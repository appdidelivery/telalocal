"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./client";
import { getTenantContext } from "./screens";
import {
  uploadImageToCloudinary,
  uploadVideoToCloudinary,
} from "@/lib/media/cloudinary";

export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export type CampaignRecord = {
  id: string;
  name: string;
  advertiserName: string;
  mediaUrl: string;
  mediaPath: string;
  mediaProvider?: "cloudinary" | "firebase";
  mediaType?: "video" | "image";
  mimeType?: string;
  templateId?: string;
  fileName: string;
  sizeBytes: number;
  durationSeconds: number;
  whatsappNumber?: string;
  couponCode?: string;
  offerText?: string;
  trackingEnabled?: boolean;
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
  whatsappNumber?: string;
  couponCode?: string;
  offerText?: string;
};

export type CreateImageCampaignInput = {
  name: string;
  advertiserName: string;
  file: File;
  durationSeconds: number;
  templateId?: string;
  whatsappNumber?: string;
  couponCode?: string;
  offerText?: string;
};

function digitsOnly(value?: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizedTracking(input: {
  whatsappNumber?: string;
  couponCode?: string;
  offerText?: string;
}) {
  const whatsappNumber = digitsOnly(input.whatsappNumber);
  const couponCode = String(input.couponCode ?? "").trim().toUpperCase();
  const offerText = String(input.offerText ?? "").trim();

  return {
    whatsappNumber,
    couponCode,
    offerText,
    trackingEnabled: Boolean(whatsappNumber || couponCode || offerText),
  };
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
    throw Object.assign(new Error("Use um arquivo MP4."), {
      code: "media/invalid-format",
    });
  }

  if (input.file.size > MAX_VIDEO_BYTES) {
    throw Object.assign(
      new Error("O MP4 deve ter no máximo 60 MB neste MVP."),
      { code: "media/file-too-large" }
    );
  }

  const context = await getTenantContext();
  const campaignRef = doc(
    collection(db, "tenants", context.tenantId, "campaigns")
  );

  const upload = await uploadVideoToCloudinary(
    input.file,
    `telalocal/${context.tenantId}/campaigns/${campaignRef.id}`,
    onProgress
  );

  const durationSeconds =
    upload.duration && upload.duration > 0
      ? upload.duration
      : input.durationSeconds;

  const tracking = normalizedTracking(input);

  const record = {
    tenantId: context.tenantId,
    ownerUid: context.ownerUid,
    name: input.name.trim(),
    advertiserName: input.advertiserName.trim(),
    mediaUrl: upload.secureUrl,
    mediaPath: upload.publicId,
    mediaProvider: "cloudinary" as const,
    mediaType: "video" as const,
    fileName: input.file.name,
    mimeType: "video/mp4",
    sizeBytes: upload.bytes || input.file.size,
    durationSeconds: Math.round(durationSeconds * 10) / 10,
    ...tracking,
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

export async function createImageCampaign(
  input: CreateImageCampaignInput,
  onProgress?: (percent: number) => void
): Promise<CampaignRecord> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(input.file.type)) {
    throw Object.assign(new Error("Use PNG, JPG ou WebP."), {
      code: "media/invalid-format",
    });
  }

  if (input.file.size > MAX_IMAGE_BYTES) {
    throw Object.assign(
      new Error("A imagem deve ter no máximo 12 MB."),
      { code: "media/file-too-large" }
    );
  }

  const context = await getTenantContext();
  const campaignRef = doc(
    collection(db, "tenants", context.tenantId, "campaigns")
  );

  const upload = await uploadImageToCloudinary(
    input.file,
    `telalocal/${context.tenantId}/campaigns/${campaignRef.id}`,
    onProgress
  );

  const tracking = normalizedTracking(input);
  const durationSeconds = Math.max(4, Math.min(30, input.durationSeconds || 8));

  const record = {
    tenantId: context.tenantId,
    ownerUid: context.ownerUid,
    name: input.name.trim(),
    advertiserName: input.advertiserName.trim(),
    mediaUrl: upload.secureUrl,
    mediaPath: upload.publicId,
    mediaProvider: "cloudinary" as const,
    mediaType: "image" as const,
    templateId: input.templateId || "custom",
    fileName: input.file.name,
    mimeType: input.file.type,
    sizeBytes: upload.bytes || input.file.size,
    durationSeconds,
    ...tracking,
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

export async function updateCampaignTracking(
  campaignId: string,
  input: {
    whatsappNumber?: string;
    couponCode?: string;
    offerText?: string;
  }
) {
  const context = await getTenantContext();
  const tracking = normalizedTracking(input);

  await updateDoc(
    doc(db, "tenants", context.tenantId, "campaigns", campaignId),
    {
      ...tracking,
      updatedAt: serverTimestamp(),
    }
  );

  return tracking;
}
