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

function playerDiagnostics() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      browserFamily: "unknown",
      browserVersion: "",
      compatMode: false,
      supportsServiceWorker: false,
      supportsIndexedDb: false,
      supportsCacheStorage: false,
      supportsFullscreen: false,
      h264Support: "",
      platform: "",
    };
  }

  const ua = navigator.userAgent || "";
  const chrome = ua.match(/(?:Chrome|CriOS)\/(\d+)/i);
  const firefox = ua.match(/Firefox\/(\d+)/i);
  const samsung = ua.match(/SamsungBrowser\/(\d+)/i);
  const webview = /;\s*wv\)/i.test(ua) || /Version\/4\.0.*Chrome/i.test(ua);
  const android = /Android/i.test(ua);
  const tvLike = /(TV|SMART-TV|SmartTV|BRAVIA|AFT|Web0S|Tizen)/i.test(ua);

  let browserFamily = "browser";
  let browserVersion = "";

  if (samsung) {
    browserFamily = "Samsung Internet";
    browserVersion = samsung[1];
  } else if (chrome) {
    browserFamily = webview ? "Android WebView" : "Chromium";
    browserVersion = chrome[1];
  } else if (firefox) {
    browserFamily = "Firefox";
    browserVersion = firefox[1];
  }

  const video = document.createElement("video");
  const h264Support = video.canPlayType(
    'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
  );

  const chromeMajor = chrome ? Number(chrome[1]) : 0;
  const compatMode =
    webview ||
    (android && chromeMajor > 0 && chromeMajor < 90) ||
    (!("indexedDB" in window) && tvLike);

  return {
    browserFamily,
    browserVersion,
    compatMode,
    supportsServiceWorker: "serviceWorker" in navigator,
    supportsIndexedDb: "indexedDB" in window,
    supportsCacheStorage: "caches" in window,
    supportsFullscreen: Boolean(
      document.documentElement.requestFullscreen ||
      (document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => void;
      }).webkitRequestFullscreen
    ),
    h264Support: h264Support || "no",
    platform: String(navigator.platform || "").slice(0, 80),
  };
}

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
      appVersion: "mvp-2",
      ...playerDiagnostics(),
    },
    { merge: true }
  );
}
