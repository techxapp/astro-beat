// SPDX-License-Identifier: AGPL-3.0-or-later
// Request handling, in the order of §8: origin → content-type/size → token → rate limits →
// budget → schema → model → output parse and post-checks. Stateless except counters.
// Never logs bodies: only route, status, latency, token counts and a hashed session prefix.
import { getPrompt, listPromptIds, outputJsonSchema, userMessage } from "@astro/prompts";
import {
  GeocodeRequest, PredictionOutput, PredictionRequest, PredictionResponse, type ErrorCode, type ErrorResponse, type GeocodeResponse,
  type MetaResponse,
} from "@astro/schema/api";
import { PAYLOAD_VERSION } from "@astro/schema/payload";
import type { CounterStore } from "./counters.ts";
import { GeocodeError, openMeteoGeocoder, type Geocoder } from "./geocode.ts";
import { UpstreamError, type ModelClient } from "./openai.ts";
import { postCheck } from "./postcheck.ts";
import { issueToken, sha256Prefix, verifyToken } from "./token.ts";

export interface ProxyConfig {
  allowedOrigin: string;
  sessionSecret: string;
  model: string;
  dailyTokenBudget: number;
  sourceUrl: string;
  commit: string;
}

export const LIMITS = {
  maxBodyBytes: 64 * 1024, // month-level periods for three ADs put the largest payloads near 32 KB
  perMinutePerIp: 10,
  perDayPerSession: 20,
  sessionsPerHourPerIp: 10,
  maxOutputTokens: 8000, // includes hidden reasoning tokens; 1500 starved a reasoning model into an empty response
  /** combined readings write a comparison table on top of the usual reading */
  maxOutputTokensCombined: 16000,
  timeoutMs: 60_000,
  timeoutMsCombined: 120_000,
  geocodeMaxBodyBytes: 512,
  geocodePerMinutePerIp: 20,
  geocodePerDayPerSession: 200,
  geocodeTimeoutMs: 8_000,
} as const;

export interface LogLine {
  route: string;
  status: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  sid?: string;
  error?: ErrorCode;
}

export interface HandlerDeps {
  config: ProxyConfig;
  counters: CounterStore;
  model: ModelClient;
  geocoder?: Geocoder;
  now?: () => number;
  log?: (line: LogLine) => void;
}

const SECURITY_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
};

