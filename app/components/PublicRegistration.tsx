"use client";

import { FormEvent, useState } from "react";
import { StatusMessage } from "./StatusMessage";
import { WorkshopCard } from "./WorkshopCard";

type Workshop = { id: number; title: string; description: string; instructor: string; startsAt: string; room: string; capacity: number; registrations: number };
type Participant = { id: number; name: string; email: string };
type Registration = { title: string; instructor: string; startsAt: string; room: string };
type EligibilityResponse = { kind?: string; message?: string; participant?: Participant; registration?: Registration; workshops?: Workshop[] };
type RegistrationResponse = { message?: string; registration?: Registration };

export function PublicRegistration() {
  const [email, setEmail] = useState("");
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkEmail(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage(null); setRegistration(null);
    try {
      const response = await fetch("/api/eligibility", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json() as EligibilityResponse;
      if (!response.ok || !data.participant) { setParticipant(null); setWorkshops([]); setMessage(data.message ?? "Não foi possível localizar sua inscrição."); return; }
      setParticipant(data.participant);
      if (data.kind === "registered" && data.registration) { setRegistration(data.registration); setWorkshops([]); }
      else setWorkshops(data.workshops ?? []);
    } catch { setMessage("Não foi possível verificar agora. Tente novamente em instantes."); }
    finally { setLoading(false); }
  }

  async function confirm() {
    if (!participant || !selected) return;
    setLoading(true); setMessage(null);
    try {
      const response = await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ participantId: participant.id, workshopId: selected }) });
      const data = await response.json() as RegistrationResponse;
      if (!response.ok || !data.registration) { setMessage(data.message ?? "Não foi possível confirmar."); return; }
      setRegistration(data.registration); setWorkshops([]);
    } catch { setMessage("Não foi possível confirmar agora. Tente novamente."); }
    finally { setLoading(false); }
  }

  return <main className="public-shell">
    <header className="site-header"><a className="brand" href="#top" aria-label="Início"><span className="brand-mark">H</span><span>SIT Fortaleza <small>2026</small></span></a><a className="admin-link" href="/admin/login">Acesso da organização <span aria-hidden="true">↗</span></a></header>
    <section className="hero" id="top">
      <div className="hero-copy"><span className="eyebrow">31 OUT · FORTALEZA, CE</span><h1>Hands-on <em>SAP Inside Track</em> Fortaleza 2026</h1><p>Reserve seu lugar em uma sessão prática, conecte-se com a comunidade e aprenda construindo.</p><div className="steps" aria-label="Etapas"><span className={participant ? "done" : "active"}>01 <b>Identificação</b></span><span className={workshops.length ? "active" : ""}>02 <b>Escolha</b></span><span className={registration ? "active" : ""}>03 <b>Confirmação</b></span></div></div>
      <div className="registration-panel">
        {!participant && !registration && <><span className="panel-number">01</span><h2>Vamos encontrar sua inscrição</h2><p>Use o mesmo e-mail da sua inscrição no evento.</p><form onSubmit={checkEmail}><label htmlFor="email">E-mail da inscrição</label><input id="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="primary-button" disabled={loading}>{loading ? "Verificando…" : "Verificar minha inscrição"}<span aria-hidden="true">→</span></button></form></>}
        {participant && workshops.length > 0 && <><span className="panel-number">02</span><h2>Olá, {participant.name.split(" ")[0]}! Escolha seu Hands-on</h2><p>Você pode reservar uma única sessão. Confira horário e sala antes de confirmar.</p></>}
        {registration && <><span className="confirmation-mark" aria-hidden="true">✓</span><span className="eyebrow">INSCRIÇÃO CONFIRMADA</span><h2>Seu Hands-on está reservado.</h2><div className="confirmation-card"><h3>{registration.title}</h3><p>{registration.instructor}</p><p>31 de outubro de 2026</p><b>{registration.room}</b></div><button className="text-button" onClick={() => { setParticipant(null); setRegistration(null); setEmail(""); }}>Consultar outro e-mail</button></>}
        {message && <StatusMessage kind="error">{message}</StatusMessage>}
      </div>
    </section>
    {participant && workshops.length > 0 && <section className="workshop-section"><div className="section-heading"><span className="eyebrow">SESSÕES DISPONÍVEIS</span><h2>Escolha onde você quer colocar a mão na massa.</h2></div><div className="workshop-grid">{workshops.map((workshop) => <WorkshopCard key={workshop.id} workshop={workshop} selected={selected === workshop.id} onSelect={() => setSelected(workshop.id)} />)}</div><div className="sticky-confirm"><span>{selected ? "Hands-on selecionado" : "Selecione uma sessão disponível"}</span><button className="primary-button" disabled={!selected || loading} onClick={confirm}>{loading ? "Confirmando…" : "Confirmar meu Hands-on"}<span aria-hidden="true">→</span></button></div></section>}
    <footer><span>Comunidade · Conhecimento · Conexão</span><span>Fortaleza, Ceará — 2026</span></footer>
  </main>;
}
