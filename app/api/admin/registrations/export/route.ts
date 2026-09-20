import { requireAdmin } from "../../../../lib/admin";
import { buildRegistrationsCsv, type RegistrationExportRow } from "../../../../lib/registrations-csv";
import { appEnv, ensureDatabase } from "../../../../lib/runtime";

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return Response.json({ message: "Sessão expirada." }, { status: 401 });
  const { DB } = appEnv();
  await ensureDatabase(DB);
  const registrations = await DB.prepare(`SELECT w.title AS workshop, p.name, p.email, r.created_at AS createdAt
    FROM registrations r JOIN participants p ON p.id = r.participant_id JOIN workshops w ON w.id = r.workshop_id
    ORDER BY w.title COLLATE NOCASE, p.name COLLATE NOCASE`).all<RegistrationExportRow>();
  return new Response(buildRegistrationsCsv(registrations.results), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="inscritos-por-hands-on.csv"',
      "cache-control": "no-store",
    },
  });
}
