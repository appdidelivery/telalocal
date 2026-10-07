import type { Metadata } from "next";
import ConversionLanding from "@/components/tracking/ConversionLanding";

export const metadata: Metadata = {
  title: "Oferta",
  robots: { index: false, follow: false },
};

export default async function ConversionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ConversionLanding token={token.toLowerCase()} />;
}
