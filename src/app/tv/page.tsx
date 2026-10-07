import type { Metadata } from "next";
import TvPairingClient from "@/components/player/TvPairingClient";

export const metadata: Metadata = {
  title: "Parear TV",
  robots: { index: false, follow: false },
};

export default function TvPage() {
  return <TvPairingClient />;
}
