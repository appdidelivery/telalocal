import type { Metadata } from "next";
import ReportsClient from "@/components/panel/ReportsClient";

export const metadata: Metadata = {
  title: "Relatórios",
  robots: { index: false, follow: false },
};

export default function ReportsPage() {
  return <ReportsClient />;
}
