"use client";

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./client";
import { getTenantContext } from "./screens";
import { uploadImageToCloudinary } from "@/lib/media/cloudinary";

export type BrandKit = {
  businessName: string;
  niche: string;
  whatsappNumber: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  logoPath: string;
};

export type SaveBrandKitInput = Omit<BrandKit, "logoUrl" | "logoPath"> & {
  logoFile?: File | null;
  currentLogoUrl?: string;
  currentLogoPath?: string;
};

const DEFAULT_BRAND_KIT: BrandKit = {
  businessName: "",
  niche: "Outro",
  whatsappNumber: "",
  primaryColor: "#38e0a3",
  secondaryColor: "#0b6b51",
  logoUrl: "",
  logoPath: "",
};

function digitsOnly(value?: string) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function loadBrandKit(): Promise<BrandKit> {
  const context = await getTenantContext();
  const tenantSnap = await getDoc(doc(db, "tenants", context.tenantId));

  if (!tenantSnap.exists()) return DEFAULT_BRAND_KIT;

  const data = tenantSnap.data();
  const brand = (data.brandKit ?? {}) as Partial<BrandKit>;

  return {
    businessName: String(brand.businessName ?? data.name ?? ""),
    niche: String(brand.niche ?? "Outro"),
    whatsappNumber: digitsOnly(brand.whatsappNumber),
    primaryColor: String(brand.primaryColor ?? DEFAULT_BRAND_KIT.primaryColor),
    secondaryColor: String(
      brand.secondaryColor ?? DEFAULT_BRAND_KIT.secondaryColor
    ),
    logoUrl: String(brand.logoUrl ?? ""),
    logoPath: String(brand.logoPath ?? ""),
  };
}

export async function saveBrandKit(
  input: SaveBrandKitInput,
  onProgress?: (percent: number) => void
): Promise<BrandKit> {
  const context = await getTenantContext();

  let logoUrl = input.currentLogoUrl ?? "";
  let logoPath = input.currentLogoPath ?? "";

  if (input.logoFile) {
    const upload = await uploadImageToCloudinary(
      input.logoFile,
      `telalocal/${context.tenantId}/brand`,
      onProgress
    );
    logoUrl = upload.secureUrl;
    logoPath = upload.publicId;
  }

  const brandKit: BrandKit = {
    businessName: input.businessName.trim(),
    niche: input.niche.trim() || "Outro",
    whatsappNumber: digitsOnly(input.whatsappNumber),
    primaryColor: input.primaryColor || DEFAULT_BRAND_KIT.primaryColor,
    secondaryColor: input.secondaryColor || DEFAULT_BRAND_KIT.secondaryColor,
    logoUrl,
    logoPath,
  };

  await updateDoc(doc(db, "tenants", context.tenantId), {
    brandKit,
    updatedAt: serverTimestamp(),
  });

  return brandKit;
}
