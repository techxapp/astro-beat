// SPDX-License-Identifier: AGPL-3.0-or-later
// Canary / no-leak gate (§11), CSP violations, consent integrity and Clear everything.
import { expect, test } from "@playwright/test";
import { API, captureAndStub, collectCspViolations, createSentinelProfile, cspViolations, sentinelNeedles } from "./helpers.ts";

test("full flow: nothing identifying leaves the page, the sent body equals the preview", async ({ page, context }) => {
  const captured = await captureAndStub(context);
  const consoleLines: string[] = [];
  page.on("console", (m) => consoleLines.push(m.text()));
  await collectCspViolations(page);

  await createSentinelProfile(page);

  // Explore every tab (exercises rendering under the production CSP).
  for (const tab of ["Planets", "Lordship & aspects", "Ashtakavarga", "Yogas", "Dashas", "KP", "Charts"]) {
    await page.getByRole("tab", { name: tab }).click();
  }

  for (const system of ["Parashari", "KP (Krishnamurti)"]) {
    await page.getByRole("button", { name: "Reading", exact: true }).click();
    await page.getByRole("button", { name: system }).click();
    await page.getByLabel("Career & work").check();
    await page.getByRole("button", { name: "Prepare and preview" }).click();
    await expect(page.getByRole("heading", { name: "Review before sending" })).toBeVisible();
    const preview = await page.locator("pre.body").textContent({ timeout: 5000 });
    await page.getByRole("button", { name: "Approve and send" }).click();
    await expect(page.getByRole("heading", { name: /reading: career/ })).toBeVisible();
    // Consent integrity: the body that left the page is byte-for-byte the previewed body.
    const sent = captured.filter((c) => c.url === `${API}/v1/predict` && c.method === "POST").at(-1);
    expect(sent?.body).toBe(preview);
    // Results render local dates for the period labels.
    await expect(page.getByText(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} – /).first()).toBeVisible();
  }

  // Only our own origin and the proxy were contacted.
  const origins = new Set(captured.map((c) => new URL(c.url).origin));
  expect([...origins].sort()).toEqual([API, "http://localhost:4173"].sort());

  // No sentinel in anything sent to the proxy (URL, headers, body).
  const outbound = captured.filter((c) => c.url.startsWith(API));
  expect(outbound.length).toBeGreaterThan(0);
  for (const c of outbound) {
    const text = `${c.url}\n${JSON.stringify(c.headers)}\n${c.body}`;
    for (const needle of sentinelNeedles()) expect(text, `leaked "${needle}"`).not.toContain(needle);
    expect(c.body).not.toMatch(/\d+\.\d+/); // no non-integer number
    expect(c.body).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no ISO date
    expect(c.body.replace(/"requestId":"[^"]+"/, "")).not.toMatch(/\d{4,}/); // no year-like token
    expect(c.headers.referer ?? "").toBe("");
  }
  // Same-origin requests carry no identifying query strings either.
  for (const c of captured.filter((x) => !x.url.startsWith(API))) {
    for (const needle of sentinelNeedles()) expect(c.url).not.toContain(needle);
  }

  // Plaintext storage and console output carry no sentinel (the vault is encrypted).
  const storage = await page.evaluate(async () => {
    const caches_ = [];
    for (const k of await caches.keys()) {
      const c = await caches.open(k);
      for (const r of await c.keys()) caches_.push(r.url);
    }
    return JSON.stringify({ ls: { ...localStorage }, ss: { ...sessionStorage }, caches_, url: location.href, title: document.title });
  });
  for (const needle of [ "Zyxwv", "canary-note", "1987-03-21", "Pune"]) {
    expect(storage).not.toContain(needle);
    expect(consoleLines.join("\n")).not.toContain(needle);
  }
  expect(await cspViolations(page)).toEqual([]);
});

test("a CSP violation is detected (the guard itself works)", async ({ page }) => {
  await collectCspViolations(page);
  await page.goto("/");
  await page.evaluate(() => {
    const s = document.createElement("img");
    s.src = "https://evil.example/pixel.png";
    document.body.appendChild(s);
  });
  await expect.poll(() => cspViolations(page)).toContainEqual(expect.stringContaining("img-src"));
});

test("Clear everything empties all storage", async ({ page, context }) => {
  await captureAndStub(context);
  await createSentinelProfile(page);
  await page.getByRole("button", { name: "Settings" }).click();
  page.once("dialog", (d) => d.accept());
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Clear everything" }).click()]);
  const state = await page.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? [];
    let records = 0;
    if (dbs.some((d) => d.name === "astro-beat")) {
      records = await new Promise<number>((resolve) => {
        const r = indexedDB.open("astro-beat");
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains("records")) return resolve(0);
          const c = db.transaction("records").objectStore("records").count();
          c.onsuccess = () => resolve(c.result);
        };
      });
    }
    return { records, ls: localStorage.length, ss: sessionStorage.length };
  });
  expect(state).toEqual({ records: 0, ls: 0, ss: 0 });
  await expect(page.getByRole("button", { name: /create my chart/i })).toBeVisible();
});
