import type { DatabaseBinding } from "../../db/database";
import { createSqliteDatabase } from "../../db/sqlite";
import { defaultWorkshops } from "./default-workshops";

export interface AppEnv {
  DB: DatabaseBinding;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
  SESSION_SECRET?: string;
}

let databaseState: { path: string; database: DatabaseBinding } | undefined;

export function appEnv(): AppEnv {
  const databasePath = process.env.DATABASE_PATH || (process.env.NODE_ENV === "production" ? "" : "./data/hands-on.db");
  if (!databasePath) {
    throw new Error("DATABASE_PATH deve ser informado no ambiente de produção.");
  }
  if (!databaseState || databaseState.path !== databasePath) {
    databaseState?.database.close();
    databaseState = { path: databasePath, database: createSqliteDatabase(databasePath) };
  }
  return {
    DB: databaseState.database,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
}

export async function ensureDatabase(db: DatabaseBinding): Promise<void> {
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
    db.prepare(`CREATE TABLE IF NOT EXISTS event_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      registration_deadline TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_registrations_workshop_id ON registrations(workshop_id)"),
    db.prepare("INSERT OR IGNORE INTO event_settings (id, registration_deadline) VALUES (1, NULL)"),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS total FROM workshops").first<{ total: number }>();
  if (Number(count?.total ?? 0) === 0) {
    await db.batch(defaultWorkshops.map((workshop) => db
      .prepare("INSERT INTO workshops (title, description, instructor, starts_at, room, capacity) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(workshop.title, workshop.description, workshop.instructor, workshop.startsAt, workshop.room, workshop.capacity)));
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}
