// SPDX-License-Identifier: AGPL-3.0-or-later
// Golden charts (§11). Reference values from an external tool (JHora for Parashari; the KP tool
// is open question Q4b) go in golden/expected/<id>.json; charts without a reference file are
// reported as pending rather than silently passing.
import { analyze } from "@astro/analysis";
import { DEFAULT_ENGINE_SETTINGS, ReferenceEngine } from "@astro/core";
import type { FactOf } from "@astro/schema/analysis";
import { Chart } from "@astro/schema/chart";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOLDEN, SENTINELS } from "../src/index.ts";

interface Expected {
  /** sidereal (Lahiri) longitudes, degrees */
  longitudes?: Partial<Record<string, number>>;
  ascendant?: number;
  placements?: { planet: string; sign: string; nakshatra: string; pada: number; dignity?: string }[];
  mahadashas?: { lord: string; start: string }[];
  kpCusps?: { cusp: number; subLord: string }[];
}

const TOL = { longitudeArcsec: 120, ascendantArcmin: 2 }; // reference engine; tightens to 1″ / 1′ with Swiss Ephemeris

const angDiff = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

describe("golden set", () => {
  it("has 30 synthetic births, one at high latitude", () => {
    expect(GOLDEN).toHaveLength(30);
    expect(GOLDEN.some((g) => Math.abs(g.birth.place.lat) > 66)).toBe(true);
  });

  for (const g of GOLDEN) {
    const file = new URL(`../golden/expected/${g.id}.json`, import.meta.url);
    const hasRef = existsSync(file);
    it.skipIf(!hasRef)(`${g.id} matches the reference tool`, () => {
      const exp = JSON.parse(readFileSync(file, "utf8")) as Expected;
      const { chart } = ReferenceEngine.computeChart(g.birth, DEFAULT_ENGINE_SETTINGS);
      const a = analyze(chart, { asOf: "2026-09-29" });
      for (const [planet, lon] of Object.entries(exp.longitudes ?? {})) {
        const got = chart.parashari.planets.find((p) => p.planet === planet)!.lon;
        expect(angDiff(got, lon!) * 3600, planet).toBeLessThanOrEqual(TOL.longitudeArcsec);
      }
      if (exp.ascendant !== undefined) expect(angDiff(chart.parashari.ascendantLon, exp.ascendant) * 60).toBeLessThanOrEqual(TOL.ascendantArcmin);
      const placements = a.parashari.facts.filter((f): f is FactOf<"placement"> => f.kind === "placement");
      for (const e of exp.placements ?? []) {
        const got = placements.find((p) => p.planet === e.planet)!;
        expect({ sign: got.sign, nakshatra: got.nakshatra, pada: got.pada }, e.planet).toEqual({ sign: e.sign, nakshatra: e.nakshatra, pada: e.pada });
        if (e.dignity) expect(got.dignity, e.planet).toBe(e.dignity);
      }
      const mds = chart.parashari.dasha.periods.filter((p) => p.level === "MD");
      for (const e of exp.mahadashas ?? []) {
        const got = mds.find((m) => m.path[0] === e.lord);
        expect(got?.start, e.lord).toBe(e.start);
      }
      for (const e of exp.kpCusps ?? []) {
        const got = a.kp?.facts.find((f) => f.kind === "kpCusp" && f.cusp === e.cusp);
        expect(got && got.kind === "kpCusp" ? got.subLord : null, `cusp ${e.cusp}`).toBe(e.subLord);
      }
    });
  }

  it("every golden and sentinel chart is schema-valid and analyses cleanly", () => {
    for (const b of [...GOLDEN.map((g) => g.birth), ...SENTINELS]) {
      const { chart } = ReferenceEngine.computeChart(b, DEFAULT_ENGINE_SETTINGS, { ingressYears: 60 });
      Chart.parse(chart);
      const a = analyze(chart, { asOf: "2026-09-29" });
      expect(a.kp === null).toBe(Math.abs(b.place.lat) > 66);
    }
  }, 120_000);
});
