import { SESSION_COOKIE } from "../../../lib/admin";
import { json } from "../../../lib/runtime";

export async function POST() {
  return json({ ok: true }, { headers: { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } });
}
