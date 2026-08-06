import { createSessionToken, readCookie, verifySessionToken } from "./auth";
import { appEnv } from "./runtime";
import { normalizeEmail } from "./participants";

export const SESSION_COOKIE = "sit_admin";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const config = appEnv();
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD_HASH) return false;
  return normalizeEmail(email) === normalizeEmail(config.ADMIN_EMAIL) && (await sha256(password)) === config.ADMIN_PASSWORD_HASH.toLowerCase();
}

export async function issueAdminSession(email: string): Promise<string> {
  const secret = appEnv().SESSION_SECRET;
  if (!secret) throw new Error("Configuração administrativa incompleta.");
  return createSessionToken(normalizeEmail(email), secret);
}

export async function requireAdmin(request: Request): Promise<{ email: string } | null> {
  const secret = appEnv().SESSION_SECRET;
  if (!secret) return null;
  return verifySessionToken(readCookie(request, SESSION_COOKIE), secret);
}
