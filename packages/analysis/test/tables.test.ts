// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_CONVENTIONS } from "@astro/schema/analysis";
import { describe, expect, it } from "vitest";
import {
  aspectsOf, baladiAvastha, BAV_TABLE, charaKarakas, compoundRelation, dignityD1, functionalRole, isCombust, isGandanta,
  nakshatraLord, nakshatraName, natalContext, padaOf, planetaryWar, sarvashtakavarga, vargaSign, badhakaLord, exchanges,
} from "../src/index.ts";
import { at, systemChart } from "./helpers.ts";

const signs = (planet: Record<string, number>): Record<string, number> => planet;

describe("nakshatra and pada", () => {
  it.each([
    [0, "Ashwini", 1, "Ketu"],
    [3.34, "Ashwini", 2, "Ketu"],
    [13.34, "Bharani", 1, "Venus"],
    [120, "Magha", 1, "Ketu"],
    [359.99, "Revati", 4, "Mercury"],
  ] as const)("%f° → %s pada %i (%s)", (lon, nak, pada, lord) => {
    expect(nakshatraName(lon)).toBe(nak);
    expect(padaOf(lon)).toBe(pada);
    expect(nakshatraLord(lon)).toBe(lord);
  });
});

describe("relations", () => {
  const s = signs({ Sun: 0, Moon: 1, Saturn: 6 });
  it.each([
    // natural friend + temporary friend (2nd) → adhi-mitra
    ["Sun", "Moon", s.Sun, s.Moon, "adhi-mitra"],
    // natural friend + temporary enemy (same sign) → sama
    ["Sun", "Moon", 0, 0, "sama"],
    // natural neutral (Moon→Mars) + temporary friend → mitra
    ["Moon", "Mars", 0, 3, "mitra"],
    // natural neutral + temporary enemy (7th) → shatru
    ["Moon", "Mars", 0, 6, "shatru"],
    // natural enemy + temporary enemy → adhi-shatru
    ["Sun", "Saturn", 0, 6, "adhi-shatru"],
    // natural enemy + temporary friend → sama
    ["Sun", "Saturn", 0, 10, "sama"],
  ] as const)("%s → %s", (a, b, sa, sb, expected) => {
    expect(compoundRelation(a, b, sa, sb)).toBe(expected);
  });
});

describe("dignity (D1)", () => {
  const natal = { Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0, Venus: 0, Saturn: 0, Rahu: 0, Ketu: 6 };
  it.each([
    ["Sun", 10, "exalted"],
    ["Sun", 190, "debilitated"],
    ["Sun", 125, "moolatrikona"],
    ["Sun", 145, "own"],
    ["Moon", 32, "exalted"],
    ["Moon", 40, "moolatrikona"],
    ["Mercury", 160, "exalted"],
    ["Mercury", 167, "moolatrikona"],
    ["Mercury", 175, "own"],
    ["Mercury", 345, "debilitated"],
    ["Saturn", 200, "exalted"],
    ["Rahu", 45, "exalted"],
    ["Ketu", 225, "exalted"],
  ] as const)("%s at %f° is %s", (p, lon, expected) => {
    expect(dignityD1(p, lon, { ...natal, [p]: Math.floor(lon / 30) }, DEFAULT_CONVENTIONS.nodeDignity)).toBe(expected);
  });
  it("uses the node-dignity setting", () => {
    expect(dignityD1("Rahu", 45, { ...natal, Rahu: 1 }, "none")).not.toBe("exalted");
    expect(dignityD1("Rahu", 75, { ...natal, Rahu: 2 }, "gemini-sagittarius")).toBe("exalted");
  });
});

describe("aspects", () => {
  it("special aspects", () => {
    expect(aspectsOf("Mars", "none").map((a) => a.offset)).toEqual([4, 7, 8]);
    expect(aspectsOf("Jupiter", "none").map((a) => a.offset)).toEqual([5, 7, 9]);
    expect(aspectsOf("Saturn", "none").map((a) => a.offset)).toEqual([3, 7, 10]);
    expect(aspectsOf("Venus", "none").map((a) => a.offset)).toEqual([7]);
  });
  it.each([
    ["none", []],
    ["7", [7]],
    ["5-7-9", [5, 7, 9]],
  ] as const)("node convention %s", (conv, offsets) => {
    expect(aspectsOf("Rahu", conv).map((a) => a.offset)).toEqual(offsets);
    expect(aspectsOf("Ketu", conv).map((a) => a.offset)).toEqual(offsets);
  });
});

describe("states", () => {
  it("combustion boundaries", () => {
    expect(isCombust("Mercury", 113.9, false, 100, "classical")).toBe(true);
    expect(isCombust("Mercury", 114.1, false, 100, "classical")).toBe(false);
    expect(isCombust("Mercury", 113, true, 100, "classical")).toBe(false); // 12° when retrograde
    expect(isCombust("Mercury", 113, true, 100, "classical-no-retro-reduction")).toBe(true);
    expect(isCombust("Moon", 355, false, 5, "classical")).toBe(true); // across 0°
    expect(isCombust("Rahu", 100, false, 100, "classical")).toBe(false);
  });
  it("planetary war within 1°", () => {
    const lon = { Sun: 0, Moon: 50, Mars: 100.2, Mercury: 200, Jupiter: 100.9, Venus: 300, Saturn: 330, Rahu: 10, Ketu: 190 };
    const lower = planetaryWar(lon, "lower-longitude");
    expect(lower.get("Mars")).toBe("won");
    expect(lower.get("Jupiter")).toBe("lost");
    expect(planetaryWar(lon, "higher-longitude").get("Jupiter")).toBe("won");
    expect(lower.has("Venus")).toBe(false);
  });
  it("gandanta and avastha", () => {
    expect(isGandanta(119.5)).toBe(true); // Ashlesha 4
    expect(isGandanta(120.5)).toBe(true); // Magha 1
    expect(isGandanta(115)).toBe(false);
    expect(baladiAvastha(1)).toBe("bala"); // odd sign
    expect(baladiAvastha(31)).toBe("mrita"); // even sign reversed
    expect(baladiAvastha(15)).toBe("yuva");
  });
});

