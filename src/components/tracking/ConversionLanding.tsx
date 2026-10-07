"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type ConversionLink = {
  token: string;
  tenantId: string;
  screenId: string;
  screenName: string;
  pointName: string;
  campaignId: string;
  campaignName: string;
  advertiserName: string;
  whatsappNumber: string;
  couponCode: string;
  offerText: string;
  status: string;
};

function dateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

async function recordEvent(link: ConversionLink, eventType: "qr_scan" | "whatsapp_click" | "coupon_copy") {
  await addDoc(
    collection(db, "tenants", link.tenantId, "conversionEvents"),
    {
      tenantId: link.tenantId,
      token: link.token,
      screenId: link.screenId,
      campaignId: link.campaignId,
      eventType,
      date: dateKey(),
      eventAt: new Date().toISOString(),
    }
  );
}

export default function ConversionLanding({ token }: { token: string }) {
  const [link, setLink] = useState<ConversionLink | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const snapshot = await getDoc(doc(db, "conversionLinks", token));
        if (!snapshot.exists()) {
          if (active) setError("Oferta não encontrada.");
          return;
        }

        const data = snapshot.data();
        const next: ConversionLink = {
          token,
          tenantId: String(data.tenantId ?? ""),
          screenId: String(data.screenId ?? ""),
          screenName: String(data.screenName ?? ""),
          pointName: String(data.pointName ?? ""),
          campaignId: String(data.campaignId ?? ""),
          campaignName: String(data.campaignName ?? ""),
          advertiserName: String(data.advertiserName ?? ""),
          whatsappNumber: String(data.whatsappNumber ?? ""),
          couponCode: String(data.couponCode ?? ""),
          offerText: String(data.offerText ?? ""),
          status: String(data.status ?? ""),
        };

        if (next.status !== "active" || !next.tenantId) {
          if (active) setError("Esta oferta não está ativa.");
          return;
        }

        if (active) setLink(next);

        const scanKey = `telalocal:scan:${token}`;
        if (!window.sessionStorage.getItem(scanKey)) {
          window.sessionStorage.setItem(scanKey, "1");
          void recordEvent(next, "qr_scan").catch(() => undefined);
        }
      } catch {
        if (active) setError("Não foi possível abrir esta oferta.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [token]);

  async function openWhatsApp() {
    if (!link?.whatsappNumber) return;

    await recordEvent(link, "whatsapp_click").catch(() => undefined);

    const message = [
      `Olá! Vi a campanha "${link.campaignName}" na TelaLocal.`,
      link.couponCode ? `Quero usar o cupom ${link.couponCode}.` : "",
      `Ref: ${link.token}`,
    ]
      .filter(Boolean)
      .join(" ");

    window.location.href = `https://wa.me/${link.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  async function copyCoupon() {
    if (!link?.couponCode) return;

    await navigator.clipboard.writeText(link.couponCode);
    setCopied(true);
    void recordEvent(link, "coupon_copy").catch(() => undefined);
  }

  if (error) {
    return (
      <main className="conversion-page">
        <section className="conversion-card">
          <div className="brand">Tela<span>Local</span></div>
          <h1>Oferta indisponível</h1>
          <p className="muted">{error}</p>
        </section>
      </main>
    );
  }

  if (!link) {
    return (
      <main className="conversion-page">
        <section className="conversion-card">
          <div className="brand">Tela<span>Local</span></div>
          <p className="muted">Carregando oferta...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="conversion-page">
      <section className="conversion-card">
        <div className="eyebrow">OFERTA VISTA NA TELA</div>
        <h1>{link.offerText || link.campaignName}</h1>
        <p className="conversion-advertiser">{link.advertiserName}</p>
        <p className="muted">Exibida em {link.pointName} · {link.screenName}</p>

        {link.couponCode ? (
          <button className="coupon-box" type="button" onClick={copyCoupon}>
            <span>Cupom</span>
            <strong>{link.couponCode}</strong>
            <small>{copied ? "Copiado!" : "Toque para copiar"}</small>
          </button>
        ) : null}

        {link.whatsappNumber ? (
          <button className="btn primary full conversion-whatsapp" type="button" onClick={openWhatsApp}>
            Abrir WhatsApp
          </button>
        ) : null}

        <p className="conversion-ref">Referência da campanha: {link.token}</p>
      </section>
    </main>
  );
}
