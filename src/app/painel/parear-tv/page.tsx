import type { Metadata } from "next";
import PairTvClient from "@/components/panel/PairTvClient";

export const metadata: Metadata = {
  title: "Parear TV",
  robots: { index: false, follow: false },
};

export default function PairTvPage() {
  return <PairTvClient />;
}
