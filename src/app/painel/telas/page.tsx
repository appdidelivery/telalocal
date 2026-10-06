import type { Metadata } from "next";
import ScreensClient from "@/components/panel/ScreensClient";

export const metadata: Metadata = {
  title: "Telas",
  robots: { index: false, follow: false },
};

export default function TelasPage() {
  return <ScreensClient />;
}