describe("vargas", () => {
  it.each([
    ["D9", 0, 0], ["D9", 3.4, 1], ["D9", 40, 0], ["D9", 359, 11],
    ["D2", 5, 4], ["D2", 20, 3], ["D2", 35, 3], ["D2", 50, 4],
    ["D3", 15, 4], ["D3", 25, 8],
    ["D10", 32, 9], // Taurus (even) 2° → starts from 9th (Capricorn)
    ["D30", 2, 0], ["D30", 7, 10], ["D30", 32, 1], ["D30", 57, 7],
    ["D60", 0.4, 0], ["D60", 29.9, 11],
    ["D16", 125, 6], // Leo (fixed) starts from Leo; 5° / 1.875° = part 2 → Libra
    ["D27", 45, 4], // Taurus (earth) starts from Cancer; 15° → part 13 → Leo
  ] as const)("%s of %f° → sign %i", (v, lon, expected) => {
    expect(vargaSign(v, lon)).toBe(expected);
  });
});

describe("ashtakavarga", () => {
  it("BAV table totals match the classical 48/49/39/54/56/52/39", () => {
    const totals = Object.fromEntries(
      Object.entries(BAV_TABLE).map(([k, row]) => [k, Object.values(row).reduce((s, xs) => s + xs.length, 0)]),
    );
    expect(totals).toEqual({ Sun: 48, Moon: 49, Mars: 39, Mercury: 54, Jupiter: 56, Venus: 52, Saturn: 39 });
  });
  it("SAV totals 337 for any chart", () => {
    for (const asc of [0, 77, 200, 333]) {
      const sav = sarvashtakavarga(natalContext(systemChart(asc), DEFAULT_CONVENTIONS));
      expect(sav.reduce((a, b) => a + b, 0)).toBe(337);
      expect(Math.max(...sav)).toBeLessThanOrEqual(56);
    }
  });
});

describe("lordship", () => {
  it.each([
    [9, "Venus", "yogakaraka"], // Capricorn lagna: Venus owns 5 & 10
    [1, "Saturn", "yogakaraka"], // Taurus lagna: Saturn owns 9 & 10
    [3, "Mars", "yogakaraka"], // Cancer lagna
    [0, "Mercury", "malefic"], // Aries lagna: 3 & 6
    [0, "Jupiter", "benefic"], // Aries lagna: 9 & 12
    [0, "Sun", "benefic"], // Aries lagna: 5
    [2, "Jupiter", "neutral"], // Gemini lagna: 7 & 10 (kendradhipati)
  ] as const)("lagna %i: %s is %s", (lagna, p, role) => {
    expect(functionalRole(p, lagna)).toBe(role);
  });
  it("badhaka lords", () => {
    expect(badhakaLord(0)).toBe("Saturn"); // movable → 11th = Aquarius
    expect(badhakaLord(1)).toBe("Saturn"); // fixed → 9th = Capricorn
    expect(badhakaLord(2)).toBe("Jupiter"); // dual → 7th = Sagittarius
  });
  it("exchange types", () => {
    // Aries lagna; Mars in Taurus (2), Venus in Aries (1) → maha
    const ctx = natalContext(systemChart(at(0), { Mars: at(1), Venus: at(0) }), DEFAULT_CONVENTIONS);
    expect(exchanges(ctx)).toEqual([{ planets: ["Mars", "Venus"], houses: [2, 1], type: "maha" }]);
    // Aries lagna; Mercury in Scorpio (8), Mars in Virgo (6) → dainya
    const ctx2 = natalContext(systemChart(at(0), { Mercury: at(7), Mars: at(5) }), DEFAULT_CONVENTIONS);
    expect(exchanges(ctx2)[0]?.type).toBe("dainya");
  });
});

describe("chara karakas", () => {
  it("ranks by degrees in sign, Rahu reversed", () => {
    const ctx = natalContext(systemChart(0, {
      Sun: 29, Moon: 31, Mars: 62, Mercury: 93, Jupiter: 124, Venus: 155, Saturn: 186, Rahu: 212,
    }), DEFAULT_CONVENTIONS);
    // degrees: Sun 29, Moon 1, Mars 2, Mercury 3, Jupiter 4, Venus 5, Saturn 6, Rahu 30-2=28
    const eight = charaKarakas(ctx, 8);
    expect(eight[0]).toEqual({ karaka: "AK", planet: "Sun" });
    expect(eight[7]).toEqual({ karaka: "DK", planet: "Moon" });
    expect(charaKarakas(ctx, 7)).toHaveLength(7);
  });
});
