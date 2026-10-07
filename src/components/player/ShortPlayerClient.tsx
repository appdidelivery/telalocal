"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import WebPlayer from "@/components/player/WebPlayer";

type AliasRecord = {
  screenId: string;
  playerKey: string;
  status: string;
  cachedAt?: number;
};

const CACHE_TTL = 24 * 60 * 60 * 1000;

export default function ShortPlayerClient({ shortCode }: { shortCode: string }) {
  const [alias, setAlias] = useState<AliasRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const cacheKey = `telalocal:screen-alias:${shortCode}`;

    async function load() {
      try {
        const cachedRaw = window.localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as AliasRecord;
          if (
            cached.screenId &&
            cached.playerKey &&
            cached.cachedAt &&
            Date.now() - cached.cachedAt < CACHE_TTL
          ) {
            if (active) setAlias(cached);
            return;
          }
        }

        const snapshot = await getDoc(doc(db, "screenAliases", shortCode));
        if (!snapshot.exists()) {
          if (active) setError("Tela não encontrada.");
          return;
        }

        const data = snapshot.data();
        const next: AliasRecord = {
          screenId: String(data.screenId ?? ""),
          playerKey: String(data.playerKey ?? ""),
          status: String(data.status ?? ""),
          cachedAt: Date.now(),
        };

        if (!next.screenId || !next.playerKey || next.status !== "active") {
          if (active) setError("Esta tela não está ativa.");
          return;
        }

        window.localStorage.setItem(cacheKey, JSON.stringify(next));
        if (active) setAlias(next);
      } catch {
        if (active) setError("Não foi possível iniciar esta tela.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [shortCode]);

  if (error) {
    return (
      <main className="tv">
        <div className="tv-ad">
          <div>
            <div className="eyebrow">TELALOCAL</div>
            <h1>Tela indisponível</h1>
            <p>{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!alias) {
    return (
      <main className="tv">
        <div className="tv-ad">
          <div>
            <div className="eyebrow">TELALOCAL</div>
            <h1>Iniciando...</h1>
          </div>
        </div>
      </main>
    );
  }

  return <WebPlayer screenId={alias.screenId} playerKey={alias.playerKey} />;
}
