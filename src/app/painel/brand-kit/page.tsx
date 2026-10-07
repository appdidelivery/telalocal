import type { Metadata } from "next";
import BrandKitClient from "@/components/panel/BrandKitClient";

export const metadata: Metadata = {
  title: "Brand Kit",
  robots: { index: false, follow: false },
};

export default function BrandKitPage() {
  return <BrandKitClient />;
}
