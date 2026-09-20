import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

async function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

async function render() {
  const port = await availablePort();
  const directory = mkdtempSync(join(tmpdir(), "sit-render-"));
  const standaloneRoot = resolve(import.meta.dirname, "..", ".next", "standalone");
  const logs = [];
  const child = spawn(process.execPath, ["server.js"], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      DATABASE_PATH: join(directory, "render.db"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Servidor encerrou antes da renderização.\n${logs.join("")}`);
      try {
        const response = await fetch(url, { headers: { accept: "text/html" } });
        if (response.ok) return response;
      } catch {
        // The production server may still be binding its port.
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    throw new Error(`Tempo esgotado aguardando renderização.\n${logs.join("")}`);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => child.once("exit", resolveExit)),
      new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
    rmSync(directory, { recursive: true, force: true });
  }
}

test("server-renders the event registration journey", { timeout: 40_000 }, async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Hands-on SAP Inside Track Fortaleza 2026<\/title>/i);
  assert.match(html, /Use o mesmo e-mail da sua inscrição no evento/i);
  assert.match(html, /Verificar minha inscrição/i);
  assert.match(html, /Acesso da organização/i);
  assert.match(html, /31 OUT · FORTALEZA, CE/i);
  assert.doesNotMatch(html, /19 SET|2026-09-19|10:30|14:00/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});
