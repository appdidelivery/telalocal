import type { Metadata } from "next";
import PlaylistsClient from "@/components/panel/PlaylistsClient";

export const metadata: Metadata = {
  title: "Playlists",
  robots: { index: false, follow: false },
};

export default function PlaylistsPage() {
  return <PlaylistsClient />;
}
