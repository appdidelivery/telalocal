"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { getTenantContext, listScreens, type ScreenRecord } from "@/lib/firebase/screens";
import { listCampaigns, type CampaignRecord } from "@/lib/firebase/campaigns";

type ProofBatch = {
  id: string;
  screenId: string;
  date: string;
  totalPlays: number;
  campaignCounts: Record<string, number>;
  firstPlayedAt: string;
  lastPlayedAt: string;
};

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sevenDaysAgoKey() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return dateKey(date);
}

export default function ProofOfPlayClient() {
  const router = useRouter();
  const [batches, setBatches] = useState<ProofBatch[]>([]);
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const context = await getTenantContext();
        const [proofSnapshot, screenList, campaignList] = await Promise.all([
          getDocs(
            query(
              collection(db, "tenants", context.tenantId, "proofBatches"),
              where("date", ">=", sevenDaysAgoKey())
            )
          ),
          listScreens(context),
          listCampaigns(),
        ]);

        setBatches(
          proofSnapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() } as ProofBatch)
          )
        );
        setScreens(screenList);
        setCampaigns(campaignList);
      } catch {
        setError("Não foi possível carregar os dados de Proof of Play.");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  const today = dateKey();

  const summary = useMemo(() => {
    const todayBatches = batches.filter((batch) => batch.date === today);
    const todayPlays = todayBatches.reduce(
      (sum, batch) => sum + Number(batch.totalPlays || 0),
      0
    );
    const sevenDayPlays = batches.reduce(
      (sum, batch) => sum + Number(batch.totalPlays || 0),
      0
    );
    const activeScreens = new Set(todayBatches.map((batch) => batch.screenId)).size;
    const campaignTotals = new Map<string, number>();

    for (const batch of batches) {
      for (const [campaignId, count] of Object.entries(batch.campaignCounts || {})) {
        campaignTotals.set(
          campaignId,
          (campaignTotals.get(campaignId) ?? 0) + Number(count || 0)
        );
      }
    }

    return { todayPlays, sevenDayPlays, activeScreens, campaignTotals };
  }, [batches, today]);

  const campaignRows = useMemo(
    () =>
      campaigns
        .map((campaign) => ({
          ...campaign,
          plays: summary.campaignTotals.get(campaign.id) ?? 0,
        }))
        .sort((a, b) => b.plays - a.plays),
    [campaigns, summary.campaignTotals]
  );

  const latestPlayback = useMemo(() => {
    const values = batches
      .map((batch) => batch.lastPlayedAt)
      .filter(Boolean)
      .sort()
      .reverse();
    return values[0] ?? "";
  }, [batches]);

  if (loading) {
    return <main className="auth-loading"><p className="muted">Carregando Proof of Play...</p></main>;
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">AUDITORIA DE EXIBIÇÕES</div>
          <h1>Proof of Play</h1>
          <p className="muted">Exibições confirmadas pelo Web Player e sincronizadas em lotes.</p>
        </div>
        <Link className="btn ghost" href="/painel">← Voltar ao painel</Link>
      </div>

      {error ? <p className="message error">{error}</p> : null}

      <div className="stats proof-stats">
        <div className="stat"><span className="muted">Exibições hoje</span><b>{summary.todayPlays}</b></div>
        <div className="stat"><span className="muted">Últimos 7 dias</span><b>{summary.sevenDayPlays}</b></div>
        <div className="stat"><span className="muted">Telas com atividade hoje</span><b>{summary.activeScreens}/{screens.length}</b></div>
        <div className="stat">
          <span className="muted">Última reprodução sincronizada</span>
          <b className="stat-small">{latestPlayback ? new Date(latestPlayback).toLocaleString("pt-BR") : "—"}</b>
        </div>
      </div>

      <section className="card proof-card">
        <div className="list-header">
          <div>
            <h2>Desempenho por campanha</h2>
            <p className="muted">Exibições sincronizadas nos últimos 7 dias.</p>
          </div>
        </div>

        {campaignRows.length === 0 ? (
          <div className="empty-state"><strong>Nenhuma campanha cadastrada.</strong></div>
        ) : (
          <div className="proof-table-wrap">
            <table className="proof-table">
              <thead>
                <tr><th>Campanha</th><th>Anunciante</th><th>Exibições</th></tr>
              </thead>
              <tbody>
                {campaignRows.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>{campaign.name}</td>
                    <td>{campaign.advertiserName}</td>
                    <td><strong>{campaign.plays}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="proof-note">
        Os players registram cada reprodução localmente. A sincronização é limitada a um lote por hora por tela para reduzir escritas no Firestore.
      </p>
    </main>
  );
}
