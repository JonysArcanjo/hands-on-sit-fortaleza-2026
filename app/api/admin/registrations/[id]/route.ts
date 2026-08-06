import { requireAdmin } from "../../../../lib/admin";
import { appEnv, ensureDatabase, json } from "../../../../lib/runtime";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const { DB } = appEnv();
  await ensureDatabase(DB);
  await DB.prepare("DELETE FROM registrations WHERE id = ?").bind(Number(id)).run();
  return json({ ok: true });
}
