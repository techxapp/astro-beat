// SPDX-License-Identifier: AGPL-3.0-or-later
import { analyze, YOGA_CATALOG } from "@astro/analysis";
import { computeChartAt, DEFAULT_ENGINE_SETTINGS, isoDateFromJd } from "@astro/core";
import { YOGA_FAMILY } from "@astro/schema/analysis";
import { TOPICS, type Topic } from "@astro/schema/enums";
import { PredictionPayload } from "@astro/schema/payload";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildPayload, KP_TOPIC_SPECS, PayloadLeakError, scanForLeaks, serializeRequest, TOPIC_SPECS } from "../src/index.ts";

const chartFor = (jdUt: number, lat = 28.61, lon = 77.21) => computeChartAt({ jdUt, lat, lon }, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
const CHART = chartFor(2447693.1); // 1989-07-xx, Delhi
const ANALYSIS = analyze(CHART, { asOf: "2026-09-29" });
const { localOnly, ...PUBLIC } = ANALYSIS;

describe("payload schema invariants (§5.3)", () => {
  // Walk the JSON Schema of PredictionPayload: every string leaf must be an enum, a literal or a
  // FactId / PeriodLabel pattern; every number leaf an integer within [0, 56].
  const schema = z.toJSONSchema(PredictionPayload) as Record<string, unknown>;
  const ALLOWED_PATTERNS = new Set(["^F\\d{1,4}$", "^P\\d{1,4}$"]);
  const problems: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "string" && !("enum" in n) && !("const" in n) && !ALLOWED_PATTERNS.has(n.pattern as string)) {
      problems.push(`${path}: free string`);
    }
    if (n.type === "number" && !("const" in n)) problems.push(`${path}: non-integer number`);
    if (n.type === "integer") {
      if (typeof n.minimum !== "number" || n.minimum < 0) problems.push(`${path}: integer without minimum ≥ 0`);
      if (typeof n.maximum !== "number" || n.maximum > 56) problems.push(`${path}: integer without maximum ≤ 56`);
    }
    if ("const" in n && typeof n.const === "number" && (!Number.isInteger(n.const) || n.const < 0 || n.const > 56)) {
      problems.push(`${path}: numeric const out of range`);
    }
    if ("format" in n) problems.push(`${path}: formatted string (${String(n.format)})`);
    for (const [k, v] of Object.entries(n)) {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${k}[${i}]`));
      else if (v && typeof v === "object") walk(v, `${path}.${k}`);
    }
  };
  walk(schema, "$");

  it("has only enum / literal / label strings and small integers", () => {
    expect(problems).toEqual([]);
  });
  it("forbids unknown keys everywhere (additionalProperties: false)", () => {
    const text = JSON.stringify(schema);
    expect(text).not.toContain('"additionalProperties":{}');
    expect(text).not.toContain('"additionalProperties":true');
  });
});

describe("buildPayload", () => {
  for (const system of ["parashari", "kp"] as const) {
    for (const topic of TOPICS) {
      it(`${system}/${topic} parses strictly and is renumbered`, () => {
        const { payload, periodLabelMap, factIdMap } = buildPayload(PUBLIC, system, topic);
        expect(() => PredictionPayload.parse(payload)).not.toThrow();
        payload.facts.forEach((f, i) => expect(f.id).toBe(`F${i + 1}`));
        payload.periods.forEach((p, i) => expect(p.label).toBe(`P${i + 1}`));
        expect(Object.keys(periodLabelMap)).toHaveLength(payload.periods.length);
        expect(Object.keys(factIdMap)).toHaveLength(payload.facts.length);
        const ids = new Set(payload.facts.map((f) => f.id));
        for (const p of payload.periods) for (const r of p.factRefs) expect(ids.has(r)).toBe(true);
        expect(payload.periods.filter((p) => p.level === "MD" && p.status === "current")).toHaveLength(1);
        // periodLabelMap points at analysis labels that have local dates
        for (const l of Object.values(periodLabelMap)) expect(localOnly.periodDates[l]).toBeDefined();
      });
    }
  }

  it("sends only the topic's vargas", () => {
    for (const topic of TOPICS) {
      const { payload } = buildPayload(PUBLIC, "parashari", topic);
      const sent = new Set(payload.facts.flatMap((f) => (f.kind === "varga" || f.kind === "vargaLagna" ? [f.varga] : [])));
      for (const v of sent) expect(TOPIC_SPECS[topic].vargas).toContain(v);
      expect(sent.has("D60")).toBe(false);
    }
  });

  it("sends only the topic's KP cusps and never sub-sub lords by default", () => {
    for (const topic of TOPICS) {
      const { payload } = buildPayload(PUBLIC, "kp", topic);
      for (const f of payload.facts) {
        if (f.kind === "kpCusp") expect(KP_TOPIC_SPECS[topic].cusps).toContain(f.cusp);
        if (f.kind === "kpSignificators") expect(KP_TOPIC_SPECS[topic].cusps).toContain(f.house);
        if (f.kind === "kpCusp" || f.kind === "kpPlanet") expect(f.subSubLord).toBeUndefined();
      }
    }
  });

  it("never mixes systems", () => {
    const kp = buildPayload(PUBLIC, "kp", "career").payload;
    expect(kp.facts.every((f) => f.kind.startsWith("kp"))).toBe(true);
    const par = buildPayload(PUBLIC, "parashari", "career").payload;
    expect(par.facts.some((f) => f.kind.startsWith("kp"))).toBe(false);
  });

  it("yoga family map agrees with the analysis catalog", () => {
    for (const y of YOGA_CATALOG) expect(YOGA_FAMILY[y.id]).toBe(y.family);
  });

  it("KP topic is refused when Placidus is unavailable", () => {
    const polar = analyze(chartFor(2447693.1, 75, 20), { asOf: "2026-09-29" });
    expect(polar.kp).toBeNull();
    const { localOnly: _l, ...pub } = polar;
    expect(() => buildPayload(pub, "kp", "career")).toThrow(/Placidus/);
  });
});

describe("serialization and leak scan", () => {
  it("serializes once and contains no dates, degrees or long digit runs", () => {
    for (const topic of TOPICS) {
      for (const system of ["parashari", "kp"] as const) {
        const { payload } = buildPayload(PUBLIC, system, topic);
        const body = serializeRequest(payload, crypto.randomUUID());
        expect(scanForLeaks(body)).toEqual([]);
        // no chart longitude or dasha date appears in any encoding
        for (const p of CHART.parashari.planets) {
          expect(body).not.toContain(p.lon.toFixed(2));
          expect(body).not.toContain(p.lon.toFixed(4));
        }
        for (const d of CHART.parashari.dasha.periods.slice(0, 50)) expect(body).not.toContain(d.start);
      }
    }
  });
  it("scanner flags the patterns it must", () => {
    expect(scanForLeaks('{"x":12.5}').map((f) => f.rule)).toContain("non-integer-number");
    expect(scanForLeaks('"1990-06-15"').map((f) => f.rule)).toContain("iso-date");
    expect(scanForLeaks('"born 1990"').map((f) => f.rule)).toContain("long-digit-run");
    expect(scanForLeaks('"08:30"').map((f) => f.rule)).toContain("time-of-day");
  });
  it("refuses to serialize a body with a smuggled value", () => {
    const { payload } = buildPayload(PUBLIC, "parashari", "career");
    // A payload that bypassed the builder cannot carry extra keys (strict parse) …
    expect(() => serializeRequest({ ...payload, note: "1990-06-15" } as never, crypto.randomUUID())).toThrow();
    expect(PayloadLeakError).toBeDefined();
  });
});

describe("random analyses always yield valid payloads", () => {
  it("property", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2415020, max: 2462502, noNaN: true }),
        fc.double({ min: -60, max: 60, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.constantFrom<Topic>(...TOPICS),
        fc.constantFrom("parashari" as const, "kp" as const),
        (jd, lat, lon, topic, system) => {
          const a = analyze(chartFor(jd, lat, lon), { asOf: isoDateFromJd(jd + 20 * 365) });
          const { localOnly: _l, ...pub } = a;
          const { payload } = buildPayload(pub, system, topic);
          const body = serializeRequest(payload, "00000000-0000-4000-8000-000000000000");
          expect(scanForLeaks(body)).toEqual([]);
          expect(body).not.toContain("localOnly");
          expect(body).not.toContain("periodDates");
        },
      ),
      { numRuns: 15 },
    );
  }, 120_000);
});
