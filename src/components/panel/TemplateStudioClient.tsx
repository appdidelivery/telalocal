"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createImageCampaign } from "@/lib/firebase/campaigns";
import { loadBrandKit, type BrandKit } from "@/lib/firebase/brandKit";
import { firebaseErrorMessage } from "@/lib/firebase/errors";

type Preset = {
  id: string;
  label: string;
  kicker: string;
  title: string;
  subtitle: string;
  cta: string;
  accent: string;
  accent2: string;
};

const PRESETS: Preset[] = [
  {
    id: "oferta",
    label: "Oferta",
    kicker: "OFERTA DO DIA",
    title: "Oferta imperdível",
    subtitle: "Só por tempo limitado",
    cta: "Escaneie e aproveite",
    accent: "#38e0a3",
    accent2: "#0b6b51",
  },
  {
    id: "primeira-compra",
    label: "Primeira compra",
    kicker: "SÓ PARA NOVOS CLIENTES",
    title: "50% OFF",
    subtitle: "Na sua primeira compra",
    cta: "Garanta pelo QR Code",
    accent: "#ffd166",
    accent2: "#7a4f00",
  },
  {
    id: "cashback",
    label: "Cashback",
    kicker: "DINHEIRO DE VOLTA",
    title: "Ganhe cashback",
    subtitle: "Compre hoje e economize na próxima",
    cta: "Ative pelo QR Code",
    accent: "#76e4f7",
    accent2: "#0b5260",
  },
  {
    id: "fidelidade",
    label: "Clube fidelidade",
    kicker: "CLUBE DE VANTAGENS",
    title: "Quem volta, ganha",
    subtitle: "Benefícios exclusivos para clientes fiéis",
    cta: "Entre para o clube",
    accent: "#d6b0ff",
    accent2: "#563178",
  },
  {
    id: "produto",
    label: "Produto destaque",
    kicker: "DESTAQUE DA CASA",
    title: "Seu produto aqui",
    subtitle: "Uma oferta que chama atenção na TV",
    cta: "Saiba mais pelo QR",
    accent: "#ff9f68",
    accent2: "#783c19",
  },
  {
    id: "whatsapp",
    label: "Chamada WhatsApp",
    kicker: "FALE COM A GENTE",
    title: "Peça ou agende agora",
    subtitle: "Escaneie o QR e abra nosso WhatsApp",
    cta: "Aponte a câmera",
    accent: "#65e572",
    accent2: "#1d6b26",
  },
];

const NICHES = [
  "Barbearia",
  "Hamburgueria",
  "Padaria",
  "Restaurante",
  "Mercado",
  "Academia",
  "Clínica",
  "Oficina",
  "Outro",
];

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
) {
  const words = text.split(/\s+/);
  let line = "";
  let lineNumber = 0;

  for (let n = 0; n < words.length; n += 1) {
    const testLine = line ? `${line} ${words[n]}` : words[n];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, y + lineNumber * lineHeight);
      line = words[n];
      lineNumber += 1;

      if (lineNumber >= maxLines - 1) break;
    } else {
      line = testLine;
    }
  }

  if (lineNumber < maxLines) {
    ctx.fillText(line, x, y + lineNumber * lineHeight);
  }
}

async function fileToBitmap(file: File) {
  return createImageBitmap(file);
}

async function urlToBitmap(url: string) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("brand/logo-load-failed");
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function canvasToFile(canvas: HTMLCanvasElement, filename: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("template/render-failed"));
          return;
        }
        resolve(new File([blob], filename, { type: "image/png" }));
      },
      "image/png",
      0.94
    );
  });
}

