// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeAll, describe, expect, it, vi } from "vitest";
import citiesRaw from "../public/geo/cities.json?raw";
import { fold, placeLabel, searchPlaces } from "../src/lib/gazetteer.ts";

// The real committed index, so the test also guards that tier 3 towns stay covered.
const ROWS = JSON.parse(citiesRaw) as unknown[];

beforeAll(() => {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(ROWS)));
});

describe("offline place search", () => {
  it("folds diacritics and case", () => {
    expect(fold("Bhiwāni")).toBe("bhiwani");
  });
  it("ignores queries shorter than two characters", async () => {
    expect(await searchPlaces("p")).toEqual([]);
  });
  it("finds tier 3 towns that the old 56-city seed lacked", async () => {
    expect(ROWS.length).toBeGreaterThan(50_000);
    const r = await searchPlaces("bhiwani");
    expect(r.map(placeLabel)).toContain("Bhiwāni, Haryana, IN");
    expect(r.find((p) => p.name === "Bhiwāni")?.tz).toBe("Asia/Kolkata");
  });
  it("ranks prefix matches before substring matches and respects the limit", async () => {
    const r = await searchPlaces("pun", 5);
    expect(r.length).toBeLessThanOrEqual(5);
    expect(r[0]?.name.toLowerCase().startsWith("pun")).toBe(true);
  });
  it("matches on the region when the name does not", async () => {
    const r = await searchPlaces("hisar haryana");
    expect(r.map((p) => p.name)).toContain("Hisar");
  });
});
