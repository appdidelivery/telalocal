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
  type PlayerManifestItem,
} from "@/lib/player/offline";
import { sendPlayerHeartbeat } from "@/lib/player/heartbeat";

type PlayerStatus = "starting" | "ready" | "offline" | "waiting" | "error";

const WATCHDOG_GRACE_MS = 2500;
const HEARTBEAT_MS = 5 * 60 * 1000;

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function localTimeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function isScheduledNow(item: PlayerManifestItem, now: Date) {
  if (!item.scheduleEnabled) return true;

  const date = localDateKey(now);
  const time = localTimeKey(now);
  const day = now.getDay();

  if (item.scheduleStartDate && date < item.scheduleStartDate) return false;
  if (item.scheduleEndDate && date > item.scheduleEndDate) return false;

  if (item.scheduleDays?.length && !item.scheduleDays.includes(day)) {
    return false;
  }

  const start = item.scheduleStartTime || "";
  const end = item.scheduleEndTime || "";

  if (start && end) {
    if (start <= end) {
      if (time < start || time > end) return false;
    } else if (time < start && time > end) {
      // Faixa atravessa meia-noite, por exemplo 18:00–02:00.
      return false;
    }
  } else if (start && time < start) {
    return false;
  } else if (end && time > end) {
    return false;
  }

  return true;
}

