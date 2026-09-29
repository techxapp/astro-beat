// SPDX-License-Identifier: AGPL-3.0-or-later
import { computeChartAt, DEFAULT_ENGINE_SETTINGS, isoDateFromJd } from "@astro/core";
import { Analysis } from "@astro/schema/local";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/index.ts";

// Random moments 1900–2030 at random places (|lat| ≤ 80 to include the no-Placidus path).
const moment = fc.record({
  jdUt: fc.double({ min: 2415020, max: 2462502, noNaN: true }),
  lat: fc.double({ min: -80, max: 80, noNaN: true }),
  lon: fc.double({ min: -180, max: 180, noNaN: true }),
});

describe("analysis properties", () => {
  it("never throws, parses strictly, unique ids, contiguous labels, one current period per level", () => {
    fc.assert(
      fc.property(moment, fc.integer({ min: 0, max: 90 * 365 }), (m, ageDays) => {
        const chart = computeChartAt(m, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
        const asOf = isoDateFromJd(m.jdUt + ageDays + 1);
        const a = analyze(chart, { asOf });
        Analysis.parse(a);

        const ids = [...a.parashari.facts, ...(a.kp?.facts ?? [])].map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);

        const labels = [...a.parashari.periods, ...(a.kp?.periods ?? [])].map((p) => Number(p.label.slice(1)));
        labels.forEach((n, i) => expect(n).toBe(i + 1));
        expect(Object.keys(a.localOnly.periodDates)).toHaveLength(labels.length);

        for (const sys of [a.parashari, a.kp]) {
          if (!sys) continue;
          for (const level of ["MD", "AD", "PD"] as const) {
            const cur = sys.periods.filter((p) => p.level === level && p.status === "current");
            expect(cur, level).toHaveLength(1);
          }
          const known = new Set(sys.facts.map((f) => f.id));
          for (const p of sys.periods) for (const r of p.factRefs) expect(known.has(r)).toBe(true);
        }
        expect(a.kp === null).toBe(chart.kp.cusps === null);
      }),
      { numRuns: 25 },
    );
  }, 120_000);

  it("is deterministic", () => {
    const chart = computeChartAt({ jdUt: 2447000.25, lat: 19.07, lon: 72.87 }, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
    const a = analyze(chart, { asOf: "2026-09-29" });
    const b = analyze(chart, { asOf: "2026-09-29" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("keeps dates and maraka out of the public part", () => {
    const chart = computeChartAt({ jdUt: 2447000.25, lat: 19.07, lon: 72.87 }, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
    const { localOnly, ...pub } = analyze(chart, { asOf: "2026-09-29" });
    const text = JSON.stringify(pub);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toMatch(/maraka/i);
    expect(Object.keys(localOnly.periodDates).length).toBeGreaterThan(0);
  });
});
