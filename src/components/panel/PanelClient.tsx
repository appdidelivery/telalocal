"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { logoutAccount } from "@/lib/firebase/accounts";

type PanelProfile = {
  displayName: string;
  email: string;
  tenantName: string;
  accountType: "host" | "advertiser";
};

export default function PanelClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<PanelProfile | null>(null);
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

        let tenantName = "Minha organização";
        if (userData.tenantId) {
          const tenantSnap = await getDoc(doc(db, "tenants", userData.tenantId));
          if (tenantSnap.exists()) tenantName = String(tenantSnap.data().name ?? tenantName);
        }

        setProfile({
          displayName: userData.displayName || user.displayName || "Usuário",
          email: user.email || "",
          tenantName,
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
          <a className="side-link active">Visão geral</a>
          <a className="side-link">Telas</a>
          <a className="side-link">Campanhas</a>
          <a className="side-link">Playlists</a>
          <a className="side-link">Proof of Play</a>
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
          <div className="stat"><span className="muted">Telas cadastradas</span><b>0</b></div>
          <div className="stat"><span className="muted">Campanhas</span><b>0</b></div>
          <div className="stat"><span className="muted">Exibições hoje</span><b>0</b></div>
          <div className="stat"><span className="muted">Players online</span><b>0</b></div>
        </div>

        <div className="section">
          <h2>Primeiros passos</h2>
          <p className="lead">Sua organização já está isolada no modelo multi-tenant. O próximo módulo será o cadastro real de telas e pontos físicos.</p>
          <div className="grid">
            <article className="card"><div className="eyebrow">CONTA ATIVA</div><h3>{profile.tenantName}</h3><p>Tenant criado e vinculado ao seu usuário.</p></article>
            <article className="card"><div className="eyebrow">PRÓXIMO MÓDULO</div><h3>Cadastrar primeira tela</h3><p>Vamos gerar uma URL pública exclusiva para o Web Player.</p></article>
            <article className="card"><div className="eyebrow">DEMO</div><h3>Player de demonstração</h3><p><Link href="/player/demo">Abrir player em tela cheia →</Link></p></article>
          </div>
        </div>
      </section>
    </main>
  );
}
