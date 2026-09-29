// SPDX-License-Identifier: AGPL-3.0-or-later
// The ONLY module allowed to perform network I/O (lint-enforced). It talks to our proxy only.
import { ErrorResponse, MetaResponse, PredictionResponse, SessionResponse } from "@astro/schema/api";

const API = __API_ORIGIN__;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryAfter?: number) {
    super(code);
    this.name = "ApiError";
  }
}

let session: { token: string; expiresAt: number } | null = null;

async function errorFrom(res: Response): Promise<ApiError> {
  const parsed = ErrorResponse.safeParse(await res.json().catch(() => null));
  return new ApiError(res.status, parsed.success ? parsed.data.error : "upstream_error", parsed.success ? parsed.data.retryAfter : undefined);
}

async function getToken(): Promise<string> {
  if (session && session.expiresAt - Date.now() > 60_000) return session.token;
  const res = await fetch(`${API}/v1/session`, { method: "POST", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
  if (!res.ok) throw await errorFrom(res);
  const s = SessionResponse.parse(await res.json());
  session = { token: s.token, expiresAt: Date.parse(s.expiresAt) };
  return s.token;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Send exactly the previewed body. `approvedHash` is the SHA-256 shown on the consent screen;
 * the body is re-hashed here and refused if it differs by a single byte.
 */
export async function sendPrediction(body: string, approvedHash: string): Promise<PredictionResponse> {
  if ((await sha256Hex(body)) !== approvedHash) throw new ApiError(0, "consent_mismatch");
  const token = await getToken();
  const res = await fetch(`${API}/v1/predict`, {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) {
    if (res.status === 401) session = null;
    throw await errorFrom(res);
  }
  return PredictionResponse.parse(await res.json());
}

export async function fetchMeta(): Promise<MetaResponse> {
  const res = await fetch(`${API}/v1/meta`, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
  if (!res.ok) throw await errorFrom(res);
  return MetaResponse.parse(await res.json());
}

export const API_ORIGIN = API;
