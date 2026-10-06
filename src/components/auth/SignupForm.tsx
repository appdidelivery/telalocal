"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicAccountType, registerAccount } from "@/lib/firebase/accounts";
import { firebaseErrorMessage } from "@/lib/firebase/errors";

export default function SignupForm({ initialProfile }: { initialProfile: PublicAccountType }) {
  const router = useRouter();
  const [accountType, setAccountType] = useState<PublicAccountType>(initialProfile);
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);

    try {
      await registerAccount({ displayName, companyName, email, phone, password, accountType });
      router.replace("/painel");
    } catch (err) {
      setError(firebaseErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="brand">Tela<span>Local</span></div>
      <h1>Crie sua conta</h1>
      <p className="muted">Seu acesso será vinculado a uma organização independente dentro da plataforma.</p>

      <div className="field">
        <label htmlFor="accountType">Quero participar como</label>
        <select id="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value as PublicAccountType)}>
          <option value="host">Lojista / ponto parceiro</option>
          <option value="advertiser">Anunciante local</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="displayName">Seu nome</label>
        <input id="displayName" required autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" />
      </div>

      <div className="field">
        <label htmlFor="companyName">Empresa ou estabelecimento</label>
        <input id="companyName" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome da empresa" />
      </div>

      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
      </div>

      <div className="field">
        <label htmlFor="phone">WhatsApp</label>
        <input id="phone" required autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(47) 99999-9999" />
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" />
      </div>

      {error ? <p className="message error">{error}</p> : null}

      <button className="btn primary full" type="submit" disabled={loading}>
        {loading ? "Criando conta..." : "Criar conta e acessar painel"}
      </button>

      <p className="auth-meta">Já possui conta? <Link href="/login">Entrar no painel</Link></p>
      <p className="auth-meta"><Link href="/">← Voltar para o site</Link></p>
    </form>
  );
}
