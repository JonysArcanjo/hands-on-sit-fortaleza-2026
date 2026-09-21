import { loadParticipantStatus } from "../../lib/participant-status";
import { normalizeEmail, isValidEmail } from "../../lib/participants";
import { isRegistrationOpen } from "../../lib/registration-deadline";
import { appEnv, ensureDatabase, json } from "../../lib/runtime";

type ParticipantCandidate = { id: number; name: string };

export async function POST(request: Request) {
  const { email: rawEmail, participantId: rawParticipantId } = await request.json() as {
    email?: string;
    participantId?: number;
  };
  const email = normalizeEmail(rawEmail ?? "");
  if (!isValidEmail(email)) return json({ kind: "invalid", message: "Informe um e-mail válido." }, { status: 400 });
  if (rawParticipantId !== undefined && (!Number.isInteger(rawParticipantId) || rawParticipantId < 1)) {
    return json({ kind: "invalid", message: "Seleção de participante inválida." }, { status: 400 });
  }

  const { DB } = appEnv();
  await ensureDatabase(DB);
  const participants = (await DB.prepare("SELECT id, name FROM participants WHERE email = ? ORDER BY name COLLATE NOCASE")
    .bind(email).all<ParticipantCandidate>()).results;
  if (participants.length === 0) {
    return json({ kind: "not-found", message: "E-mail não encontrado. Use o mesmo e-mail da inscrição principal do evento ou procure a organização." }, { status: 404 });
  }
  if (rawParticipantId === undefined && participants.length > 1) {
    return json({ kind: "choose-participant", participants });
  }

  const participantId = rawParticipantId ?? participants[0].id;
  const status = await loadParticipantStatus(DB, email, participantId);
  if (!status) return json({ kind: "not-found", message: "O nome selecionado não pertence a este e-mail." }, { status: 404 });

  const settings = await DB.prepare("SELECT registration_deadline AS registrationDeadline FROM event_settings WHERE id = 1")
    .first<{ registrationDeadline: string | null }>();
  if (!isRegistrationOpen(settings?.registrationDeadline)) {
    return json({ ...status, kind: "closed", workshops: [], message: "O período de inscrições para os Hands-on foi encerrado." }, { status: 409 });
  }
  return json({ ...status, kind: "eligible" });
}
