// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserContext, Page, Request } from "@playwright/test";

export const API = "https://api.astro-beat.example";

/** Sentinel birth data. None of these values may ever appear in a request that leaves the page. */
export const SENTINEL = {
  name: "Zyxwv Canary",
  date: "1987-03-21",
  time: "14:05",
  place: "Pune",
  lat: 18.52,
  lon: 73.86,
  tz: "Asia/Kolkata",
  notes: "canary-note-qwerty",
};

/** Every encoding of the sentinel we scan for. */
export function sentinelNeedles(): string[] {
  const utcMs = Date.UTC(1987, 2, 21, 8, 35); // 14:05 IST
  const jd = utcMs / 86_400_000 + 2440587.5;
  return [
    SENTINEL.name, "Zyxwv", "Canary", SENTINEL.notes, SENTINEL.place, "Maharashtra", SENTINEL.tz, "Kolkata",
    "1987", "03-21", "21/03", "03/21", "21.03", "14:05", "1405", "08:35",
    String(utcMs), String(Math.floor(utcMs / 1000)), jd.toFixed(1), jd.toFixed(2), jd.toFixed(4),
    "18.52", "73.86", "18.5", "73.8", "73.9", "+330", "330", "UTC+05:30", "+05:30", "5:30",
  ];
}

export interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

/** Capture every request (page, workers and service worker) and stub the proxy. */
export async function captureAndStub(context: BrowserContext): Promise<Captured[]> {
  const captured: Captured[] = [];
  await context.route("**/*", async (route, request: Request) => {
    captured.push({ url: request.url(), method: request.method(), headers: request.headers(), body: request.postData() ?? "" });
    const url = new URL(request.url());
    if (url.origin !== API) return route.continue();
    const cors = { "access-control-allow-origin": "http://localhost:4173", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === "/v1/session") {
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ token: "00000000-0000-4000-8000-000000000000.9999999999.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", expiresAt: "2099-01-01T00:00:00.000Z" }) });
    }
    if (url.pathname === "/v1/geocode") {
      const { q } = JSON.parse(request.postData() ?? "{}") as { q?: string };
      const places = /zzyzx/i.test(q ?? "")
        ? [{ name: "Zzyzxville", admin: "Nowhere State", country: "IN", lat: 25.5, lon: 85.1, tz: "Asia/Kolkata" }]
        : [];
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ places }) });
    }
    if (url.pathname === "/v1/predict") {
      const req = JSON.parse(request.postData() ?? "{}");
      const payload = req.payload;
      const firstPeriod = payload.periods[0]?.label ?? "P1";
      return route.fulfill({
        status: 200, headers: cors, contentType: "application/json",
        body: JSON.stringify({
          requestId: req.requestId, system: payload.system, topic: payload.topic, promptVersion: `${payload.system}-${payload.topic}@2`, model: "stub",
          output: {
            summary: `A stubbed reading. ${firstPeriod} looks steady.`,
            themes: [{ title: "Stub theme", detail: "Grounded in F1.", tone: "mixed", basis: ["F1"] }],
            periods: [{ period: firstPeriod, headline: "Steady", detail: "A steady period.", confidence: "tentative", basis: ["F1"] }],
            table: [], limitations: [], declined: [],
          },
          checks: { unknownFactIds: [], unknownPeriods: [], datesRedacted: 0 },
          usage: { inputTokens: 1, outputTokens: 1 },
        }),
      });
    }
    return route.fulfill({ status: 404, headers: cors, body: "{}" });
  });
  return captured;
}

export async function collectCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sample} @${e.sourceFile}:${e.lineNumber}:${e.columnNumber}`);
    });
  });
}

export const cspViolations = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? []);

export async function createSentinelProfile(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /create my chart/i }).click();
  await page.getByLabel("Name (optional)").fill(SENTINEL.name);
  await page.getByLabel("Birth date").fill(SENTINEL.date);
  await page.getByLabel("Birth time (local clock time)").fill(SENTINEL.time);
  await page.getByPlaceholder("Search a city (offline)").fill("Pun");
  await page.getByRole("button", { name: /^Pune, Maharashtra, IN$/ }).click();
  await page.getByLabel(/Notes/).fill(SENTINEL.notes);
  await page.getByRole("button", { name: "Compute chart" }).click();
  await page.getByRole("heading", { name: /chart & analysis/i }).waitFor({ timeout: 60_000 });
}
