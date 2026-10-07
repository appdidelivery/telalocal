"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  getTenantContext,
  listScreens,
  type ScreenRecord,
} from "@/lib/firebase/screens";
import { claimPairing } from "@/lib/firebase/pairing";

export default function PairTvClient() {
  const router = useRouter();
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [screenId, setScreenId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const context = await getTenantContext();
        const data = await listScreens(context);
        setScreens(data);
        if (data[0]) setScreenId(data[0].id);
      } catch {
        setError("Não foi possível carregar suas telas.");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const screen = screens.find((item) => item.id === screenId);
    if (!screen) {
      setError("Selecione uma tela.");
      return;
    }

    const normalized = code.replace(/\D/g, "").slice(0, 6);
    if (normalized.length !== 6) {
      setError("Digite os 6 números exibidos na TV.");
      return;
    }

    setPairing(true);

    try {
      await claimPairing(normalized, screen);
      setMessage(
        `TV pareada com sucesso com ${screen.pointName} · ${screen.screenName}. A reprodução começará automaticamente na TV.`
      );
      setCode("");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Não foi possível parear esta TV.";
      setError(msg);
    } finally {
      setPairing(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-loading">
        <p className="muted">Preparando pareamento...</p>
      </main>
    );
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">INSTALAÇÃO SEM COMPLICAÇÃO</div>
          <h1>Parear uma TV</h1>
          <p className="muted">
            Na Smart TV abra telalocal.vercel.app/tv. Depois informe aqui o código de 6 dígitos.
          </p>
        </div>
        <Link className="btn ghost" href="/painel/telas">
          ← Voltar para telas
        </Link>
      </div>

      <div className="pair-panel-layout">
        <form className="card pair-panel-card" onSubmit={handleSubmit}>
          <h2>1. Código exibido na TV</h2>
          <div className="field">
            <label htmlFor="pair-code">Código de 6 dígitos</label>
            <input
              id="pair-code"
              className="pair-code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
              placeholder="482731"
              required
            />
          </div>

          <h2 className="pair-step-title">2. Qual tela é esta?</h2>
          <div className="field">
            <label htmlFor="pair-screen">Tela cadastrada</label>
            <select
              id="pair-screen"
              value={screenId}
              onChange={(event) => setScreenId(event.target.value)}
              required
            >
              {screens.length === 0 ? (
                <option value="">Nenhuma tela cadastrada</option>
              ) : null}
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.pointName} · {screen.screenName}
                </option>
              ))}
            </select>
          </div>

          {screens.length === 0 ? (
            <p className="message error">
              Cadastre uma tela antes de fazer o pareamento.
            </p>
          ) : null}

          {error ? <p className="message error">{error}</p> : null}
          {message ? <p className="message success">{message}</p> : null}

          <button
            className="btn primary full"
            type="submit"
            disabled={pairing || screens.length === 0}
          >
            {pairing ? "Pareando..." : "Parear esta TV"}
          </button>
        </form>

        <section className="card pair-howto">
          <div className="eyebrow">PASSO A PASSO</div>
          <h2>Na Smart TV</h2>
          <ol>
            <li>Abra o navegador.</li>
            <li>Digite <strong>telalocal.vercel.app/tv</strong>.</li>
            <li>A TV mostrará um código de 6 números.</li>
            <li>Digite o código ao lado e escolha a tela.</li>
            <li>A TV inicia o player automaticamente.</li>
            <li>Use o botão <strong>⛶ Tela cheia</strong>.</li>
          </ol>
          <p className="muted">
            Depois do primeiro pareamento, o navegador guarda o vínculo. Ao voltar para /tv, a mesma tela abre novamente sem pedir código.
          </p>
        </section>
      </div>
    </main>
  );
}
