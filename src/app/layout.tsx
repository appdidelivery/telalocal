import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://telalocal-chi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TelaLocal | Mídia Indoor para Comércio Local",
    template: "%s | TelaLocal",
  },
  description:
    "Transforme Smart TVs de estabelecimentos em uma rede de mídia indoor local, com gestão de campanhas, playlists, operação offline e prova de exibição.",
  keywords: [
    "mídia indoor",
    "DOOH",
    "publicidade local",
    "smart TV",
    "digital signage",
    "painel de mídia indoor",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "TelaLocal | Mídia Indoor para Comércio Local",
    description:
      "Publicidade local em Smart TVs com gestão simples, operação offline e prova de exibição.",
    url: siteUrl,
    siteName: "TelaLocal",
    type: "website",
    locale: "pt_BR",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
