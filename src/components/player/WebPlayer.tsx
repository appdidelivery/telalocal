"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  cacheManifestMedia,
  getPlayableUrl,
  queueProofOfPlay,
  readManifest,
  saveManifest,
  subscribeToManifest,
  syncProofOfPlay,
  type PlayerManifest,
} from "@/lib/player/offline";

type PlayerStatus = "starting" | "ready" | "offline" | "waiting" | "error";

const WATCHDOG_GRACE_MS = 2500;

export default function WebPlayer({
  screenId,
  playerKey,
}: {
  screenId: string;
  playerKey: string;
}) {
  const [manifest, setManifest] = useState<PlayerManifest | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [playbackCycle, setPlaybackCycle] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("starting");
  const [online, setOnline] = useState(true);
  const [origin, setOrigin] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenControlExpanded, setFullscreenControlExpanded] = useState(true);
  const [fullscreenNotice, setFullscreenNotice] = useState("");

  const playerRootRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const manifestRef = useRef<PlayerManifest | null>(null);
  const preparingVersionRef = useRef<number | null>(null);
  const transitionLockRef = useRef(false);
  const watchdogRef = useRef<number | null>(null);
  const fullscreenControlTimerRef = useRef<number | null>(null);

  const clearFullscreenControlTimer = useCallback(() => {
    if (fullscreenControlTimerRef.current !== null) {
      window.clearTimeout(fullscreenControlTimerRef.current);
      fullscreenControlTimerRef.current = null;
    }
  }, []);

  const scheduleFullscreenControlCompact = useCallback(() => {
    clearFullscreenControlTimer();
    fullscreenControlTimerRef.current = window.setTimeout(() => {
      setFullscreenControlExpanded(false);
    }, 3500);
  }, [clearFullscreenControlTimer]);

  const revealFullscreenControl = useCallback(() => {
    if (!isFullscreen) return;
    setFullscreenControlExpanded(true);
    scheduleFullscreenControlCompact();
  }, [isFullscreen, scheduleFullscreenControlCompact]);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
      msFullscreenElement?: Element | null;
      msExitFullscreen?: () => Promise<void> | void;
    };

    const target = (playerRootRef.current || document.documentElement) as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };

    const fullscreenElement =
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement;

    try {
      if (fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        return;
      }

      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      } else if (target.msRequestFullscreen) {
        await target.msRequestFullscreen();
      } else {
        setFullscreenNotice(
          "Este navegador da TV não libera tela cheia pelo site. Use o menu do navegador → Tela cheia."
        );
        window.setTimeout(() => setFullscreenNotice(""), 6000);
      }
    } catch {
      setFullscreenNotice(
        "A TV bloqueou a tela cheia automática. Pressione novamente ou use o menu do navegador."
      );
      window.setTimeout(() => setFullscreenNotice(""), 6000);
    }
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const preparePlayback = useCallback(
    async (nextManifest: PlayerManifest) => {
      if (
        manifestRef.current?.version === nextManifest.version ||
        preparingVersionRef.current === nextManifest.version
      ) {
        return;
      }

      preparingVersionRef.current = nextManifest.version;

      try {
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

        clearWatchdog();
        transitionLockRef.current = false;
        manifestRef.current = nextManifest;
        await saveManifest(nextManifest);
        setUrls(nextUrls);
        setManifest(nextManifest);
        setIndex(0);
        setPlaybackCycle((value) => value + 1);
        setStatus(navigator.onLine ? "ready" : "offline");
      } finally {
        preparingVersionRef.current = null;
      }
    },
    [clearWatchdog]
  );

  const trySyncProof = useCallback(
    async (force = false) => {
      const currentManifest = manifestRef.current;
      if (!currentManifest || !playerKey) return;

      try {
        await syncProofOfPlay({
          tenantId: currentManifest.tenantId,
          screenId,
          playerKey,
          force,
        });
      } catch {
        // O Proof of Play permanece na fila local e será reenviado depois.
      }
    },
    [playerKey, screenId]
  );

  useEffect(() => {
    let active = true;
    setOnline(navigator.onLine);
    setOrigin(window.location.origin);

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
    })();

    const unsubscribe = subscribeToManifest(
      screenId,
      async (latest) => {
        if (!active) return;
        await preparePlayback(latest);
      },
      () => {
        if (!manifestRef.current) setStatus("waiting");
      }
    );

    const handleOnline = () => {
      setOnline(true);
      setStatus(manifestRef.current ? "ready" : "starting");
      void trySyncProof(false);
    };

    const handleOffline = () => {
      setOnline(false);
      setStatus(manifestRef.current ? "offline" : "waiting");
    };

    const proofInterval = window.setInterval(
      () => void trySyncProof(false),
      5 * 60 * 1000
    );

    const handleFullscreenChange = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        msFullscreenElement?: Element | null;
      };

      const fullscreen = Boolean(
        document.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.msFullscreenElement
      );

      setIsFullscreen(fullscreen);
      setFullscreenControlExpanded(true);

      if (fullscreen) {
        scheduleFullscreenControlCompact();
      } else {
        clearFullscreenControlTimer();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pointermove", revealFullscreenControl);
    window.addEventListener("touchstart", revealFullscreenControl);
    window.addEventListener("keydown", revealFullscreenControl);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(proofInterval);
      clearWatchdog();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pointermove", revealFullscreenControl);
      window.removeEventListener("touchstart", revealFullscreenControl);
      window.removeEventListener("keydown", revealFullscreenControl);
      clearFullscreenControlTimer();
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);

      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, [
    clearFullscreenControlTimer,
    clearWatchdog,
    preparePlayback,
    revealFullscreenControl,
    scheduleFullscreenControlCompact,
    screenId,
    trySyncProof,
  ]);

  const current = useMemo(() => {
    if (!manifest?.items.length) return null;
    return manifest.items[index % manifest.items.length];
  }, [index, manifest]);

  const recordCompletedPlay = useCallback(
    (completedManifest: PlayerManifest, campaignId: string) => {
      void (async () => {
        try {
          await queueProofOfPlay({
            screenId,
            campaignId,
            manifestVersion: completedManifest.version,
          });
          await trySyncProof(false);
        } catch {
          // Telemetria nunca pode interromper ou atrasar a reprodução.
        }
      })();
    },
    [screenId, trySyncProof]
  );

  const advancePlayback = useCallback(
    (reason: "ended" | "watchdog" | "error") => {
      const activeManifest = manifestRef.current;
      if (!activeManifest?.items.length || transitionLockRef.current) return;

      transitionLockRef.current = true;
      clearWatchdog();

      const activeIndex = index % activeManifest.items.length;
      const completedItem = activeManifest.items[activeIndex];

      if (reason !== "error" && completedItem) {
        recordCompletedPlay(activeManifest, completedItem.campaignId);
      }

      setIndex((value) => (value + 1) % activeManifest.items.length);
      setPlaybackCycle((value) => value + 1);

      window.setTimeout(() => {
        transitionLockRef.current = false;
      }, 120);
    },
    [clearWatchdog, index, recordCompletedPlay]
  );

  const armWatchdog = useCallback(() => {
    clearWatchdog();

    const activeManifest = manifestRef.current;
    if (!activeManifest?.items.length) return;

    const activeIndex = index % activeManifest.items.length;
    const item = activeManifest.items[activeIndex];
    const fallbackSeconds =
      Number.isFinite(item?.durationSeconds) && item.durationSeconds > 0
        ? item.durationSeconds
        : 30;

    watchdogRef.current = window.setTimeout(
      () => advancePlayback("watchdog"),
      Math.ceil(fallbackSeconds * 1000) +
        (item?.mediaType === "image" ? 0 : WATCHDOG_GRACE_MS)
    );
  }, [advancePlayback, clearWatchdog, index]);

  useEffect(() => {
    if (!current) return;

    if (current.mediaType === "image") {
      armWatchdog();
      return () => clearWatchdog();
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const start = async () => {
      try {
        video.muted = true;
        video.currentTime = 0;
        await video.play();
        if (!cancelled) armWatchdog();
      } catch {
        // Alguns browsers de TV demoram para liberar autoplay.
      }
    };

    void start();

    return () => {
      cancelled = true;
      clearWatchdog();
    };
  }, [armWatchdog, clearWatchdog, current, playbackCycle]);

  const handleCanPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    void video.play().then(armWatchdog).catch(() => undefined);
  }, [armWatchdog]);

  if (!current || !manifest) {
    return (
      <main className="tv" ref={playerRootRef}>
        <button
          type="button"
          className={`player-fullscreen-btn${isFullscreen && !fullscreenControlExpanded ? " compact" : ""}`}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
        >
          <span className="fullscreen-icon">⛶</span>
          <span className="fullscreen-label">
            {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          </span>
        </button>
        {fullscreenNotice ? (
          <div className="player-fullscreen-notice">{fullscreenNotice}</div>
        ) : null}
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

  const conversionUrl =
    origin && current.conversionPath ? `${origin}${current.conversionPath}` : "";
  const mediaUrl = urls[current.campaignId] || current.mediaUrl;
  const mediaKey = `${manifest.version}:${current.campaignId}:${playbackCycle}`;

  return (
    <main className="player-root" ref={playerRootRef}>
      <button
        type="button"
        className={`player-fullscreen-btn${isFullscreen && !fullscreenControlExpanded ? " compact" : ""}`}
        onClick={toggleFullscreen}
        title={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
        aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
      >
        <span className="fullscreen-icon">⛶</span>
        <span className="fullscreen-label">
          {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        </span>
      </button>

      {fullscreenNotice ? (
        <div className="player-fullscreen-notice">{fullscreenNotice}</div>
      ) : null}
      {current.mediaType === "image" ? (
        <img
          key={mediaKey}
          className="player-media player-image player-fade"
          src={mediaUrl}
          alt=""
          onLoad={armWatchdog}
          onError={() => window.setTimeout(() => advancePlayback("error"), 800)}
        />
      ) : (
        <video
          ref={videoRef}
          key={mediaKey}
          className="player-media player-video player-fade"
          src={mediaUrl}
          autoPlay
          muted
          playsInline
          preload="auto"
          onLoadedData={handleCanPlay}
          onCanPlay={handleCanPlay}
          onPlaying={armWatchdog}
          onEnded={() => advancePlayback("ended")}
          onError={() => {
            window.setTimeout(() => advancePlayback("error"), 800);
          }}
        />
      )}

      {conversionUrl ? (
        <div className="conversion-overlay">
          <div className="conversion-copy">
            <strong>{current.offerText || "Escaneie e aproveite"}</strong>
            <span>
              {current.couponCode
                ? `Cupom ${current.couponCode} • WhatsApp`
                : "Abra no celular • WhatsApp"}
            </span>
          </div>
          <div className="conversion-qr">
            <QRCodeSVG
              value={conversionUrl}
              size={138}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
        </div>
      ) : null}

      <div className="player-badge">
        <span className={online ? "status-dot online" : "status-dot"} />
        {status === "offline" ? "offline • cache local" : "online"}
      </div>
    </main>
  );
}
