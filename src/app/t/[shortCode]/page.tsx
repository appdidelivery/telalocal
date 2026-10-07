import type { Metadata } from "next";
import ShortPlayerClient from "@/components/player/ShortPlayerClient";

export const metadata: Metadata = {
  title: "Tela",
  robots: { index: false, follow: false },
};

export default async function ShortPlayerPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  return <ShortPlayerClient shortCode={shortCode.toUpperCase()} />;
}
