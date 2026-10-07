"use client";

import {
  collection,
  doc,
  getCountFromServer,
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
import { PLAN_LIMITS } from "@/lib/plans";

export const MAX_VIDEO_BYTES = PLAN_LIMITS.pilot.videoBytes;
export const MAX_IMAGE_BYTES = PLAN_LIMITS.pilot.imageBytes;

export type CampaignTargetMode = "all" | "category" | "city" | "zip" | "screens";

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
  slotSeconds?: 15 | 30;
  budgetCredits?: number;
  whatsappNumber?: string;
  couponCode?: string;
  offerText?: string;
  trackingEnabled?: boolean;
  scheduleEnabled?: boolean;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  scheduleDays?: number[];
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  targetMode?: CampaignTargetMode;
  targetCategories?: string[];
  targetCities?: string[];
  targetZipCodes?: string[];
  targetScreenIds?: string[];
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

export type CampaignDeliveryInput = {
  slotSeconds: 15 | 30;
  budgetCredits: number;
  scheduleEnabled: boolean;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  scheduleDays?: number[];
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  targetMode: CampaignTargetMode;
  targetCategories?: string[];
  targetCities?: string[];
  targetZipCodes?: string[];
  targetScreenIds?: string[];
};

function digitsOnly(value?: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function cleanList(values?: string[]) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
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

function defaultDelivery(durationSeconds: number) {
  return {
    slotSeconds: (durationSeconds <= 15 ? 15 : 30) as 15 | 30,
    budgetCredits: 10,
    scheduleEnabled: false,
    scheduleStartDate: "",
    scheduleEndDate: "",
    scheduleDays: [] as number[],
    scheduleStartTime: "",
    scheduleEndTime: "",
    targetMode: "all" as CampaignTargetMode,
    targetCategories: [] as string[],
    targetCities: [] as string[],
    targetZipCodes: [] as string[],
    targetScreenIds: [] as string[],
  };
}


async function ensureCampaignLimit() {
  const context = await getTenantContext();
  const count = await getCountFromServer(
    query(
      collection(db, "tenants", context.tenantId, "campaigns"),
      where("ownerUid", "==", context.ownerUid)
    )
  );

  if (count.data().count >= PLAN_LIMITS.pilot.campaigns) {
    throw Object.assign(
      new Error(
        `O plano piloto permite até ${PLAN_LIMITS.pilot.campaigns} campanhas.`
      ),
      { code: "campaign/plan-limit" }
    );
  }

  return context;
}


export async function listCampaigns(): Promise<CampaignRecord[]> {
  const context = await getTenantContext();
  const snapshot = await getDocs(
    query(
      collection(db, "tenants", context.tenantId, "campaigns"),
      where("ownerUid", "==", context.ownerUid)
    )
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

  const context = await ensureCampaignLimit();
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
  const delivery = defaultDelivery(durationSeconds);

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
    ...delivery,
    status: "active" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(campaignRef, record);

  return { id: campaignRef.id, ...record, createdAt: undefined };
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
    throw Object.assign(new Error("A imagem deve ter no máximo 12 MB."), {
      code: "media/file-too-large",
    });
  }

  const context = await ensureCampaignLimit();
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
  const delivery = defaultDelivery(durationSeconds);

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
    ...delivery,
    status: "active" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(campaignRef, record);

  return { id: campaignRef.id, ...record, createdAt: undefined };
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
    { ...tracking, updatedAt: serverTimestamp() }
  );

  return tracking;
}

export async function updateCampaignDelivery(
  campaignId: string,
  input: CampaignDeliveryInput
) {
  const context = await getTenantContext();

  const delivery = {
    slotSeconds: input.slotSeconds,
    budgetCredits: Math.max(
      0,
      Math.min(PLAN_LIMITS.pilot.monthlyCredits, Number(input.budgetCredits || 0))
    ),
    scheduleEnabled: Boolean(input.scheduleEnabled),
    scheduleStartDate: String(input.scheduleStartDate ?? ""),
    scheduleEndDate: String(input.scheduleEndDate ?? ""),
    scheduleDays: (input.scheduleDays ?? []).filter(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6
    ),
    scheduleStartTime: String(input.scheduleStartTime ?? ""),
    scheduleEndTime: String(input.scheduleEndTime ?? ""),
    targetMode: input.targetMode,
    targetCategories: cleanList(input.targetCategories),
    targetCities: cleanList(input.targetCities),
    targetZipCodes: cleanList(input.targetZipCodes).map(digitsOnly),
    targetScreenIds: cleanList(input.targetScreenIds),
  };

  await updateDoc(
    doc(db, "tenants", context.tenantId, "campaigns", campaignId),
    { ...delivery, updatedAt: serverTimestamp() }
  );

  return delivery;
}
