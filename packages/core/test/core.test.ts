// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  ascendant, calendarFromJd, DEFAULT_ENGINE_SETTINGS, deltaTSeconds, findIngresses, gmstDegrees, julianDay, lunarNode,
  meanObliquity, moonPosition, placidusCusps, planetPosition, ReferenceEngine, sunPosition, vimshottari, ayanamsa,
  VIMSHOTTARI_ORDER, jdUtFromLocal, westernChart, chartBirthDate, jdTtFromUt, tropicalLongitude,
} from "../src/index.ts";

const close = (actual: number, expected: number, tol: number): void => {
  const diff = Math.abs(((actual - expected + 540) % 360) - 180);
  expect(diff, `${actual} vs ${expected}`).toBeLessThanOrEqual(tol);
};

describe("time (Meeus ch. 7)", () => {
  it("julian day, Gregorian and Julian calendars", () => {
    expect(julianDay(1957, 10, 4.81)).toBeCloseTo(2436116.31, 6);
    expect(julianDay(333, 1, 27.5)).toBeCloseTo(1842713.0, 6);
    expect(julianDay(2000, 1, 1.5)).toBe(2451545.0);
  });
  it("calendar from JD round-trips", () => {
    const c = calendarFromJd(2436116.31);
    expect([c.year, c.month, c.day]).toEqual([1957, 10, 4]);
    expect(c.fraction).toBeCloseTo(0.81, 6);
  });
  it("ΔT is plausible", () => {
    expect(deltaTSeconds(2000)).toBeCloseTo(63.86, 1);
    expect(deltaTSeconds(1950)).toBeCloseTo(29.07, 1);
  });
  it("local time with offset", () => {
    // 2000-01-01 17:30 at UTC+05:30 = 12:00 UT
    expect(jdUtFromLocal("2000-01-01", "17:30", 330)).toBeCloseTo(2451545.0, 9);
  });
});

describe("reference ephemeris against Meeus worked examples (tolerance 3′)", () => {
  const tol = 0.05;
  it("Sun 1992-10-13 0h TD (ex. 25.a, geometric 199.90988°)", () => {
    close(sunPosition(2448908.5).lon, 199.90988, tol);
  });
  it("Moon 1992-04-12 0h TD (ex. 47.a, 133.162655° incl. nutation +0.0046°)", () => {
    close(moonPosition(2448724.5).lon, 133.162655 - 0.00461, tol);
  });
  it("Venus 1992-12-20 0h TD (ex. 33.a, apparent 313.08102°)", () => {
    close(planetPosition("Venus", 2448976.5).lon, 313.08102, tol);
  });
  it("mean lunar node 1992-04-12 (ex. 47.a, Ω = 274.400656°)", () => {
    close(lunarNode(2448724.5, "mean"), 274.400656, 0.0001);
  });
  it("true node stays within 2° of mean node", () => {
    for (let jd = 2440000; jd < 2460000; jd += 997) {
      close(lunarNode(jd, "true"), lunarNode(jd, "mean"), 2);
    }
  });
  it("GMST (ex. 12.a / 12.b)", () => {
    close(gmstDegrees(2446895.5), 197.693195, 1e-5);
    close(gmstDegrees(2446896.30625), 128.7378734, 1e-5);
  });
  it("mean obliquity 1987-04-10 (ex. 22.a, 23°26′27.407″)", () => {
    expect(meanObliquity(2446895.5)).toBeCloseTo(23 + 26 / 60 + 27.407 / 3600, 5);
  });
});

describe("ayanamsa", () => {
  it("Lahiri at J2000 ≈ 23°51′", () => {
    expect(ayanamsa("lahiri", 2451545)).toBeCloseTo(23.857, 2);
  });
  it("KP (old) is ~6′ less than Lahiri", () => {
    const diff = ayanamsa("lahiri", 2451545) - ayanamsa("kp-old", 2451545);
    expect(diff).toBeGreaterThan(0.08);
    expect(diff).toBeLessThan(0.12);
  });
  it("kp-new is refused by the reference engine", () => {
    expect(() => ayanamsa("kp-new", 2451545)).toThrow(/Swiss Ephemeris/);
  });
});

describe("houses", () => {
  it("ascendant at the equator with RAMC 0 is 0° Cancer", () => {
    close(ascendant(0, 0, 23.44), 90, 1e-9);
    close(ascendant(90, 0, 23.44), 180, 1e-9);
  });
  it("Placidus at the equator equals meridian houses", () => {
    const eps = 23.44;
    const cusps = placidusCusps(10, 0, eps);
    expect(cusps).not.toBeNull();
    const ecl = (ra: number): number => ((Math.atan2(Math.sin(ra * Math.PI / 180), Math.cos(ra * Math.PI / 180) * Math.cos(eps * Math.PI / 180)) * 180) / Math.PI + 360) % 360;
    close(cusps![10]!, ecl(40), 1e-6); // cusp 11
    close(cusps![11]!, ecl(70), 1e-6); // cusp 12
    close(cusps![1]!, ecl(130), 1e-6); // cusp 2
  });
  it("Placidus cusps are ordered at a mid latitude and undefined past the polar circle", () => {
    const cusps = placidusCusps(123.4, 51.5, 23.44)!;
    expect(cusps).toHaveLength(12);
    expect(placidusCusps(123.4, 70, 23.44)).toBeNull();
    expect(placidusCusps(123.4, -70, 23.44)).toBeNull();
  });
});

