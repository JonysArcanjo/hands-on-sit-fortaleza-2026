import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const standaloneRoot = join(projectRoot, ".next", "standalone");
const temporaryDirectories = [];
const children = new Set();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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

async function waitForHealth(baseUrl, child, logs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Servidor encerrou antes do healthcheck.\n${logs.join("")}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The TCP listener may not be ready yet.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Tempo esgotado aguardando healthcheck.\n${logs.join("")}`);
}

async function startApplication({ admin = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "sit-deploy-e2e-"));
  temporaryDirectories.push(directory);
  const port = await availablePort();
  const password = "senha-e2e";
  const environment = {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    DATABASE_PATH: join(directory, "hands-on.db"),
  };
  if (admin) {
    environment.ADMIN_EMAIL = "admin@teste.local";
    environment.ADMIN_PASSWORD_HASH = createHash("sha256").update(password).digest("hex");
    environment.SESSION_SECRET = "segredo-e2e-com-tamanho-suficiente";
  } else {
    delete environment.ADMIN_EMAIL;
    delete environment.ADMIN_PASSWORD_HASH;
    delete environment.SESSION_SECRET;
  }
  const logs = [];
  const child = spawn(process.execPath, ["server.js"], {
    cwd: standaloneRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl, child, logs);
  return { baseUrl, child, logs, password };
}

async function stopApplication(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
  children.delete(child);
}

async function jsonRequest(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { response, body };
}

async function verifyMissingAdminConfiguration() {
  const application = await startApplication({ admin: false });
  try {
    const health = await jsonRequest(application.baseUrl, "/api/health");
    assert(health.response.status === 200 && health.body.database === "ok", "Healthcheck deve funcionar sem credenciais administrativas.");
    const login = await jsonRequest(application.baseUrl, "/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@teste.local", password: "senha-e2e" }),
    });
    assert(login.response.status === 401, "Login deve ser negado quando a configuração administrativa está ausente.");
  } finally {
    await stopApplication(application.child);
  }
}

async function verifyCompleteWorkflow() {
  const application = await startApplication();
  const { baseUrl, password } = application;
  try {
    const login = await jsonRequest(baseUrl, "/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@teste.local", password }),
    });
    assert(login.response.status === 200, `Login administrativo falhou: ${JSON.stringify(login.body)}`);
    const cookie = login.response.headers.get("set-cookie")?.split(";", 1)[0];
    assert(cookie?.startsWith("sit_admin="), "Login não devolveu o cookie sit_admin.");
    const adminHeaders = { cookie, "content-type": "application/json" };

    const deadline = await jsonRequest(baseUrl, "/api/admin/settings/registration-deadline", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ registrationDeadline: "2099-12-31" }),
    });
    assert(deadline.response.status === 200, "Não foi possível atualizar a data final.");

    const csv = [
      "Nome,E-mail",
      "Ana E2E,ana.e2e@example.com",
      "Bruno E2E,bruno.e2e@example.com",
      "Carla E2E,carla.e2e@example.com",
    ].join("\n");
    const form = new FormData();
    form.set("file", new File([csv], "participantes.csv", { type: "text/csv" }));
    const imported = await jsonRequest(baseUrl, "/api/admin/participants/import", {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    assert(imported.response.status === 200 && imported.body.created === 3, `Importação falhou: ${JSON.stringify(imported.body)}`);

    async function eligibility(email) {
      return jsonRequest(baseUrl, "/api/eligibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    }

    const ana = await eligibility("ana.e2e@example.com");
    assert(ana.response.status === 200 && ana.body.kind === "eligible", "Participante importada não ficou elegível.");
    const firstWorkshop = ana.body.workshops[0];
    const registration = await jsonRequest(baseUrl, "/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId: ana.body.participant.id, workshopId: firstWorkshop.id }),
    });
    assert(registration.response.status === 201, `Inscrição pública falhou: ${JSON.stringify(registration.body)}`);

    const limitedWorkshop = await jsonRequest(baseUrl, "/api/admin/workshops", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        title: "Concorrência E2E",
        description: "Valida a última vaga",
        instructor: "Equipe E2E",
        startsAt: "2026-10-31",
        room: "Sala E2E",
        capacity: 1,
      }),
    });
    assert(limitedWorkshop.response.status === 201, `Criação do Hands-on limitado falhou: ${JSON.stringify(limitedWorkshop.body)}`);
    const [bruno, carla] = await Promise.all([eligibility("bruno.e2e@example.com"), eligibility("carla.e2e@example.com")]);
    const concurrentResponses = await Promise.all([bruno, carla].map((entry) => jsonRequest(baseUrl, "/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId: entry.body.participant.id, workshopId: limitedWorkshop.body.workshop.id }),
    })));
    const statuses = concurrentResponses.map(({ response }) => response.status).sort();
    assert(JSON.stringify(statuses) === JSON.stringify([201, 409]), `Disputa pela última vaga retornou ${statuses.join(", ")}.`);

    const dashboard = await jsonRequest(baseUrl, "/api/admin/dashboard", { headers: { cookie } });
    assert(dashboard.response.status === 200, "Dashboard administrativo não respondeu.");
    assert(dashboard.body.metrics.registrations === 2, `Esperadas 2 inscrições; recebidas ${dashboard.body.metrics.registrations}.`);
    const limited = dashboard.body.workshops.find((workshop) => workshop.id === limitedWorkshop.body.workshop.id);
    assert(limited?.registrations === 1, "O Hands-on limitado deve conter exatamente uma inscrição.");

    const exported = await fetch(`${baseUrl}/api/admin/registrations/export`, { headers: { cookie } });
    const exportedCsv = await exported.text();
    assert(exported.status === 200, "Exportação CSV falhou.");
    assert(exportedCsv.includes("Ana E2E") && exportedCsv.includes("ana.e2e@example.com") && exportedCsv.includes(firstWorkshop.title), "Exportação CSV não contém os dados inscritos.");
  } finally {
    await stopApplication(application.child);
  }
}

try {
  await verifyMissingAdminConfiguration();
  await verifyCompleteWorkflow();
  console.log("Deploy E2E: health, login, prazo, importação, inscrição, concorrência, dashboard e exportação OK.");
} finally {
  await Promise.all([...children].map(stopApplication));
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
}
