import {
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type PlayerManifestItem = {
  campaignId: string;
  name: string;
  advertiserName: string;
  mediaUrl: string;
  mediaPath: string;
  mediaType?: "video" | "image";
  durationSeconds: number;
  transition?: "fade";
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

type ProofLog = {
  id: string;
  screenId: string;
  campaignId: string;
  manifestVersion: number;
  playedAt: string;
  batchId?: string;
  batchCreatedAt?: string;
};

const DB_NAME = "telalocal-player";
const DB_VERSION = 1;
const MANIFEST_STORE = "manifests";
const LOG_STORE = "proof-of-play";
const MEDIA_CACHE = "telalocal-media-v1";
const LAST_SYNC_PREFIX = "telalocal:proof-last-sync:";
const SYNC_INTERVAL_MS = 60 * 60 * 1000;

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

function randomBatchId(screenId: string) {
  const suffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${screenId}_${Date.now()}_${suffix}`;
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

export function subscribeToManifest(
  screenId: string,
  onManifest: (manifest: PlayerManifest) => void,
  onError?: () => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "playerManifests", screenId),
    (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      onManifest({
        schemaVersion: 1,
        version: Number(data.version),
        tenantId: String(data.tenantId ?? ""),
        screenId: String(data.screenId),
        generatedAt: String(data.generatedAt),
        items: Array.isArray(data.items) ? data.items : [],
      });
    },
    () => onError?.()
  );
}

export async function queueProofOfPlay(input: {
  screenId: string;
  campaignId: string;
  manifestVersion: number;
}) {
  const db = await openDb();
  const now = Date.now();
  const record: ProofLog = {
    id: `${input.screenId}:${input.campaignId}:${now}:${Math.random()
      .toString(36)
      .slice(2)}`,
    ...input,
    playedAt: new Date(now).toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOG_STORE, "readwrite");
    tx.objectStore(LOG_STORE).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readProofLogs() {
  const db = await openDb();
  const logs = await new Promise<ProofLog[]>((resolve, reject) => {
    const tx = db.transaction(LOG_STORE, "readonly");
    const request = tx.objectStore(LOG_STORE).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as ProofLog[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return logs;
}

async function assignBatch(logs: ProofLog[], batchId: string, batchCreatedAt: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOG_STORE, "readwrite");
    const store = tx.objectStore(LOG_STORE);

    for (const log of logs) {
      store.put({ ...log, batchId, batchCreatedAt });
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function deleteProofLogs(ids: string[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOG_STORE, "readwrite");
    const store = tx.objectStore(LOG_STORE);

    for (const id of ids) store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function nextProofBatch(screenId: string) {
  const all = (await readProofLogs())
    .filter((log) => log.screenId === screenId)
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt));

  if (all.length === 0) return null;

  const alreadyClaimed = all.find((log) => log.batchId);
  if (alreadyClaimed?.batchId) {
    return {
      batchId: alreadyClaimed.batchId,
      batchCreatedAt:
        alreadyClaimed.batchCreatedAt ?? alreadyClaimed.playedAt,
      logs: all.filter((log) => log.batchId === alreadyClaimed.batchId),
    };
  }

  const date = all[0].playedAt.slice(0, 10);
  const logs = all.filter(
    (log) => !log.batchId && log.playedAt.slice(0, 10) === date
  );
  const batchId = randomBatchId(screenId);
  const batchCreatedAt = new Date().toISOString();

  await assignBatch(logs, batchId, batchCreatedAt);

  return { batchId, batchCreatedAt, logs };
}

function canSyncProof(screenId: string) {
  try {
    const last = Number(
      window.localStorage.getItem(`${LAST_SYNC_PREFIX}${screenId}`) ?? "0"
    );
    return !last || Date.now() - last >= SYNC_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markProofSynced(screenId: string) {
  try {
    window.localStorage.setItem(
      `${LAST_SYNC_PREFIX}${screenId}`,
      String(Date.now())
    );
  } catch {}
}

export async function syncProofOfPlay(input: {
  tenantId: string;
  screenId: string;
  playerKey: string;
  force?: boolean;
}) {
  if (!navigator.onLine || !input.tenantId || !input.playerKey) {
    return { synced: 0 };
  }

  if (!input.force && !canSyncProof(input.screenId)) {
    return { synced: 0 };
  }

  let synced = 0;

  while (true) {
    const batch = await nextProofBatch(input.screenId);
    if (!batch) break;

    const campaignCounts: Record<string, number> = {};
    let manifestVersion = 0;

    for (const log of batch.logs) {
      campaignCounts[log.campaignId] =
        (campaignCounts[log.campaignId] ?? 0) + 1;
      manifestVersion = Math.max(manifestVersion, log.manifestVersion);
    }

    const firstPlayedAt = batch.logs[0].playedAt;
    const lastPlayedAt = batch.logs[batch.logs.length - 1].playedAt;
    const date = firstPlayedAt.slice(0, 10);

    const record = {
      tenantId: input.tenantId,
      screenId: input.screenId,
      playerKey: input.playerKey,
      batchId: batch.batchId,
      date,
      totalPlays: batch.logs.length,
      campaignCounts,
      manifestVersion,
      firstPlayedAt,
      lastPlayedAt,
      batchCreatedAt: batch.batchCreatedAt,
    };

    await setDoc(
      doc(
        db,
        "tenants",
        input.tenantId,
        "proofBatches",
        batch.batchId
      ),
      record
    );

    await deleteProofLogs(batch.logs.map((log) => log.id));
    synced += batch.logs.length;
  }

  if (synced > 0) markProofSynced(input.screenId);

  return { synced };
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
