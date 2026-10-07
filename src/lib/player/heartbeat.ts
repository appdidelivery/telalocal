"use client";

import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type PlayerHeartbeatInput = {
  tenantId: string;
  screenId: string;
  playerKey: string;
  playerState: "active" | "paused" | "waiting";
  currentCampaignId?: string;
  currentCampaignName?: string;
  manifestVersion?: number;
  mediaCount?: number;
};

export async function sendPlayerHeartbeat(input: PlayerHeartbeatInput) {
  if (!input.tenantId || !input.screenId || !input.playerKey) return;

  await setDoc(
    doc(db, "tenants", input.tenantId, "heartbeats", input.screenId),
    {
      tenantId: input.tenantId,
      screenId: input.screenId,
      playerKey: input.playerKey,
      playerState: input.playerState,
      currentCampaignId: input.currentCampaignId || "",
      currentCampaignName: input.currentCampaignName || "",
      manifestVersion: Number(input.manifestVersion || 0),
      mediaCount: Number(input.mediaCount || 0),
      lastSeenAtMs: Date.now(),
      online: true,
      userAgent:
        typeof navigator !== "undefined"
          ? navigator.userAgent.slice(0, 220)
          : "",
      viewport:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : "",
      appVersion: "mvp-1",
    },
    { merge: true }
  );
}
