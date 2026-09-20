import { appEnv, ensureDatabase, json } from "../../lib/runtime";
import { isRegistrationOpen } from "../../lib/registration-deadline";

export async function POST(request: Request) {
  const { participantId, workshopId } = await request.json() as { participantId?: number; workshopId?: number };
  if (!Number.isInteger(participantId) || !Number.isInteger(workshopId)) return json({ kind: "invalid", message: "Seleção inválida." }, { status: 400 });
  const { DB } = appEnv();
  await ensureDatabase(DB);
  const settings = await DB.prepare("SELECT registration_deadline AS registrationDeadline FROM event_settings WHERE id = 1").first<{ registrationDeadline: string | null }>();
  if (!isRegistrationOpen(settings?.registrationDeadline)) return json({ kind: "closed", message: "O período de inscrições para os Hands-on foi encerrado." }, { status: 409 });
  const participant = await DB.prepare("SELECT id FROM participants WHERE id = ?").bind(participantId).first();
  if (!participant) return json({ kind: "not-found", message: "Participante não encontrado." }, { status: 404 });
  const already = await DB.prepare("SELECT id FROM registrations WHERE participant_id = ?").bind(participantId).first();
  if (already) return json({ kind: "already-registered", message: "Este participante já escolheu um Hands-on." }, { status: 409 });
  const workshop = await DB.prepare(`SELECT w.id, w.title, w.instructor, w.starts_at AS startsAt, w.room, w.capacity, w.active,
    COUNT(r.id) AS registrations FROM workshops w LEFT JOIN registrations r ON r.workshop_id = w.id
    WHERE w.id = ? GROUP BY w.id`).bind(workshopId).first<{ id: number; title: string; instructor: string; startsAt: string; room: string; capacity: number; active: number; registrations: number }>();
  if (!workshop || !workshop.active) return json({ kind: "unavailable", message: "Este Hands-on não está disponível." }, { status: 409 });
  if (Number(workshop.registrations) >= workshop.capacity) return json({ kind: "sold-out", message: "As vagas deste Hands-on acabaram." }, { status: 409 });
  try {
    await DB.prepare(`INSERT INTO registrations (participant_id, workshop_id)
      SELECT ?, ? WHERE (SELECT COUNT(*) FROM registrations WHERE workshop_id = ?) < (SELECT capacity FROM workshops WHERE id = ?)`)
      .bind(participantId, workshopId, workshopId, workshopId).run();
  } catch {
    return json({ kind: "already-registered", message: "Este participante já escolheu um Hands-on." }, { status: 409 });
  }
  const saved = await DB.prepare("SELECT id FROM registrations WHERE participant_id = ? AND workshop_id = ?").bind(participantId, workshopId).first();
  if (!saved) return json({ kind: "sold-out", message: "A última vaga acabou de ser preenchida. Escolha outro Hands-on." }, { status: 409 });
  return json({ kind: "confirmed", registration: workshop }, { status: 201 });
}
