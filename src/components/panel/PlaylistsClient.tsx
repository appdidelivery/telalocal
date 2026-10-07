"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  loadPlaylistEditorData,
  publishPlaylist,
} from "@/lib/firebase/playlists";
import type { ScreenRecord } from "@/lib/firebase/screens";
import type { CampaignRecord } from "@/lib/firebase/campaigns";

export default function PlaylistsClient() {
  const router = useRouter();
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [screenId, setScreenId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const data = await loadPlaylistEditorData();
        setScreens(data.screens);
        setCampaigns(data.campaigns);
        if (data.screens[0]) setScreenId(data.screens[0].id);
      } catch {
        setError("Não foi possível carregar telas e campanhas.");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  const selectedCampaigns = useMemo(
    () =>
      selectedIds
        .map((id) => campaigns.find((campaign) => campaign.id === id))
        .filter(Boolean) as CampaignRecord[],
    [selectedIds, campaigns]
  );

  function toggleCampaign(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function move(id: string, direction: -1 | 1) {
    setSelectedIds((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  async function handlePublish() {
    setError("");
    setMessage("");

    const screen = screens.find((item) => item.id === screenId);
    if (!screen) {
      setError("Selecione uma tela.");
      return;
    }

    if (selectedCampaigns.length === 0) {
      setError("Selecione pelo menos uma campanha.");
      return;
    }

    setPublishing(true);

    try {
      const manifest = await publishPlaylist(screen, selectedCampaigns);
      setMessage(
        `Playlist publicada. Versão ${manifest.version} com ${manifest.items.length} mídia(s).`
      );
    } catch (err) {
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      setError(
        code === "permission-denied" || code === "firestore/permission-denied"
          ? "O Firestore bloqueou a publicação. Aguarde o deploy automático das regras e tente novamente."
          : "Não foi possível publicar a playlist. Tente novamente."
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <main className="auth-loading"><p className="muted">Carregando playlists...</p></main>;
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">GRADE DE PROGRAMAÇÃO</div>
          <h1>Playlists</h1>
          <p className="muted">
            Escolha uma tela, selecione as campanhas e publique uma nova versão do manifesto.
          </p>
        </div>
        <Link className="btn ghost" href="/painel">← Voltar ao painel</Link>
      </div>

      <div className="playlist-layout">
        <section className="card">
          <h2>1. Escolha a tela</h2>
          <div className="field">
            <label htmlFor="playlist-screen">Tela</label>
            <select
              id="playlist-screen"
              value={screenId}
              onChange={(event) => setScreenId(event.target.value)}
            >
              {screens.length === 0 ? <option value="">Nenhuma tela cadastrada</option> : null}
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.pointName} · {screen.screenName}
                </option>
              ))}
            </select>
          </div>
          {screens.length === 0 ? (
            <p className="muted">
              <Link href="/painel/telas">Cadastre uma tela primeiro →</Link>
            </p>
          ) : null}
        </section>

        <section className="card">
          <h2>2. Selecione as campanhas</h2>
          <p className="muted">A ordem marcada abaixo será a ordem do loop.</p>

          {campaigns.length === 0 ? (
            <p className="muted">
              <Link href="/painel/campanhas">Cadastre uma campanha primeiro →</Link>
            </p>
          ) : (
            <div className="campaign-picker">
              {campaigns.map((campaign) => {
                const selected = selectedIds.includes(campaign.id);
                return (
                  <label className={selected ? "campaign-option selected" : "campaign-option"} key={campaign.id}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCampaign(campaign.id)}
                    />
                    <span>
                      <strong>{campaign.name}</strong>
                      <small>
                        {campaign.advertiserName} · {campaign.durationSeconds}s
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <h2>3. Ordem do loop</h2>
          {selectedCampaigns.length === 0 ? (
            <p className="muted">Selecione campanhas para montar a sequência.</p>
          ) : (
            <div className="playlist-order">
              {selectedCampaigns.map((campaign, index) => (
                <div className="playlist-item" key={campaign.id}>
                  <span className="playlist-position">{index + 1}</span>
                  <div>
                    <strong>{campaign.name}</strong>
                    <small>{campaign.advertiserName} · {campaign.durationSeconds}s</small>
                  </div>
                  <div className="playlist-controls">
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => move(campaign.id, -1)}
                      disabled={index === 0}
                      aria-label="Mover para cima"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => move(campaign.id, 1)}
                      disabled={index === selectedCampaigns.length - 1}
                      aria-label="Mover para baixo"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error ? <p className="message error">{error}</p> : null}
          {message ? <p className="message success">{message}</p> : null}

          <button
            className="btn primary full"
            type="button"
            onClick={handlePublish}
            disabled={publishing || !screenId || selectedCampaigns.length === 0}
          >
            {publishing ? "Publicando..." : "Publicar playlist na TV"}
          </button>
        </section>
      </div>
    </main>
  );
}
