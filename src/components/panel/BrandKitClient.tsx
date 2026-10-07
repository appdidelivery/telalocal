"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  loadBrandKit,
  saveBrandKit,
  type BrandKit,
} from "@/lib/firebase/brandKit";
import { firebaseErrorMessage } from "@/lib/firebase/errors";

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

export default function BrandKitClient() {
  const router = useRouter();
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [loading, setLoading] = useState(true);
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
        setBrand(await loadBrandKit());
      } catch (err) {
        setError(firebaseErrorMessage(err));
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(brand?.logoUrl ?? "");
      return;
    }

    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [logoFile, brand?.logoUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!brand) return;

    setSaving(true);
    setProgress(0);
    setError("");
    setMessage("");

    try {
      const saved = await saveBrandKit(
        {
          businessName: brand.businessName,
          niche: brand.niche,
          whatsappNumber: brand.whatsappNumber,
          primaryColor: brand.primaryColor,
          secondaryColor: brand.secondaryColor,
          logoFile,
          currentLogoUrl: brand.logoUrl,
          currentLogoPath: brand.logoPath,
        },
        setProgress
      );

      setBrand(saved);
      setLogoFile(null);
      setMessage("Brand Kit salvo. Os próximos templates já abrirão com sua marca.");
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !brand) {
    return (
      <main className="auth-loading">
        <p className="muted">Carregando Brand Kit...</p>
      </main>
    );
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">IDENTIDADE DO NEGÓCIO</div>
          <h1>Brand Kit</h1>
          <p className="muted">
            Configure uma vez. Nome, logo, cores e WhatsApp serão reutilizados nos próximos criativos.
          </p>
        </div>
        <div className="screen-actions">
          <Link className="btn primary" href="/painel/criar-conteudo">
            Criar conteúdo
          </Link>
          <Link className="btn ghost" href="/painel">← Voltar</Link>
        </div>
      </div>

      <div className="brand-kit-layout">
        <form className="card" onSubmit={handleSubmit}>
          <h2>Dados da marca</h2>

          <div className="field">
            <label htmlFor="brand-name">Nome do negócio</label>
            <input
              id="brand-name"
              required
              value={brand.businessName}
              onChange={(e) =>
                setBrand((current) =>
                  current ? { ...current, businessName: e.target.value } : current
                )
              }
            />
          </div>

          <div className="field">
            <label htmlFor="brand-niche">Nicho principal</label>
            <select
              id="brand-niche"
              value={brand.niche}
              onChange={(e) =>
                setBrand((current) =>
                  current ? { ...current, niche: e.target.value } : current
                )
              }
            >
              {NICHES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="brand-whatsapp">WhatsApp padrão</label>
            <input
              id="brand-whatsapp"
              inputMode="tel"
              placeholder="5548999999999"
              value={brand.whatsappNumber}
              onChange={(e) =>
                setBrand((current) =>
                  current ? { ...current, whatsappNumber: e.target.value } : current
                )
              }
            />
          </div>

          <div className="field">
            <label htmlFor="brand-logo">Logo</label>
            <input
              id="brand-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="brand-color-grid">
            <div className="field">
              <label htmlFor="brand-primary">Cor principal</label>
              <div className="brand-color-input">
                <input
                  id="brand-primary"
                  type="color"
                  value={brand.primaryColor}
                  onChange={(e) =>
                    setBrand((current) =>
                      current
                        ? { ...current, primaryColor: e.target.value }
                        : current
                    )
                  }
                />
                <code>{brand.primaryColor}</code>
              </div>
            </div>

            <div className="field">
              <label htmlFor="brand-secondary">Cor secundária</label>
              <div className="brand-color-input">
                <input
                  id="brand-secondary"
                  type="color"
                  value={brand.secondaryColor}
                  onChange={(e) =>
                    setBrand((current) =>
                      current
                        ? { ...current, secondaryColor: e.target.value }
                        : current
                    )
                  }
                />
                <code>{brand.secondaryColor}</code>
              </div>
            </div>
          </div>

          {saving && logoFile ? (
            <div className="upload-progress">
              <div style={{ width: `${progress}%` }} />
              <span>{progress}%</span>
            </div>
          ) : null}

          {error ? <p className="message error">{error}</p> : null}
          {message ? <p className="message success">{message}</p> : null}

          <button className="btn primary full" disabled={saving} type="submit">
            {saving ? "Salvando..." : "Salvar Brand Kit"}
          </button>
        </form>

        <section>
          <div className="list-header">
            <div>
              <h2>Prévia da identidade</h2>
              <p className="muted">Essa base será aplicada automaticamente nos templates.</p>
            </div>
          </div>

          <div
            className="brand-preview"
            style={{
              ["--brand-primary" as string]: brand.primaryColor,
              ["--brand-secondary" as string]: brand.secondaryColor,
            }}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="" className="brand-preview-logo" />
            ) : (
              <div className="brand-preview-logo empty">LOGO</div>
            )}
            <div>
              <span>{brand.niche}</span>
              <strong>{brand.businessName || "Seu negócio"}</strong>
              <p>Oferta pronta para TV, QR rastreável e WhatsApp.</p>
            </div>
            <em>Escaneie e aproveite</em>
          </div>

          <div className="card brand-kit-info">
            <div className="eyebrow">AUTOMAÇÃO</div>
            <h3>O que será preenchido sozinho</h3>
            <p>
              Nome da empresa, nicho, logo, cores e WhatsApp. No Studio, o lojista precisa trocar basicamente oferta, preço e foto.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
