// SPDX-License-Identifier: AGPL-3.0-or-later
import { GeocodeResponse, type GeocodePlace } from "@astro/schema/api";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryCounterStore } from "../src/counters.ts";
import { GeocodeError, openMeteoGeocoder, type Geocoder } from "../src/geocode.ts";
import { createHandler, LIMITS, type LogLine, type ProxyConfig } from "../src/handler.ts";

const ORIGIN = "https://app.test";
const CONFIG: ProxyConfig = {
  allowedOrigin: ORIGIN, sessionSecret: "test-secret-0123456789abcdef", model: "m",
  dailyTokenBudget: 10_000, sourceUrl: "https://example.test/src", commit: "abc",
};
const SECRET_QUERY = "Zzyzx Tiny Village";
const PLACE: GeocodePlace = { name: "Bhiwani", admin: "Haryana", country: "IN", lat: 28.79, lon: 76.14, tz: "Asia/Kolkata" };

let counters: MemoryCounterStore;
let logs: LogLine[];
let seen: string[];
let geocoder: Geocoder;
const handler = () => createHandler({
  config: CONFIG, counters, log: (l) => logs.push(l),
  model: async () => {
    throw new Error("model must not be called");
  },
  geocoder: (q, t) => {
    seen.push(q);
    return geocoder(q, t);
  },
});

beforeEach(() => {
  counters = new MemoryCounterStore();
  logs = [];
  seen = [];
  geocoder = async () => [PLACE];
});

const post = (path: string, body: string | null, headers: Record<string, string> = {}, ip = "203.0.113.9") =>
  new Request(`https://api.test${path}`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", "cf-connecting-ip": ip, ...headers },
    ...(body === null ? {} : { body }),
  });
const token = async (h: (r: Request) => Promise<Response>) => ((await (await h(post("/v1/session", null))).json()) as { token: string }).token;
const geocode = (h: (r: Request) => Promise<Response>, body: string, t: string, headers: Record<string, string> = {}) =>
  h(post("/v1/geocode", body, { authorization: `Bearer ${t}`, ...headers }));

describe("POST /v1/geocode", () => {
  it("returns validated places for a session holder", async () => {
    const h = handler();
    const r = await geocode(h, JSON.stringify({ q: "bhiwani" }), await token(h));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(GeocodeResponse.parse(await r.json()).places).toEqual([PLACE]);
    expect(seen).toEqual(["bhiwani"]);
  });
  it("rejects a foreign origin, a missing token and a GET", async () => {
    const h = handler();
    expect((await h(post("/v1/geocode", "{}", { origin: "https://evil.test" }))).status).toBe(403);
    expect((await h(post("/v1/geocode", JSON.stringify({ q: "pune" })))).status).toBe(401);
    expect((await h(new Request("https://api.test/v1/geocode", { headers: { origin: ORIGIN } }))).status).toBe(405);
    expect(seen).toEqual([]);
  });
  it("enforces the query length cap and the body size cap", async () => {
    const h = handler();
    const t = await token(h);
    expect((await geocode(h, JSON.stringify({ q: "a" }), t)).status).toBe(400);
    expect((await geocode(h, JSON.stringify({ q: "x".repeat(81) }), t)).status).toBe(400);
    expect((await geocode(h, JSON.stringify({ q: "pune", extra: 1 }), t)).status).toBe(400);
    expect((await geocode(h, "not json", t)).status).toBe(400);
    expect((await geocode(h, JSON.stringify({ q: "x".repeat(LIMITS.geocodeMaxBodyBytes) }), t)).status).toBe(413);
    expect(seen).toEqual([]);
  });
  it("rate-limits per IP per minute with Retry-After", async () => {
    const h = handler();
    const t = await token(h);
    for (let i = 0; i < LIMITS.geocodePerMinutePerIp; i++) expect((await geocode(h, JSON.stringify({ q: "pune" }), t)).status).toBe(200);
    const r = await geocode(h, JSON.stringify({ q: "pune" }), t);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).not.toBeNull();
  });
  it("maps upstream failure to 502 and timeout to 504", async () => {
    const h = handler();
    const t = await token(h);
    geocoder = async () => {
      throw new GeocodeError("http", "boom");
    };
    expect((await geocode(h, JSON.stringify({ q: "pune" }), t)).status).toBe(502);
    geocoder = async () => {
      throw new GeocodeError("timeout", "slow");
    };
    expect((await geocode(h, JSON.stringify({ q: "pune" }), t)).status).toBe(504);
  });
  it("never logs the query", async () => {
    const h = handler();
    await geocode(h, JSON.stringify({ q: SECRET_QUERY }), await token(h));
    expect(logs.some((l) => l.route === "POST /v1/geocode")).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("Zzyzx");
  });
});

describe("Open-Meteo geocoder client", () => {
  const call = (fetchImpl: typeof fetch) => openMeteoGeocoder(fetchImpl)("Bhiwani", 1000);
  it("calls only the fixed host, sends only the name, and maps results", async () => {
    let sent: URL | undefined;
    let init: RequestInit | undefined;
    const fakeFetch = (async (u: URL, i: RequestInit) => {
      sent = u;
      init = i;
      return new Response(JSON.stringify({
        results: [
          { name: "Bhiwani", latitude: 28.79, longitude: 76.14, timezone: "Asia/Kolkata", admin1: "Haryana", country_code: "IN" },
          { name: "Broken", latitude: 999, longitude: 0, timezone: "UTC" },
        ],
      }));
    }) as unknown as typeof fetch;
    expect(await call(fakeFetch)).toEqual([PLACE]);
    expect(sent?.origin).toBe("https://geocoding-api.open-meteo.com");
    expect(sent?.searchParams.get("name")).toBe("Bhiwani");
    expect(Object.keys(init?.headers ?? {})).toEqual(["accept"]);
  });
  it("treats a body without results as no matches", async () => {
    expect(await call((async () => new Response(JSON.stringify({ generationtime_ms: 1 }))) as unknown as typeof fetch)).toEqual([]);
  });
  it("throws on http errors, non-JSON bodies and timeouts", async () => {
    await expect(call((async () => new Response("no", { status: 500 })) as unknown as typeof fetch)).rejects.toMatchObject({ kind: "http" });
    await expect(call((async () => new Response("<html>")) as unknown as typeof fetch)).rejects.toMatchObject({ kind: "shape" });
    const hang = ((_u: URL, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    await expect(openMeteoGeocoder(hang)("x", 20)).rejects.toMatchObject({ kind: "timeout" });
  });
});
