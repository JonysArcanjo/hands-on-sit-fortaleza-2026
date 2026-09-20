import { appEnv, ensureDatabase, json } from "../../lib/runtime";

export async function GET() {
  try {
    const { DB } = appEnv();
    await ensureDatabase(DB);
    const result = await DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    if (result?.ok !== 1) throw new Error("SQLite health query failed");
    return json({ status: "ok", database: "ok" });
  } catch {
    return json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}
