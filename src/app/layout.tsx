import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://telalocal.vercel.app"),
  title: { default: "TelaLocal | Mídia Indoor para Comércio Local", template: "%s | TelaLocal" },
  description: "Transforme Smart TVs de estabelecimentos em uma rede de mídia indoor local, com gestão de campanhas, playlists, operação offline e prova de exibição.",
  keywords: ["mídia indoor","DOOH","publicidade local","smart TV","digital signage","painel de mídia indoor"],
  alternates: { canonical: "/" },
  openGraph: { title: "TelaLocal | Mídia Indoor para Comércio Local", description: "Publicidade local em Smart TVs com gestão simples, operação offline e prova de exibição.", type: "website", locale: "pt_BR" },
  robots: { index: true, follow: true }
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
