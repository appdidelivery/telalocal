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
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { logoutAccount } from "@/lib/firebase/accounts";

type PanelProfile = {
  displayName: string;
  email: string;
  tenantName: string;
  tenantId: string;
  accountType: "host" | "advertiser";
};

export default function PanelClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<PanelProfile | null>(null);
  const [screenCount, setScreenCount] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);
  const [playsToday, setPlaysToday] = useState(0);
  const [activePlayersToday, setActivePlayersToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (!userSnap.exists()) {
          setError("Seu usuário existe no Authentication, mas o perfil ainda não foi criado no Firestore.");
          setLoading(false);
          return;
        }

        const userData = userSnap.data() as {
          displayName?: string;
          tenantId?: string;
          accountType?: "host" | "advertiser";
        };

        const tenantId = String(userData.tenantId ?? "");
        let tenantName = "Minha organização";

        if (tenantId) {
          const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
          if (tenantSnap.exists()) {
            tenantName = String(tenantSnap.data().name ?? tenantName);
          }

          window.sessionStorage.setItem(
            "telalocal:tenant-context",
            JSON.stringify({ tenantId, ownerUid: user.uid })
          );

          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

          const [screenCountSnapshot, campaignCountSnapshot, proofSnapshot, heartbeatSnapshot] =
            await Promise.all([
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
              getDocs(
                query(
                  collection(db, "tenants", tenantId, "proofBatches"),
                  where("date", "==", today)
                )
              ),
              getDocs(collection(db, "tenants", tenantId, "heartbeats")),
            ]);

          setScreenCount(screenCountSnapshot.data().count);
          setCampaignCount(campaignCountSnapshot.data().count);

          let totalToday = 0;
          proofSnapshot.forEach((item) => {
            const data = item.data();
            totalToday += Number(data.totalPlays ?? 0);
          });
          setPlaysToday(totalToday);

          const onlineCutoff = Date.now() - 7 * 60 * 1000;
          let onlineNow = 0;
          heartbeatSnapshot.forEach((item) => {
            if (Number(item.data().lastSeenAtMs ?? 0) >= onlineCutoff) {
              onlineNow += 1;
            }
          });
          setActivePlayersToday(onlineNow);
        }

        setProfile({
          displayName: userData.displayName || user.displayName || "Usuário",
          email: user.email || "",
          tenantName,
          tenantId,
          accountType: userData.accountType || "host",
        });
        setLoading(false);
      } catch {
        setError("Não foi possível carregar seu perfil. Confirme se as regras do Firestore foram publicadas.");
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  async function handleLogout() {
    window.sessionStorage.removeItem("telalocal:tenant-context");
    await logoutAccount();
    router.replace("/login");
  }

  if (loading) {
    return <main className="auth-loading"><div><div className="brand">Tela<span>Local</span></div><p className="muted">Carregando seu painel...</p></div></main>;
  }

  if (error || !profile) {
    return (
      <main className="wrap">
        <div className="form">
          <div className="brand">Tela<span>Local</span></div>
          <h1>Precisamos concluir seu acesso</h1>
          <p className="message error">{error}</p>
          <div className="cta">
            <Link className="btn ghost" href="/">Voltar ao site</Link>
            <button className="btn primary" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="panel-shell">
      <aside className="sidebar">
        <div className="brand">Tela<span>Local</span></div>
        <div className="tenant-label">{profile.tenantName}</div>
        <div style={{ marginTop: 24 }}>
          <Link className="side-link active" href="/painel">Visão geral</Link>
          <Link className="side-link" href="/painel/telas">Telas</Link>
          <Link className="side-link" href="/painel/parear-tv">Parear TV</Link>
          <Link className="side-link" href="/painel/criar-conteudo">Criar conteúdo</Link>
          <Link className="side-link" href="/painel/brand-kit">Brand Kit</Link>
          <Link className="side-link" href="/painel/campanhas">Campanhas</Link>
          <Link className="side-link" href="/painel/playlists">Playlists</Link>
          <Link className="side-link" href="/painel/planejamento">Agendamento e segmentação</Link>
          <Link className="side-link" href="/painel/proof-of-play">Proof of Play</Link>
          <Link className="side-link" href="/painel/relatorios">Relatórios</Link>
          {profile.accountType === "advertiser" ? (
            <Link className="side-link" href="/painel/anunciante">Console do anunciante</Link>
          ) : null}
          <Link className="side-link" href="/painel/plano">Plano e limites</Link>
        </div>
      </aside>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">{profile.accountType === "host" ? "PONTO PARCEIRO" : "ANUNCIANTE"}</div>
            <h1>Olá, {profile.displayName}</h1>
            <p className="muted">{profile.email}</p>
          </div>
          <div className="cta compact">
            <Link className="btn ghost" href="/">Ver landing</Link>
            <button className="btn ghost" onClick={handleLogout}>Sair</button>
          </div>
        </div>

        <div className="stats">
          <div className="stat"><span className="muted">Telas cadastradas</span><b>{screenCount}</b></div>
          <div className="stat"><span className="muted">Campanhas</span><b>{campaignCount}</b></div>
          <div className="stat"><span className="muted">Exibições hoje</span><b>{playsToday}</b></div>
          <div className="stat"><span className="muted">TVs online agora</span><b>{activePlayersToday}</b></div>
        </div>

        <div className="section">
          <h2>Primeiros passos</h2>
          <p className="lead">Sua organização já está isolada no modelo multi-tenant. Agora você pode cadastrar os pontos físicos e gerar as URLs das TVs.</p>
          <div className="grid">
            <article className="card">
              <div className="eyebrow">CONTA ATIVA</div>
              <h3>{profile.tenantName}</h3>
              <p>Tenant criado e vinculado ao seu usuário.</p>
            </article>
            <article className="card">
              <div className="eyebrow">{screenCount ? "REDE ATIVA" : "PRÓXIMO PASSO"}</div>
              <h3>{screenCount ? `${screenCount} tela(s) cadastrada(s)` : "Cadastrar primeira tela"}</h3>
              <p><Link href="/painel/telas">{screenCount ? "Gerenciar telas →" : "Cadastrar ponto e gerar URL →"}</Link></p>
            </article>
            <article className="card">
              <div className="eyebrow">{profile.accountType === "advertiser" ? "ANUNCIANTE" : "CRIAR CONTEÚDO"}</div>
              <h3>{profile.accountType === "advertiser" ? "Planejar campanha local" : "Templates prontos"}</h3>
              <p>
                <Link href={profile.accountType === "advertiser" ? "/painel/anunciante" : "/painel/criar-conteudo"}>
                  {profile.accountType === "advertiser" ? "Abrir console do anunciante →" : "Criar peça em poucos minutos →"}
                </Link>
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
