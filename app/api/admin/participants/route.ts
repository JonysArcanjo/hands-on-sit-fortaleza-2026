import { requireAdmin } from "../../../lib/admin";
import { appEnv, ensureDatabase, json } from "../../../lib/runtime";

type DeleteResult = { changes: number };

export async function DELETE(request: Request) {
  if (!(await requireAdmin(request))) return json({ message: "Sessão expirada." }, { status: 401 });
  const { DB } = appEnv();
  await ensureDatabase(DB);
  const [registrations, participants] = await DB.batch([
    DB.prepare("DELETE FROM registrations"),
    DB.prepare("DELETE FROM participants"),
  ]) as DeleteResult[];
  return json({
    deletedParticipants: participants.changes,
    deletedRegistrations: registrations.changes,
  });
}
