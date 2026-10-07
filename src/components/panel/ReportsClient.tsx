"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import {
  getTenantContext,
  listScreens,
  type ScreenRecord,
} from "@/lib/firebase/screens";
import {
  listCampaigns,
  type CampaignRecord,
} from "@/lib/firebase/campaigns";

type ProofBatch = {
  screenId: string;
  date: string;
  totalPlays: number;
  campaignCounts: Record<string, number>;
};

type ConversionEvent = {
  screenId: string;
  campaignId: string;
  eventType: "qr_scan" | "whatsapp_click" | "coupon_copy";
  date: string;
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return dateKey(date);
}

function csvEscape(value: string | number) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function ReportsClient() {
  const router = useRouter();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(() => dateKey(new Date()));
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [proofs, setProofs] = useState<ProofBatch[]>([]);
  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState("");

  const loadRange = useCallback(async (start: string, end: string) => {
    const context = await getTenantContext();

    const [screenList, campaignList, proofSnapshot, eventSnapshot] =
      await Promise.all([
        listScreens(context),
        listCampaigns(),
        getDocs(
          query(
            collection(db, "tenants", context.tenantId, "proofBatches"),
            where("date", ">=", start),
            where("date", "<=", end)
          )
        ),
        getDocs(
          query(
            collection(db, "tenants", context.tenantId, "conversionEvents"),
            where("date", ">=", start),
            where("date", "<=", end)
          )
        ),
      ]);

    setScreens(screenList);
    setCampaigns(campaignList);
    setProofs(proofSnapshot.docs.map((item) => item.data() as ProofBatch));
    setEvents(eventSnapshot.docs.map((item) => item.data() as ConversionEvent));
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        await loadRange(startDate, endDate);
      } catch {
        setError("Não foi possível carregar o relatório.");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuerying(true);
    setError("");

    try {
      await loadRange(startDate, endDate);
    } catch {
      setError("Não foi possível consultar este período.");
    } finally {
      setQuerying(false);
    }
  }

  const metrics = useMemo(() => {
    const totalPlays = proofs.reduce(
      (sum, item) => sum + Number(item.totalPlays || 0),
      0
    );
    const qr = events.filter((item) => item.eventType === "qr_scan").length;
    const whatsapp = events.filter(
      (item) => item.eventType === "whatsapp_click"
    ).length;
    const coupons = events.filter(
      (item) => item.eventType === "coupon_copy"
    ).length;

    return {
      totalPlays,
      qr,
      whatsapp,
      coupons,
      qrRate: totalPlays ? (qr / totalPlays) * 100 : 0,
      whatsappRate: qr ? (whatsapp / qr) * 100 : 0,
    };
  }, [events, proofs]);

  const campaignRows = useMemo(() => {
    return campaigns
      .map((campaign) => {
        let plays = 0;

        for (const proof of proofs) {
          plays += Number(proof.campaignCounts?.[campaign.id] || 0);
        }

        const campaignEvents = events.filter(
          (item) => item.campaignId === campaign.id
        );
        const qr = campaignEvents.filter(
          (item) => item.eventType === "qr_scan"
        ).length;
        const whatsapp = campaignEvents.filter(
          (item) => item.eventType === "whatsapp_click"
        ).length;
        const coupons = campaignEvents.filter(
          (item) => item.eventType === "coupon_copy"
        ).length;

        return {
          id: campaign.id,
          name: campaign.name,
          advertiser: campaign.advertiserName,
          plays,
          qr,
          whatsapp,
          coupons,
          rate: plays ? (qr / plays) * 100 : 0,
        };
      })
      .sort((a, b) => b.plays - a.plays);
  }, [campaigns, events, proofs]);

  const screenRows = useMemo(() => {
    return screens
      .map((screen) => {
        const proofRows = proofs.filter(
          (item) => item.screenId === screen.id
        );
        const plays = proofRows.reduce(
          (sum, item) => sum + Number(item.totalPlays || 0),
          0
        );
        const screenEvents = events.filter(
          (item) => item.screenId === screen.id
        );
        const qr = screenEvents.filter(
          (item) => item.eventType === "qr_scan"
        ).length;
        const whatsapp = screenEvents.filter(
          (item) => item.eventType === "whatsapp_click"
        ).length;

        return {
          id: screen.id,
          name: `${screen.pointName} · ${screen.screenName}`,
          location: `${screen.city}/${screen.state}`,
          plays,
          qr,
          whatsapp,
        };
      })
      .sort((a, b) => b.plays - a.plays);
  }, [events, proofs, screens]);

  function exportCsv() {
    const rows = [
      [
        "Campanha",
        "Anunciante",
        "Exibições",
        "QR",
        "WhatsApp",
        "Cupom",
        "Taxa QR/Exibição",
      ],
      ...campaignRows.map((item) => [
        item.name,
        item.advertiser,
        item.plays,
        item.qr,
        item.whatsapp,
        item.coupons,
        `${item.rate.toFixed(2)}%`,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => csvEscape(value)).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `telalocal-relatorio-${startDate}-a-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="auth-loading">
        <p className="muted">Carregando relatórios...</p>
      </main>
    );
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">RELATÓRIO COMERCIAL</div>
          <h1>Resultados por período</h1>
          <p className="muted">
            Exibições, QR, WhatsApp e cupons por campanha e por tela.
          </p>
        </div>
        <div className="screen-actions">
          <button className="btn primary" type="button" onClick={exportCsv}>
            Exportar CSV
          </button>
          <Link className="btn ghost" href="/painel">
            ← Voltar
          </Link>
        </div>
      </div>

      <form className="card report-filter" onSubmit={handleFilter}>
        <div className="field">
          <label>De</label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Até</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <button className="btn ghost" type="submit" disabled={querying}>
          {querying ? "Consultando..." : "Aplicar período"}
        </button>
      </form>

      {error ? <p className="message error">{error}</p> : null}

      <div className="stats proof-stats">
        <div className="stat">
          <span className="muted">Exibições</span>
          <b>{metrics.totalPlays}</b>
        </div>
        <div className="stat">
          <span className="muted">QR scans</span>
          <b>{metrics.qr}</b>
        </div>
        <div className="stat">
          <span className="muted">WhatsApp</span>
          <b>{metrics.whatsapp}</b>
        </div>
        <div className="stat">
          <span className="muted">QR / exibição</span>
          <b>{metrics.qrRate.toFixed(1)}%</b>
          <small className="metric-sub">
            WhatsApp / QR: {metrics.whatsappRate.toFixed(1)}%
          </small>
        </div>
      </div>

      <section className="card proof-card">
        <div className="list-header">
          <div>
            <h2>Por campanha</h2>
            <p className="muted">
              {startDate} até {endDate}
            </p>
          </div>
        </div>

        <div className="proof-table-wrap">
          <table className="proof-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Exibições</th>
                <th>QR</th>
                <th>WhatsApp</th>
                <th>Cupom</th>
                <th>Taxa</th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small className="table-sub">{item.advertiser}</small>
                  </td>
                  <td>{item.plays}</td>
                  <td>{item.qr}</td>
                  <td>{item.whatsapp}</td>
                  <td>{item.coupons}</td>
                  <td>
                    <strong>{item.rate.toFixed(1)}%</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card proof-card">
        <div className="list-header">
          <div>
            <h2>Por tela / ponto</h2>
            <p className="muted">
              Compare a entrega entre estabelecimentos.
            </p>
          </div>
        </div>

        <div className="proof-table-wrap">
          <table className="proof-table">
            <thead>
              <tr>
                <th>Tela</th>
                <th>Exibições</th>
                <th>QR</th>
                <th>WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {screenRows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small className="table-sub">{item.location}</small>
                  </td>
                  <td>{item.plays}</td>
                  <td>{item.qr}</td>
                  <td>{item.whatsapp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="proof-note">
        WhatsApp representa abertura rastreada do canal. Cupom representa cópia
        rastreada; confirmação de resgate depende de integração com o PDV/ERP.
      </p>
    </main>
  );
}
