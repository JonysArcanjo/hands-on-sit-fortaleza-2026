import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DatabaseBinding } from "../../db/database";
import { createSqliteDatabase } from "../../db/sqlite";
import { ensureDatabase } from "./runtime";
import { loadParticipantStatus } from "./participant-status";

const directories: string[] = [];
const databases: DatabaseBinding[] = [];

async function scenario() {
  const directory = mkdtempSync(join(tmpdir(), "sit-participant-status-"));
  directories.push(directory);
  const database = createSqliteDatabase(join(directory, "status.db"));
  databases.push(database);
  await ensureDatabase(database);
  await database.batch([
    database.prepare("INSERT INTO participants (id, name, name_key, email) VALUES (?, ?, ?, ?)")
      .bind(1, "João Victor", "joão victor", "arcanjocity@gmail.com"),
    database.prepare("INSERT INTO participants (id, name, name_key, email) VALUES (?, ?, ?, ?)")
      .bind(2, "Jonys Arcanjo", "jonys arcanjo", "arcanjocity@gmail.com"),
    database.prepare("INSERT INTO participants (id, name, name_key, email) VALUES (?, ?, ?, ?)")
      .bind(3, "Outra Pessoa", "outra pessoa", "outra@example.com"),
    database.prepare("UPDATE event_settings SET max_workshops_per_participant = 2 WHERE id = 1"),
    database.prepare("INSERT INTO registrations (participant_id, workshop_id) VALUES (?, ?)").bind(1, 1),
  ]);
  return database;
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe("participant registration status", () => {
  it("keeps registration state isolated by both email and selected participant", async () => {
    const database = await scenario();

    await expect(loadParticipantStatus(database, "arcanjocity@gmail.com", 3)).resolves.toBeNull();

    const joao = await loadParticipantStatus(database, "arcanjocity@gmail.com", 1);
    expect(joao?.participant).toEqual({ id: 1, name: "João Victor", email: "arcanjocity@gmail.com" });
    expect(joao?.registrations.map((registration) => registration.id)).toEqual([1]);
    expect(joao?.workshops.map((workshop) => workshop.id)).toEqual([2]);
    expect({ maximum: joao?.maximum, remaining: joao?.remaining }).toEqual({ maximum: 2, remaining: 1 });

    const jonys = await loadParticipantStatus(database, "arcanjocity@gmail.com", 2);
    expect(jonys?.registrations).toEqual([]);
    expect(jonys?.workshops.map((workshop) => workshop.id)).toEqual([1, 2]);
    expect(jonys?.remaining).toBe(2);
  });

  it("preserves existing registrations and returns zero remaining when the limit is lowered", async () => {
    const database = await scenario();
    await database.prepare("INSERT INTO registrations (participant_id, workshop_id) VALUES (?, ?)").bind(1, 2).run();
    await database.prepare("UPDATE event_settings SET max_workshops_per_participant = 1 WHERE id = 1").run();

    const status = await loadParticipantStatus(database, "arcanjocity@gmail.com", 1);

    expect(status?.registrations).toHaveLength(2);
    expect(status?.workshops).toEqual([]);
    expect({ maximum: status?.maximum, remaining: status?.remaining }).toEqual({ maximum: 1, remaining: 0 });
  });
});
