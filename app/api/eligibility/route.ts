import { normalizeEmail, isValidEmail } from "../../lib/participants";
import { appEnv, ensureDatabase, json } from "../../lib/runtime";

export async function POST(request: Request) {
  const { email: rawEmail } = await request.json() as { email?: string };
  const email = normalizeEmail(rawEmail ?? "");
  if (!isValidEmail(email)) return json({ kind: "invalid", message: "Informe um e-mail válido." }, { status: 400 });
  const { DB } = appEnv();
  await ensureDatabase(DB);
  const participant = await DB.prepare("SELECT id, name, email FROM participants WHERE email = ?").bind(email).first<{ id: number; name: string; email: string }>();
  if (!participant) return json({ kind: "not-found", message: "E-mail não encontrado. Use o mesmo e-mail da inscrição principal do evento ou procure a organização." }, { status: 404 });
  const existing = await DB.prepare(`SELECT r.id, r.created_at AS createdAt, w.title, w.instructor, w.starts_at AS startsAt, w.room
    FROM registrations r JOIN workshops w ON w.id = r.workshop_id WHERE r.participant_id = ?`).bind(participant.id).first();
  if (existing) return json({ kind: "registered", participant, registration: existing });
  const workshops = await DB.prepare(`SELECT w.id, w.title, w.description, w.instructor, w.starts_at AS startsAt, w.room, w.capacity,
    COUNT(r.id) AS registrations FROM workshops w LEFT JOIN registrations r ON r.workshop_id = w.id
    WHERE w.active = 1 GROUP BY w.id ORDER BY w.starts_at, w.title`).all();
  return json({ kind: "eligible", participant, workshops: workshops.results });
}
