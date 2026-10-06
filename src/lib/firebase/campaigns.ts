"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { db, storage } from "./client";
import { getTenantContext } from "./screens";

export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

export type CampaignRecord = {
  id: string;
  name: string;
  advertiserName: string;
  mediaUrl: string;
  mediaPath: string;
  fileName: string;
  sizeBytes: number;
  durationSeconds: number;
  status: "active";
  ownerUid: string;
  tenantId: string;
  createdAt?: { seconds?: number };
};

export type CreateCampaignInput = {
  name: string;
  advertiserName: string;
  file: File;
  durationSeconds: number;
};

function safeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

export async function listCampaigns(): Promise<CampaignRecord[]> {
  const context = await getTenantContext();
  const campaignsRef = collection(db, "tenants", context.tenantId, "campaigns");
  const snapshot = await getDocs(
    query(campaignsRef, where("ownerUid", "==", context.ownerUid))
  );

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() } as CampaignRecord))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function createCampaign(
  input: CreateCampaignInput,
  onProgress?: (percent: number) => void
): Promise<CampaignRecord> {
  if (input.file.type !== "video/mp4") {
    throw new Error("storage/invalid-format");
  }

  if (input.file.size > MAX_VIDEO_BYTES) {
    throw new Error("storage/file-too-large");
  }

  const context = await getTenantContext();
  const campaignRef = doc(collection(db, "tenants", context.tenantId, "campaigns"));
  const cleanName = safeFileName(input.file.name);
  const mediaPath =
    `tenants/${context.tenantId}/owners/${context.ownerUid}/campaigns/${campaignRef.id}/${cleanName}`;

  const storageRef = ref(storage, mediaPath);
  const uploadTask = uploadBytesResumable(storageRef, input.file, {
    contentType: "video/mp4",
    cacheControl: "public,max-age=31536000,immutable",
    customMetadata: {
      tenantId: context.tenantId,
      ownerUid: context.ownerUid,
      campaignId: campaignRef.id,
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent =
          snapshot.totalBytes > 0
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
        onProgress?.(percent);
      },
      reject,
      resolve
    );
  });

  const mediaUrl = await getDownloadURL(storageRef);

  const record = {
    tenantId: context.tenantId,
    ownerUid: context.ownerUid,
    name: input.name.trim(),
    advertiserName: input.advertiserName.trim(),
    mediaUrl,
    mediaPath,
    fileName: input.file.name,
    mimeType: "video/mp4",
    sizeBytes: input.file.size,
    durationSeconds: Math.round(input.durationSeconds * 10) / 10,
    status: "active" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(campaignRef, record);

  return {
    id: campaignRef.id,
    ...record,
    createdAt: undefined,
  };
}
