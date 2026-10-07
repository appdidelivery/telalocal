"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { getPlanLimits } from "@/lib/plans";

export default function PlanClient() {
  const router = useRouter();
  const [planName, setPlanName] = useState("Piloto");
  const [screenCount, setScreenCount] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);
  const [accountType, setAccountType] = useState<"host" | "advertiser">("host");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const tenantId = String(userData.tenantId ?? "");
      setAccountType(userData.accountType === "advertiser" ? "advertiser" : "host");

      const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
      const plan = String(tenantSnap.data()?.plan ?? "pilot");
      const limits = getPlanLimits(plan);
      setPlanName(limits.label);

      const [screens, campaigns] = await Promise.all([
        getCountFromServer(
          query(
            collection(db, "tenants", tenantId, "screens"),
            where("ownerUid", "==", user.uid)
          )
        ),
        getCountFromServer(
          query(
            collection(db, "tenants", tenantId, "campaigns"),
            where("ownerUid", "==", user.uid)
          )
        ),
      ]);

      setScreenCount(screens.data().count);
      setCampaignCount(campaigns.data().count);
      setLoading(false);
    });
  }, [router]);

  const limits = getPlanLimits("pilot");

  if (loading) {
    return (
      <main className="auth-loading">
        <p className="muted">Carregando plano...</p>
      </main>
    );
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">PLANO E LIMITES</div>
          <h1>{planName}</h1>
          <p className="muted">
            Limites técnicos do ambiente piloto. Os pacotes comerciais da landing
            definem cobertura e contratação de mídia.
          </p>
        </div>
        <Link className="btn ghost" href="/painel">
          ← Voltar
        </Link>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="muted">Telas</span>
          <b>{screenCount}/{limits.screens}</b>
        </div>
        <div className="stat">
          <span className="muted">Campanhas</span>
          <b>{campaignCount}/{limits.campaigns}</b>
        </div>
        <div className="stat">
          <span className="muted">Mídias por playlist</span>
          <b>{limits.playlistItems}</b>
        </div>
        <div className="stat">
          <span className="muted">Créditos piloto</span>
          <b>{limits.monthlyCredits}</b>
        </div>
      </div>

      <div className="grid plan-detail-grid">
        <article className="card">
          <div className="eyebrow">VÍDEO</div>
          <h3>Até {Math.round(limits.videoBytes / 1024 / 1024)} MB</h3>
          <p>MP4 por campanha, armazenado e entregue via CDN.</p>
        </article>

        <article className="card">
          <div className="eyebrow">FORMATO</div>
          <h3>15s e 30s</h3>
          <p>Slots comerciais com programação por data, dia e faixa horária.</p>
        </article>

        <article className="card">
          <div className="eyebrow">PERFIL</div>
          <h3>{accountType === "advertiser" ? "Anunciante" : "Ponto parceiro"}</h3>
          <p>
            {accountType === "advertiser"
              ? "Use o console do anunciante para escolher cobertura e acompanhar resultados."
              : "O ponto parceiro pode operar as próprias telas e participar da monetização da rede."}
          </p>
        </article>
      </div>

      <div className="banner plan-banner">
        <div>
          <h2>Modelo comercial separado do limite técnico</h2>
          <p>
            O piloto mantém limites conservadores para controlar custo e estabilidade.
            Os planos comerciais definem quantidade de pontos e serviços contratados.
          </p>
        </div>
        <Link className="btn primary" href="/#planos">
          Ver preços
        </Link>
      </div>
    </main>
  );
}