export default function WebPlayer({
  screenId,
  playerKey,
  bindingEpoch,
  onRemoteUnpair,
}: {
  screenId: string;
  playerKey: string;
  bindingEpoch?: number;
  onRemoteUnpair?: () => void;
}) {
  const [manifest, setManifest] = useState<PlayerManifest | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [playbackCycle, setPlaybackCycle] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("starting");
  const [online, setOnline] = useState(true);
  const [origin, setOrigin] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenControlExpanded, setFullscreenControlExpanded] = useState(true);
  const [fullscreenNotice, setFullscreenNotice] = useState("");

  const playerRootRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const manifestRef = useRef<PlayerManifest | null>(null);
  const eligibleItemsRef = useRef<PlayerManifestItem[]>([]);
  const currentCampaignRef = useRef("");
  const currentCampaignNameRef = useRef("");
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

  const sendHeartbeatNow = useCallback(async () => {
    const currentManifest = manifestRef.current;
    if (!currentManifest || !navigator.onLine) return;

    const playerState =
      currentManifest.playerStatus === "paused"
        ? "paused"
        : eligibleItemsRef.current.length > 0
          ? "active"
          : "waiting";

    try {
      await sendPlayerHeartbeat({
        tenantId: currentManifest.tenantId,
        screenId,
        playerKey,
        playerState,
        currentCampaignId: currentCampaignRef.current,
        currentCampaignName: currentCampaignNameRef.current,
        manifestVersion: currentManifest.version,
        mediaCount: eligibleItemsRef.current.length,
      });
    } catch {
      // Heartbeat operacional nunca interfere na reprodução.
    }
  }, [playerKey, screenId]);

  const preparePlayback = useCallback(
    async (nextManifest: PlayerManifest) => {
      if (
        bindingEpoch !== undefined &&
        Number(nextManifest.pairingEpoch ?? 1) > bindingEpoch
      ) {
        onRemoteUnpair?.();
        return;
      }

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

        window.setTimeout(() => void sendHeartbeatNow(), 250);
      } finally {
        preparingVersionRef.current = null;
      }
    },
    [bindingEpoch, clearWatchdog, onRemoteUnpair, sendHeartbeatNow]
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
      void sendHeartbeatNow();
    };

    const handleOffline = () => {
      setOnline(false);
      setStatus(manifestRef.current ? "offline" : "waiting");
    };

    const proofInterval = window.setInterval(
      () => void trySyncProof(false),
      5 * 60 * 1000
    );

    const heartbeatInterval = window.setInterval(
      () => void sendHeartbeatNow(),
      HEARTBEAT_MS
    );

    const scheduleClock = window.setInterval(
      () => setClock(Date.now()),
      60 * 1000
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
    document.addEventListener(
      "webkitfullscreenchange",
      handleFullscreenChange as EventListener
    );

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(proofInterval);
      window.clearInterval(heartbeatInterval);
      window.clearInterval(scheduleClock);
      clearWatchdog();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pointermove", revealFullscreenControl);
      window.removeEventListener("touchstart", revealFullscreenControl);
      window.removeEventListener("keydown", revealFullscreenControl);
      clearFullscreenControlTimer();
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange as EventListener
      );

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
    sendHeartbeatNow,
    trySyncProof,
  ]);

  const eligibleItems = useMemo(() => {
    if (!manifest?.items.length) return [];
    const now = new Date(clock);
    return manifest.items.filter((item) => isScheduledNow(item, now));
  }, [clock, manifest]);

  const eligibleSignature = useMemo(
    () => eligibleItems.map((item) => item.campaignId).join("|"),
    [eligibleItems]
  );

  useEffect(() => {
    eligibleItemsRef.current = eligibleItems;
    setIndex((value) =>
      eligibleItems.length ? value % eligibleItems.length : 0
    );
  }, [eligibleItems, eligibleSignature]);

  const current = useMemo(() => {
    if (!eligibleItems.length) return null;
    return eligibleItems[index % eligibleItems.length];
  }, [eligibleItems, index]);

  useEffect(() => {
    currentCampaignRef.current = current?.campaignId ?? "";
    currentCampaignNameRef.current = current?.name ?? "";
  }, [current?.campaignId, current?.name]);

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
      const activeItems = eligibleItemsRef.current;

      if (
        !activeManifest ||
        !activeItems.length ||
        transitionLockRef.current
      ) {
        return;
      }

      transitionLockRef.current = true;
      clearWatchdog();

      const activeIndex = index % activeItems.length;
      const completedItem = activeItems[activeIndex];

      if (reason !== "error" && completedItem) {
        recordCompletedPlay(activeManifest, completedItem.campaignId);
      }

      // Smart TVs mais antigas podem manter o frame final/preto quando existe
      // somente um vídeo. Nesse caso reiniciamos o mesmo elemento de vídeo
      // diretamente, sem desmontá-lo e sem depender de uma troca de playlist.
      if (
        activeItems.length === 1 &&
        completedItem?.mediaType !== "image" &&
        reason !== "error"
      ) {
        const video = videoRef.current;
        const fallbackSeconds =
          Number.isFinite(completedItem.durationSeconds) &&
          completedItem.durationSeconds > 0
            ? completedItem.durationSeconds
            : 30;

        if (video) {
          try {
            video.muted = true;
            video.currentTime = 0;
            void video.play().catch(() => {
              // Fallback para browsers de TV que recusam o replay no mesmo nó.
              setPlaybackCycle((value) => value + 1);
            });
          } catch {
            setPlaybackCycle((value) => value + 1);
          }
        } else {
          setPlaybackCycle((value) => value + 1);
        }

        watchdogRef.current = window.setTimeout(
          () => advancePlayback("watchdog"),
          Math.ceil(fallbackSeconds * 1000) + WATCHDOG_GRACE_MS
        );

        window.setTimeout(() => {
          transitionLockRef.current = false;
        }, 120);
        return;
      }

      setIndex((value) => (value + 1) % activeItems.length);
      setPlaybackCycle((value) => value + 1);

      window.setTimeout(() => {
        transitionLockRef.current = false;
      }, 120);
    },
    [clearWatchdog, index, recordCompletedPlay]
  );

  const armWatchdog = useCallback(() => {
    clearWatchdog();

    const activeItems = eligibleItemsRef.current;
    if (!activeItems.length) return;

    const activeIndex = index % activeItems.length;
    const item = activeItems[activeIndex];
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
    if (!current || manifest?.playerStatus === "paused") return;

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
  }, [armWatchdog, clearWatchdog, current, manifest?.playerStatus, playbackCycle]);

  const handleCanPlay = useCallback(() => {
    if (manifestRef.current?.playerStatus === "paused") return;

    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    void video.play().then(armWatchdog).catch(() => undefined);
  }, [armWatchdog]);

  const fullscreenButton = (
    <button
      type="button"
      className={`player-fullscreen-btn${
        isFullscreen && !fullscreenControlExpanded ? " compact" : ""
      }`}
      onClick={toggleFullscreen}
      title={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
      aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
    >
      <span className="fullscreen-icon">⛶</span>
      <span className="fullscreen-label">
        {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
      </span>
    </button>
  );

  if (manifest?.playerStatus === "paused") {
    return (
      <main className="tv" ref={playerRootRef}>
        {fullscreenButton}
        <div className="tv-ad">
          <div>
            <div className="eyebrow">TELALOCAL • TELA PAUSADA</div>
            <h1>Exibição pausada remotamente.</h1>
            <p>O conteúdo volta automaticamente quando a tela for reativada no painel.</p>
            <small className="player-id">Tela: {screenId}</small>
          </div>
        </div>
      </main>
    );
  }

  if (!manifest || !current) {
    const hasManifest = Boolean(manifest);
    return (
      <main className="tv" ref={playerRootRef}>
        {fullscreenButton}
        {fullscreenNotice ? (
          <div className="player-fullscreen-notice">{fullscreenNotice}</div>
        ) : null}
        <div className="tv-ad">
          <div>
            <div className="eyebrow">TELALOCAL • WEB PLAYER</div>
            <h1>
              {hasManifest
                ? "Nenhuma campanha programada agora."
                : status === "waiting"
                  ? "Aguardando playlist."
                  : "Preparando player..."}
            </h1>
            <p>
              {hasManifest
                ? "A tela retomará automaticamente quando entrar no horário de uma campanha."
                : online
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
      {fullscreenButton}

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
