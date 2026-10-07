"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./client";

export type ScreenRecord = {
  id: string;
  pointId: string;
  pointName: string;
  screenName: string;
  category: string;
  address?: string;
  city: string;
  state: string;
  zipCode?: string;
  status: "active" | "paused";
  playerPath: string;
  playerKey?: string;
  shortCode?: string;
  pairingEpoch?: number;
  manifestVersion?: number;
  playlistStatus?: "empty" | "published";
  createdAt?: { seconds?: number };
};

export type HeartbeatRecord = {
  screenId: string;
  playerState: "active" | "paused" | "waiting";
  currentCampaignId?: string;
  currentCampaignName?: string;
  manifestVersion?: number;
  mediaCount?: number;
  lastSeenAtMs: number;
  online?: boolean;
  userAgent?: string;
  viewport?: string;
  appVersion?: string;
};

export type CreateScreenInput = {
  pointName: string;
  screenName: string;
  category: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
};

export type TenantContext = {
  tenantId: string;
  ownerUid: string;
};

const CACHE_KEY = "telalocal:tenant-context";

function createPlayerKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function shortCodeForScreen(screenId: string) {
  const clean = screenId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (clean.slice(0, 6) || "TELA01").padEnd(6, "X");
}

function shortPlayerPath(shortCode: string) {
  return `/t/${shortCode}`;
}

function digitsOnly(value?: string) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function getTenantContext(): Promise<TenantContext> {
  const user = auth.currentUser;
  if (!user) throw new Error("auth/not-authenticated");

  if (typeof window !== "undefined") {
    const cached = window.sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TenantContext;
        if (parsed.ownerUid === user.uid && parsed.tenantId) return parsed;
      } catch {}
    }
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) throw new Error("firestore/profile-not-found");

  const tenantId = String(userSnap.data().tenantId ?? "");
  if (!tenantId) throw new Error("firestore/tenant-not-found");

  const context = { tenantId, ownerUid: user.uid };
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(context));
  }
  return context;
}

