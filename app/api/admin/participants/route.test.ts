import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "../../../lib/auth";
import { appEnv, ensureDatabase } from "../../../lib/runtime";
import { DELETE } from "./route";

const directories: string[] = [];

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "sit-clear-participants-"));
  directories.push(directory);
  const secret = "segredo-da-exclusao-de-participantes";
  vi.stubEnv("DATABASE_PATH", join(directory, "participants.db"));
  vi.stubEnv("SESSION_SECRET", secret);
  const token = await createSessionToken("admin@teste.local", secret);
  const database = appEnv().DB;
  await ensureDatabase(database);
  await database.batch([
    database.prepare("INSERT INTO participants (id, name, name_key, email) VALUES (?, ?, ?, ?)")
      .bind(1, "Ana Teste", "ana teste", "ana@example.com"),
    database.prepare("INSERT INTO registrations (participant_id, workshop_id) VALUES (?, ?)").bind(1, 1),
  ]);
  return { token, database };
}

function request(token?: string) {
  return new Request("http://localhost/api/admin/participants", {
    method: "DELETE",
    headers: token ? { cookie: `sit_admin=${token}` } : {},
  });
}

afterEach(() => {
  appEnv().DB.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("clear imported participants", () => {
  it("requires an administrative session without deleting data", async () => {
    const { database } = await setup();

    expect((await DELETE(request())).status).toBe(401);
    expect(await database.prepare("SELECT COUNT(*) AS total FROM participants").first()).toEqual({ total: 1 });
    expect(await database.prepare("SELECT COUNT(*) AS total FROM registrations").first()).toEqual({ total: 1 });
  });

  it("deletes participants and their registrations while preserving event configuration", async () => {
    const { token, database } = await setup();
    const response = await DELETE(request(token));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedParticipants: 1, deletedRegistrations: 1 });
    expect(await database.prepare("SELECT COUNT(*) AS total FROM participants").first()).toEqual({ total: 0 });
    expect(await database.prepare("SELECT COUNT(*) AS total FROM registrations").first()).toEqual({ total: 0 });
    expect(await database.prepare("SELECT COUNT(*) AS total FROM workshops").first()).toEqual({ total: 2 });
    expect(await database.prepare("SELECT COUNT(*) AS total FROM event_settings").first()).toEqual({ total: 1 });
  });
});
