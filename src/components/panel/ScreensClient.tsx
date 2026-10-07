"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  createPointAndScreen,
  getTenantContext,
  listScreens,
  type ScreenRecord,
} from "@/lib/firebase/screens";
import { firebaseErrorMessage } from "@/lib/firebase/errors";

export default function ScreensClient() {
  const router = useRouter();
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [ownerUid, setOwnerUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pointName, setPointName] = useState("");
  const [screenName, setScreenName] = useState("TV principal");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const context = await getTenantContext();
        setTenantId(context.tenantId);
        setOwnerUid(context.ownerUid);
        setScreens(await listScreens(context));
      } catch (err) {
        setError(firebaseErrorMessage(err));
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const created = await createPointAndScreen(
        { tenantId, ownerUid },
        { pointName, screenName, category, address, city, state }
      );
      setScreens((current) => [created, ...current]);
      setPointName("");
      setScreenName("TV principal");
      setCategory("");
      setAddress("");
      setCity("");
      setState("");
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function playerUrl(path: string) {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }

  async function copyUrl(path: string) {
    await navigator.clipboard.writeText(playerUrl(path));
  }

  if (loading) {
    return <main className="auth-loading"><p className="muted">Carregando telas...</p></main>;
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">REDE DE TELAS</div>
          <h1>Telas e pontos físicos</h1>
          <p className="muted">Cadastre as telas, abra telalocal.vercel.app/tv na Smart TV e faça o pareamento por código.</p>
        </div>
        <div className="screen-actions">
          <Link className="btn primary" href="/painel/parear-tv">Parear TV</Link>
          <Link className="btn ghost" href="/painel">← Voltar ao painel</Link>
        </div>
      </div>

      <div className="two-column">
        <form className="card screen-form" onSubmit={handleSubmit}>
          <h2>Cadastrar primeira tela</h2>
          <p className="muted">Neste MVP, o cadastro cria o ponto físico e sua primeira tela em uma única operação.</p>

          <div className="field">
            <label htmlFor="pointName">Nome do estabelecimento</label>
            <input id="pointName" required value={pointName} onChange={(e) => setPointName(e.target.value)} placeholder="Ex.: Barbearia Centro" />
          </div>

          <div className="field">
            <label htmlFor="screenName">Nome da tela</label>
            <input id="screenName" required value={screenName} onChange={(e) => setScreenName(e.target.value)} placeholder="Ex.: TV principal" />
          </div>

          <div className="field">
            <label htmlFor="category">Categoria</label>
            <select id="category" required value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Selecione</option>
              <option>Barbearia</option>
              <option>Padaria</option>
              <option>Bar / Restaurante</option>
              <option>Oficina</option>
              <option>Clínica</option>
              <option>Academia</option>
              <option>Mercado</option>
              <option>Outro</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="address">Endereço</label>
            <input id="address" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número e bairro" />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="city">Cidade</label>
              <input id="city" required value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="state">UF</label>
              <input id="state" required maxLength={2} value={state} onChange={(e) => setState(e.target.value)} placeholder="SC" />
            </div>
          </div>

          {error ? <p className="message error">{error}</p> : null}

          <button className="btn primary full" type="submit" disabled={saving || !tenantId}>
            {saving ? "Criando tela..." : "Cadastrar ponto e gerar URL"}
          </button>
        </form>

        <section>
          <div className="list-header">
            <div>
              <h2>Telas cadastradas</h2>
              <p className="muted">{screens.length} tela(s) neste tenant</p>
            </div>
          </div>

          {screens.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhuma tela ainda.</strong>
              <p className="muted">Cadastre o primeiro ponto para gerar a URL que será aberta na Smart TV.</p>
            </div>
          ) : (
            <div className="screen-list">
              {screens.map((screen) => (
                <article className="screen-row" key={screen.id}>
                  <div>
                    <div className="eyebrow">ATIVA</div>
                    <h3>{screen.pointName} · {screen.screenName}</h3>
                    <p className="muted">{screen.category} • {screen.city}/{screen.state}</p>
                    <code>{screen.playerPath}</code>
                  </div>
                  <div className="screen-actions">
                    <Link className="btn ghost" href={screen.playerPath} target="_blank">Abrir player</Link>
                    <button className="btn ghost" type="button" onClick={() => copyUrl(screen.playerPath)}>Copiar URL</button>
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
