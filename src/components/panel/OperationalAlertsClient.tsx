"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  getTenantContext,
  listHeartbeats,
  listScreens,
  type HeartbeatRecord,
  type ScreenRecord,
} from "@/lib/firebase/screens";

type AlertRow = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  screenName: string;
};

function ageLabel(ms?: number) {
  if (!ms) return "sem comunicação registrada";
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return "há " + minutes + " min";
  return "há " + Math.floor(minutes / 60) + "h";
}

export default function OperationalAlertsClient() {
  const router = useRouter();
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [heartbeats, setHeartbeats] = useState<Record<string, HeartbeatRecord>>({});
  const [loading, setLoading] = useState(true);

  async function reload() {
    const context = await getTenantContext();
    const [screenList, heartbeatMap] = await Promise.all([
      listScreens(context),
      listHeartbeats(context),
    ]);
    setScreens(screenList);
    setHeartbeats(heartbeatMap);
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        await reload();
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  const alerts = useMemo<AlertRow[]>(() => {
    const now = Date.now();
    const rows: AlertRow[] = [];

    screens.forEach((screen) => {
      const hb = heartbeats[screen.id];
      const lastSeen = Number(hb?.lastSeenAtMs || 0);
      const age = lastSeen ? now - lastSeen : Number.POSITIVE_INFINITY;
      const name = screen.pointName + " · " + screen.screenName;

      if (!lastSeen) {
        rows.push({
          id: screen.id + ":never",
          severity: "warning",
          title: "TV ainda não comunicou",
          detail: "Pareie a TV e mantenha o player aberto para validar o heartbeat.",
          screenName: name,
        });
      } else if (age > 60 * 60 * 1000) {
        rows.push({
          id: screen.id + ":offline-critical",
          severity: "critical",
          title: "TV offline há mais de 1 hora",
          detail: "Última comunicação " + ageLabel(lastSeen) + ".",
          screenName: name,
        });
      } else if (age > 15 * 60 * 1000) {
        rows.push({
          id: screen.id + ":offline-warning",
          severity: "warning",
          title: "TV offline há mais de 15 minutos",
          detail: "Última comunicação " + ageLabel(lastSeen) + ".",
          screenName: name,
        });
      } else if (age > 7 * 60 * 1000) {
        rows.push({
          id: screen.id + ":offline",
          severity: "warning",
          title: "TV provavelmente offline",
          detail: "Heartbeat atrasado; última comunicação " + ageLabel(lastSeen) + ".",
          screenName: name,
        });
      }

      if (hb?.compatMode) {
        rows.push({
          id: screen.id + ":compat",
          severity: "warning",
          title: "Navegador em modo de compatibilidade",
          detail:
            (hb.browserFamily || "Navegador") +
            " " +
            (hb.browserVersion || "") +
            " pode ter limitações de vídeo/cache.",
          screenName: name,
        });
      }

      if (hb && hb.h264Support === "no") {
        rows.push({
          id: screen.id + ":h264",
          severity: "critical",
          title: "H.264 não confirmado",
          detail: "Este navegador não informou suporte ao codec padrão do player.",
          screenName: name,
        });
      }
    });

    return rows.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [heartbeats, screens]);

  const critical = alerts.filter((item) => item.severity === "critical").length;
  const warning = alerts.filter((item) => item.severity === "warning").length;

  if (loading) {
    return (
      <main className="auth-loading">
        <p className="muted">Verificando a rede...</p>
      </main>
    );
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">MONITORAMENTO OPERACIONAL</div>
          <h1>Alertas da rede</h1>
          <p className="muted">
            Identifique TVs paradas, heartbeat atrasado e navegadores com risco de incompatibilidade.
          </p>
        </div>
        <div className="screen-actions">
          <button className="btn primary" type="button" onClick={() => void reload()}>
            Atualizar
          </button>
          <Link className="btn ghost" href="/painel/telas">Ver telas</Link>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="muted">Críticos</span><b>{critical}</b></div>
        <div className="stat"><span className="muted">Atenção</span><b>{warning}</b></div>
        <div className="stat"><span className="muted">Telas monitoradas</span><b>{screens.length}</b></div>
        <div className="stat">
          <span className="muted">Situação</span>
          <b className="stat-small">{alerts.length ? "Requer atenção" : "Rede saudável"}</b>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state operational-ok">
          <strong>Nenhum alerta operacional agora.</strong>
          <p className="muted">As TVs monitoradas estão dentro da janela esperada de heartbeat.</p>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <article className={"card alert-row " + alert.severity} key={alert.id}>
              <span className="alert-severity">
                {alert.severity === "critical" ? "CRÍTICO" : "ATENÇÃO"}
              </span>
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.screenName}</p>
                <small>{alert.detail}</small>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="proof-note">
        O alerta desta página é calculado ao abrir ou atualizar o painel. Notificação automática por e-mail ou WhatsApp com o painel fechado exige um canal de envio conectado.
      </p>
    </main>
  );
}
