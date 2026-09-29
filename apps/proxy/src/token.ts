// SPDX-License-Identifier: AGPL-3.0-or-later
// Stateless session tokens: `${sid}.${expUnixSec}.${base64url(HMAC-SHA256(secret, sid.exp))}`.
const enc = new TextEncoder();

const b64url = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export const SESSION_TTL_SEC = 24 * 3600;

export async function issueToken(secret: string, nowMs: number): Promise<{ token: string; sid: string; expiresAt: string }> {
  const sid = crypto.randomUUID();
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SEC;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(`${sid}.${exp}`));
  return { token: `${sid}.${exp}.${b64url(sig)}`, sid, expiresAt: new Date(exp * 1000).toISOString() };
}

/** Returns the session id, or null if the token is malformed, forged or expired. */
export async function verifyToken(secret: string, token: string, nowMs: number): Promise<string | null> {
  const m = /^([0-9a-f-]{36})\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return null;
  const [, sid, expStr, sig] = m as unknown as [string, string, string, string];
  if (Number(expStr) * 1000 < nowMs) return null;
  const expected = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(`${sid}.${expStr}`));
  // constant-time compare
  const a = b64url(expected);
  if (a.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? sid : null;
}

export async function sha256Prefix(text: string, chars = 12): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, chars);
}
