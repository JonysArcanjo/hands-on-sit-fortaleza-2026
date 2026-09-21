import { requireAdmin } from "../../../../lib/admin";
import { appEnv, ensureDatabase, json } from "../../../../lib/runtime";

export async function PUT(request: Request) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const { maximum } = await request.json() as { maximum?: number };
  if (!Number.isInteger(maximum) || Number(maximum) < 1 || Number(maximum) > 100) {
    return json({ message: "Informe um limite inteiro entre 1 e 100." }, { status: 400 });
  }
  const { DB } = appEnv();
  await ensureDatabase(DB);
  await DB.prepare(`UPDATE event_settings SET max_workshops_per_participant = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = 1`).bind(maximum!).run();
  return json({ ok: true, maximum });
}
