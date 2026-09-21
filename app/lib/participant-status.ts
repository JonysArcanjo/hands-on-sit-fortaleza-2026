import type { DatabaseBinding } from "../../db/database";

export type ParticipantSummary = { id: number; name: string; email: string };
export type RegistrationSummary = {
  id: number;
  workshopId: number;
  title: string;
  instructor: string;
  startsAt: string;
  room: string;
  createdAt: string;
};
export type WorkshopSummary = {
  id: number;
  title: string;
  description: string;
  instructor: string;
  startsAt: string;
  room: string;
  capacity: number;
  registrations: number;
};
export type ParticipantStatus = {
  participant: ParticipantSummary;
  registrations: RegistrationSummary[];
  workshops: WorkshopSummary[];
  maximum: number;
  remaining: number;
};

export async function loadParticipantStatus(
  database: DatabaseBinding,
  email: string,
  participantId: number,
): Promise<ParticipantStatus | null> {
  const participant = await database.prepare("SELECT id, name, email FROM participants WHERE id = ? AND email = ?")
    .bind(participantId, email).first<ParticipantSummary>();
  if (!participant) return null;

  const registrations = (await database.prepare(`SELECT r.id, r.workshop_id AS workshopId,
    r.created_at AS createdAt, w.title, w.instructor, w.starts_at AS startsAt, w.room
    FROM registrations r JOIN workshops w ON w.id = r.workshop_id
    WHERE r.participant_id = ? ORDER BY w.starts_at, w.title`).bind(participantId).all<RegistrationSummary>()).results;
  const settings = await database.prepare(`SELECT max_workshops_per_participant AS maximum
    FROM event_settings WHERE id = 1`).first<{ maximum: number }>();
  const maximum = Number(settings?.maximum ?? 1);
  const remaining = Math.max(0, maximum - registrations.length);
  const workshops = remaining === 0 ? [] : (await database.prepare(`SELECT w.id, w.title, w.description,
    w.instructor, w.starts_at AS startsAt, w.room, w.capacity, COUNT(all_registrations.id) AS registrations
    FROM workshops w
    LEFT JOIN registrations all_registrations ON all_registrations.workshop_id = w.id
    WHERE w.active = 1
      AND NOT EXISTS (SELECT 1 FROM registrations own WHERE own.participant_id = ? AND own.workshop_id = w.id)
    GROUP BY w.id ORDER BY w.starts_at, w.title`).bind(participantId).all<WorkshopSummary>()).results;

  return { participant, registrations, workshops, maximum, remaining };
}
