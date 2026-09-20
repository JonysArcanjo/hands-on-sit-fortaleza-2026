import { requireAdmin } from "../../../../lib/admin";
import { parseParticipantRows } from "../../../../lib/import-participants";
import { parseParticipantFile } from "../../../../lib/participant-file";
import { appEnv, ensureDatabase, json } from "../../../../lib/runtime";

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ message: "Selecione um arquivo CSV ou XLSX." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return json({ message: "O arquivo deve ter no máximo 5 MB." }, { status: 413 });
  if (!/\.(csv|xlsx)$/i.test(file.name)) return json({ message: "Formato incompatível. Envie CSV ou XLSX." }, { status: 400 });
  try {
    const rows = await parseParticipantFile(file.name, await file.arrayBuffer());
    const result = parseParticipantRows(rows);
    const { DB } = appEnv();
    await ensureDatabase(DB);
    let created = 0;
    let updated = 0;
    for (const participant of result.valid) {
      const existing = await DB.prepare("SELECT id, name FROM participants WHERE email = ?").bind(participant.email).first<{ id: number; name: string }>();
      if (existing) {
        await DB.prepare("UPDATE participants SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(participant.name, existing.id).run();
        updated += 1;
      } else {
        await DB.prepare("INSERT INTO participants (name, email) VALUES (?, ?)").bind(participant.name, participant.email).run();
        created += 1;
      }
    }
    return json({ created, updated, rejected: result.errors.length, ignored: result.ignored, errors: result.errors });
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "Não foi possível importar o arquivo." }, { status: 400 });
  }
}
