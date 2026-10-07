"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./client";
import { getTenantContext, listScreens, type ScreenRecord } from "./screens";
import type { CampaignRecord } from "./campaigns";
import { PLAN_LIMITS } from "@/lib/plans";

export type PlayerManifestItem = {
  campaignId: string;
  name: string;
  advertiserName: string;
  mediaUrl: string;
  mediaPath: string;
  mediaType: "video" | "image";
  durationSeconds: number;
  slotSeconds?: 15 | 30;
  transition: "fade";
  conversionPath?: string;
  whatsappNumber?: string;
  couponCode?: string;
  offerText?: string;
  scheduleEnabled?: boolean;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  scheduleDays?: number[];
  scheduleStartTime?: string;
  scheduleEndTime?: string;
};

export type PlayerManifest = {
  schemaVersion: 1;
  version: number;
  tenantId: string;
  screenId: string;
  generatedAt: string;
  playerStatus: "active" | "paused";
  pairingEpoch: number;
  syncNonce: number;
  items: PlayerManifestItem[];
};

function conversionToken(screen: ScreenRecord, campaign: CampaignRecord) {
  const screenPart = String(screen.shortCode || screen.id.slice(0, 6))
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  const campaignPart = campaign.id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toLowerCase();

  return `${screenPart}${campaignPart}`;
}

function normalized(value?: string) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

function digitsOnly(value?: string) {
  return String(value ?? "").replace(/\D/g, "");
}

export function campaignMatchesScreen(
  campaign: CampaignRecord,
  screen: ScreenRecord
) {
  const mode = campaign.targetMode ?? "all";

  if (mode === "all") return true;

  if (mode === "category") {
    return (campaign.targetCategories ?? []).some(
      (value) => normalized(value) === normalized(screen.category)
    );
  }

  if (mode === "city") {
    return (campaign.targetCities ?? []).some(
      (value) => normalized(value) === normalized(screen.city)
    );
  }

  if (mode === "zip") {
    return (campaign.targetZipCodes ?? []).some(
      (value) => digitsOnly(value) === digitsOnly(screen.zipCode)
    );
  }

  if (mode === "screens") {
    return (campaign.targetScreenIds ?? []).includes(screen.id);
  }

  return false;
}

export async function loadPlaylistEditorData(): Promise<{
  screens: ScreenRecord[];
  campaigns: CampaignRecord[];
}> {
  const context = await getTenantContext();

  const [screens, campaignSnapshot] = await Promise.all([
    listScreens(context),
    getDocs(
      query(
        collection(db, "tenants", context.tenantId, "campaigns"),
        where("ownerUid", "==", context.ownerUid)
      )
    ),
  ]);

  const campaigns = campaignSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() } as CampaignRecord))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

  return { screens, campaigns };
}

export async function publishPlaylist(
  screen: ScreenRecord,
  campaigns: CampaignRecord[]
) {
  if (campaigns.length === 0) {
    throw Object.assign(new Error("A playlist precisa ter pelo menos uma campanha."), {
      code: "playlist/empty",
    });
  }

  if (campaigns.length > PLAN_LIMITS.pilot.playlistItems) {
    throw Object.assign(
      new Error(
        `O plano piloto permite até ${PLAN_LIMITS.pilot.playlistItems} mídias por playlist.`
      ),
      { code: "playlist/plan-limit" }
    );
  }

  const context = await getTenantContext();
  const version = Date.now();

  const manifestItems = campaigns.map((campaign) => {
    const token = conversionToken(screen, campaign);

    return {
      campaignId: campaign.id,
      name: campaign.name,
      advertiserName: campaign.advertiserName,
      mediaUrl: campaign.mediaUrl,
      mediaPath: campaign.mediaPath,
      mediaType:
        campaign.mediaType === "image" ? ("image" as const) : ("video" as const),
      durationSeconds: campaign.durationSeconds,
      slotSeconds: campaign.slotSeconds,
      transition: "fade" as const,
      conversionPath: `/r/${token}`,
      whatsappNumber: campaign.whatsappNumber || "",
      couponCode: campaign.couponCode || "",
      offerText: campaign.offerText || "",
      scheduleEnabled: Boolean(campaign.scheduleEnabled),
      scheduleStartDate: campaign.scheduleStartDate || "",
      scheduleEndDate: campaign.scheduleEndDate || "",
      scheduleDays: campaign.scheduleDays || [],
      scheduleStartTime: campaign.scheduleStartTime || "",
      scheduleEndTime: campaign.scheduleEndTime || "",
    };
  });

  const manifest: PlayerManifest = {
    schemaVersion: 1,
    version,
    tenantId: context.tenantId,
    screenId: screen.id,
    generatedAt: new Date().toISOString(),
    playerStatus: screen.status === "paused" ? "paused" : "active",
    pairingEpoch: Number(screen.pairingEpoch ?? 1),
    syncNonce: version,
    items: manifestItems,
  };

  const playlistRef = doc(
    db,
    "tenants",
    context.tenantId,
    "playlists",
    screen.id
  );
  const screenRef = doc(db, "tenants", context.tenantId, "screens", screen.id);
  const publicManifestRef = doc(db, "playerManifests", screen.id);

  const batch = writeBatch(db);

  batch.set(
    playlistRef,
    {
      tenantId: context.tenantId,
      ownerUid: context.ownerUid,
      screenId: screen.id,
      campaignIds: campaigns.map((campaign) => campaign.id),
      manifestSource: "firestore",
      manifestVersion: version,
      status: "published",
      updatedAt: serverTimestamp(),
      publishedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.update(screenRef, {
    manifestVersion: version,
    playlistStatus: "published",
    updatedAt: serverTimestamp(),
  });

  batch.set(publicManifestRef, {
    ...manifest,
    ownerUid: context.ownerUid,
    status: "published",
    updatedAt: serverTimestamp(),
  });

  campaigns.forEach((campaign) => {
    const token = conversionToken(screen, campaign);

    batch.set(
      doc(db, "conversionLinks", token),
      {
        token,
        tenantId: context.tenantId,
        ownerUid: context.ownerUid,
        screenId: screen.id,
        screenName: screen.screenName,
        pointName: screen.pointName,
        campaignId: campaign.id,
        campaignName: campaign.name,
        advertiserName: campaign.advertiserName,
        whatsappNumber: campaign.whatsappNumber || "",
        couponCode: campaign.couponCode || "",
        offerText: campaign.offerText || "",
        status: "active",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();

  return manifest;
}

export async function publishSegmentedPlaylists(
  screens: ScreenRecord[],
  campaigns: CampaignRecord[]
) {
  const results: Array<{ screenId: string; count: number }> = [];

  for (const screen of screens) {
    const matches = campaigns.filter((campaign) =>
      campaignMatchesScreen(campaign, screen)
    );

    if (matches.length === 0) continue;

    await publishPlaylist(screen, matches.slice(0, PLAN_LIMITS.pilot.playlistItems));
    results.push({ screenId: screen.id, count: matches.length });
  }

  return results;
}
