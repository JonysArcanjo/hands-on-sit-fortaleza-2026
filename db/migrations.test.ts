import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DatabaseBinding } from "./database";
import { migrateDatabase } from "./migrations";
import { createSqliteDatabase } from "./sqlite";

const directories: string[] = [];
const databases: DatabaseBinding[] = [];

function temporaryDatabase(): DatabaseBinding {
  const directory = mkdtempSync(join(tmpdir(), "sit-migration-"));
  directories.push(directory);
  const database = createSqliteDatabase(join(directory, "migration.db"));
  databases.push(database);
  return database;
}

async function createLegacySchema(database: DatabaseBinding) {
  await database.batch([
    database.prepare(`CREATE TABLE participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE workshops (
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
    database.prepare(`CREATE TABLE registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL UNIQUE REFERENCES participants(id) ON DELETE RESTRICT,
      workshop_id INTEGER NOT NULL REFERENCES workshops(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE event_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      registration_deadline TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe("SQLite schema migrations", () => {
  it("migrates legacy data without changing identifiers or foreign keys", async () => {
    const database = temporaryDatabase();
    await createLegacySchema(database);
    await database.batch([
      database.prepare("INSERT INTO participants (id, name, email) VALUES (?, ?, ?)").bind(7, "Ana", "ana@example.com"),
      database.prepare(`INSERT INTO workshops (id, title, description, instructor, starts_at, room, capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(3, "Clean Core", "Descrição", "Equipe", "2026-10-31", "Sala 1", 20),
      database.prepare("INSERT INTO registrations (id, participant_id, workshop_id) VALUES (?, ?, ?)").bind(11, 7, 3),
      database.prepare("INSERT INTO event_settings (id, registration_deadline) VALUES (1, ?)").bind("2026-10-20"),
    ]);

    await migrateDatabase(database);

    expect(await database.prepare("SELECT id, name, email FROM participants WHERE id = 7").first()).toEqual({
      id: 7,
      name: "Ana",
      email: "ana@example.com",
    });
    expect(await database.prepare("SELECT id, participant_id, workshop_id FROM registrations WHERE id = 11").first()).toEqual({
      id: 11,
      participant_id: 7,
      workshop_id: 3,
    });
    expect(await database.prepare(`SELECT registration_deadline AS deadline,
      max_workshops_per_participant AS maximum FROM event_settings WHERE id = 1`).first()).toEqual({
      deadline: "2026-10-20",
      maximum: 1,
    });
    expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
  });

  it("creates the current schema from an empty database and is idempotent", async () => {
    const database = temporaryDatabase();

    await migrateDatabase(database);
    await migrateDatabase(database);

    expect(await database.prepare("SELECT MAX(version) AS version FROM schema_migrations").first()).toEqual({ version: 2 });
    expect(await database.prepare("SELECT max_workshops_per_participant AS maximum FROM event_settings WHERE id = 1").first()).toEqual({ maximum: 1 });
    expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
  });

  it("allows shared emails and multiple distinct workshops but rejects duplicate identities and workshops", async () => {
    const database = temporaryDatabase();
    await migrateDatabase(database);
    await database.batch([
      database.prepare("INSERT INTO participants (id, name, name_key, email) VALUES (?, ?, ?, ?)").bind(1, "João Victor", "joão victor", "arcanjocity@gmail.com"),
      database.prepare("INSERT INTO participants (id, name, name_key, email) VALUES (?, ?, ?, ?)").bind(2, "Jonys Arcanjo", "jonys arcanjo", "arcanjocity@gmail.com"),
      database.prepare(`INSERT INTO workshops (id, title, description, instructor, starts_at, room, capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(1, "Primeiro", "Descrição", "Equipe", "2026-10-31", "Sala 1", 20),
      database.prepare(`INSERT INTO workshops (id, title, description, instructor, starts_at, room, capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(2, "Segundo", "Descrição", "Equipe", "2026-10-31", "Sala 2", 20),
      database.prepare("INSERT INTO registrations (participant_id, workshop_id) VALUES (?, ?)").bind(1, 1),
      database.prepare("INSERT INTO registrations (participant_id, workshop_id) VALUES (?, ?)").bind(1, 2),
    ]);

    await expect(database.prepare("INSERT INTO participants (name, name_key, email) VALUES (?, ?, ?)")
      .bind("JOÃO VICTOR", "joão victor", "arcanjocity@gmail.com").run()).rejects.toThrow();
    await expect(database.prepare("INSERT INTO registrations (participant_id, workshop_id) VALUES (?, ?)")
      .bind(1, 1).run()).rejects.toThrow();
    expect(await database.prepare("SELECT COUNT(*) AS total FROM participants WHERE email = ?")
      .bind("arcanjocity@gmail.com").first()).toEqual({ total: 2 });
    expect(await database.prepare("SELECT COUNT(*) AS total FROM registrations WHERE participant_id = 1").first()).toEqual({ total: 2 });
  });
});
