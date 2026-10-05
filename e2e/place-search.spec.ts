// SPDX-License-Identifier: AGPL-3.0-or-later
// Place search: tier 3 towns resolve offline with no network; online lookup only on an explicit click.
import { expect, test } from "@playwright/test";
import { API, captureAndStub } from "./helpers.ts";

async function openForm(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /create my chart/i }).click();
}

test("a tier 3 town is found offline without contacting the proxy", async ({ page, context }) => {
  const captured = await captureAndStub(context);
  await openForm(page);
  await page.getByPlaceholder("Search a city (offline)").fill("Bhiwani");
  await expect(page.getByRole("button", { name: /^Bhiwāni, Haryana, IN$/ })).toBeVisible();
  expect(captured.filter((c) => c.url.startsWith(API))).toEqual([]);
});

test("online lookup happens only after clicking, sends only the typed text, and fills the place", async ({ page, context }) => {
  const captured = await captureAndStub(context);
  await openForm(page);
  await page.getByPlaceholder("Search a city (offline)").fill("Zzyzxville");
  await expect(page.getByText("Not in the offline list.")).toBeVisible();
  // Nothing has been sent yet, however long the user types.
  expect(captured.filter((c) => c.url.startsWith(API))).toEqual([]);

  await page.getByRole("button", { name: "Search online" }).click();
  await page.getByRole("button", { name: /^Zzyzxville, Nowhere State, IN$/ }).click();
  await expect(page.getByText("Selected:")).toContainText("Zzyzxville");
  await expect(page.getByLabel("Time zone (IANA)")).toHaveValue("Asia/Kolkata");

  const geo = captured.filter((c) => c.url === `${API}/v1/geocode` && c.method === "POST");
  expect(geo).toHaveLength(1);
  expect(JSON.parse(geo[0]!.body)).toEqual({ q: "Zzyzxville" });
  expect(geo[0]!.headers.referer ?? "").toBe("");
});
