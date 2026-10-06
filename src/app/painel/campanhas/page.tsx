import type { Metadata } from "next";
import CampaignsClient from "@/components/panel/CampaignsClient";

export const metadata: Metadata = {
  title: "Campanhas",
  robots: { index: false, follow: false },
};

export default function CampanhasPage() {
  return <CampaignsClient />;
}
