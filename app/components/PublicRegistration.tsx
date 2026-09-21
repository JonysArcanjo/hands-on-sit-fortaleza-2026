"use client";

import { FormEvent, useState } from "react";
import type { ParticipantStatus, RegistrationSummary, WorkshopSummary } from "../lib/participant-status";
import { ParticipantChoice, type ParticipantCandidate } from "./ParticipantChoice";
import { RegistrationSummary as RegistrationSummaryView } from "./RegistrationSummary";
import { StatusMessage } from "./StatusMessage";
import { WorkshopCard } from "./WorkshopCard";

type EligibilityResponse = Partial<ParticipantStatus> & {
  kind?: string;
  message?: string;
  participants?: ParticipantCandidate[];
};

export function PublicRegistration() {
  const [email, setEmail] = useState("");
  const [candidates, setCandidates] = useState<ParticipantCandidate[]>([]);
  const [participant, setParticipant] = useState<ParticipantStatus["participant"] | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationSummary[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopSummary[]>([]);
  const [maximum, setMaximum] = useState(1);
  const [remaining, setRemaining] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [newlyConfirmedWorkshopId, setNewlyConfirmedWorkshopId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function clearParticipant() {
    setParticipant(null);
    setRegistrations([]);
    setWorkshops([]);
    setMaximum(1);
    setRemaining(0);
    setSelected(null);
    setNewlyConfirmedWorkshopId(null);
  }

  function applyStatus(data: EligibilityResponse) {
    if (!data.participant) return false;
    setParticipant(data.participant);
    setRegistrations(data.registrations ?? []);
    setWorkshops(data.workshops ?? []);
    setMaximum(data.maximum ?? 1);
    setRemaining(data.remaining ?? 0);
    setSelected(null);
    return true;
  }

  async function requestEligibility(participantId?: number) {
    const response = await fetch("/api/eligibility", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, participantId }),
    });
    const data = await response.json() as EligibilityResponse;
    if (data.kind === "choose-participant" && data.participants) {
      clearParticipant();
      setCandidates(data.participants);
      return;
    }
    if (applyStatus(data)) {
      setMessage(response.ok ? null : (data.message ?? null));
      return;
    }
    clearParticipant();
    setCandidates([]);
    setMessage(data.message ?? "Não foi possível localizar sua inscrição.");
  }

  async function checkEmail(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setCandidates([]);
    clearParticipant();
    try { await requestEligibility(); }
    catch { setMessage("Não foi possível verificar agora. Tente novamente em instantes."); }
    finally { setLoading(false); }
  }

  async function chooseParticipant(participantId: number) {
    setLoading(true);
    setMessage(null);
    try { await requestEligibility(participantId); }
    catch { setMessage("Não foi possível selecionar este nome. Tente novamente."); }
    finally { setLoading(false); }
  }

  async function confirm() {
    if (!participant || !selected) return;
    const workshopId = selected;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, participantId: participant.id, workshopId: selected }),
      });
      const data = await response.json() as EligibilityResponse;
      if (!response.ok || !applyStatus(data)) {
        setMessage(data.message ?? "Não foi possível confirmar.");
        return;
      }
      setNewlyConfirmedWorkshopId(workshopId);
    } catch { setMessage("Não foi possível confirmar agora. Tente novamente."); }
    finally { setLoading(false); }
  }

  function resetAll() {
    clearParticipant();
    setCandidates([]);
    setEmail("");
    setMessage(null);
  }

  function changeParticipant() {
    clearParticipant();
    setMessage(null);
  }

  return <main className="public-shell">
    <header className="site-header"><a className="brand" href="#top" aria-label="Início"><span className="brand-mark">H</span><span>SIT Fortaleza <small>2026</small></span></a><a className="admin-link" href="/admin/login">Acesso da organização <span aria-hidden="true">↗</span></a></header>
    <section className="hero" id="top">
      <div className="hero-copy"><span className="eyebrow">31 OUT · FORTALEZA, CE</span><h1>Hands-on <em>SAP Inside Track</em> Fortaleza 2026</h1><p>Reserve seu lugar em uma sessão prática, conecte-se com a comunidade e aprenda construindo.</p><div className="steps" aria-label="Etapas"><span className={participant ? "done" : "active"}>01 <b>Identificação</b></span><span className={participant && remaining > 0 ? "active" : ""}>02 <b>Escolha</b></span><span className={registrations.length > 0 ? "active" : ""}>03 <b>Confirmação</b></span></div></div>
      <div className="registration-panel">
        {!participant && candidates.length === 0 && <><span className="panel-number">01</span><h2>Vamos encontrar sua inscrição</h2><p>Use o mesmo e-mail da sua inscrição no evento.</p><form onSubmit={checkEmail}><label htmlFor="email">E-mail da inscrição</label><input id="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="primary-button" disabled={loading}>{loading ? "Verificando…" : "Verificar minha inscrição"}<span aria-hidden="true">→</span></button></form></>}
        {!participant && candidates.length > 0 && <><span className="panel-number">01</span><ParticipantChoice participants={candidates} disabled={loading} onSelect={chooseParticipant} /><button className="text-button" onClick={resetAll}>← Informar outro e-mail</button></>}
        {participant && <><span className="panel-number">02</span><h2>Olá, {participant.name.split(" ")[0]}!</h2>{registrations.length === 0 && <p>Escolha seu Hands-on. Seu limite é de {maximum} {maximum === 1 ? "sessão" : "sessões"}.</p>}<RegistrationSummaryView registrations={registrations} maximum={maximum} remaining={remaining} newlyConfirmedWorkshopId={newlyConfirmedWorkshopId} /><div className="identity-actions">{candidates.length > 1 && <button className="text-button" onClick={changeParticipant}>Trocar nome</button>}<button className="text-button" onClick={resetAll}>Consultar outro e-mail</button></div></>}
        {message && <StatusMessage kind="error">{message}</StatusMessage>}
      </div>
    </section>
    {participant && remaining > 0 && workshops.length > 0 && <section className="workshop-section"><div className="section-heading"><span className="eyebrow">SESSÕES DISPONÍVEIS</span><h2>Escolha onde você quer colocar a mão na massa.</h2></div><div className="workshop-grid">{workshops.map((workshop) => <WorkshopCard key={workshop.id} workshop={workshop} selected={selected === workshop.id} onSelect={() => { setSelected(workshop.id); setNewlyConfirmedWorkshopId(null); }} />)}</div><div className="sticky-confirm"><span>{selected ? "Hands-on selecionado" : `Você ainda pode escolher ${remaining}`}</span><button className="primary-button" disabled={!selected || loading} onClick={confirm}>{loading ? "Confirmando…" : "Confirmar meu Hands-on"}<span aria-hidden="true">→</span></button></div></section>}
    <footer><span>Comunidade · Conhecimento · Conexão</span><span>Fortaleza, Ceará — 2026</span></footer>
  </main>;
}