export async function listScreens(context: TenantContext): Promise<ScreenRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "tenants", context.tenantId, "screens"),
      where("ownerUid", "==", context.ownerUid)
    )
  );

  const batch = writeBatch(db);
  let migrations = 0;

  const screens = snapshot.docs.map((item) => {
    const data = item.data();
    const playerKey = String(data.playerKey ?? "") || createPlayerKey();
    const shortCode =
      String(data.shortCode ?? "") || shortCodeForScreen(item.id);
    const playerPath = shortPlayerPath(shortCode);
    const pairingEpoch = Number(data.pairingEpoch ?? 1) || 1;
    const zipCode = digitsOnly(String(data.zipCode ?? ""));

    if (
      !data.playerKey ||
      !data.shortCode ||
      data.playerPath !== playerPath ||
      !data.pairingEpoch ||
      !data.inventoryVersion
    ) {
      batch.update(item.ref, {
        playerKey,
        shortCode,
        playerPath,
        pairingEpoch,
        inventoryVersion: 1,
        updatedAt: serverTimestamp(),
      });

      batch.set(
        doc(db, "screenAliases", shortCode),
        {
          tenantId: context.tenantId,
          ownerUid: context.ownerUid,
          screenId: item.id,
          playerKey,
          status: data.status === "paused" ? "paused" : "active",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      migrations += 1;
    }

    if (!data.inventoryVersion) {
      batch.set(
        doc(db, "networkInventory", item.id),
        {
          screenId: item.id,
          tenantId: context.tenantId,
          ownerUid: context.ownerUid,
          category: String(data.category ?? ""),
          city: String(data.city ?? ""),
          state: String(data.state ?? ""),
          zipCode,
          status: data.status === "paused" ? "paused" : "active",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      id: item.id,
      ...data,
      zipCode,
      playerKey,
      shortCode,
      playerPath,
      pairingEpoch,
    } as ScreenRecord;
  });

  if (migrations > 0) {
    await batch.commit();
  }

  return screens.sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
  );
}

export async function listHeartbeats(
  context: TenantContext
): Promise<Record<string, HeartbeatRecord>> {
  const snapshot = await getDocs(
    collection(db, "tenants", context.tenantId, "heartbeats")
  );

  const output: Record<string, HeartbeatRecord> = {};
  snapshot.forEach((item) => {
    output[item.id] = item.data() as HeartbeatRecord;
  });
  return output;
}

export function isHeartbeatOnline(
  heartbeat?: HeartbeatRecord,
  now = Date.now()
) {
  return Boolean(
    heartbeat?.lastSeenAtMs &&
      now - Number(heartbeat.lastSeenAtMs) <= 7 * 60 * 1000
  );
}

export async function createPointAndScreen(
  context: TenantContext,
  input: CreateScreenInput
): Promise<ScreenRecord> {
  const pointRef = doc(collection(db, "tenants", context.tenantId, "points"));
  const screenRef = doc(collection(db, "tenants", context.tenantId, "screens"));
  const batch = writeBatch(db);

  const playerKey = createPlayerKey();
  const shortCode = shortCodeForScreen(screenRef.id);
  const playerPath = shortPlayerPath(shortCode);
  const zipCode = digitsOnly(input.zipCode);

  const shared = {
    tenantId: context.tenantId,
    ownerUid: context.ownerUid,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(pointRef, {
    ...shared,
    name: input.pointName.trim(),
    category: input.category.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    zipCode,
  });

  batch.set(screenRef, {
    ...shared,
    pointId: pointRef.id,
    pointName: input.pointName.trim(),
    screenName: input.screenName.trim(),
    category: input.category.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    zipCode,
    playerKey,
    shortCode,
    playerPath,
    pairingEpoch: 1,
    inventoryVersion: 1,
    manifestVersion: 0,
    playlistStatus: "empty",
  });

  batch.set(doc(db, "screenAliases", shortCode), {
    tenantId: context.tenantId,
    ownerUid: context.ownerUid,
    screenId: screenRef.id,
    playerKey,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, "networkInventory", screenRef.id), {
    screenId: screenRef.id,
    tenantId: context.tenantId,
    ownerUid: context.ownerUid,
    category: input.category.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    zipCode,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    id: screenRef.id,
    pointId: pointRef.id,
    pointName: input.pointName.trim(),
    screenName: input.screenName.trim(),
    category: input.category.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    zipCode,
    status: "active",
    playerKey,
    shortCode,
    playerPath,
    pairingEpoch: 1,
    manifestVersion: 0,
    playlistStatus: "empty",
  };
}

async function updateManifestControl(
  context: TenantContext,
  screen: ScreenRecord,
  fields: Record<string, unknown>
) {
  const manifestRef = doc(db, "playerManifests", screen.id);
  const manifestSnap = await getDoc(manifestRef);
  const batch = writeBatch(db);

  batch.update(
    doc(db, "tenants", context.tenantId, "screens", screen.id),
    {
      ...fields,
      updatedAt: serverTimestamp(),
    }
  );

  if (manifestSnap.exists()) {
    batch.update(manifestRef, {
      ...fields,
      version: Date.now(),
      generatedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  }

  if (screen.shortCode) {
    batch.set(
      doc(db, "screenAliases", screen.shortCode),
      {
        status:
          fields.status === "paused"
            ? "paused"
            : fields.status === "active"
              ? "active"
              : screen.status,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  batch.set(
    doc(db, "networkInventory", screen.id),
    {
      status:
        fields.status === "paused"
          ? "paused"
          : fields.status === "active"
            ? "active"
            : screen.status,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}

export async function setScreenPlaybackStatus(
  screen: ScreenRecord,
  status: "active" | "paused"
) {
  const context = await getTenantContext();
  await updateManifestControl(context, screen, {
    status,
    playerStatus: status,
  });
}

export async function refreshScreen(screen: ScreenRecord) {
  const context = await getTenantContext();
  await updateManifestControl(context, screen, {
    syncNonce: Date.now(),
  });
}

export async function unpairScreen(screen: ScreenRecord) {
  const context = await getTenantContext();
  const pairingEpoch = Number(screen.pairingEpoch ?? 1) + 1;

  await updateManifestControl(context, screen, {
    pairingEpoch,
    syncNonce: Date.now(),
  });

  return pairingEpoch;
}
