"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAccount } from "@/lib/firebase/accounts";
import { firebaseErrorMessage } from "@/lib/firebase/errors";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginAccount(email, password);
      router.replace("/painel");
    } catch (err) {
      setError(firebaseErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form className="form auth-form" onSubmit={handleSubmit}>
      <div className="brand">Tela<span>Local</span></div>
      <h1>Acessar painel</h1>
      <p className="muted">Entre com o e-mail e a senha cadastrados no TelaLocal.</p>

      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />
      </div>

      {error ? <p className="message error">{error}</p> : null}

      <button className="btn primary full" type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="auth-meta">Ainda não possui conta? <Link href="/cadastro">Criar conta</Link></p>
      <p className="auth-meta"><Link href="/">← Voltar para o site</Link></p>
    </form>
  );
}
