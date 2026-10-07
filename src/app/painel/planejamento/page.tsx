import type { Metadata } from "next";
import DeliveryPlanningClient from "@/components/panel/DeliveryPlanningClient";

export const metadata: Metadata = {
  title: "Agendamento e segmentação",
  robots: { index: false, follow: false },
};

export default function PlanningPage() {
  return <DeliveryPlanningClient />;
}
