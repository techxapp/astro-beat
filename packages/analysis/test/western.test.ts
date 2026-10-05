// SPDX-License-Identifier: AGPL-3.0-or-later
import { WesternAnalysis, type WesternFact } from "@astro/schema/analysis";
import type { WesternChart } from "@astro/schema/chart";
import { PLANETS, type Planet } from "@astro/schema/enums";
import { describe, expect, it } from "vitest";
import { addMonths, analyzeWestern, aspectBetween, NATAL_ORB, westernDignity, westernHouse } from "../src/western.ts";
import { FactIds } from "../src/parashari.ts";

const LON: Record<Planet, number> = {
  Sun: 84, Moon: 222, Mars: 100, Mercury: 70, Jupiter: 82, Venus: 110, Saturn: 280, Rahu: 310, Ketu: 130,
};
/** A whole-sign chart (no cusps) with the Ascendant at 15° Capricorn, born 1989-06-15. */
function chart(over: Partial<WesternChart> = {}): WesternChart {
  return {
    birthDate: "1989-06-15",
    ascendantLon: 285,
    midheavenLon: null,
    cusps: null,
    planets: PLANETS.map((planet) => ({ planet, lon: LON[planet], speed: planet === "Saturn" ? -0.02 : 0.5, retrograde: planet === "Saturn" })),
    transits: [
      // Saturn on natal Saturn (a Saturn return) in the first quarter of the 2026 year, then moving on
      { date: "2026-07-01", Jupiter: 120, Saturn: 280.5, NorthNode: 340 },
      { date: "2026-12-01", Jupiter: 125, Saturn: 300, NorthNode: 335 },
    ],
    ...over,
  };
}

describe("western tables", () => {
  it("dignity by sign with traditional rulers", () => {
    expect(westernDignity("Sun", 4)).toBe("domicile");
    expect(westernDignity("Sun", 0)).toBe("exaltation");
    expect(westernDignity("Sun", 10)).toBe("detriment");
    expect(westernDignity("Sun", 6)).toBe("fall");
    expect(westernDignity("Mars", 3)).toBe("fall");
    expect(westernDignity("Mercury", 5)).toBe("domicile"); // Virgo: domicile wins over exaltation
    expect(westernDignity("Venus", 2)).toBe("peregrine");
  });
  it("houses: whole-sign without cusps, Placidus with them", () => {
    expect(westernHouse(15, 285, null)).toBe(4); // Aries from a Capricorn rising
    const cusps = [285, 320, 350, 15, 40, 65, 105, 140, 170, 195, 220, 245];
    expect(westernHouse(286, 285, cusps)).toBe(1);
    expect(westernHouse(10, 285, cusps)).toBe(3);
    expect(westernHouse(250, 285, cusps)).toBe(12);
  });
  it("aspects pick the closest within orb", () => {
    expect(aspectBetween(10, 100, (a) => NATAL_ORB[a])).toEqual({ aspect: "square", gap: 0 });
    expect(aspectBetween(10, 197, (a) => NATAL_ORB[a])).toEqual({ aspect: "opposition", gap: 7 });
    expect(aspectBetween(10, 40, (a) => NATAL_ORB[a])).toBeNull();
  });
  it("adds months with day clamping", () => {
    expect(addMonths("2000-02-29", 12)).toBe("2001-02-28");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("analyzeWestern", () => {
  const r = analyzeWestern(chart(), "2026-10-05", new FactIds(100), 50);
  const facts = r.analysis.facts;
  const find = <K extends WesternFact["kind"]>(kind: K, pred: (f: Extract<WesternFact, { kind: K }>) => boolean = () => true) =>
    facts.filter((f): f is Extract<WesternFact, { kind: K }> => f.kind === kind).find(pred);

  it("is schema-valid with ids and labels continuing the given counters", () => {
    expect(() => WesternAnalysis.parse(r.analysis)).not.toThrow();
    expect(facts[0]!.id).toBe("F100");
    expect(r.analysis.periods[0]!.label).toBe("P50");
    expect(r.nextLabel).toBe(50 + r.analysis.periods.length);
    expect(r.analysis.houseSystem).toBe("whole-sign");
    expect(r.analysis.ascendant).toEqual({ sign: "Capricorn", ruler: "Saturn" });
    expect(r.analysis.sun).toEqual({ sign: "Gemini" });
  });
  it("natal facts: placements, rulers, aspects, balance; no Midheaven without cusps", () => {
    expect(find("wAngle", (f) => f.angle === "Midheaven")).toBeUndefined();
    expect(find("wPlacement", (f) => f.body === "Saturn")).toMatchObject({ sign: "Capricorn", house: 1, retrograde: true, dignity: "domicile" });
    expect(find("wPlacement", (f) => f.body === "NorthNode")).toMatchObject({ dignity: "none", retrograde: false });
    expect(find("wHouseRuler", (f) => f.house === 7)).toMatchObject({ cuspSign: "Cancer", ruler: "Moon", rulerSign: "Scorpio", rulerHouse: 11 });
    expect(find("wAspect", (f) => f.a === "Sun" && f.b === "Jupiter")).toMatchObject({ aspect: "conjunction", closeness: "tight" });
    expect(find("wBalance")).toMatchObject({ fire: 0, earth: 2, air: 3, water: 3 });
  });
  it("profection years from the birthday, quarters for the first two, and transit hits", () => {
    const years = r.analysis.periods.filter((p) => p.level === "year");
    expect(years).toHaveLength(7);
    // age 37 → 37 mod 12 = 1 → 2nd house (Aquarius, ruled by Saturn)
    expect(years[0]).toMatchObject({ status: "current", profection: { house: 2, sign: "Aquarius", lord: "Saturn" } });
    expect(r.periodDates[years[0]!.label]).toEqual({ start: "2026-06-15", end: "2027-06-15" });
    const quarters = r.analysis.periods.filter((p) => p.level === "quarter");
    expect(quarters).toHaveLength(8);
    expect(quarters.filter((q) => q.status === "current")).toHaveLength(1);
    expect(years[0]!.aspects).toContainEqual({ planet: "Saturn", aspect: "conjunction", to: "Saturn" });
    expect(quarters[0]!.aspects).toContainEqual({ planet: "Saturn", aspect: "conjunction", to: "Saturn" });
    expect(quarters[2]!.aspects).toEqual([]);
    expect(years[0]!.transits).toContainEqual({ planet: "Saturn", sign: "Capricorn", house: 1 });
    expect(years[0]!.factRefs.length).toBeGreaterThan(0);
  });
});