describe("Vimshottari", () => {
  it("Moon at 0° Aries starts a full Ketu mahadasha", () => {
    const jd = 2451545;
    const periods = vimshottari(0, jd, { yearLength: "365.25", depth: 1 });
    expect(periods.map((p) => p.path[0])).toEqual([...VIMSHOTTARI_ORDER]);
    expect(periods[0]!.start).toBe("2000-01-01");
    expect(periods[0]!.end).toBe("2007-01-01"); // JD 2454101.75
  });
  it("balance of dasha at mid-nakshatra is half the lord's years", () => {
    const periods = vimshottari(360 / 27 / 2, 2451545, { yearLength: "365.25", depth: 1 });
    expect(periods[0]!.path).toEqual(["Ketu"]);
    expect(periods[0]!.end).toBe("2003-07-02"); // JD 2452823.375
  });
  it("four levels are contiguous and fit the schema cap", () => {
    const periods = vimshottari(123.456, 2451545, { yearLength: "365.25", depth: 4 });
    expect(periods.length).toBeLessThanOrEqual(7380);
    for (const level of ["MD", "AD", "PD", "SD"] as const) {
      const ps = periods.filter((p) => p.level === level);
      for (let i = 1; i < ps.length; i++) expect(ps[i]!.start).toBe(ps[i - 1]!.end);
      expect(ps[0]!.start).toBe("2000-01-01");
    }
  });
});

describe("engine", () => {
  const birth = {
    localDate: "1990-06-15", localTime: "08:30", timeAccuracy: "exact" as const,
    place: { label: "Test", lat: 28.6, lon: 77.2 },
    timezone: { iana: "Asia/Kolkata", utcOffsetMinutes: 330, overridden: false },
  };
  it("computes a schema-valid chart with both systems", async () => {
    const { Chart } = await import("@astro/schema/chart");
    const { chart, temporal } = ReferenceEngine.computeChart(birth, DEFAULT_ENGINE_SETTINGS);
    expect(() => Chart.parse(chart)).not.toThrow();
    expect(chart.kp.cusps).toHaveLength(12);
    expect(temporal.utcInstant).toBe("1990-06-15T03:00:00Z");
    const sunP = chart.parashari.planets.find((p) => p.planet === "Sun")!;
    const sunK = chart.kp.planets.find((p) => p.planet === "Sun")!;
    expect(sunP.lon - sunK.lon).toBeCloseTo(-0.0965, 2);
    // 1990-06-15: Sun tropical ~Gemini 24°, Lahiri ayanamsa ~23.7° → sidereal ~60.2°.
    expect(sunP.lon).toBeGreaterThan(59.5);
    expect(sunP.lon).toBeLessThan(61);
  });
  it("finds ingresses with sensible counts", () => {
    const ing = findIngresses(2451545, { ayanamsa: "lahiri", nodeType: "mean", years: 30 });
    const saturn = ing.filter((i) => i.planet === "Saturn");
    const rahu = ing.filter((i) => i.planet === "Rahu");
    expect(saturn.length).toBeGreaterThanOrEqual(12);
    expect(saturn.length).toBeLessThanOrEqual(32); // retrograde loops add re-entries
    expect(rahu.length).toBeGreaterThanOrEqual(18);
    expect(rahu.length).toBeLessThanOrEqual(21);
    expect(rahu.every((i) => !i.retrogradeReentry)).toBe(true);
  });
  it("high-latitude birth has no Placidus cusps", () => {
    const { chart } = ReferenceEngine.computeChart({ ...birth, place: { label: "Svalbard", lat: 78.2, lon: 15.6 } }, DEFAULT_ENGINE_SETTINGS);
    expect(chart.kp.cusps).toBeNull();
  });
});

describe("western chart", () => {
  const birth = { localDate: "1989-06-15", localTime: "12:00", timeAccuracy: "exact" as const, place: { label: "x", lat: 28.6, lon: 77.2 }, timezone: { iana: "Asia/Kolkata", utcOffsetMinutes: 330, overridden: false } };
  const { chart, temporal } = ReferenceEngine.computeChart(birth, DEFAULT_ENGINE_SETTINGS, { ingressYears: 10 });
  const w = westernChart(chart, { asOf: "2026-10-05" });
  it("recovers the birth date from the dasha tree", () => {
    expect(chartBirthDate(chart)).toBe(temporal.utcInstant.slice(0, 10));
  });
  it("natal positions equal the ephemeris' tropical ones (sidereal plus ayanamsa)", () => {
    const tt = jdTtFromUt(temporal.jdUt);
    for (const p of w.planets) {
      const diff = Math.abs(((p.lon - tropicalLongitude(p.planet, tt, "mean") + 540) % 360) - 180);
      expect(diff, p.planet).toBeLessThan(1e-3);
    }
    expect(w.cusps).not.toBeNull();
    expect(w.midheavenLon).toBe(w.cusps![9]);
  });
  it("samples slow-mover transits around today", () => {
    expect(w.transits[0]!.date <= "2025-10-01").toBe(true);
    expect(w.transits.at(-1)!.date >= "2033-10-01").toBe(true);
  });
});

