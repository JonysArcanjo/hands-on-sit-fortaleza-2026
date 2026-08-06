import { requireAdmin } from "../../../../lib/admin";
import { validateCapacity } from "../../../../lib/capacity";
import { appEnv, ensureDatabase, json } from "../../../../lib/runtime";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const workshopId = Number(id);
  const input = await request.json() as Record<string, unknown>;
  const { DB } = appEnv();
  await ensureDatabase(DB);
  const count = await DB.prepare("SELECT COUNT(*) AS total FROM registrations WHERE workshop_id = ?").bind(workshopId).first<{ total: number }>();
  const capacity = Number(input.capacity);
  const result = validateCapacity(capacity, Number(count?.total ?? 0));
  if (!result.ok) return json({ message: result.message }, { status: 400 });
  await DB.prepare(`UPDATE workshops SET title = ?, description = ?, instructor = ?, starts_at = ?, room = ?, capacity = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(String(input.title).trim(), String(input.description).trim(), String(input.instructor).trim(), String(input.startsAt), String(input.room).trim(), capacity, input.active === false ? 0 : 1, workshopId).run();
  return json({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const { DB } = appEnv();
  await ensureDatabase(DB);
  const count = await DB.prepare("SELECT COUNT(*) AS total FROM registrations WHERE workshop_id = ?").bind(Number(id)).first<{ total: number }>();
  if (Number(count?.total ?? 0) > 0) return json({ message: "Não é possível excluir um Hands-on com inscrições." }, { status: 409 });
  await DB.prepare("DELETE FROM workshops WHERE id = ?").bind(Number(id)).run();
  return json({ ok: true });
}
