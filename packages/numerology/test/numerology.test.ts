// SPDX-License-Identifier: AGPL-3.0-or-later
import { NumerologyAnalysis } from "@astro/schema/analysis";
import { describe, expect, it } from "vitest";
import { letterValue, nameParts, numerology, PERSONAL_MONTHS, PERSONAL_YEARS, reduce, reduceWithDebt } from "../src/index.ts";

const core = (r: ReturnType<typeof numerology>, n: string) => r.analysis.facts.find((f) => f.kind === "numCore" && f.number === n);

describe("reduction", () => {
  it("keeps master numbers unless asked not to", () => {
    expect(reduce(29)).toBe(11);
    expect(reduce(29, false)).toBe(2);
    expect(reduce(22)).toBe(22);
    expect(reduce(33)).toBe(33);
    expect(reduce(1987)).toBe(7);
  });
  it("reports karmic debt numbers passed through", () => {
    expect(reduceWithDebt(13)).toEqual({ value: 4, karmicDebt: 13 });
    expect(reduceWithDebt(19)).toEqual({ value: 1, karmicDebt: 19 });
    expect(reduceWithDebt(12)).toEqual({ value: 3 });
  });
  it("letter values and name parts", () => {
    expect([..."AJSIRZ"].map(letterValue)).toEqual([1, 1, 1, 9, 9, 8]);
    expect(nameParts("José  O'Neil-Smith")).toEqual(["JOSE", "O", "NEIL", "SMITH"]);
  });
});

describe("numerology", () => {
  it("life path with karmic debt (1987-03-21 → 3 + 3 + 7 = 13/4)", () => {
    const r = numerology({ birthDate: "1987-03-21" }, { asOf: "2026-10-05" });
    expect(core(r, "lifePath")).toMatchObject({ value: 4, karmicDebt: 13 });
    expect(core(r, "birthday")).toMatchObject({ value: 3 });
    expect(r.analysis.nameUsed).toBe(false);
    expect(core(r, "expression")).toBeUndefined();
  });
  it("master life path (1990-12-25 → 3 + 7 + 1 = 11)", () => {
    expect(core(numerology({ birthDate: "1990-12-25" }, { asOf: "2026-10-05" }), "lifePath")).toMatchObject({ value: 11 });
  });
  it("name numbers (John Smith: expression 8, soul urge 6, personality 11)", () => {
    const r = numerology({ birthDate: "1990-12-25", name: "John Smith" }, { asOf: "2026-10-05" });
    expect(core(r, "expression")).toMatchObject({ value: 8 });
    expect(core(r, "soulUrge")).toMatchObject({ value: 6 });
    expect(core(r, "personality")).toMatchObject({ value: 11 });
    expect(core(r, "maturity")).toMatchObject({ value: 1 });
    expect(r.analysis.facts.find((f) => f.kind === "numKarmicLessons")).toMatchObject({ missing: [3, 7] });
    expect(r.analysis.facts.find((f) => f.kind === "numHiddenPassion")).toMatchObject({ values: [1, 8] });
  });
  it("names without Latin letters are skipped", () => {
    expect(numerology({ birthDate: "1990-12-25", name: "राम" }, { asOf: "2026-10-05" }).analysis.nameUsed).toBe(false);
  });
  it("periods: four pinnacles, personal years and months, one of each current", () => {
    const r = numerology({ birthDate: "1987-03-21", name: "Zyxwv Canary" }, { asOf: "2026-10-05", labelStart: 10, factStart: 5 });
    expect(() => NumerologyAnalysis.parse(r.analysis)).not.toThrow();
    const by = (l: string) => r.analysis.periods.filter((p) => p.level === l);
    expect(by("pinnacle")).toHaveLength(4);
    expect(by("personalYear")).toHaveLength(PERSONAL_YEARS);
    expect(by("personalMonth")).toHaveLength(PERSONAL_MONTHS);
    for (const l of ["pinnacle", "personalYear", "personalMonth"]) expect(by(l).filter((p) => p.status === "current")).toHaveLength(1);
    // life path 4 → first pinnacle ends at 32: 2019-03-21
    expect(r.periodDates[by("pinnacle")[0]!.label]).toEqual({ start: "1987-03-21", end: "2019-03-21" });
    // personal year 2026: 3 + 3 + 1 = 7; October: 7 + 10 = 17 → 8
    expect(by("personalYear")[0]).toMatchObject({ value: 7, status: "current" });
    expect(by("personalMonth")[0]).toMatchObject({ value: 8, status: "current" });
    expect(r.periodDates[by("personalMonth")[0]!.label]).toEqual({ start: "2026-10-01", end: "2026-11-01" });
    expect(r.analysis.periods[0]!.label).toBe("P10");
    expect(r.analysis.facts[0]!.id).toBe("F5");
    expect(Object.keys(r.periodDates)).toHaveLength(r.analysis.periods.length);
  });
});
