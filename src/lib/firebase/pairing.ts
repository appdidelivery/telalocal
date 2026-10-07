"use client";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { getTenantContext, type ScreenRecord } from "./screens";

export type PairingAssignment = {
  screenId: string;
  playerKey: string;
  pairingEpoch: number;
};

export type PairingRequest = {
  pairId: string;
  code: string;
  status: "pending" | "paired";
  createdAtMs: number;
  expiresAtMs: number;
  screenId?: string;
  playerKey?: string;
  pairingEpoch?: number;
};

const PAIRING_TTL_MS = 10 * 60 * 1000;

function randomDigits() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

function randomPairId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPairingRequest(): Promise<PairingRequest> {
  const now = Date.now();
  const pairId = randomPairId();
  const record: PairingRequest = {
    pairId,
    code: randomDigits(),
    status: "pending",
    createdAtMs: now,
    expiresAtMs: now + PAIRING_TTL_MS,
  };

  await setDoc(doc(db, "pairRequests", pairId), record);
  return record;
}

export function subscribeToPairing(
  pairId: string,
  onPaired: (assignment: PairingAssignment) => void,
  onError?: () => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "pairRequests", pairId),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      if (
        data.status === "paired" &&
        typeof data.screenId === "string" &&
        typeof data.playerKey === "string" &&
        data.screenId &&
        data.playerKey
      ) {
        onPaired({
          screenId: data.screenId,
          playerKey: data.playerKey,
          pairingEpoch: Number(data.pairingEpoch ?? 1),
        });
      }
    },
    () => onError?.()
  );
}

export async function claimPairing(
  code: string,
  screen: ScreenRecord
): Promise<void> {
  const normalized = code.replace(/\D/g, "").slice(0, 6);
  if (normalized.length !== 6) {
    throw Object.assign(new Error("Digite os 6 números exibidos na TV."), {
      code: "pairing/invalid-code",
    });
  }

  const context = await getTenantContext();
  const snapshot = await getDocs(
    query(collection(db, "pairRequests"), where("code", "==", normalized))
  );

  const now = Date.now();
  const candidates = snapshot.docs
    .map((item) => ({ ref: item.ref, data: item.data() }))
    .filter(
      (item) =>
        item.data.status === "pending" &&
        Number(item.data.expiresAtMs ?? 0) > now
    )
    .sort(
      (a, b) =>
        Number(b.data.createdAtMs ?? 0) - Number(a.data.createdAtMs ?? 0)
    );

  const request = candidates[0];
  if (!request) {
    throw Object.assign(
      new Error("Código não encontrado ou expirado. Gere um novo código na TV."),
      { code: "pairing/not-found" }
    );
  }

  if (!screen.playerKey) {
    throw Object.assign(new Error("Essa tela ainda não possui chave de player."), {
      code: "pairing/screen-key-missing",
    });
  }

  await updateDoc(request.ref, {
    status: "paired",
    tenantId: context.tenantId,
    ownerUid: context.ownerUid,
    screenId: screen.id,
    playerKey: screen.playerKey,
    pairingEpoch: Number(screen.pairingEpoch ?? 1),
    pairedAtMs: now,
  });
}
