"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { listCampaigns, type CampaignRecord } from "@/lib/firebase/campaigns";
import { PLAN_LIMITS } from "@/lib/plans";

type InventoryItem = {
  screenId: string;
  category: string;
  city: string;
  state: string;
  zipCode?: string;
  status: "active" | "paused";
};

export default function AdvertiserClient() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
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
        const [inventorySnapshot, campaignList] = await Promise.all([
          getDocs(
            query(
              collection(db, "networkInventory"),
              where("status", "==", "active"),
              limit(200)
            )
          ),
          listCampaigns(),
        ]);

        setInventory(
          inventorySnapshot.docs
            .map((item) => item.data() as InventoryItem)
        );
        setCampaigns(campaignList);
      } catch {
        setError("Não foi possível carregar o console do anunciante.");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  const coverage = useMemo(() => {
    const cities = new Set(
      inventory.map((item) => `${item.city}/${item.state}`).filter(Boolean)
    );
    const categories = new Set(
      inventory.map((item) => item.category).filter(Boolean)
    );
    const allocatedCredits = campaigns.reduce(
      (sum, item) => sum + Number(item.budgetCredits ?? 0),
      0
    );

    return {
      screens: inventory.length,
      cities: cities.size,
      categories: categories.size,
      allocatedCredits,
      availableCredits: Math.max(
        0,
        PLAN_LIMITS.pilot.monthlyCredits - allocatedCredits
      ),
    };
  }, [campaigns, inventory]);

  const cityRows = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach((item) => {
      const key = `${item.city}/${item.state}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [inventory]);

  if (loading) {
    return (
      <main className="auth-loading">
        <p className="muted">Carregando rede disponível...</p>
      </main>
    );
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">CONSOLE DO ANUNCIANTE</div>
          <h1>Planeje sua presença local</h1>
          <p className="muted">
            Crie a peça, escolha o público, distribua o orçamento em créditos e acompanhe a entrega.
          </p>
        </div>
        <Link className="btn ghost" href="/painel">
          ← Voltar
        </Link>
      </div>

      {error ? <p className="message error">{error}</p> : null}

      <div className="stats">
        <div className="stat">
          <span className="muted">Telas disponíveis</span>
          <b>{coverage.screens}</b>
        </div>
        <div className="stat">
          <span className="muted">Cidades</span>
          <b>{coverage.cities}</b>
        </div>
        <div className="stat">
          <span className="muted">Categorias</span>
          <b>{coverage.categories}</b>
        </div>
        <div className="stat">
          <span className="muted">Créditos livres</span>
          <b>{coverage.availableCredits}</b>
          <small className="metric-sub">
            {coverage.allocatedCredits} alocados de {PLAN_LIMITS.pilot.monthlyCredits}
          </small>
        </div>
      </div>

      <div className="advertiser-steps">
        <Link className="card advertiser-step" href="/painel/criar-conteudo">
          <span>1</span>
          <div>
            <strong>Criar anúncio</strong>
            <small>Template, imagem ou vídeo</small>
          </div>
        </Link>
        <Link className="card advertiser-step" href="/painel/planejamento">
          <span>2</span>
          <div>
            <strong>Escolher público</strong>
            <small>Categoria, cidade, CEP ou telas</small>
          </div>
        </Link>
        <Link className="card advertiser-step" href="/painel/playlists">
          <span>3</span>
          <div>
            <strong>Publicar</strong>
            <small>15s ou 30s na rede selecionada</small>
          </div>
        </Link>
        <Link className="card advertiser-step" href="/painel/relatorios">
          <span>4</span>
          <div>
            <strong>Medir</strong>
            <small>Exibição, QR, WhatsApp e cupom</small>
          </div>
        </Link>
      </div>

      <div className="two-column advertiser-console-grid">
        <section className="card">
          <div className="list-header">
            <div>
              <h2>Cobertura atual</h2>
              <p className="muted">Inventário ativo disponível para segmentação.</p>
            </div>
          </div>

          {cityRows.length === 0 ? (
            <div className="empty-state">
              <strong>A rede ainda não possui telas disponíveis.</strong>
            </div>
          ) : (
            <div className="network-city-list">
              {cityRows.map(([city, count]) => (
                <div key={city}>
                  <span>{city}</span>
                  <strong>{count} tela(s)</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="list-header">
            <div>
              <h2>Minhas campanhas</h2>
              <p className="muted">{campaigns.length} campanha(s)</p>
            </div>
          </div>

          <div className="network-city-list">
            {campaigns.slice(0, 8).map((campaign) => (
              <div key={campaign.id}>
                <span>
                  <strong>{campaign.name}</strong>
                  <small>
                    {campaign.slotSeconds ?? 15}s · {campaign.targetMode ?? "all"}
                  </small>
                </span>
                <strong>{campaign.budgetCredits ?? 0} cr.</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
