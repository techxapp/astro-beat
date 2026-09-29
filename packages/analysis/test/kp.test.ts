// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_CONVENTIONS } from "@astro/schema/analysis";
import { PLANETS, type Planet } from "@astro/schema/enums";
import { describe, expect, it } from "vitest";
import { bhavaOf, houseSignificators, KP_SUB_TABLE, kpContext, kpLordsAt, planetSignifies, subBoundaryDistance, UNITS_PER_DEGREE } from "../src/index.ts";

const dms = (d: number, m: number, s = 0): number => d + m / 60 + s / 3600;
const units = (deg: number): number => Math.round(deg * UNITS_PER_DEGREE);

describe("KP sub table (generated)", () => {
  it("has 249 divisions covering the zodiac without gaps", () => {
    expect(KP_SUB_TABLE).toHaveLength(249);
    expect(KP_SUB_TABLE[0]!.startUnits).toBe(0);
    expect(KP_SUB_TABLE[248]!.endUnits).toBe(360 * UNITS_PER_DEGREE);
    for (let i = 1; i < KP_SUB_TABLE.length; i++) expect(KP_SUB_TABLE[i]!.startUnits).toBe(KP_SUB_TABLE[i - 1]!.endUnits);
  });
  it("matches published KP table rows", () => {
    // Rows as printed in standard KP tables (sign, star, sub, from–to within the sign).
    const rows: [number, string, string, string, number, number][] = [
      [1, "Aries", "Ketu", "Ketu", 0, dms(0, 46, 40)],
      [2, "Aries", "Ketu", "Venus", dms(0, 46, 40), dms(3, 0)],
      [3, "Aries", "Ketu", "Sun", dms(3, 0), dms(3, 40)],
      [4, "Aries", "Ketu", "Moon", dms(3, 40), dms(4, 46, 40)],
      [10, "Aries", "Venus", "Venus", dms(13, 20), dms(15, 33, 20)],
      [19, "Aries", "Sun", "Sun", dms(26, 40), dms(27, 20)],
      [22, "Aries", "Sun", "Rahu", dms(29, 13, 20), 30],
      [23, "Taurus", "Sun", "Rahu", 30, 30 + dms(1, 13, 20)],
      [249, "Pisces", "Mercury", "Saturn", 330 + dms(27, 53, 20), 360],
    ];
    for (const [idx, sign, star, sub, from, to] of rows) {
      const r = KP_SUB_TABLE[idx - 1]!;
      expect([r.sign, r.starLord, r.subLord]).toEqual([sign, star, sub]);
      expect(r.startUnits).toBe(units(from));
      expect(r.endUnits).toBe(units(to));
    }
  });
  it("sign boundaries at 60°, 180°, 300° coincide with sub boundaries (why 249 not 252)", () => {
    for (const deg of [60, 180, 300]) {
      expect(KP_SUB_TABLE.some((r) => r.startUnits === deg * UNITS_PER_DEGREE)).toBe(true);
    }
  });
  it("looks up lords including sub-sub", () => {
    const l = kpLordsAt(0.04);
    expect(l).toEqual({ sign: "Aries", signLord: "Mars", starLord: "Ketu", subLord: "Ketu", subSubLord: "Ketu" });
    // Ketu sub-sub of the Ketu sub of Ketu star = 7·7/(120·120) of 13°20′ = 0°02′43.3″ (0.04537°)
    expect(kpLordsAt(0.0453).subSubLord).toBe("Ketu");
    expect(kpLordsAt(0.0455).subSubLord).toBe("Venus");
    // In a split sub (Rahu sub of Krittika across Aries/Taurus), sub-sub continues across the sign boundary.
    expect(kpLordsAt(30.2).subLord).toBe("Rahu");
    expect(kpLordsAt(30.2).sign).toBe("Taurus");
  });
  it("distance to the next sub boundary", () => {
    const d = subBoundaryDistance(0.5);
    expect(d.forward).toBeCloseTo(dms(0, 46, 40) - 0.5, 9);
    expect(d.backward).toBeCloseTo(0.5, 9);
  });
});

describe("bhava and significators", () => {
  // Equal-ish cusps starting at 10° Aries for a readable fixture.
  const cusps = Array.from({ length: 12 }, (_, i) => (10 + i * 30) % 360);
  it("bhava occupancy uses cusp spans, not signs", () => {
    expect(bhavaOf(5, cusps)).toBe(12);
    expect(bhavaOf(15, cusps)).toBe(1);
    expect(bhavaOf(355, cusps)).toBe(12);
  });
  const lons: Record<Planet, number> = {
    Sun: 15, // bhava 1, star Ketu (Ashwini)
    Moon: 50, // bhava 2, star Moon (Rohini)
    Mars: 100, // bhava 4, star Saturn (Pushya)
    Mercury: 20, // bhava 1, star Venus (Bharani)
    Jupiter: 200, // bhava 7, star Rahu (Swati)
    Venus: 250, // bhava 9, star Ketu (Mula)
    Saturn: 280, // bhava 10, star Moon (Shravana)
    Rahu: 320, // bhava 11, star Rahu (Shatabhisha)
    Ketu: 140, // bhava 5, star Venus (Purva Phalguni)
  };
  const planets = PLANETS.map((p) => ({ planet: p, lon: lons[p], retrograde: false }));
  const ctx = kpContext(planets, cusps, { ...DEFAULT_CONVENTIONS, kpNodeRule: false });

  it("levels A–D for house 1", () => {
    const h1 = houseSignificators(ctx)[0]!;
    // occupants: Sun, Mercury. Planets in their stars: none in Sun's star (Krittika/U.Phal/U.Asha), Mercury's (Ashlesha/Jyeshtha/Revati): none.
    expect(h1.b).toEqual(["Sun", "Mercury"]);
    expect(h1.a).toEqual([]);
    // cusp 1 at 10° Aries → owner Mars; planets in Mars's stars (Mrigashira/Chitra/Dhanishta): none here.
    expect(h1.d).toEqual(["Mars"]);
    expect(h1.c).toEqual([]);
  });
  it("level A picks planets in the star of occupants", () => {
    // house 2 occupant Moon; planets in the Moon's stars: Moon (Rohini), Saturn (Shravana)
    const h2 = houseSignificators(ctx)[1]!;
    expect(h2.a).toEqual(["Moon", "Saturn"]);
  });
  it("planet signification via star lord and sub lord", () => {
    const s = planetSignifies(ctx, "Saturn"); // star lord Moon: occupies 2, owns cusp in Cancer (4th cusp at 100° → Cancer)
    expect(s.viaStarLord).toEqual([2, 4]);
    expect(s.houses).toEqual(expect.arrayContaining([2, 4, 10]));
  });
  it("node rule adds the dispositor's houses", () => {
    const withRule = kpContext(planets, cusps, { ...DEFAULT_CONVENTIONS, kpNodeRule: true });
    // Rahu in Aquarius → dispositor Saturn (bhava 10; owns cusps in Cap/Aqu = 10, 11)
    expect(planetSignifies(withRule, "Rahu").houses).toEqual(expect.arrayContaining([10, 11]));
    expect(planetSignifies(ctx, "Rahu").houses).not.toContain(10);
  });
});
