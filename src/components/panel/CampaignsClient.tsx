"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  createCampaign,
  listCampaigns,
  updateCampaignTracking,
  MAX_VIDEO_BYTES,
  type CampaignRecord,
} from "@/lib/firebase/campaigns";
import { firebaseErrorMessage } from "@/lib/firebase/errors";

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function readDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video/metadata-error"));
    };
    video.src = url;
  });
}

export default function CampaignsClient() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [name, setName] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [offerText, setOfferText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const fileSummary = useMemo(() => {
    if (!file) return "";
    return `${file.name} • ${formatBytes(file.size)}${duration ? ` • ${duration.toFixed(1)}s` : ""}`;
  }, [file, duration]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        setCampaigns(await listCampaigns());
      } catch (err) {
        setError(firebaseErrorMessage(err));
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function handleFileChange(nextFile: File | null) {
    setError("");
    setDuration(0);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.type !== "video/mp4") {
      setError("Use um arquivo MP4.");
      setFile(null);
      return;
    }

    if (nextFile.size > MAX_VIDEO_BYTES) {
      setError("O MP4 deve ter no máximo 60 MB neste MVP.");
      setFile(null);
      return;
    }

    setFile(nextFile);

    try {
      setDuration(await readDuration(nextFile));
    } catch {
      setError("Não consegui ler a duração desse vídeo. Tente outro MP4.");
      setFile(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Selecione um vídeo MP4.");
      return;
    }

    setSaving(true);
    setProgress(0);

    try {
      const created = await createCampaign(
        {
          name,
          advertiserName,
          file,
          durationSeconds: duration,
          whatsappNumber,
          couponCode,
          offerText,
        },
        setProgress
      );
      setCampaigns((current) => [created, ...current]);
      setName("");
      setAdvertiserName("");
      setWhatsappNumber("");
      setCouponCode("");
      setOfferText("");
      setFile(null);
      setDuration(0);
      setProgress(0);

      const input = document.getElementById("campaign-video") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function configureTracking(campaign: CampaignRecord) {
    const whatsapp = window.prompt(
      "WhatsApp com DDI + DDD + número:",
      campaign.whatsappNumber || ""
    );
    if (whatsapp === null) return;

    const coupon = window.prompt(
      "Cupom da campanha:",
      campaign.couponCode || ""
    );
    if (coupon === null) return;

    const offer = window.prompt(
      "Chamada da oferta:",
      campaign.offerText || campaign.name
    );
    if (offer === null) return;

    try {
      const updated = await updateCampaignTracking(campaign.id, {
        whatsappNumber: whatsapp,
        couponCode: coupon,
        offerText: offer,
      });

      setCampaigns((current) =>
        current.map((item) =>
          item.id === campaign.id
            ? {
                ...item,
                ...updated,
                trackingEnabled: Boolean(
                  updated.whatsappNumber ||
                    updated.couponCode ||
                    updated.offerText
                ),
              }
            : item
        )
      );
    } catch {
      setError("Não foi possível atualizar a conversão da campanha.");
    }
  }

  if (loading) {
    return <main className="auth-loading"><p className="muted">Carregando campanhas...</p></main>;
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">MÍDIA, OFERTA E CONVERSÃO</div>
          <h1>Campanhas</h1>
          <p className="muted">Envie o MP4 e configure QR, WhatsApp e cupom para medir conversões por tela.</p>
        </div>
        <Link className="btn ghost" href="/painel">← Voltar ao painel</Link>
      </div>

      <div className="two-column">
        <form className="card screen-form" onSubmit={handleSubmit}>
          <h2>Nova campanha</h2>
          <p className="muted">MP4 até 60 MB. O QR rastreável é gerado automaticamente quando a campanha entra na playlist.</p>

          <div className="field">
            <label htmlFor="campaign-name">Nome da campanha</label>
            <input id="campaign-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Primeiro pedido 50% OFF" />
          </div>

          <div className="field">
            <label htmlFor="advertiser-name">Anunciante</label>
            <input id="advertiser-name" required value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} placeholder="Ex.: Burger Prime" />
          </div>

          <div className="field">
            <label htmlFor="offer-text">Chamada da oferta</label>
            <input id="offer-text" value={offerText} onChange={(e) => setOfferText(e.target.value)} placeholder="Ex.: Primeiro pedido com 50% OFF" />
          </div>

          <div className="field">
            <label htmlFor="whatsapp-number">WhatsApp para conversão</label>
            <input id="whatsapp-number" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="Ex.: 5548999999999" inputMode="tel" />
            <span className="file-summary">Use DDI + DDD + número. O QR abrirá uma landing rastreável antes do WhatsApp.</span>
          </div>

          <div className="field">
            <label htmlFor="coupon-code">Cupom</label>
            <input id="coupon-code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Ex.: TELA50" />
          </div>

          <div className="field">
            <label htmlFor="campaign-video">Vídeo MP4</label>
            <input
              id="campaign-video"
              required
              type="file"
              accept="video/mp4,.mp4"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {fileSummary ? <p className="file-summary">{fileSummary}</p> : null}

          {saving ? (
            <div className="upload-progress" aria-label={`Upload ${progress}%`}>
              <div style={{ width: `${progress}%` }} />
              <span>{progress}%</span>
            </div>
          ) : null}

          {error ? <p className="message error">{error}</p> : null}

          <button className="btn primary full" type="submit" disabled={saving}>
            {saving ? "Enviando vídeo..." : "Criar campanha"}
          </button>
        </form>

        <section>
          <div className="list-header">
            <div>
              <h2>Campanhas cadastradas</h2>
              <p className="muted">{campaigns.length} campanha(s) neste tenant</p>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhuma campanha ainda.</strong>
              <p className="muted">A primeira campanha ficará disponível para montagem de playlist.</p>
            </div>
          ) : (
            <div className="screen-list">
              {campaigns.map((campaign) => (
                <article className="screen-row" key={campaign.id}>
                  <div className="campaign-main">
                    <div className="eyebrow">{campaign.trackingEnabled ? "RASTREÁVEL" : "ATIVA"}</div>
                    <h3>{campaign.name}</h3>
                    <p className="muted">
                      {campaign.advertiserName} • {campaign.durationSeconds}s • {formatBytes(campaign.sizeBytes)}
                    </p>
                    {campaign.offerText ? <span className="file-summary">{campaign.offerText}</span> : null}
                    {campaign.couponCode ? <span className="file-summary">Cupom: {campaign.couponCode}</span> : null}
                  </div>
                  <div className="screen-actions">
                    <button className="btn ghost" type="button" onClick={() => configureTracking(campaign)}>
                      {campaign.trackingEnabled ? "Editar conversão" : "Configurar conversão"}
                    </button>
                    <a className="btn ghost" href={campaign.mediaUrl} target="_blank" rel="noreferrer">Ver vídeo</a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
