"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusMessage } from "../../components/StatusMessage";

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) setError(data.message ?? "E-mail ou senha incorretos.");
      else router.replace("/admin");
    } catch { setError("Não foi possível entrar agora."); }
    finally { setLoading(false); }
  }
  return <main className="admin-login"><Link className="brand" href="/"><span className="brand-mark">H</span><span>SIT Fortaleza <small>2026</small></span></Link><section><span className="eyebrow">ORGANIZAÇÃO</span><h1>Acesso administrativo</h1><p>Gerencie participantes, Hands-on, vagas e inscrições.</p><form onSubmit={submit}><label>E-mail<input name="email" type="email" autoComplete="username" required /></label><label>Senha<input name="password" type="password" autoComplete="current-password" required /></label><button className="primary-button" disabled={loading}>{loading ? "Entrando…" : "Entrar no painel"}</button></form>{error && <StatusMessage kind="error">{error}</StatusMessage>}<Link href="/" className="text-button">← Voltar para a inscrição</Link></section></main>;
}
