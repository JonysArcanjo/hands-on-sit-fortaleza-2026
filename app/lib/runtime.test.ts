import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSqliteDatabase } from "../../db/sqlite";
import type { DatabaseBinding } from "../../db/database";
import { appEnv, ensureDatabase } from "./runtime";

const directories: string[] = [];
const databases: DatabaseBinding[] = [];

function temporaryPath(name = "application.db") {
  const directory = mkdtempSync(join(tmpdir(), "sit-runtime-"));
  directories.push(directory);
  return join(directory, name);
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("application runtime", () => {
  it("creates the schema and default data idempotently", async () => {
    const database = createSqliteDatabase(temporaryPath());
    databases.push(database);

    await ensureDatabase(database);
    await ensureDatabase(database);

    expect((await database.prepare("SELECT title FROM workshops ORDER BY id").all()).results).toHaveLength(2);
    expect(await database.prepare("SELECT id, registration_deadline FROM event_settings").first()).toEqual({
      id: 1,
      registration_deadline: null,
    });
  });

  it("serializes concurrent initialization of the same database", async () => {
    const database = createSqliteDatabase(temporaryPath("concurrent.db"));
    databases.push(database);

    await Promise.all([ensureDatabase(database), ensureDatabase(database), ensureDatabase(database)]);

    expect((await database.prepare("SELECT title FROM workshops ORDER BY id").all()).results).toHaveLength(2);
    expect(await database.prepare("SELECT MAX(version) AS version FROM schema_migrations").first())
      .toEqual({ version: 2 });
  });

  it("preserves application rows after the database is reopened", async () => {
    const databasePath = temporaryPath("persistent.db");
    const database = createSqliteDatabase(databasePath);
    await ensureDatabase(database);
    await database.prepare("INSERT INTO participants (name, name_key, email) VALUES (?, ?, ?)").bind("Ana", "ana", "ana@example.com").run();
    database.close();

    const reopened = createSqliteDatabase(databasePath);
    databases.push(reopened);

    expect(await reopened.prepare("SELECT name, email FROM participants").first()).toEqual({
      name: "Ana",
      email: "ana@example.com",
    });
  });

  it("reads administrative settings and the database path from process environment", () => {
    const databasePath = temporaryPath("environment.db");
    vi.stubEnv("DATABASE_PATH", databasePath);
    vi.stubEnv("ADMIN_EMAIL", "organizacao@example.com");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "abc123");
    vi.stubEnv("SESSION_SECRET", "segredo-de-teste");

    const environment = appEnv();
    databases.push(environment.DB);

    expect(environment.ADMIN_EMAIL).toBe("organizacao@example.com");
    expect(environment.ADMIN_PASSWORD_HASH).toBe("abc123");
    expect(environment.SESSION_SECRET).toBe("segredo-de-teste");
    expect(environment.DB).toBeDefined();
  });

  it("requires an explicit database path in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_PATH", "");

    expect(() => appEnv()).toThrow("DATABASE_PATH");
  });
});
