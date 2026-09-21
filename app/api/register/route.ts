import { loadParticipantStatus } from "../../lib/participant-status";
import { isValidEmail, normalizeEmail } from "../../lib/participants";
import { isRegistrationOpen } from "../../lib/registration-deadline";
import { appEnv, ensureDatabase, json } from "../../lib/runtime";

type WorkshopAvailability = { id: number; active: number; capacity: number; registrations: number };

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; participantId?: number; workshopId?: number };
  const email = normalizeEmail(body.email ?? "");
  const { participantId, workshopId } = body;
  if (!isValidEmail(email) || !Number.isInteger(participantId) || !Number.isInteger(workshopId)) {
    return json({ kind: "invalid", message: "Seleção inválida." }, { status: 400 });
  }

  const { DB } = appEnv();
  await ensureDatabase(DB);
  const settings = await DB.prepare("SELECT registration_deadline AS registrationDeadline FROM event_settings WHERE id = 1")
    .first<{ registrationDeadline: string | null }>();
  if (!isRegistrationOpen(settings?.registrationDeadline)) {
    return json({ kind: "closed", message: "O período de inscrições para os Hands-on foi encerrado." }, { status: 409 });
  }

  const status = await loadParticipantStatus(DB, email, participantId!);
  if (!status) return json({ kind: "not-found", message: "Participante não encontrado para este e-mail." }, { status: 404 });
  if (status.registrations.some((registration) => registration.workshopId === workshopId)) {
    return json({ kind: "already-registered", message: "Você já está inscrito neste Hands-on." }, { status: 409 });
  }
  if (status.remaining === 0) {
    return json({ kind: "limit-reached", message: `Você atingiu o limite de ${status.maximum} Hands-on.` }, { status: 409 });
  }

  const workshop = await DB.prepare(`SELECT w.id, w.active, w.capacity, COUNT(r.id) AS registrations
    FROM workshops w LEFT JOIN registrations r ON r.workshop_id = w.id
    WHERE w.id = ? GROUP BY w.id`).bind(workshopId!).first<WorkshopAvailability>();
  if (!workshop || !workshop.active) return json({ kind: "unavailable", message: "Este Hands-on não está disponível." }, { status: 409 });
  if (Number(workshop.registrations) >= workshop.capacity) {
    return json({ kind: "sold-out", message: "As vagas deste Hands-on acabaram." }, { status: 409 });
  }

  const inserted = await DB.prepare(`INSERT INTO registrations (participant_id, workshop_id)
    SELECT ?, ?
    WHERE EXISTS (SELECT 1 FROM participants WHERE id = ? AND email = ?)
      AND NOT EXISTS (SELECT 1 FROM registrations WHERE participant_id = ? AND workshop_id = ?)
      AND (SELECT COUNT(*) FROM registrations WHERE participant_id = ?)
        < (SELECT max_workshops_per_participant FROM event_settings WHERE id = 1)
      AND (SELECT COUNT(*) FROM registrations WHERE workshop_id = ?)
        < (SELECT capacity FROM workshops WHERE id = ? AND active = 1)`)
    .bind(participantId!, workshopId!, participantId!, email, participantId!, workshopId!, participantId!, workshopId!, workshopId!).run();

  if (inserted.changes === 0) {
    const refreshed = await loadParticipantStatus(DB, email, participantId!);
    if (refreshed?.registrations.some((registration) => registration.workshopId === workshopId)) {
      return json({ kind: "already-registered", message: "Você já está inscrito neste Hands-on." }, { status: 409 });
    }
    if (!refreshed || refreshed.remaining === 0) {
      return json({ kind: "limit-reached", message: `Você atingiu o limite de ${refreshed?.maximum ?? status.maximum} Hands-on.` }, { status: 409 });
    }
    return json({ kind: "sold-out", message: "A última vaga acabou de ser preenchida. Escolha outro Hands-on." }, { status: 409 });
  }

  const refreshed = await loadParticipantStatus(DB, email, participantId!);
  const registration = refreshed?.registrations.find((entry) => entry.workshopId === workshopId);
  return json({ ...refreshed, kind: "confirmed", registration }, { status: 201 });
}
