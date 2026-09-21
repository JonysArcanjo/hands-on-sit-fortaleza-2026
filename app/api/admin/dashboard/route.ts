import { requireAdmin } from "../../../lib/admin";
import { appEnv, ensureDatabase, json } from "../../../lib/runtime";

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const { DB } = appEnv();
  await ensureDatabase(DB);
  const metrics = await DB.prepare(`SELECT
    (SELECT COUNT(*) FROM participants) AS participants,
    (SELECT COUNT(*) FROM workshops) AS workshops,
    (SELECT COALESCE(SUM(capacity), 0) FROM workshops WHERE active = 1) AS capacity,
    (SELECT COUNT(*) FROM registrations) AS registrations,
    (SELECT COALESCE(SUM(capacity), 0) FROM workshops WHERE active = 1) - (SELECT COUNT(*) FROM registrations r JOIN workshops w ON w.id = r.workshop_id WHERE w.active = 1) AS remaining,
    (SELECT COUNT(*) FROM workshops w WHERE w.active = 1 AND (SELECT COUNT(*) FROM registrations r WHERE r.workshop_id = w.id) >= w.capacity) AS soldOut`).first();
  const workshops = await DB.prepare(`SELECT w.id, w.title, w.description, w.instructor, w.starts_at AS startsAt, w.room, w.capacity, w.active,
    COUNT(r.id) AS registrations FROM workshops w LEFT JOIN registrations r ON r.workshop_id = w.id GROUP BY w.id ORDER BY w.starts_at`).all();
  const registrations = await DB.prepare(`SELECT r.id, r.created_at AS createdAt, p.name, p.email, w.title AS workshop
    FROM registrations r JOIN participants p ON p.id = r.participant_id JOIN workshops w ON w.id = r.workshop_id ORDER BY r.created_at DESC`).all();
  const settings = await DB.prepare(`SELECT registration_deadline AS registrationDeadline,
    max_workshops_per_participant AS maxWorkshopsPerParticipant FROM event_settings WHERE id = 1`).first();
  return json({ metrics, workshops: workshops.results, registrations: registrations.results, settings });
}
