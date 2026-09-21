import type { DatabaseBinding } from "../../db/database";
import { migrateDatabase } from "../../db/migrations";
import { createSqliteDatabase } from "../../db/sqlite";
import { defaultWorkshops } from "./default-workshops";

export interface AppEnv {
  DB: DatabaseBinding;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
  SESSION_SECRET?: string;
}

let databaseState: { path: string; database: DatabaseBinding } | undefined;
const databaseInitializations = new WeakMap<DatabaseBinding, Promise<void>>();

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

async function initializeDatabase(db: DatabaseBinding): Promise<void> {
  await migrateDatabase(db);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO event_settings (id, registration_deadline, max_workshops_per_participant) VALUES (1, NULL, 1)"),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS total FROM workshops").first<{ total: number }>();
  if (Number(count?.total ?? 0) === 0) {
    await db.batch(defaultWorkshops.map((workshop) => db
      .prepare("INSERT INTO workshops (title, description, instructor, starts_at, room, capacity) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(workshop.title, workshop.description, workshop.instructor, workshop.startsAt, workshop.room, workshop.capacity)));
  }
}

export async function ensureDatabase(db: DatabaseBinding): Promise<void> {
  let initialization = databaseInitializations.get(db);
  if (!initialization) {
    initialization = initializeDatabase(db);
    databaseInitializations.set(db, initialization);
  }
  try {
    await initialization;
  } catch (error) {
    databaseInitializations.delete(db);
    throw error;
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}
