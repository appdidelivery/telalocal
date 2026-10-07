"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cacheManifestMedia,
  fetchLatestManifest,
  getPlayableUrl,
  markManifestCheckedToday,
  queueProofOfPlay,
  readManifest,
  saveManifest,
  wasManifestCheckedToday,
  type PlayerManifest,
} from "@/lib/player/offline";

type PlayerStatus = "starting" | "ready" | "offline" | "waiting" | "error";

export default function WebPlayer({ screenId }: { screenId: string }) {
  const [manifest, setManifest] = useState<PlayerManifest | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("starting");
  const [online, setOnline] = useState(true);
  const objectUrlsRef = useRef<string[]>([]);
  const currentVersionRef = useRef<number | null>(null);

  const preparePlayback = useCallback(async (nextManifest: PlayerManifest) => {
    try {
      await cacheManifestMedia(nextManifest);
    } catch {
      // Se algum cache falhar, o player ainda tenta reproduzir pela CDN.
    }

    const pairs = await Promise.all(
      nextManifest.items.map(async (item) => [
        item.campaignId,
        await getPlayableUrl(item.mediaUrl),
      ] as const)
    );

    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current = [];

    const nextUrls: Record<string, string> = {};
    for (const [campaignId, url] of pairs) {
      nextUrls[campaignId] = url;
      if (url.startsWith("blob:")) objectUrlsRef.current.push(url);
    }

    currentVersionRef.current = nextManifest.version;
    setUrls(nextUrls);
    setManifest(nextManifest);
    setIndex(0);
    setStatus(navigator.onLine ? "ready" : "offline");
  }, []);

  const syncFromNetwork = useCallback(
    async (force = false) => {
      if (!navigator.onLine) return;

      if (!force && wasManifestCheckedToday(screenId)) {
        return;
      }

      try {
        const latest = await fetchLatestManifest(screenId);
        markManifestCheckedToday(screenId);

        if (latest.version !== currentVersionRef.current) {
          await saveManifest(latest);
          await preparePlayback(latest);
        } else {
          setStatus("ready");
        }
      } catch {
        // Mantém o último manifesto local caso a rede ou o Firestore falhem.
      }
    },
    [preparePlayback, screenId]
  );

  useEffect(() => {
    let active = true;
    setOnline(navigator.onLine);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    (async () => {
      const cached = await readManifest(screenId).catch(() => undefined);

      if (!active) return;

      if (cached) {
        await preparePlayback(cached);
      } else {
        setStatus(navigator.onLine ? "starting" : "waiting");
      }

      if (navigator.onLine && (!cached || !wasManifestCheckedToday(screenId))) {
        await syncFromNetwork(!cached);
      }

      if (!cached && currentVersionRef.current === null) {
        setStatus(navigator.onLine ? "waiting" : "offline");
      }
    })();

    const handleOnline = () => {
      setOnline(true);
      syncFromNetwork(false);
    };

    const handleOffline = () => {
      setOnline(false);
      setStatus(currentVersionRef.current ? "offline" : "waiting");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, [preparePlayback, screenId, syncFromNetwork]);

  const current = useMemo(() => {
    if (!manifest?.items.length) return null;
    return manifest.items[index % manifest.items.length];
  }, [index, manifest]);

  async function handleEnded() {
    if (!manifest || !current) return;

    try {
      await queueProofOfPlay({
        screenId,
        campaignId: current.campaignId,
        manifestVersion: manifest.version,
      });
    } catch {
      // O log local não pode interromper a exibição.
    }

    setIndex((value) =>
      manifest.items.length > 0 ? (value + 1) % manifest.items.length : 0
    );
  }

  if (!current || !manifest) {
    return (
      <main className="tv">
        <div className="tv-ad">
          <div>
            <div className="eyebrow">TELALOCAL • WEB PLAYER</div>
            <h1>
              {status === "waiting"
                ? "Aguardando playlist."
                : "Preparando player..."}
            </h1>
            <p>
              {online
                ? "Quando uma playlist for publicada, ela será carregada nesta tela."
                : "Sem conexão e ainda não há uma playlist salva neste aparelho."}
            </p>
            <small className="player-id">Tela: {screenId}</small>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="player-root">
      <video
        key={`${manifest.version}:${current.campaignId}:${index}`}
        className="player-video"
        src={urls[current.campaignId] || current.mediaUrl}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleEnded}
        onError={() => window.setTimeout(handleEnded, 1500)}
      />
      <div className="player-badge">
        <span className={online ? "status-dot online" : "status-dot"} />
        {status === "offline" ? "offline • cache local" : "online"}
      </div>
    </main>
  );
}
