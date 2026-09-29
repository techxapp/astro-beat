// SPDX-License-Identifier: AGPL-3.0-or-later
// PWA: after one online visit, the app loads and computes a full chart with the network off.
// The service worker caches static assets only.
import { expect, test } from "@playwright/test";
import { createSentinelProfile } from "./helpers.ts";

test("works offline after the first visit; the SW cache holds static assets only", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    return reg.active?.state;
  });
  const cached = await page.evaluate(async () => {
    const out: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
    return out.sort();
  });
  expect(cached).toContain("/");
  expect(cached).toContain("/geo/cities.json");
  expect(cached.every((p) => p === "/" || /^\/(assets\/|geo\/|icon\.svg|manifest\.webmanifest)/.test(p))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await createSentinelProfile(page);
  await page.getByRole("tab", { name: "Dashas" }).click();
  await expect(page.getByText(/mahadasha/).first()).toBeVisible();

  const after = await page.evaluate(async () => {
    const out: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url);
    return out;
  });
  expect(after.length).toBe(cached.length); // nothing added at runtime
  await context.setOffline(false);
});
