import type { Metadata } from "next";
import PanelClient from "@/components/panel/PanelClient";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

export default function Painel() {
  return <PanelClient />;
}
