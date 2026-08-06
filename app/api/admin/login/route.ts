import { issueAdminSession, SESSION_COOKIE, verifyAdminCredentials } from "../../../lib/admin";
import { json } from "../../../lib/runtime";

export async function POST(request: Request) {
  const { email = "", password = "" } = await request.json() as { email?: string; password?: string };
  if (!(await verifyAdminCredentials(email, password))) return json({ message: "E-mail ou senha incorretos." }, { status: 401 });
  const token = await issueAdminSession(email);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return json({ ok: true }, { headers: { "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}` } });
}
