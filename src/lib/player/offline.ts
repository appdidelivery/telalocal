import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

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

const DB_NAME = "telalocal-player";
const DB_VERSION = 1;
const MANIFEST_STORE = "manifests";
const LOG_STORE = "proof-of-play";
const MEDIA_CACHE = "telalocal-media-v1";
const MANIFEST_CHECK_PREFIX = "telalocal:manifest-check:";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MANIFEST_STORE)) {
        db.createObjectStore(MANIFEST_STORE);
      }
      if (!db.objectStoreNames.contains(LOG_STORE)) {
        db.createObjectStore(LOG_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function currentDayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function wasManifestCheckedToday(screenId: string) {
  try {
    return (
      window.localStorage.getItem(`${MANIFEST_CHECK_PREFIX}${screenId}`) ===
      currentDayKey()
    );
  } catch {
    return false;
  }
}

export function markManifestCheckedToday(screenId: string) {
  try {
    window.localStorage.setItem(
      `${MANIFEST_CHECK_PREFIX}${screenId}`,
      currentDayKey()
    );
  } catch {
    // TVs com storage restrito continuam funcionando sem essa otimização.
  }
}

export async function saveManifest(manifest: PlayerManifest) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MANIFEST_STORE, "readwrite");
    tx.objectStore(MANIFEST_STORE).put(manifest, manifest.screenId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function readManifest(screenId: string) {
  const db = await openDb();
  const result = await new Promise<PlayerManifest | undefined>((resolve, reject) => {
    const tx = db.transaction(MANIFEST_STORE, "readonly");
    const request = tx.objectStore(MANIFEST_STORE).get(screenId);
    request.onsuccess = () => resolve(request.result as PlayerManifest | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function queueProofOfPlay(input: {
  screenId: string;
  campaignId: string;
  manifestVersion: number;
}) {
  const db = await openDb();
  const now = Date.now();
  const record = {
    id: `${input.screenId}:${input.campaignId}:${now}:${Math.random()
      .toString(36)
      .slice(2)}`,
    ...input,
    playedAt: new Date(now).toISOString(),
    synced: false,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOG_STORE, "readwrite");
    tx.objectStore(LOG_STORE).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheManifestMedia(manifest: PlayerManifest) {
  if (!("caches" in window)) return;

  const cache = await caches.open(MEDIA_CACHE);

  await Promise.all(
    manifest.items.map(async (item) => {
      const hit = await cache.match(item.mediaUrl);
      if (hit) return;

      const response = await fetch(item.mediaUrl, { mode: "cors" });
      if (!response.ok) {
        throw new Error(`media/cache-failed:${item.campaignId}`);
      }
      await cache.put(item.mediaUrl, response.clone());
    })
  );
}

export async function getPlayableUrl(mediaUrl: string) {
  if (!("caches" in window)) return mediaUrl;

  const cache = await caches.open(MEDIA_CACHE);
  const response = await cache.match(mediaUrl);

  if (!response) return mediaUrl;

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function fetchLatestManifest(screenId: string) {
  const snapshot = await getDoc(doc(db, "playerManifests", screenId));

  if (!snapshot.exists()) {
    throw new Error("manifest/not-found");
  }

  const data = snapshot.data();

  return {
    schemaVersion: 1,
    version: Number(data.version),
    screenId: String(data.screenId),
    generatedAt: String(data.generatedAt),
    items: Array.isArray(data.items) ? data.items : [],
  } as PlayerManifest;
}
