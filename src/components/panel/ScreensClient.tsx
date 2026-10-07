"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  createPointAndScreen,
  getTenantContext,
  isHeartbeatOnline,
  listHeartbeats,
  listScreens,
  refreshScreen,
  setScreenPlaybackStatus,
  unpairScreen,
  type HeartbeatRecord,
  type ScreenRecord,
} from "@/lib/firebase/screens";
import { firebaseErrorMessage } from "@/lib/firebase/errors";
import { PLAN_LIMITS } from "@/lib/plans";

function ago(timestamp?: number) {
  if (!timestamp) return "nunca";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours}h`;
}

export default function ScreensClient() {
  const router = useRouter();
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [heartbeats, setHeartbeats] = useState<Record<string, HeartbeatRecord>>({});
  const [tenantId, setTenantId] = useState("");
  const [ownerUid, setOwnerUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pointName, setPointName] = useState("");
  const [screenName, setScreenName] = useState("TV principal");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

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

        const [screenList, heartbeatMap] = await Promise.all([
          listScreens(context),
          listHeartbeats(context),
        ]);

        setScreens(screenList);
        setHeartbeats(heartbeatMap);
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
    setMessage("");

    if (screens.length >= PLAN_LIMITS.pilot.screens) {
      setError(
        `O plano piloto permite até ${PLAN_LIMITS.pilot.screens} telas.`
      );
      return;
    }

    setSaving(true);

    try {
      const created = await createPointAndScreen(
        { tenantId, ownerUid },
        { pointName, screenName, category, address, city, state, zipCode }
      );
      setScreens((current) => [created, ...current]);
      setPointName("");
      setScreenName("TV principal");
      setCategory("");
      setAddress("");
      setCity("");
      setState("");
      setZipCode("");
      setMessage("Tela criada. Agora você pode pareá-la com uma Smart TV.");
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
    setMessage("URL curta copiada.");
  }

  async function runAction(
    screen: ScreenRecord,
    action: "pause" | "resume" | "refresh" | "unpair"
  ) {
    setActingId(screen.id);
    setError("");
    setMessage("");

    try {
      if (action === "pause" || action === "resume") {
        const nextStatus = action === "pause" ? "paused" : "active";
        await setScreenPlaybackStatus(screen, nextStatus);
        setScreens((current) =>
          current.map((item) =>
            item.id === screen.id ? { ...item, status: nextStatus } : item
          )
        );
        setMessage(
          action === "pause"
            ? "Tela pausada remotamente."
            : "Tela reativada remotamente."
        );
      } else if (action === "refresh") {
        await refreshScreen(screen);
        setMessage("Sincronização remota enviada para a TV.");
      } else {
        if (
          !window.confirm(
            "Desvincular o aparelho pareado? A TV voltará a exibir um novo código."
          )
        ) {
          return;
        }
        const pairingEpoch = await unpairScreen(screen);
        setScreens((current) =>
          current.map((item) =>
            item.id === screen.id ? { ...item, pairingEpoch } : item
          )
        );
        setMessage("Comando de desvinculação enviado.");
      }
    } catch {
      setError("Não foi possível executar o comando remoto.");
    } finally {
      setActingId("");
    }
  }

  if (loading) {
    return (
      <main className="auth-loading">
        <p className="muted">Carregando telas...</p>
      </main>
    );
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">REDE DE TELAS</div>
          <h1>Telas e pontos físicos</h1>
          <p className="muted">
            Status real, URL curta, pareamento e comandos remotos em um só lugar.
          </p>
        </div>
        <div className="screen-actions">
          <Link className="btn primary" href="/painel/parear-tv">
            Parear TV
          </Link>
          <Link className="btn ghost" href="/painel">
            ← Voltar
          </Link>
        </div>
      </div>

      {message ? <p className="message success">{message}</p> : null}
      {error ? <p className="message error">{error}</p> : null}

      <div className="two-column">
        <form className="card screen-form" onSubmit={handleSubmit}>
          <h2>Cadastrar tela</h2>
          <p className="muted">
            Plano piloto: {screens.length}/{PLAN_LIMITS.pilot.screens} telas.
          </p>

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
              <option>Hamburgueria</option>
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

          <div className="field">
            <label htmlFor="zipCode">CEP</label>
            <input id="zipCode" inputMode="numeric" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="88000-000" />
          </div>

          <button
            className="btn primary full"
            type="submit"
            disabled={
              saving ||
              !tenantId ||
              screens.length >= PLAN_LIMITS.pilot.screens
            }
          >
            {saving ? "Criando tela..." : "Cadastrar ponto e gerar URL"}
          </button>
        </form>

        <section>
          <div className="list-header">
            <div>
              <h2>Telas cadastradas</h2>
              <p className="muted">{screens.length} tela(s)</p>
            </div>
          </div>

          {screens.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhuma tela ainda.</strong>
            </div>
          ) : (
            <div className="screen-list">
              {screens.map((screen) => {
                const heartbeat = heartbeats[screen.id];
                const live = isHeartbeatOnline(heartbeat);
                const paused = screen.status === "paused";

                return (
                  <article className="screen-row screen-row-operational" key={screen.id}>
                    <div className="screen-main">
                      <div className="screen-status-line">
                        <span className={live ? "screen-live online" : "screen-live offline"}>
                          {live ? "ONLINE" : "OFFLINE"}
                        </span>
                        {paused ? <span className="screen-live paused">PAUSADA</span> : null}
                      </div>
                      <h3>{screen.pointName} · {screen.screenName}</h3>
                      <p className="muted">
                        {screen.category} • {screen.city}/{screen.state}
                        {screen.zipCode ? ` • CEP ${screen.zipCode}` : ""}
                      </p>
                      <code>{screen.playerPath}</code>

                      <div className="screen-telemetry">
                        <span>Última comunicação: <strong>{ago(heartbeat?.lastSeenAtMs)}</strong></span>
                        <span>Manifesto: <strong>v{heartbeat?.manifestVersion ?? screen.manifestVersion ?? 0}</strong></span>
                        <span>Estado: <strong>{heartbeat?.playerState ?? "—"}</strong></span>
                        <span>
                          Campanha: <strong>{heartbeat?.currentCampaignName || heartbeat?.currentCampaignId?.slice(0, 8) || "—"}</strong>
                        </span>
                      </div>

                      {heartbeat ? (
                        <div className="screen-diagnostics">
                          <span className={heartbeat.compatMode ? "diag-pill warn" : "diag-pill ok"}>
                            {heartbeat.compatMode ? "Compatibilidade: atenção" : "Compatibilidade: OK"}
                          </span>
                          <span className="diag-pill">
                            {heartbeat.browserFamily || "Navegador"}
                            {heartbeat.browserVersion ? ` ${heartbeat.browserVersion}` : ""}
                          </span>
                          <span className={heartbeat.h264Support === "no" ? "diag-pill warn" : "diag-pill"}>
                            H.264: {heartbeat.h264Support || "—"}
                          </span>
                          <span className={heartbeat.supportsIndexedDb ? "diag-pill" : "diag-pill warn"}>
                            IndexedDB: {heartbeat.supportsIndexedDb ? "sim" : "não"}
                          </span>
                          <span className={heartbeat.supportsCacheStorage ? "diag-pill" : "diag-pill warn"}>
                            Cache: {heartbeat.supportsCacheStorage ? "sim" : "não"}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="screen-actions screen-actions-stack">
                      <Link className="btn ghost" href={screen.playerPath} target="_blank">
                        Abrir player
                      </Link>
                      <button className="btn ghost" type="button" onClick={() => copyUrl(screen.playerPath)}>
                        Copiar URL
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={actingId === screen.id}
                        onClick={() =>
                          void runAction(screen, paused ? "resume" : "pause")
                        }
                      >
                        {paused ? "Retomar" : "Pausar"}
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={actingId === screen.id}
                        onClick={() => void runAction(screen, "refresh")}
                      >
                        Sincronizar
                      </button>
                      <button
                        className="btn ghost danger-soft"
                        type="button"
                        disabled={actingId === screen.id}
                        onClick={() => void runAction(screen, "unpair")}
                      >
                        Desvincular aparelho
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
