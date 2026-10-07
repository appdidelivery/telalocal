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

export type PlayerManifestItem = {
  campaignId: string;
  name: string;
  advertiserName: string;
  mediaUrl: string;
  mediaPath: string;
  mediaType: "video" | "image";
  durationSeconds: number;
  transition: "fade";
  conversionPath?: string;
  whatsappNumber?: string;
  couponCode?: string;
  offerText?: string;
};

export type PlayerManifest = {
  schemaVersion: 1;
  version: number;
  tenantId: string;
  screenId: string;
  generatedAt: string;
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
      mediaType: campaign.mediaType === "image" ? "image" as const : "video" as const,
      durationSeconds: campaign.durationSeconds,
      transition: "fade" as const,
      conversionPath: `/r/${token}`,
      whatsappNumber: campaign.whatsappNumber || "",
      couponCode: campaign.couponCode || "",
      offerText: campaign.offerText || "",
    };
  });

  const manifest: PlayerManifest = {
    schemaVersion: 1,
    version,
    tenantId: context.tenantId,
    screenId: screen.id,
    generatedAt: new Date().toISOString(),
    items: manifestItems,
  };

  const playlistRef = doc(
    db,
    "tenants",
    context.tenantId,
    "playlists",
    screen.id
  );
  const screenRef = doc(
    db,
    "tenants",
    context.tenantId,
    "screens",
    screen.id
  );
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
