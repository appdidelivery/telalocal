import type { Metadata } from "next";
import PlanClient from "@/components/panel/PlanClient";

export const metadata: Metadata = {
  title: "Plano e limites",
  robots: { index: false, follow: false },
};

export default function PlanPage() {
  return <PlanClient />;
}
