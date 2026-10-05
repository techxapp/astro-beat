// SPDX-License-Identifier: AGPL-3.0-or-later
// Inversion harness (§11): brute-force the birth instants and places consistent with a payload,
// to measure how identifying it is. Adversary model: knows the engine and the payload, nothing
// else; searches 1900–2030 and all inhabited latitudes.
import { kpLordsAt, nakshatraName, padaOf, vargaSign } from "@astro/analysis";
import { julianDay, ReferenceEngine, type AyanamsaId } from "@astro/core";
import type { Fact, KpFact } from "@astro/schema/analysis";
import type { PlanetPos } from "@astro/schema/chart";
import { SIGNS, type Planet, type Varga } from "@astro/schema/enums";
import type { KpPayload, ParashariPayload } from "@astro/schema/payload";

/** The harness models the Vedic payloads (the ones that carry birth-time-sensitive angles). */
export type InvertiblePayload = ParashariPayload | KpPayload;

export interface InversionOptions {
  fromYear: number;
  toYear: number;
  /** fine time step on candidate days */
  stepMinutes: number;
  /** location grid, degrees (longitude is the sensitive axis: it acts like clock time) */
  lonStep: number;
  latStep: number;
  maxLat: number;
  /** time slots sampled for the location scan */
  maxSlots: number;
  /** what-if analysis: pretend some fact fields were withheld from the payload */
  whatIf?: { placementSignOnly?: boolean; dropPlanetVargas?: boolean };
}

export const DEFAULT_INVERSION: InversionOptions = { fromYear: 1900, toYear: 2030, stepMinutes: 10, lonStep: 1, latStep: 5, maxLat: 60, maxSlots: 30 };

export interface InversionResult {
  system: InvertiblePayload["system"];
  topic: InvertiblePayload["topic"];
  /** distinct UT dates with at least one consistent time slot */
  candidateDays: number;
  /** consistent time slots (of stepMinutes) before location is considered */
  candidateHours: number;
  /** mean fraction of the (lat, lon) grid consistent with the angle facts, over surviving slots */
  locationFraction: number;
  /**
   * candidateHours × locationFraction: the size of the candidate set in "hours of worldwide
   * ambiguity". 24 would mean the payload narrows the birth moment to about one day anywhere on Earth.
   */
  effectiveHours: number;
}

const signIdx = (s: string): number => SIGNS.indexOf(s as (typeof SIGNS)[number]);
const sgn = (lon: number): number => Math.floor(lon / 30) % 12;

type PlanetCheck = (p: PlanetPos) => boolean;
type AngleCheck = (asc: number, cusps: number[] | null) => boolean;

interface Constraints {
  ayanamsa: AyanamsaId;
  planets: Map<Planet, PlanetCheck[]>;
  /** coarse checks usable on the daily scan (sign / nakshatra only; tolerant of ±1 day) */
  coarse: Map<Planet, (lon: number) => boolean>;
  angles: AngleCheck[];
}

function parashariConstraints(p: ParashariPayload, whatIf: InversionOptions["whatIf"] = {}): Constraints {
  const planets = new Map<Planet, PlanetCheck[]>();
  const coarse = new Map<Planet, (lon: number) => boolean>();
  const add = (pl: Planet, c: PlanetCheck): void => void planets.set(pl, [...(planets.get(pl) ?? []), c]);
  const angles: AngleCheck[] = [(asc) => sgn(asc) === signIdx(p.lagna.sign)];
  add("Moon", (x) => sgn(x.lon) === signIdx(p.moon.sign) && nakshatraName(x.lon) === p.moon.nakshatra && padaOf(x.lon) === p.moon.pada);
  for (const f of p.facts as Fact[]) {
    if (f.kind === "placement") {
      const s = signIdx(f.sign);
      if (whatIf.placementSignOnly) add(f.planet, (x) => sgn(x.lon) === s);
      else add(f.planet, (x) => sgn(x.lon) === s && nakshatraName(x.lon) === f.nakshatra && padaOf(x.lon) === f.pada);
      if (f.planet !== "Rahu" && f.planet !== "Ketu") add(f.planet, (x) => x.retrograde === f.retrograde);
      coarse.set(f.planet, (lon) => sgn(lon) === s);
    } else if (f.kind === "varga" && !whatIf.dropPlanetVargas) {
      const s = signIdx(f.sign);
      add(f.planet, (x) => vargaSign(f.varga as Varga, x.lon) === s);
    } else if (f.kind === "vargaLagna") {
      const s = signIdx(f.sign);
      angles.push((asc) => vargaSign(f.varga as Varga, asc) === s);
    }
  }
  return { ayanamsa: "lahiri", planets, coarse, angles };
}

