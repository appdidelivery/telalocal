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
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./client";
import { getTenantContext, listScreens, type ScreenRecord } from "./screens";
import type { CampaignRecord } from "./campaigns";

export type PlayerManifestItem = {
  campaignId: string;
  name: string;
  advertiserName: string;
  mediaUrl: string;
  mediaPath: string;
  durationSeconds: number;
};

export type PlayerManifest = {
  schemaVersion: 1;
  version: number;
  screenId: string;
  generatedAt: string;
  items: PlayerManifestItem[];
};

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
    throw new Error("playlist/empty");
  }

  const context = await getTenantContext();
  const version = Date.now();

  const manifest: PlayerManifest = {
    schemaVersion: 1,
    version,
    screenId: screen.id,
    generatedAt: new Date().toISOString(),
    items: campaigns.map((campaign) => ({
      campaignId: campaign.id,
      name: campaign.name,
      advertiserName: campaign.advertiserName,
      mediaUrl: campaign.mediaUrl,
      mediaPath: campaign.mediaPath,
      durationSeconds: campaign.durationSeconds,
    })),
  };

  const manifestPath = `manifests/${screen.id}/current.json`;
  const manifestRef = ref(storage, manifestPath);
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));

  await uploadBytes(manifestRef, bytes, {
    contentType: "application/json",
    cacheControl: "no-store,max-age=0",
    customMetadata: {
      ownerUid: context.ownerUid,
      tenantId: context.tenantId,
      screenId: screen.id,
      version: String(version),
    },
  });

  const playlistRef = doc(db, "tenants", context.tenantId, "playlists", screen.id);
  const screenRef = doc(db, "tenants", context.tenantId, "screens", screen.id);
  const batch = writeBatch(db);

  batch.set(
    playlistRef,
    {
      tenantId: context.tenantId,
      ownerUid: context.ownerUid,
      screenId: screen.id,
      campaignIds: campaigns.map((campaign) => campaign.id),
      manifestPath,
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

  await batch.commit();

  return manifest;
}
