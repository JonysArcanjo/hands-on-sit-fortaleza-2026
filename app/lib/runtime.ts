import { env } from "cloudflare:workers";

export interface AppEnv {
  DB: D1Database;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
  SESSION_SECRET?: string;
}

export function appEnv(): AppEnv {
  return env as unknown as AppEnv;
}

export async function ensureDatabase(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS workshops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      instructor TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      room TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL UNIQUE REFERENCES participants(id) ON DELETE RESTRICT,
      workshop_id INTEGER NOT NULL REFERENCES workshops(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_registrations_workshop_id ON registrations(workshop_id)"),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS total FROM workshops").first<{ total: number }>();
  if (Number(count?.total ?? 0) === 0) {
    await db.batch([
      db.prepare("INSERT INTO workshops (title, description, instructor, starts_at, room, capacity) VALUES (?, ?, ?, ?, ?, ?)")
        .bind("SAP Build Apps: do zero ao protótipo", "Crie uma experiência empresarial responsiva usando recursos low-code.", "Marina Alves", "2026-09-19T10:30:00-03:00", "Sala Iracema", 30),
      db.prepare("INSERT INTO workshops (title, description, instructor, starts_at, room, capacity) VALUES (?, ?, ?, ?, ?, ?)")
        .bind("Integrações inteligentes com SAP BTP", "Conecte serviços, eventos e APIs em um fluxo prático na SAP BTP.", "Rafael Moura", "2026-09-19T10:30:00-03:00", "Sala Jangada", 24),
      db.prepare("INSERT INTO workshops (title, description, instructor, starts_at, room, capacity) VALUES (?, ?, ?, ?, ?, ?)")
        .bind("Clean Core na prática", "Aplique extensibilidade e boas decisões de arquitetura em um cenário S/4HANA.", "Camila Nogueira", "2026-09-19T14:00:00-03:00", "Sala Dragão do Mar", 20),
    ]);
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}
