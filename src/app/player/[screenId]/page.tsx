import type { Metadata } from "next";
import WebPlayer from "@/components/player/WebPlayer";

export const metadata: Metadata = {
  title: "Web Player",
  robots: { index: false, follow: false },
};

export default async function ScreenPlayer({
  params,
  searchParams,
}: {
  params: Promise<{ screenId: string }>;
  searchParams: Promise<{ k?: string | string[] }>;
}) {
  const { screenId } = await params;
  const query = await searchParams;
  const playerKey = Array.isArray(query.k) ? query.k[0] ?? "" : query.k ?? "";

  return <WebPlayer screenId={screenId} playerKey={playerKey} />;
}
