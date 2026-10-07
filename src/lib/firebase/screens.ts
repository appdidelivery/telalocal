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
  city: string;
  state: string;
  status: "active" | "paused";
  playerPath: string;
  playerKey?: string;
  shortCode?: string;
  createdAt?: { seconds?: number };
};

export type CreateScreenInput = {
  pointName: string;
  screenName: string;
  category: string;
  address: string;
  city: string;
  state: string;
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
  const screensRef = collection(db, "tenants", context.tenantId, "screens");
  const snapshot = await getDocs(
    query(screensRef, where("ownerUid", "==", context.ownerUid))
  );

  const batch = writeBatch(db);
  let migrations = 0;

  const screens = snapshot.docs.map((item) => {
    const data = item.data();
    const existingKey = String(data.playerKey ?? "");
    const playerKey = existingKey || createPlayerKey();
    const existingShortCode = String(data.shortCode ?? "");
    const shortCode = existingShortCode || shortCodeForScreen(item.id);
    const playerPath = shortPlayerPath(shortCode);

    if (
      !existingKey ||
      !existingShortCode ||
      data.playerPath !== playerPath
    ) {
      batch.update(item.ref, {
        playerKey,
        shortCode,
        playerPath,
        updatedAt: serverTimestamp(),
      });

      batch.set(
        doc(db, "screenAliases", shortCode),
        {
          tenantId: context.tenantId,
          ownerUid: context.ownerUid,
          screenId: item.id,
          playerKey,
          status: "active",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      migrations += 1;
    }

    return {
      id: item.id,
      ...data,
      playerKey,
      shortCode,
      playerPath,
    } as ScreenRecord;
  });

  if (migrations > 0) {
    await batch.commit();
  }

  return screens.sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
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
  });

  batch.set(screenRef, {
    ...shared,
    pointId: pointRef.id,
    pointName: input.pointName.trim(),
    screenName: input.screenName.trim(),
    category: input.category.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    playerKey,
    shortCode,
    playerPath,
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

  await batch.commit();

  return {
    id: screenRef.id,
    pointId: pointRef.id,
    pointName: input.pointName.trim(),
    screenName: input.screenName.trim(),
    category: input.category.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    status: "active",
    playerKey,
    shortCode,
    playerPath,
  };
}
