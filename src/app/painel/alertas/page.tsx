import type { Metadata } from "next";
import OperationalAlertsClient from "@/components/panel/OperationalAlertsClient";

export const metadata: Metadata = {
  title: "Alertas da rede",
  robots: { index: false, follow: false },
};

export default function AlertsPage() {
  return <OperationalAlertsClient />;
}
