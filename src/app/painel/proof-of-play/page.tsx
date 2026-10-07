import type { Metadata } from "next";
import ProofOfPlayClient from "@/components/panel/ProofOfPlayClient";

export const metadata: Metadata = {
  title: "Proof of Play",
  robots: { index: false, follow: false },
};

export default function ProofOfPlayPage() {
  return <ProofOfPlayClient />;
}
