import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";
import type { PublicAccountType } from "@/lib/firebase/accounts";

export const metadata: Metadata = {
  title: "Cadastro",
  description: "Cadastre seu estabelecimento ou anunciante na rede de mídia indoor TelaLocal.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/cadastro" },
};

export default async function Cadastro({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string }>;
}) {
  const params = await searchParams;
  const initialProfile: PublicAccountType =
    params.perfil === "anunciante" ? "advertiser" : "host";

  return (
    <main className="wrap">
      <SignupForm initialProfile={initialProfile} />
    </main>
  );
}
