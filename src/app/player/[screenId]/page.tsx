import type { Metadata } from "next";
import WebPlayer from "@/components/player/WebPlayer";

export const metadata: Metadata = {
  title: "Web Player",
  robots: { index: false, follow: false },
};

export default async function ScreenPlayer({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;
  return <WebPlayer screenId={screenId} />;
}
