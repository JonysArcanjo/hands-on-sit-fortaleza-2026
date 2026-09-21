import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "../../../../lib/auth";
import { appEnv, ensureDatabase } from "../../../../lib/runtime";
import { PUT } from "./route";

const directories: string[] = [];

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "sit-max-workshops-"));
  directories.push(directory);
  const secret = "segredo-da-rota-de-limite";
  vi.stubEnv("DATABASE_PATH", join(directory, "settings.db"));
  vi.stubEnv("SESSION_SECRET", secret);
  const token = await createSessionToken("admin@teste.local", secret);
  const database = appEnv().DB;
  await ensureDatabase(database);
  return { token, database };
}

function request(maximum: number, token?: string) {
  return new Request("http://localhost/api/admin/settings/max-workshops", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(token ? { cookie: `sit_admin=${token}` } : {}),
    },
    body: JSON.stringify({ maximum }),
  });
}

afterEach(() => {
  appEnv().DB.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("maximum workshops setting", () => {
  it("requires an administrative session", async () => {
    await setup();
    expect((await PUT(request(2))).status).toBe(401);
  });

  it("rejects non-positive, fractional and excessive limits", async () => {
    const { token } = await setup();
    for (const value of [0, 1.5, 101]) expect((await PUT(request(value, token))).status).toBe(400);
  });

  it("persists an integer limit from 1 through 100", async () => {
    const { token, database } = await setup();
    expect((await PUT(request(2, token))).status).toBe(200);
    expect(await database.prepare("SELECT max_workshops_per_participant AS maximum FROM event_settings WHERE id = 1").first())
      .toEqual({ maximum: 2 });
  });
});
