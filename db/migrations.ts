import type { DatabaseBinding, PreparedQuery } from "./database";
import { participantNameKey } from "./participant-identity";

export const CURRENT_SCHEMA_VERSION = 2;

const currentSchema = [
  `CREATE TABLE participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE workshops (
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
  )`,
  `CREATE TABLE registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
    workshop_id INTEGER NOT NULL REFERENCES workshops(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE event_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    registration_deadline TEXT,
    max_workshops_per_participant INTEGER NOT NULL DEFAULT 1 CHECK (max_workshops_per_participant >= 1),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE UNIQUE INDEX idx_participants_email_name ON participants(email, name_key)",
  "CREATE INDEX idx_registrations_workshop_id ON registrations(workshop_id)",
  "CREATE UNIQUE INDEX idx_registrations_workshop_participant ON registrations(workshop_id, participant_id)",
] as const;

async function runTransaction(database: DatabaseBinding, statements: PreparedQuery[], validate?: () => Promise<void>) {
  await database.prepare("BEGIN IMMEDIATE").run();
  try {
    for (const statement of statements) await statement.run();
    await validate?.();
    await database.prepare("COMMIT").run();
  } catch (error) {
    await database.prepare("ROLLBACK").run();
    throw error;
  }
}

async function createCurrentSchema(database: DatabaseBinding) {
  await runTransaction(database, [
    ...currentSchema.map((sql) => database.prepare(sql)),
    database.prepare("INSERT INTO event_settings (id, registration_deadline, max_workshops_per_participant) VALUES (1, NULL, 1)"),
    database.prepare("INSERT INTO schema_migrations (version) VALUES (?)").bind(CURRENT_SCHEMA_VERSION),
  ]);
}

async function migrateLegacySchema(database: DatabaseBinding) {
  const legacyParticipants = (await database.prepare(`SELECT id, name, email, created_at AS createdAt,
    updated_at AS updatedAt FROM participants ORDER BY id`).all<{
    id: number; name: string; email: string; createdAt: string; updatedAt: string;
  }>()).results;
  const participantsBefore = await database.prepare("SELECT COUNT(*) AS total FROM participants").first<{ total: number }>();
  const registrationsBefore = await database.prepare("SELECT COUNT(*) AS total FROM registrations").first<{ total: number }>();

  await database.prepare("PRAGMA foreign_keys = OFF").run();
  try {
    await runTransaction(database, [
      database.prepare("ALTER TABLE registrations RENAME TO registrations_legacy"),
      database.prepare("ALTER TABLE participants RENAME TO participants_legacy"),
      database.prepare(currentSchema[0]),
      database.prepare(currentSchema[2]),
      ...legacyParticipants.map((participant) => database.prepare(`INSERT INTO participants
        (id, name, name_key, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(
        participant.id,
        participant.name,
        participantNameKey(participant.name),
        participant.email,
        participant.createdAt,
        participant.updatedAt,
      )),
      database.prepare(`INSERT INTO registrations (id, participant_id, workshop_id, created_at)
        SELECT id, participant_id, workshop_id, created_at FROM registrations_legacy`),
      database.prepare("DROP TABLE registrations_legacy"),
      database.prepare("DROP TABLE participants_legacy"),
      database.prepare("ALTER TABLE event_settings ADD COLUMN max_workshops_per_participant INTEGER NOT NULL DEFAULT 1 CHECK (max_workshops_per_participant >= 1)"),
      database.prepare(currentSchema[4]),
      database.prepare(currentSchema[5]),
      database.prepare(currentSchema[6]),
      database.prepare("INSERT INTO schema_migrations (version) VALUES (?)").bind(CURRENT_SCHEMA_VERSION),
    ], async () => {
      const participantsAfter = await database.prepare("SELECT COUNT(*) AS total FROM participants").first<{ total: number }>();
      const registrationsAfter = await database.prepare("SELECT COUNT(*) AS total FROM registrations").first<{ total: number }>();
      if (participantsAfter?.total !== participantsBefore?.total || registrationsAfter?.total !== registrationsBefore?.total) {
        throw new Error("A migração não preservou todas as linhas existentes.");
      }
    });
  } finally {
    await database.prepare("PRAGMA foreign_keys = ON").run();
  }

  const violations = await database.prepare("PRAGMA foreign_key_check").all();
  if (violations.results.length > 0) throw new Error("A migração produziu referências inválidas.");
}

export async function migrateDatabase(database: DatabaseBinding): Promise<void> {
  await database.prepare(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const version = await database.prepare("SELECT MAX(version) AS version FROM schema_migrations").first<{ version: number | null }>();
  if (Number(version?.version ?? 0) >= CURRENT_SCHEMA_VERSION) return;

  const participantsTable = await database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'participants'").first();
  if (!participantsTable) await createCurrentSchema(database);
  else await migrateLegacySchema(database);
}
