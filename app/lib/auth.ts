const SESSION_DURATION_MS = 8 * 60 * 60 * 1_000;
const encoder = new TextEncoder();

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

async function signature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

export async function createSessionToken(email: string, secret: string, now = Date.now()): Promise<string> {
  const payload = encodeBase64Url(JSON.stringify({ email, expiresAt: now + SESSION_DURATION_MS }));
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<{ email: string } | null> {
  if (!token || !secret) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expected = await signature(payload, secret);
  if (expected.length !== suppliedSignature.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ suppliedSignature.charCodeAt(index);
  if (mismatch !== 0) return null;
  try {
    const data = JSON.parse(decodeBase64Url(payload)) as { email?: string; expiresAt?: number };
    if (!data.email || !data.expiresAt || data.expiresAt < now) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
