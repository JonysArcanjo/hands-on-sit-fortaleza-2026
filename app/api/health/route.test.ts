import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appEnv } from "../../lib/runtime";
import { GET } from "./route";

const directories: string[] = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "sit-health-"));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  try {
    appEnv().DB.close();
  } catch {
    // A failure-path test can intentionally leave no open database.
  }
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("health endpoint", () => {
  it("reports a healthy database without requiring admin credentials", async () => {
    vi.stubEnv("DATABASE_PATH", join(temporaryDirectory(), "health.db"));
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    vi.stubEnv("SESSION_SECRET", "");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok", database: "ok" });
  });

  it("returns an opaque unavailable response when SQLite cannot open", async () => {
    vi.stubEnv("DATABASE_PATH", temporaryDirectory());

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "error", database: "unavailable" });
  });
});
