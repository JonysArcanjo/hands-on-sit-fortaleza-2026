import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function projectFile(path: string) {
  return readFileSync(path, "utf8");
}

describe("Docker deployment configuration", () => {
  it("builds a standalone Node 22 image that runs without root privileges", () => {
    const dockerfile = projectFile("Dockerfile");

    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim AS deps/);
    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim AS builder/);
    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim AS runner/);
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
  });

  it("keeps dependencies, builds, credentials and SQLite files out of the image context", () => {
    const dockerignore = projectFile(".dockerignore");

    for (const entry of ["node_modules", ".next", ".env", "data", "*.db*"]) {
      expect(dockerignore).toContain(entry);
    }
  });

  it("publishes HTTP and stores SQLite in a persistent named volume", () => {
    const compose = projectFile("compose.yaml");

    expect(compose).toContain('"80:3000"');
    expect(compose).toContain("DATABASE_PATH: /app/data/hands-on.db");
    expect(compose).toContain("hands_on_data:/app/data");
    expect(compose).toContain("restart: unless-stopped");
    expect(compose).toContain("/api/health");
    expect(compose).toMatch(/volumes:\s*\n\s+hands_on_data:/);
  });
});
