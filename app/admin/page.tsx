"use client";

import { FormEvent, useEffect, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { workshopChangesFromForm } from "./workshop-edit";
import { finishWorkshopCreation } from "./workshop-form";

type Workshop = { id: number; title: string; description: string; instructor: string; startsAt: string; room: string; capacity: number; active: number; registrations: number };
type Registration = { id: number; name: string; email: string; workshop: string; createdAt: string };
type Dashboard = { metrics: Record<string, number>; workshops: Workshop[]; registrations: Registration[]; settings: { registrationDeadline: string | null } };

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [editingWorkshopId, setEditingWorkshopId] = useState<number | null>(null);
  async function load() {
    const response = await fetch("/api/admin/dashboard");
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    setData(await response.json());
  }
  useEffect(() => {
    fetch("/api/admin/dashboard").then((response) => {
      if (response.status === 401) { window.location.assign("/admin/login"); return null; }
      return response.json() as Promise<Dashboard>;
    }).then((dashboard) => { if (dashboard) setData(dashboard); });
  }, []);

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/participants/import", { method: "POST", body: form });
    const result = await response.json() as { message?: string; created?: number; updated?: number; rejected?: number; ignored?: number };
    if (!response.ok) setMessage({ kind: "error", text: result.message ?? "Não foi possível importar." });
    else { setMessage({ kind: "success", text: `${result.created} criados, ${result.updated} atualizados, ${result.rejected} rejeitados e ${result.ignored} ignorados.` }); await load(); }
  }
  async function addWorkshop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const body = { title: form.get("title"), instructor: form.get("instructor"), startsAt: form.get("startsAt"), room: form.get("room"), capacity: Number(form.get("capacity")), description: form.get("description") };
    const response = await fetch("/api/admin/workshops", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { message?: string };
    if (!response.ok) setMessage({ kind: "error", text: result.message ?? "Não foi possível criar o Hands-on." });
    else { setMessage({ kind: "success", text: "Hands-on criado." }); await finishWorkshopCreation(formElement, load); }
  }
  async function saveDeadline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const registrationDeadline = String(new FormData(event.currentTarget).get("registrationDeadline") ?? "");
    const response = await fetch("/api/admin/settings/registration-deadline", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ registrationDeadline }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) setMessage({ kind: "error", text: result.message ?? "Não foi possível salvar o prazo." });
    else { setMessage({ kind: "success", text: "Prazo das inscrições atualizado." }); await load(); }
  }
  async function removeRegistration(id: number) {
    if (!window.confirm("Cancelar esta inscrição e liberar a vaga?")) return;
    await fetch(`/api/admin/registrations/${id}`, { method: "DELETE" }); await load();
  }
  async function updateWorkshop(workshop: Workshop, changes: Partial<Workshop>) {
    const response = await fetch(`/api/admin/workshops/${workshop.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...workshop, active: Boolean(workshop.active), ...changes }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) { setMessage({ kind: "error", text: result.message ?? "Não foi possível atualizar o Hands-on." }); return false; }
    setMessage({ kind: "success", text: "Hands-on atualizado." }); await load(); return true;
  }
  async function saveWorkshop(event: FormEvent<HTMLFormElement>, workshop: Workshop) {
    event.preventDefault();
    if (await updateWorkshop(workshop, workshopChangesFromForm(new FormData(event.currentTarget)))) setEditingWorkshopId(null);
  }
  async function deleteWorkshop(workshop: Workshop) {
    if (!window.confirm(`Excluir “${workshop.title}”?`)) return;
    const response = await fetch(`/api/admin/workshops/${workshop.id}`, { method: "DELETE" });
    const result = await response.json() as { message?: string };
    if (!response.ok) setMessage({ kind: "error", text: result.message ?? "Não foi possível excluir." });
    else { setMessage({ kind: "success", text: "Hands-on excluído." }); await load(); }
  }
  async function logout() { await fetch("/api/admin/logout", { method: "POST" }); window.location.assign("/admin/login"); }

  if (!data) return <main className="admin-shell"><p>Carregando painel…</p></main>;
  const labels: Record<string, string> = { participants: "Participantes", workshops: "Hands-on", capacity: "Total de vagas", registrations: "Inscrições", remaining: "Vagas restantes", soldOut: "Esgotados" };
  return <main className="admin-shell"><header className="admin-header"><div><span className="eyebrow">PAINEL DA ORGANIZAÇÃO</span><h1>Hands-on SIT Fortaleza</h1></div><button className="text-button" onClick={logout}>Sair</button></header>
    {message && <StatusMessage kind={message.kind}>{message.text}</StatusMessage>}
    <section className="metric-grid">{Object.entries(labels).map(([key, label]) => <article key={key}><span>{label}</span><strong>{Number(data.metrics[key] ?? 0)}</strong></article>)}</section>
    <section className="admin-card registration-controls"><div><span className="eyebrow">INSCRIÇÕES</span><h2>Prazo e relatório</h2><p>Defina o último dia para inscrições ou baixe a relação agrupada por Hands-on.</p></div><form onSubmit={saveDeadline}><label>Data final<input name="registrationDeadline" type="date" defaultValue={data.settings.registrationDeadline ?? ""} required /></label><button className="primary-button">Salvar prazo</button></form><button className="primary-button download-button" onClick={() => window.location.assign("/api/admin/registrations/export")}>Baixar inscritos por Hands-on <span aria-hidden="true">↓</span></button></section>
    <div className="admin-columns"><section className="admin-card"><span className="eyebrow">PARTICIPANTES</span><h2>Importar lista</h2><p>Envie CSV ou XLSX com as colunas Nome e E-mail. Limite de 5 MB.</p><form onSubmit={importFile}><label className="file-field">Arraste ou selecione o arquivo<input name="file" type="file" accept=".csv,.xlsx" required /></label><button className="primary-button">Importar participantes</button></form></section>
    <section className="admin-card"><span className="eyebrow">PROGRAMAÇÃO</span><h2>Novo Hands-on</h2><form className="workshop-form" onSubmit={addWorkshop}><label>Título<input name="title" required /></label><label>Instrutor<input name="instructor" required /></label><label>Data<input name="startsAt" type="date" defaultValue="2026-10-31" required /></label><label>Sala<input name="room" required /></label><label>Capacidade<input name="capacity" type="number" min="1" required /></label><label className="full">Descrição<textarea name="description" required rows={3} /></label><button className="primary-button full">Adicionar Hands-on</button></form></section></div>
    <section className="admin-card table-card"><div className="table-heading"><div><span className="eyebrow">SESSÕES</span><h2>Hands-on cadastrados</h2></div></div><div className="table-wrap"><table><thead><tr><th>Hands-on</th><th>Data</th><th>Sala</th><th>Ocupação</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{data.workshops.map((workshop) => editingWorkshopId === workshop.id ? <tr className="workshop-edit-row" key={workshop.id}><td colSpan={6}><form className="workshop-edit-form" onSubmit={(event) => saveWorkshop(event, workshop)}><label>Título<input name="title" defaultValue={workshop.title} required /></label><label>Instrutor<input name="instructor" defaultValue={workshop.instructor} required /></label><label>Sala<input name="room" defaultValue={workshop.room} required /></label><label>Capacidade<input name="capacity" type="number" min={workshop.registrations || 1} defaultValue={workshop.capacity} required /></label><div className="edit-actions"><button className="primary-button">Salvar</button><button type="button" className="text-button" onClick={() => setEditingWorkshopId(null)}>Cancelar</button></div></form></td></tr> : <tr key={workshop.id}><td data-label="Hands-on"><b>{workshop.title}</b><small>{workshop.instructor}</small></td><td data-label="Data">31/10/2026</td><td data-label="Sala">{workshop.room}</td><td data-label="Ocupação">{workshop.registrations}/{workshop.capacity}</td><td data-label="Estado"><span className={`availability ${workshop.active ? "" : "sold-out"}`}>{workshop.active ? "Ativo" : "Inativo"}</span></td><td data-label="Ações"><div className="row-actions"><button onClick={() => setEditingWorkshopId(workshop.id)}>Editar</button><button onClick={() => updateWorkshop(workshop, { active: workshop.active ? 0 : 1 })}>{workshop.active ? "Desativar" : "Ativar"}</button><button className="danger-button" onClick={() => deleteWorkshop(workshop)}>Excluir</button></div></td></tr>)}</tbody></table></div></section>
    <section className="admin-card table-card"><span className="eyebrow">INSCRIÇÕES</span><h2>Participantes confirmados</h2><div className="table-wrap"><table><thead><tr><th>Participante</th><th>Hands-on</th><th>Data</th><th>Ação</th></tr></thead><tbody>{data.registrations.map((registration) => <tr key={registration.id}><td data-label="Participante"><b>{registration.name}</b><small>{registration.email}</small></td><td data-label="Hands-on">{registration.workshop}</td><td data-label="Data">{new Date(registration.createdAt).toLocaleString("pt-BR")}</td><td data-label="Ação"><button className="danger-button" onClick={() => removeRegistration(registration.id)}>Cancelar</button></td></tr>)}</tbody></table></div></section>
  </main>;
}
