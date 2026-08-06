import { requireAdmin } from "../../../lib/admin";
import { validateCapacity } from "../../../lib/capacity";
import { appEnv, ensureDatabase, json } from "../../../lib/runtime";

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const input = await request.json() as Record<string, unknown>;
  const capacity = Number(input.capacity);
  const capacityResult = validateCapacity(capacity, 0);
  if (!capacityResult.ok) return json({ message: capacityResult.message }, { status: 400 });
  const required = ["title", "description", "instructor", "startsAt", "room"] as const;
  if (required.some((field) => !String(input[field] ?? "").trim())) return json({ message: "Preencha todos os campos do Hands-on." }, { status: 400 });
  const { DB } = appEnv();
  await ensureDatabase(DB);
  const saved = await DB.prepare(`INSERT INTO workshops (title, description, instructor, starts_at, room, capacity, active)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`).bind(
      String(input.title).trim(), String(input.description).trim(), String(input.instructor).trim(),
      String(input.startsAt), String(input.room).trim(), capacity, input.active === false ? 0 : 1,
    ).first();
  return json({ ok: true, workshop: saved }, { status: 201 });
}
