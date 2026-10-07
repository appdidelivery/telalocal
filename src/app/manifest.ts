import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TelaLocal",
    short_name: "TelaLocal",
    description: "Mídia indoor local em Smart TVs, com gestão, operação offline e Proof of Play.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#082B5C",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