export default function TemplateStudioClient() {
  const router = useRouter();
  const [presetId, setPresetId] = useState("primeira-compra");
  const preset = useMemo(
    () => PRESETS.find((item) => item.id === presetId) ?? PRESETS[0],
    [presetId]
  );

  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [niche, setNiche] = useState("Hamburgueria");
  const [advertiserName, setAdvertiserName] = useState("Negócio Exemplo");
  const [campaignName, setCampaignName] = useState("Campanha promocional");
  const [headline, setHeadline] = useState(preset.title);
  const [subtitle, setSubtitle] = useState(preset.subtitle);
  const [price, setPrice] = useState("");
  const [cta, setCta] = useState(preset.cta);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const brand = await loadBrandKit();
        setBrandKit(brand);

        if (brand.businessName) setAdvertiserName(brand.businessName);
        if (brand.niche) setNiche(brand.niche);
        if (brand.whatsappNumber) setWhatsappNumber(brand.whatsappNumber);
      } catch {
        // O Studio continua utilizável mesmo sem Brand Kit.
      }
    });
  }, [router]);

  useEffect(() => {
    setHeadline(preset.title);
    setSubtitle(preset.subtitle);
    setCta(preset.cta);
  }, [preset]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return;
    }

    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const activeAccent = brandKit?.primaryColor || preset.accent;
  const activeAccent2 = brandKit?.secondaryColor || preset.accent2;

  async function renderTemplate() {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("template/canvas-unavailable");

    const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
    gradient.addColorStop(0, "#07111f");
    gradient.addColorStop(0.65, "#0e1b2c");
    gradient.addColorStop(1, activeAccent2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1920, 1080);

    if (photo) {
      const bitmap = await fileToBitmap(photo);
      const targetX = 1100;
      const targetW = 820;
      const targetH = 1080;
      const scale = Math.max(targetW / bitmap.width, targetH / bitmap.height);
      const drawW = bitmap.width * scale;
      const drawH = bitmap.height * scale;
      const drawX = targetX + (targetW - drawW) / 2;
      const drawY = (targetH - drawH) / 2;

      ctx.globalAlpha = 0.9;
      ctx.drawImage(bitmap, drawX, drawY, drawW, drawH);
      ctx.globalAlpha = 1;

      const shade = ctx.createLinearGradient(900, 0, 1450, 0);
      shade.addColorStop(0, "#07111f");
      shade.addColorStop(1, "rgba(7,17,31,0.08)");
      ctx.fillStyle = shade;
      ctx.fillRect(840, 0, 700, 1080);
      bitmap.close();
    }

    if (brandKit?.logoUrl) {
      try {
        const logo = await urlToBitmap(brandKit.logoUrl);
        const maxW = 310;
        const maxH = 150;
        const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
        const drawW = logo.width * scale;
        const drawH = logo.height * scale;

        ctx.fillStyle = "rgba(255,255,255,.96)";
        ctx.beginPath();
        ctx.roundRect(1480, 70, 350, 190, 28);
        ctx.fill();
        ctx.drawImage(
          logo,
          1480 + (350 - drawW) / 2,
          70 + (190 - drawH) / 2,
          drawW,
          drawH
        );
        logo.close();
      } catch {
        // Se a logo não carregar, a peça continua sem ela.
      }
    }

    ctx.fillStyle = activeAccent;
    ctx.fillRect(110, 105, 150, 10);

    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillStyle = activeAccent;
    ctx.fillText(preset.kicker, 110, 185);

    ctx.font = "800 44px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(advertiserName || niche, 110, 255);

    ctx.font = "900 116px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    wrapText(ctx, headline || preset.title, 110, 430, 930, 120, 3);

    if (price.trim()) {
      ctx.font = "900 88px Arial, sans-serif";
      ctx.fillStyle = activeAccent;
      ctx.fillText(price.trim(), 110, 755);
    }

    ctx.font = "500 42px Arial, sans-serif";
    ctx.fillStyle = "#c9d8e7";
    wrapText(ctx, subtitle || preset.subtitle, 110, price.trim() ? 835 : 735, 850, 52, 2);

    ctx.fillStyle = activeAccent;
    ctx.beginPath();
    ctx.roundRect(110, 915, 610, 92, 24);
    ctx.fill();

    ctx.font = "800 30px Arial, sans-serif";
    ctx.fillStyle = "#07111f";
    ctx.fillText(cta || preset.cta, 145, 972);

    // Reserva visual para o QR dinâmico do player.
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 14]);
    ctx.beginPath();
    ctx.roundRect(1540, 725, 300, 255, 24);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "700 26px Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText("QR DINÂMICO", 1590, 850);
    ctx.font = "500 20px Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.fillText("gerado por tela", 1602, 888);

    return canvasToFile(
      canvas,
      `telalocal-${preset.id}-${Date.now()}.png`
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    setProgress(0);

    try {
      const file = await renderTemplate();

      const created = await createImageCampaign(
        {
          name: campaignName || headline,
          advertiserName: advertiserName || niche,
          file,
          durationSeconds,
          templateId: `${niche.toLowerCase()}:${preset.id}`,
          whatsappNumber,
          couponCode,
          offerText: headline,
        },
        setProgress
      );

      setMessage(
        `Peça criada: ${created.name}. Ela já está disponível em Campanhas e Playlists.`
      );
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">STUDIO DE CONTEÚDO</div>
          <h1>Criar peça para TV</h1>
          <p className="muted">
            Escolha um modelo, troque os dados e publique sem precisar de designer.
          </p>
        </div>
        <div className="screen-actions">
          <Link className="btn ghost" href="/painel/brand-kit">Brand Kit</Link>
          <Link className="btn ghost" href="/painel/campanhas">Enviar vídeo MP4</Link>
          <Link className="btn ghost" href="/painel">← Voltar</Link>
        </div>
      </div>

      <div className="template-shell">
        <section className="card template-form-card">
          <h2>1. Escolha o objetivo</h2>

          <div className="template-preset-grid">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === presetId ? "template-preset active" : "template-preset"}
                onClick={() => setPresetId(item.id)}
              >
                <span style={{ background: item.accent }} />
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="template-niche">Nicho</label>
              <select id="template-niche" value={niche} onChange={(e) => setNiche(e.target.value)}>
                {NICHES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="template-advertiser">Nome do negócio</label>
              <input id="template-advertiser" required value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="template-campaign">Nome interno da campanha</label>
              <input id="template-campaign" required value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="template-headline">Oferta principal</label>
              <input id="template-headline" required value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="template-subtitle">Texto de apoio</label>
              <input id="template-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="template-price">Preço / destaque</label>
                <input id="template-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex.: R$ 29,90" />
              </div>
              <div className="field">
                <label htmlFor="template-duration">Duração</label>
                <select id="template-duration" value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))}>
                  <option value={6}>6s</option>
                  <option value={8}>8s</option>
                  <option value={10}>10s</option>
                  <option value={12}>12s</option>
                  <option value={15}>15s</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="template-cta">Chamada</label>
              <input id="template-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="template-photo">Foto do produto/serviço (opcional)</label>
              <input id="template-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </div>

            <h2 className="template-form-section">2. Conversão</h2>

            <div className="field">
              <label htmlFor="template-whatsapp">WhatsApp</label>
              <input id="template-whatsapp" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="5548999999999" inputMode="tel" />
            </div>

            <div className="field">
              <label htmlFor="template-coupon">Cupom</label>
              <input id="template-coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="TELA50" />
            </div>

            {saving ? (
              <div className="upload-progress">
                <div style={{ width: `${progress}%` }} />
                <span>{progress ? `${progress}%` : "Gerando peça..."}</span>
              </div>
            ) : null}

            {error ? <p className="message error">{error}</p> : null}
            {message ? <p className="message success">{message}</p> : null}

            <button className="btn primary full" type="submit" disabled={saving}>
              {saving ? "Criando peça..." : "Criar e salvar campanha"}
            </button>
          </form>
        </section>

        <section className="template-preview-column">
          <div className="list-header">
            <div>
              <h2>Prévia 16:9</h2>
              <p className="muted">O QR real é aplicado automaticamente quando a peça entra em uma tela.</p>
            </div>
          </div>

          <div
            className="template-preview"
            style={{
              ["--tpl-accent" as string]: activeAccent,
              ["--tpl-accent2" as string]: activeAccent2,
              backgroundImage: photoPreview
                ? `linear-gradient(90deg,rgba(7,17,31,.98) 0%,rgba(7,17,31,.85) 48%,rgba(7,17,31,.15) 100%),url("${photoPreview}")`
                : undefined,
            }}
          >
            {brandKit?.logoUrl ? (
              <div className="template-brand-logo">
                <img src={brandKit.logoUrl} alt="" />
              </div>
            ) : null}
            <div className="template-preview-copy">
              <span className="template-kicker">{preset.kicker}</span>
              <small>{advertiserName || niche}</small>
              <strong>{headline || preset.title}</strong>
              {price ? <b>{price}</b> : null}
              <p>{subtitle || preset.subtitle}</p>
              <em>{cta || preset.cta}</em>
            </div>
            <div className="template-qr-placeholder">
              <span>QR</span>
              <small>dinâmico</small>
            </div>
          </div>

          {brandKit?.businessName ? (
            <div className="brand-kit-applied">
              <span>Brand Kit aplicado</span>
              <strong>{brandKit.businessName}</strong>
              <Link href="/painel/brand-kit">Editar</Link>
            </div>
          ) : (
            <div className="brand-kit-applied empty">
              <span>Quer ganhar tempo?</span>
              <strong>Cadastre sua marca uma única vez.</strong>
              <Link href="/painel/brand-kit">Configurar Brand Kit</Link>
            </div>
          )}

          <div className="card template-help">
            <div className="eyebrow">PADRÃO TELALOCAL</div>
            <h3>Simples para o lojista</h3>
            <p>
              Imagens usam 8 segundos por padrão, transição Fade e QR rastreável por tela. Vídeos mantêm a duração original.
            </p>
            <div className="template-flow">
              <span>Template</span><b>→</b><span>Personalizar</span><b>→</b><span>Playlist</span><b>→</b><span>Publicar</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
