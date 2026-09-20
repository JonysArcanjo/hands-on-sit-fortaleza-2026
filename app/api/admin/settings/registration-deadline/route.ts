import { requireAdmin } from "../../../../lib/admin";
import { appEnv, ensureDatabase, json } from "../../../../lib/runtime";

export async function PUT(request: Request) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const { registrationDeadline } = await request.json() as { registrationDeadline?: string };
  if (!registrationDeadline || !/^\d{4}-\d{2}-\d{2}$/.test(registrationDeadline)) {
    return json({ message: "Informe uma data final válida." }, { status: 400 });
  }
  const { DB } = appEnv();
  await ensureDatabase(DB);
  await DB.prepare("UPDATE event_settings SET registration_deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1").bind(registrationDeadline).run();
  return json({ ok: true });
}
