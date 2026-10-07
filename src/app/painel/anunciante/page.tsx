import type { Metadata } from "next";
import AdvertiserClient from "@/components/panel/AdvertiserClient";

export const metadata: Metadata = {
  title: "Console do anunciante",
  robots: { index: false, follow: false },
};

export default function AdvertiserPage() {
  return <AdvertiserClient />;
}
