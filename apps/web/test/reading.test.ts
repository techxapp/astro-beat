// SPDX-License-Identifier: AGPL-3.0-or-later
import { analyze } from "@astro/analysis";
import { DEFAULT_ENGINE_SETTINGS, ReferenceEngine, westernChart } from "@astro/core";
import { BRANCHES, TOPICS } from "@astro/schema/enums";
import type { BirthInput } from "@astro/schema/identifying";
import { payloadParts } from "@astro/schema/payload";
import { describe, expect, it } from "vitest";
import { prepareReading, readingBranches } from "../src/lib/reading.ts";
import { factSentence, periodName } from "../src/lib/render.ts";

const ASOF = "2026-10-05";
const BIRTH: BirthInput = {
  name: "Test Person", localDate: "1990-12-25", localTime: "06:30", timeAccuracy: "exact",
  place: { label: "Delhi", lat: 28.65, lon: 77.23 }, timezone: { iana: "Asia/Kolkata", utcOffsetMinutes: 330, overridden: false },
};
const { chart } = ReferenceEngine.computeChart(BIRTH, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
const ANALYSIS = analyze(chart, { asOf: ASOF, western: westernChart(chart, { asOf: ASOF }) });

describe("prepareReading", () => {
  it("offers every branch with a birth date, and no numerology without one", () => {
    expect(readingBranches(ANALYSIS, BIRTH, ASOF)).toEqual([...BRANCHES]);
    expect(readingBranches(ANALYSIS, undefined, ASOF)).not.toContain("numerology");
  });
  for (const system of ["western", "numerology", "combined"] as const) {
    it(`${system}: every payload period gets local dates; fact maps keep analysis facts only`, () => {
      for (const topic of TOPICS) {
        const r = prepareReading(ANALYSIS, BIRTH, system, topic, BRANCHES, ASOF);
        const labels = payloadParts(r.payload).flatMap((p) => p.periods.map((x) => x.label));
        expect(labels.length).toBeGreaterThan(0);
        for (const l of labels) expect(r.periodDates[l], `${system}/${topic} ${l}`).toBeDefined();
        const analysisIds = new Set([...ANALYSIS.parashari.facts, ...(ANALYSIS.kp?.facts ?? []), ...(ANALYSIS.western?.facts ?? [])].map((f) => f.id));
        for (const id of Object.values(r.factIdMap)) expect(analysisIds.has(id)).toBe(true);
        if (system === "numerology") expect(r.factIdMap).toEqual({});
        // every fact and period renders as a sentence
        for (const part of payloadParts(r.payload)) {
          for (const f of part.facts) expect(factSentence(f)).toMatch(/\.$/);
          for (const p of part.periods) expect(periodName(p).length).toBeGreaterThan(3);
        }
      }
    });
  }
  it("numerology is refused without a birth date", () => {
    expect(() => prepareReading(ANALYSIS, undefined, "numerology", "career", BRANCHES, ASOF)).toThrow(/birth date/);
  });
  it("combined uses only the chosen branches", () => {
    const r = prepareReading(ANALYSIS, BIRTH, "combined", "marriage", ["kp", "numerology"], ASOF);
    expect(payloadParts(r.payload).map((p) => p.system)).toEqual(["kp", "numerology"]);
  });
});