function kpConstraints(p: KpPayload): Constraints {
  const planets = new Map<Planet, PlanetCheck[]>();
  const coarse = new Map<Planet, (lon: number) => boolean>();
  const add = (pl: Planet, c: PlanetCheck): void => void planets.set(pl, [...(planets.get(pl) ?? []), c]);
  const angles: AngleCheck[] = [(asc) => sgn(asc) === signIdx(p.lagna.sign)];
  add("Moon", (x) => sgn(x.lon) === signIdx(p.moon.sign) && nakshatraName(x.lon) === p.moon.nakshatra && padaOf(x.lon) === p.moon.pada);
  for (const f of p.facts as KpFact[]) {
    if (f.kind === "kpPlanet") {
      const s = signIdx(f.sign);
      add(f.planet, (x) => {
        const l = kpLordsAt(x.lon);
        return sgn(x.lon) === s && l.starLord === f.starLord && l.subLord === f.subLord;
      });
      if (f.planet !== "Rahu" && f.planet !== "Ketu") add(f.planet, (x) => x.retrograde === f.retrograde);
      coarse.set(f.planet, (lon) => sgn(lon) === s);
    } else if (f.kind === "kpCusp") {
      const i = f.cusp - 1;
      angles.push((_asc, cusps) => {
        if (!cusps) return false;
        const l = kpLordsAt(cusps[i] as number);
        return l.sign === f.sign && l.starLord === f.starLord && l.subLord === f.subLord;
      });
    }
  }
  return { ayanamsa: "kp-old", planets, coarse, angles };
}

/** Daily noon positions, cached per ayanamsa (independent of any payload). */
const dailyCache = new Map<string, { jd0: number; lons: Float64Array[] }>();

function daily(ayanamsa: AyanamsaId, opts: InversionOptions): { jd0: number; lons: Float64Array[] } {
  const key = `${ayanamsa}|${opts.fromYear}|${opts.toYear}`;
  const hit = dailyCache.get(key);
  if (hit) return hit;
  const jd0 = julianDay(opts.fromYear, 1, 1);
  const days = Math.round(julianDay(opts.toYear + 1, 1, 1) - jd0);
  const lons = Array.from({ length: 9 }, () => new Float64Array(days + 1));
  for (let d = 0; d <= days; d++) {
    const pos = ReferenceEngine.siderealPositions(jd0 + d, ayanamsa, "mean");
    pos.forEach((p, i) => ((lons[i] as Float64Array)[d] = p.lon));
  }
  const v = { jd0, lons };
  dailyCache.set(key, v);
  return v;
}

const PLANET_INDEX: Record<Planet, number> = { Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Jupiter: 4, Venus: 5, Saturn: 6, Rahu: 7, Ketu: 8 };

export function invertPayload(payload: InvertiblePayload, opts: InversionOptions = DEFAULT_INVERSION): InversionResult {
  const c = payload.system === "kp" ? kpConstraints(payload) : parashariConstraints(payload, opts.whatIf);
  const { jd0, lons } = daily(c.ayanamsa, opts);
  const days = (lons[0] as Float64Array).length - 1;

  // 1. Daily scan with coarse (sign) checks on everything except the Moon, tolerant at day edges.
  const coarse = [...c.coarse.entries()].filter(([p]) => p !== "Moon");
  const candidateDays: number[] = [];
  for (let d = 0; d < days; d++) {
    const ok = coarse.every(([p, check]) => {
      const arr = lons[PLANET_INDEX[p]] as Float64Array;
      return check(arr[d] as number) || check(arr[d + 1] as number);
    });
    if (ok) candidateDays.push(d);
  }

  // 2. Fine time scan on candidate days with all planet checks (the daily sample is at 0h UT).
  const slots: number[] = [];
  const perDay = Math.round(1440 / opts.stepMinutes);
  const days_ = new Set<number>();
  for (const d of candidateDays) {
    for (let k = 0; k < perDay; k++) {
      const jd = jd0 + d + k / perDay;
      const pos = ReferenceEngine.siderealPositions(jd, c.ayanamsa, "mean");
      let ok = true;
      for (const [planet, checks] of c.planets) {
        const pp = pos[PLANET_INDEX[planet]] as PlanetPos;
        if (!checks.every((ch) => ch(pp))) {
          ok = false;
          break;
        }
      }
      if (ok) {
        slots.push(jd);
        days_.add(d);
      }
    }
  }

  // 3. Location grid for the angle facts (sampled over at most maxSlots slots).
  const n = Math.min(slots.length, opts.maxSlots);
  const sample = Array.from({ length: n }, (_, i) => slots[Math.floor((i * slots.length) / n)] as number);
  let fracSum = 0;
  for (const jd of sample) {
    let ok = 0;
    let cells = 0;
    for (let lat = -opts.maxLat; lat <= opts.maxLat; lat += opts.latStep) {
      for (let lon = -180; lon < 180; lon += opts.lonStep) {
        cells++;
        const a = ReferenceEngine.siderealAngles({ jdUt: jd, lat, lon }, c.ayanamsa);
        if (c.angles.every((check) => check(a.ascendant, a.cusps))) ok++;
      }
    }
    fracSum += ok / cells;
  }
  const locationFraction = n ? fracSum / n : 0;
  const candidateHours = (slots.length * opts.stepMinutes) / 60;
  return {
    system: payload.system,
    topic: payload.topic,
    candidateDays: days_.size,
    candidateHours,
    locationFraction,
    effectiveHours: candidateHours * locationFraction,
  };
}
