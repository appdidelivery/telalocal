"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { getTenantContext, listScreens, type ScreenRecord } from "@/lib/firebase/screens";
import { listCampaigns, type CampaignRecord } from "@/lib/firebase/campaigns";
import { syncProofOfPlay } from "@/lib/player/offline";

type ProofBatch = {
  id: string;
  screenId: string;
  date: string;
  totalPlays: number;
  campaignCounts: Record<string, number>;
  firstPlayedAt: string;
  lastPlayedAt: string;
};

type ConversionEvent = {
  id: string;
  screenId: string;
  campaignId: string;
  eventType: "qr_scan" | "whatsapp_click" | "coupon_copy";
  date: string;
  eventAt: string;
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
  const [events, setEvents] = useState<ConversionEvent[]>([]);
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
        const [screenList, campaignList] = await Promise.all([
          listScreens(context),
          listCampaigns(),
        ]);

        setScreens(screenList);
        setCampaigns(campaignList);

        await Promise.allSettled(
          screenList
            .filter((screen) => Boolean(screen.playerKey))
            .map((screen) =>
              syncProofOfPlay({
                tenantId: context.tenantId,
                screenId: screen.id,
                playerKey: String(screen.playerKey),
                force: true,
              })
            )
        );

        const [proofSnapshot, conversionSnapshot] = await Promise.all([
          getDocs(
            query(
              collection(db, "tenants", context.tenantId, "proofBatches"),
              where("date", ">=", sevenDaysAgoKey())
            )
          ),
          getDocs(
            query(
              collection(db, "tenants", context.tenantId, "conversionEvents"),
              where("date", ">=", sevenDaysAgoKey())
            )
          ),
        ]);

        setBatches(
          proofSnapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() } as ProofBatch)
          )
        );

        setEvents(
          conversionSnapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() } as ConversionEvent)
          )
        );
      } catch {
        setError("Não foi possível carregar os dados de mídia e conversão.");
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

    const qrScans = events.filter((event) => event.eventType === "qr_scan").length;
    const whatsappClicks = events.filter((event) => event.eventType === "whatsapp_click").length;
    const couponCopies = events.filter((event) => event.eventType === "coupon_copy").length;

    return {
      todayPlays,
      sevenDayPlays,
      activeScreens,
      campaignTotals,
      qrScans,
      whatsappClicks,
      couponCopies,
      qrRate: sevenDayPlays > 0 ? (qrScans / sevenDayPlays) * 100 : 0,
      whatsappRate: qrScans > 0 ? (whatsappClicks / qrScans) * 100 : 0,
    };
  }, [batches, events, today]);

  const campaignRows = useMemo(
    () =>
      campaigns
        .map((campaign) => {
          const campaignEvents = events.filter((event) => event.campaignId === campaign.id);
          const plays = summary.campaignTotals.get(campaign.id) ?? 0;
          const scans = campaignEvents.filter((event) => event.eventType === "qr_scan").length;
          const whatsapp = campaignEvents.filter((event) => event.eventType === "whatsapp_click").length;
          const coupons = campaignEvents.filter((event) => event.eventType === "coupon_copy").length;

          return {
            ...campaign,
            plays,
            scans,
            whatsapp,
            coupons,
            qrRate: plays > 0 ? (scans / plays) * 100 : 0,
          };
        })
        .sort((a, b) => b.plays - a.plays),
    [campaigns, events, summary.campaignTotals]
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
    return <main className="auth-loading"><p className="muted">Carregando métricas...</p></main>;
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">MÍDIA + CONVERSÃO</div>
          <h1>Proof of Play e conversões</h1>
          <p className="muted">Da exibição na TV ao scan do QR, WhatsApp e uso do cupom.</p>
        </div>
        <Link className="btn ghost" href="/painel">← Voltar ao painel</Link>
      </div>

      {error ? <p className="message error">{error}</p> : null}

      <div className="stats proof-stats">
        <div className="stat"><span className="muted">Exibições hoje</span><b>{summary.todayPlays}</b></div>
        <div className="stat"><span className="muted">Últimos 7 dias</span><b>{summary.sevenDayPlays}</b></div>
        <div className="stat"><span className="muted">Telas com atividade hoje</span><b>{summary.activeScreens}/{screens.length}</b></div>
        <div className="stat">
          <span className="muted">Última reprodução</span>
          <b className="stat-small">{latestPlayback ? new Date(latestPlayback).toLocaleString("pt-BR") : "—"}</b>
        </div>
      </div>

      <div className="stats proof-stats conversion-stats">
        <div className="stat"><span className="muted">QR scans · 7 dias</span><b>{summary.qrScans}</b></div>
        <div className="stat"><span className="muted">Cliques WhatsApp</span><b>{summary.whatsappClicks}</b></div>
        <div className="stat"><span className="muted">Cupons copiados</span><b>{summary.couponCopies}</b></div>
        <div className="stat"><span className="muted">QR / exibição</span><b>{summary.qrRate.toFixed(1)}%</b><small className="metric-sub">WhatsApp / QR: {summary.whatsappRate.toFixed(1)}%</small></div>
      </div>

      <section className="card proof-card">
        <div className="list-header">
          <div>
            <h2>Resultado por campanha</h2>
            <p className="muted">Exibições e ações rastreadas nos últimos 7 dias.</p>
          </div>
        </div>

        {campaignRows.length === 0 ? (
          <div className="empty-state"><strong>Nenhuma campanha cadastrada.</strong></div>
        ) : (
          <div className="proof-table-wrap">
            <table className="proof-table">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Exibições</th>
                  <th>QR</th>
                  <th>WhatsApp</th>
                  <th>Cupom</th>
                  <th>QR / exibição</th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((campaign) => (
                  <tr key={campaign.id}>
                    <td><strong>{campaign.name}</strong><small className="table-sub">{campaign.advertiserName}</small></td>
                    <td>{campaign.plays}</td>
                    <td>{campaign.scans}</td>
                    <td>{campaign.whatsapp}</td>
                    <td>{campaign.coupons}</td>
                    <td><strong>{campaign.qrRate.toFixed(1)}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="proof-note">
        “WhatsApp” mede a abertura rastreada do canal. Confirmação de mensagem enviada exige integração com a API oficial do WhatsApp. “Cupom” mede a cópia; resgate confirmado poderá ser integrado ao PDV/ERP.
      </p>
    </main>
  );
}
