// SPDX-License-Identifier: AGPL-3.0-or-later
// Western, numerology and combined payloads.
import { analyze } from "@astro/analysis";
import { computeChartAt, DEFAULT_ENGINE_SETTINGS, isoDateFromJd, westernChart } from "@astro/core";
import { numerology } from "@astro/numerology";
import { BRANCHES, TOPICS } from "@astro/schema/enums";
import { payloadFactIds, payloadPeriodLabels, PredictionPayload, type CombinedPayload, type WesternPayload } from "@astro/schema/payload";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  availableBranches, buildCombinedPayload, buildNumerologyPayload, buildPayload, scanForLeaks, serializeRequest, WESTERN_TOPIC_SPECS,
} from "../src/index.ts";

const ASOF = "2026-09-29";
const CHART = computeChartAt({ jdUt: 2447693.1, lat: 28.61, lon: 77.21 }, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
const { localOnly, ...PUBLIC } = analyze(CHART, { asOf: ASOF, western: westernChart(CHART, { asOf: ASOF }) });
const NUM = numerology({ birthDate: "1989-06-15", name: "Test Person" }, { asOf: ASOF });
const SOURCES = { analysis: PUBLIC, numerology: NUM.analysis };
const UUID = "00000000-0000-4000-8000-000000000000";
/** The proxy's body limit. */
const MAX_BODY = 64 * 1024;

describe("western payload", () => {
  for (const topic of TOPICS) {
    it(`${topic}: strict, renumbered, dated locally, no past periods`, () => {
      const built = buildPayload(PUBLIC, "western", topic);
      const payload = built.payload as WesternPayload;
      expect(payload.system).toBe("western");
      expect(payload.zodiac).toBe("tropical");
      payload.facts.forEach((f, i) => expect(f.id).toBe(`F${i + 1}`));
      payload.periods.forEach((p, i) => expect(p.label).toBe(`P${i + 1}`));
      expect(payload.periods.some((p) => p.status === "past")).toBe(false);
      expect(payload.periods.filter((p) => p.level === "year" && p.status === "current")).toHaveLength(1);
      const ids = new Set(payload.facts.map((f) => f.id));
      for (const p of payload.periods) for (const r of p.factRefs) expect(ids.has(r)).toBe(true);
      for (const l of Object.values(built.periodLabelMap)) expect(localOnly.periodDates[l]).toBeDefined();
      expect(Object.values(built.origin.periods).every((o) => o === "analysis")).toBe(true);
      // topic house rulers only (plus the Ascendant's)
      for (const f of payload.facts) if (f.kind === "wHouseRuler") expect([1, ...WESTERN_TOPIC_SPECS[topic].houses]).toContain(f.house);
      const body = serializeRequest(payload, UUID);
      expect(scanForLeaks(body)).toEqual([]);
      for (const p of CHART.parashari.planets) expect(body).not.toContain(p.lon.toFixed(2));
    });
  }
  it("is refused when the analysis has no Western chart", () => {
    const { localOnly: _l, ...pub } = analyze(CHART, { asOf: ASOF });
    expect(pub.western).toBeNull();
    expect(() => buildPayload(pub, "western", "career")).toThrow(/Western/);
  });
});

describe("numerology payload", () => {
  it("carries the numbers and current/upcoming cycles only, with numerology origins", () => {
    const built = buildNumerologyPayload(NUM.analysis, "career");
    expect(built.payload.system).toBe("numerology");
    if (built.payload.system !== "numerology") return;
    expect(built.payload.facts.length).toBe(NUM.analysis.facts.length);
    expect(built.payload.periods.some((p) => p.status === "past")).toBe(false);
    expect(Object.values(built.origin.facts).every((o) => o === "numerology")).toBe(true);
    for (const l of Object.values(built.periodLabelMap)) expect(NUM.periodDates[l]).toBeDefined();
    const body = serializeRequest(built.payload, UUID);
    expect(scanForLeaks(body)).toEqual([]);
    for (const needle of ["1989", "06-15", "Test", "Person"]) expect(body).not.toContain(needle);
  });
});

describe("combined payload", () => {
  it("all four branches are available for a normal chart with a birth date", () => {
    expect(availableBranches(SOURCES)).toEqual([...BRANCHES]);
    expect(availableBranches({ ...SOURCES, numerology: null })).toEqual(["parashari", "kp", "western"]);
  });
  for (const topic of TOPICS) {
    it(`${topic}: one part per branch, ids and labels unique across parts, under the body limit`, () => {
      const built = buildCombinedPayload(SOURCES, BRANCHES, topic);
      const payload = built.payload as CombinedPayload;
      expect(payload.parts.map((p) => p.system)).toEqual([...BRANCHES]);
      const facts = payload.parts.flatMap((p) => p.facts.map((f) => f.id));
      const labels = payload.parts.flatMap((p) => p.periods.map((x) => x.label));
      expect(new Set(facts).size).toBe(facts.length);
      expect(new Set(labels).size).toBe(labels.length);
      expect(payloadFactIds(payload).size).toBe(facts.length);
      expect(payloadPeriodLabels(payload).size).toBe(labels.length);
      expect(Object.keys(built.factIdMap)).toHaveLength(facts.length);
      // every label resolves to a date in the source it came from
      for (const [label, source] of Object.entries(built.periodLabelMap)) {
        const dates = built.origin.periods[label] === "numerology" ? NUM.periodDates : localOnly.periodDates;
        expect(dates[source], label).toBeDefined();
      }
      const body = serializeRequest(payload, UUID);
      expect(scanForLeaks(body)).toEqual([]);
      expect(new TextEncoder().encode(body).byteLength).toBeLessThan(MAX_BODY);
    });
  }
  it("accepts a subset, refuses fewer than two branches and unavailable ones", () => {
    const two = buildCombinedPayload(SOURCES, ["western", "numerology"], "marriage").payload as CombinedPayload;
    expect(two.parts.map((p) => p.system)).toEqual(["western", "numerology"]);
    expect(() => buildCombinedPayload(SOURCES, ["kp"], "career")).toThrow(/two branches/);
    expect(() => buildCombinedPayload({ ...SOURCES, numerology: null }, ["parashari", "numerology"], "career")).toThrow(/birth date/);
  });
  it("the schema refuses a branch twice", () => {
    const p = buildCombinedPayload(SOURCES, ["western", "numerology"], "career").payload as CombinedPayload;
    expect(PredictionPayload.safeParse({ ...p, parts: [p.parts[0], p.parts[0]] }).success).toBe(false);
  });
});

describe("random charts always yield valid combined payloads within the body limit", () => {
  it("property", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2415020, max: 2462502, noNaN: true }),
        fc.double({ min: -60, max: 60, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.constantFrom(...TOPICS),
        (jd, lat, lon, topic) => {
          const chart = computeChartAt({ jdUt: jd, lat, lon }, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
          const asOf = isoDateFromJd(jd + 20 * 365);
          const { localOnly: _l, ...pub } = analyze(chart, { asOf, western: westernChart(chart, { asOf }) });
          const num = numerology({ birthDate: isoDateFromJd(jd), name: "Random Person" }, { asOf }).analysis;
          const body = serializeRequest(buildCombinedPayload({ analysis: pub, numerology: num }, BRANCHES, topic).payload, UUID);
          expect(scanForLeaks(body)).toEqual([]);
          expect(new TextEncoder().encode(body).byteLength).toBeLessThan(MAX_BODY);
        },
      ),
      { numRuns: 10 },
    );
  }, 120_000);
});