function corsHeaders(origin: string | null, cfg: ProxyConfig): Record<string, string> {
  if (origin !== cfg.allowedOrigin) return { vary: "Origin" };
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly extra: Partial<ErrorResponse>;
  constructor(status: number, code: ErrorCode, extra: Partial<ErrorResponse> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const dayKey = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 10);

async function readBody(req: Request, max: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declared) && declared > max) throw new HttpError(413, "payload_too_large");
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new HttpError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(all);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const { config: cfg, counters, model } = deps;
  const geocoder = deps.geocoder ?? openMeteoGeocoder();
  const now = deps.now ?? Date.now;
  const log = deps.log ?? ((l: LogLine) => console.log(JSON.stringify(l)));
  const outputSchema = outputJsonSchema();

  return async (req) => {
    const started = now();
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    const cors = corsHeaders(origin, cfg);
    const route = `${req.method} ${url.pathname}`;
    const meta: Omit<LogLine, "route" | "status" | "latencyMs"> = {};

    const respond = (status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response => {
      log({ route, status, latencyMs: now() - started, ...meta });
      return new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { ...SECURITY_HEADERS, ...cors, ...(body === null ? {} : { "content-type": "application/json" }), ...extraHeaders },
      });
    };

    try {
      if (req.method === "OPTIONS") {
        if (origin !== cfg.allowedOrigin) throw new HttpError(403, "bad_origin");
        return respond(204, null);
      }

      if (url.pathname === "/v1/meta") {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed");
        const body: MetaResponse = {
          service: "astro-beat-proxy", apiVersion: 1, sourceUrl: cfg.sourceUrl, commit: cfg.commit, prompts: listPromptIds(),
          limits: { maxBodyBytes: LIMITS.maxBodyBytes, perMinute: LIMITS.perMinutePerIp, perSessionPerDay: LIMITS.perDayPerSession },
        };
        return respond(200, body);
      }

      const isGeocode = url.pathname === "/v1/geocode";
      if (url.pathname !== "/v1/session" && url.pathname !== "/v1/predict" && !isGeocode) throw new HttpError(404, "not_found");
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
      // 1. Origin (exact match only)
      if (origin !== cfg.allowedOrigin) throw new HttpError(403, "bad_origin");
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      const ipKey = await sha256Prefix(`ip:${ip}`, 24);

      if (url.pathname === "/v1/session") {
        const hit = await counters.hit(`session:${ipKey}`, LIMITS.sessionsPerHourPerIp, 3600, now());
        if (!hit.allowed) throw new HttpError(429, "rate_limited", { retryAfter: hit.retryAfter });
        const t = await issueToken(cfg.sessionSecret, now());
        meta.sid = await sha256Prefix(t.sid, 8);
        return respond(200, { token: t.token, expiresAt: t.expiresAt });
      }

      // 2. Content-Type and size
      const ct = req.headers.get("content-type") ?? "";
      if (!/^application\/json(;\s*charset=utf-8)?$/i.test(ct.trim())) throw new HttpError(415, "unsupported_media_type");
      const text = await readBody(req, isGeocode ? LIMITS.geocodeMaxBodyBytes : LIMITS.maxBodyBytes);

      // 3. Token
      const auth = req.headers.get("authorization") ?? "";
      const sid = auth.startsWith("Bearer ") ? await verifyToken(cfg.sessionSecret, auth.slice(7), now()) : null;
      if (!sid) throw new HttpError(401, "unauthorized");
      meta.sid = await sha256Prefix(sid, 8);

      // 4. Rate limits
      const limits = isGeocode
        ? ([[`geoip:${ipKey}`, LIMITS.geocodePerMinutePerIp, 60], [`geosid:${sid}`, LIMITS.geocodePerDayPerSession, 86_400]] as const)
        : ([[`ip:${ipKey}`, LIMITS.perMinutePerIp, 60], [`sid:${sid}`, LIMITS.perDayPerSession, 86_400]] as const);
      for (const [key, limit, window] of limits) {
        const hit = await counters.hit(key, limit, window, now());
        if (!hit.allowed) throw new HttpError(429, "rate_limited", { retryAfter: hit.retryAfter });
      }

      if (isGeocode) {
        // The query is never logged; `meta` carries only the hashed session prefix.
        let rawQuery: unknown;
        try {
          rawQuery = JSON.parse(text);
        } catch {
          throw new HttpError(400, "invalid_json");
        }
        const parsedQuery = GeocodeRequest.safeParse(rawQuery);
        if (!parsedQuery.success) throw new HttpError(400, "invalid_payload");
        try {
          const places = await geocoder(parsedQuery.data.q, LIMITS.geocodeTimeoutMs);
          const body: GeocodeResponse = { places };
          return respond(200, body);
        } catch (e) {
          if (e instanceof GeocodeError && e.kind === "timeout") throw new HttpError(504, "upstream_timeout");
          throw new HttpError(502, "upstream_error");
        }
      }

      // 5. Global daily token budget
      const budgetKey = `budget:${dayKey(now())}`;
      if ((await counters.get(budgetKey, now())) >= cfg.dailyTokenBudget) throw new HttpError(503, "budget_exhausted");

      // 6. Schema
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new HttpError(400, "invalid_json");
      }
      const version = (raw as { payload?: { payloadVersion?: unknown } } | null)?.payload?.payloadVersion;
      if (version !== undefined && version !== PAYLOAD_VERSION) throw new HttpError(422, "unsupported_version");
      const parsed = PredictionRequest.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 20).map((i) => ({
          path: i.path.slice(0, 16).map((p) => (typeof p === "number" ? p : String(p).slice(0, 64))),
        }));
        throw new HttpError(400, "invalid_payload", { issues });
      }
      const { requestId, promptVersion, payload } = parsed.data;
      const prompt = getPrompt(payload.system, payload.topic, promptVersion);
      if (!prompt) throw new HttpError(422, "unsupported_version");

      // 7. Model
      let result;
      const combined = payload.system === "combined";
      try {
        result = await model({
          model: cfg.model, instructions: prompt.instructions, input: userMessage(payload), schema: outputSchema,
          maxOutputTokens: combined ? LIMITS.maxOutputTokensCombined : LIMITS.maxOutputTokens,
          timeoutMs: combined ? LIMITS.timeoutMsCombined : LIMITS.timeoutMs,
        });
      } catch (e) {
        if (e instanceof UpstreamError && e.kind === "timeout") throw new HttpError(504, "upstream_timeout");
        throw new HttpError(502, "upstream_error");
      }
      meta.inputTokens = result.inputTokens;
      meta.outputTokens = result.outputTokens;
      await counters.add(budgetKey, result.inputTokens + result.outputTokens, 86_400, now());

      // 8. Output parse and post-checks
      let out: unknown;
      try {
        out = JSON.parse(result.text);
      } catch {
        throw new HttpError(502, "model_output_invalid");
      }
      const output = PredictionOutput.safeParse(out);
      if (!output.success) throw new HttpError(502, "model_output_invalid");
      const checked = postCheck(output.data, payload);
      const response = PredictionResponse.parse({
        requestId,
        system: payload.system,
        topic: payload.topic,
        promptVersion: prompt.id,
        model: result.model.slice(0, 100),
        output: checked.output,
        checks: { unknownFactIds: checked.unknownFactIds, unknownPeriods: checked.unknownPeriods, datesRedacted: checked.datesRedacted },
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      });
      return respond(200, response);
    } catch (e) {
      if (e instanceof HttpError) {
        meta.error = e.code;
        const body: ErrorResponse = { error: e.code, ...e.extra };
        return respond(e.status, body, e.extra.retryAfter ? { "retry-after": String(e.extra.retryAfter) } : {});
      }
      meta.error = "upstream_error";
      return respond(500, { error: "upstream_error" });
    }
  };
}
