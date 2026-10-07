"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WebPlayer from "@/components/player/WebPlayer";
import {
  createPairingRequest,
  subscribeToPairing,
  type PairingAssignment,
  type PairingRequest,
} from "@/lib/firebase/pairing";

const DEVICE_KEY = "telalocal:paired-device";
const PENDING_KEY = "telalocal:pending-pairing";

type StoredPending = PairingRequest;

function readStoredAssignment(): PairingAssignment | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PairingAssignment;
    return value.screenId && value.playerKey ? value : null;
  } catch {
    return null;
  }
}

function readPending(): StoredPending | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredPending;
    if (
      value.pairId &&
      value.code &&
      value.status === "pending" &&
      value.expiresAtMs > Date.now()
    ) {
      return value;
    }
  } catch {}

  return null;
}

export default function TvPairingClient() {
  const [assignment, setAssignment] = useState<PairingAssignment | null>(null);
  const [request, setRequest] = useState<PairingRequest | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const beginPairing = useCallback(async (forceNew = false) => {
    setError("");

    try {
      if (!forceNew) {
        const existing = readStoredAssignment();
        if (existing) {
          setAssignment(existing);
          return;
        }
      }

      if (forceNew) {
        window.localStorage.removeItem(DEVICE_KEY);
        window.localStorage.removeItem(PENDING_KEY);
        setAssignment(null);
      }

      const pending = !forceNew ? readPending() : null;
      const next = pending ?? (await createPairingRequest());

      window.localStorage.setItem(PENDING_KEY, JSON.stringify(next));
      setRequest(next);
    } catch {
      setError("Não foi possível gerar o código. Verifique a internet da TV.");
    }
  }, []);

  useEffect(() => {
    void beginPairing(false);
  }, [beginPairing]);

  useEffect(() => {
    if (!request?.pairId || assignment) return;

    const unsubscribe = subscribeToPairing(
      request.pairId,
      (paired) => {
        window.localStorage.setItem(DEVICE_KEY, JSON.stringify(paired));
        window.localStorage.removeItem(PENDING_KEY);
        setAssignment(paired);
      },
      () => setError("A conexão do pareamento foi interrompida.")
    );

    return unsubscribe;
  }, [assignment, request?.pairId]);

  useEffect(() => {
    if (!request || assignment) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [assignment, request]);

  const secondsLeft = useMemo(() => {
    if (!request) return 0;
    return Math.max(0, Math.ceil((request.expiresAtMs - now) / 1000));
  }, [now, request]);

  useEffect(() => {
    if (request && !assignment && secondsLeft === 0) {
      window.localStorage.removeItem(PENDING_KEY);
    }
  }, [assignment, request, secondsLeft]);

  if (assignment) {
    return (
      <>
        <WebPlayer
          screenId={assignment.screenId}
          playerKey={assignment.playerKey}
        />
        <button
          type="button"
          className="tv-unpair-btn"
          onClick={() => void beginPairing(true)}
        >
          Desvincular TV
        </button>
      </>
    );
  }

  return (
    <main className="tv-pair-page">
      <section className="tv-pair-card">
        <div className="brand tv-pair-brand">
          Tela<span>Local</span>
        </div>
        <div className="eyebrow">PAREAR ESTA TV</div>
        <h1>Digite este código no painel</h1>

        {request && secondsLeft > 0 ? (
          <>
            <div className="tv-pair-code" aria-label={request.code}>
              {request.code.slice(0, 3)}
              <span> </span>
              {request.code.slice(3)}
            </div>
            <p>
              No celular ou computador, abra <strong>Painel → Parear TV</strong>,
              escolha a tela e informe este código.
            </p>
            <small>Expira em {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</small>
          </>
        ) : (
          <>
            <p>O código expirou.</p>
            <button
              type="button"
              className="btn primary"
              onClick={() => void beginPairing(true)}
            >
              Gerar novo código
            </button>
          </>
        )}

        {error ? <p className="message error">{error}</p> : null}
      </section>
    </main>
  );
}
