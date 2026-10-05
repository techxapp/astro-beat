// SPDX-License-Identifier: AGPL-3.0-or-later
// Western (tropical) astrology: traditional rulerships and dignities, Placidus houses (whole-sign
// when Placidus is undefined), Ptolemaic aspects, annual profections and slow-mover transits.
// Input is the worker's WesternChart; output is categorical like the Vedic analyses.
import type {
  WesternAnalysis, WesternFact, WesternFactOf, WesternPeriodFact, WesternRuler, WesternTransitHit, WesternTransitPlanet,
  WesternTransitStay,
} from "@astro/schema/analysis";
import type { WesternChart } from "@astro/schema/chart";
import {
  GRAHAS, WESTERN_ASPECTS, type Graha, type IsoDate, type Planet, type WesternAspect, type WesternBody, type WesternDignity,
  type WesternPoint,
} from "@astro/schema/enums";
import type { PeriodDates } from "@astro/schema/local";
import type { FactIds } from "./parashari.ts";
import { periodStatus } from "./periods.ts";
import { closenessBucket } from "./states.ts";
import { EXALTATION, houseFrom, OWN_SIGNS, SIGN_LORD, signAt, signIndex, signName } from "./tables.ts";

export const ASPECT_ANGLE: Readonly<Record<WesternAspect, number>> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
/** Natal aspect orbs in degrees (a common modern set; Sun and Moon get no extra allowance). */
export const NATAL_ORB: Readonly<Record<WesternAspect, number>> = { conjunction: 8, sextile: 5, square: 7, trine: 7, opposition: 8 };
/** Orb for a transit to count as "hitting" a natal point. */
export const TRANSIT_ORB = 1;
/** Annual profections cover the current year and the six after it; the first two are also split into quarters. */
export const PROFECTION_YEARS = 7;
export const QUARTER_YEARS = 2;

const WESTERN_NAME: Readonly<Record<Planet, WesternBody>> = {
  Sun: "Sun", Moon: "Moon", Mercury: "Mercury", Venus: "Venus", Mars: "Mars", Jupiter: "Jupiter", Saturn: "Saturn",
  Rahu: "NorthNode", Ketu: "SouthNode",
};
const TRANSIT_PLANETS: readonly WesternTransitPlanet[] = ["Jupiter", "Saturn", "NorthNode"];

const angularDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Essential dignity by sign with traditional rulerships. */
export function westernDignity(planet: Graha, sign: number): WesternDignity {
  const own = OWN_SIGNS[planet];
  if (own.includes(sign)) return "domicile";
  if (EXALTATION[planet] === sign) return "exaltation";
  if (own.some((s) => (s + 6) % 12 === sign)) return "detriment";
  if ((EXALTATION[planet] + 6) % 12 === sign) return "fall";
  return "peregrine";
}

/** House (1..12) of a tropical longitude: Placidus cusps when given, else whole-sign from the Ascendant. */
export function westernHouse(lon: number, ascendantLon: number, cusps: readonly number[] | null): number {
  if (!cusps) return houseFrom(signIndex(ascendantLon), signIndex(lon));
  for (let i = 0; i < 12; i++) {
    const start = cusps[i] as number;
    const span = (((cusps[(i + 1) % 12] as number) - start) % 360 + 360) % 360;
    if ((((lon - start) % 360) + 360) % 360 < span) return i + 1;
  }
  return 12;
}

/** The aspect (and orb gap) between two longitudes, or null if none within `orb(aspect)`. */
export function aspectBetween(a: number, b: number, orb: (x: WesternAspect) => number): { aspect: WesternAspect; gap: number } | null {
  const d = angularDistance(a, b);
  let best: { aspect: WesternAspect; gap: number } | null = null;
  for (const aspect of WESTERN_ASPECTS) {
    const gap = Math.abs(d - ASPECT_ANGLE[aspect]);
    if (gap <= orb(aspect) && (!best || gap < best.gap)) best = { aspect, gap };
  }
  return best;
}

// ---------------------------------------------------------------- calendar helpers (local dates only)
const pad = (n: number): string => String(n).padStart(2, "0");
const daysIn = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Add whole months to an ISO date, clamping the day (29 Feb + 1 year → 28 Feb). */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${pad(nm)}-${pad(Math.min(d, daysIn(ny, nm)))}`;
}

interface Natal {
  ascSign: number;
  lon: Record<WesternPoint, number | null>;
  house: (lon: number) => number;
}

function natalFacts(w: WesternChart, n: Natal, ids: FactIds): WesternFact[] {
  const facts: WesternFact[] = [];
  const push = <F extends WesternFact>(f: Omit<F, "id">): void => {
    facts.push({ id: ids.next(), ...f } as F);
  };
  push<WesternFactOf<"wAngle">>({ kind: "wAngle", angle: "Ascendant", sign: signName(n.ascSign), ruler: SIGN_LORD[n.ascSign] as WesternRuler });
  if (w.midheavenLon !== null) {
    const s = signIndex(w.midheavenLon);
    push<WesternFactOf<"wAngle">>({ kind: "wAngle", angle: "Midheaven", sign: signName(s), ruler: SIGN_LORD[s] as WesternRuler });
  }
  for (const p of w.planets) {
    const sign = signIndex(p.lon);
    const body = WESTERN_NAME[p.planet];
    push<WesternFactOf<"wPlacement">>({
      kind: "wPlacement", body, sign: signName(sign), house: n.house(p.lon),
      // mean nodes always move backwards; that is not a "retrograde" in the Western sense
      retrograde: p.planet === "Rahu" || p.planet === "Ketu" ? false : p.retrograde,
      dignity: p.planet === "Rahu" || p.planet === "Ketu" ? "none" : westernDignity(p.planet as Graha, sign),
    });
  }
  for (let h = 1; h <= 12; h++) {
    const cuspSign = w.cusps ? signIndex(w.cusps[h - 1] as number) : signAt(n.ascSign, h);
    const ruler = SIGN_LORD[cuspSign] as Graha;
    const rulerLon = n.lon[ruler] as number;
    push<WesternFactOf<"wHouseRuler">>({
      kind: "wHouseRuler", house: h, cuspSign: signName(cuspSign), ruler, rulerSign: signName(signIndex(rulerLon)), rulerHouse: n.house(rulerLon),
    });
  }
  // Aspects among the seven planets and the angles; the nodes count by conjunction only.
  const main: WesternPoint[] = [...GRAHAS, "Ascendant", "Midheaven"];
  const nodes: WesternPoint[] = ["NorthNode", "SouthNode"];
  for (let i = 0; i < main.length; i++) {
    for (let j = i + 1; j < main.length; j++) {
      const a = main[i] as WesternPoint;
      const b = main[j] as WesternPoint;
      if (a === "Ascendant" && b === "Midheaven") continue;
      const la = n.lon[a];
      const lb = n.lon[b];
      if (la === null || lb === null) continue;
      const hit = aspectBetween(la, lb, (x) => NATAL_ORB[x]);
      if (hit) push<WesternFactOf<"wAspect">>({ kind: "wAspect", a, b, aspect: hit.aspect, closeness: closenessBucket(hit.gap) });
    }
  }
  for (const node of nodes) {
    for (const b of main) {
      const lb = n.lon[b];
      if (lb === null) continue;
      const gap = angularDistance(n.lon[node] as number, lb);
      if (gap <= NATAL_ORB.conjunction) {
        push<WesternFactOf<"wAspect">>({ kind: "wAspect", a: node, b, aspect: "conjunction", closeness: closenessBucket(gap) });
      }
    }
  }
  const signs = [...w.planets.filter((p) => p.planet !== "Rahu" && p.planet !== "Ketu").map((p) => signIndex(p.lon)), n.ascSign];
  const count = (pred: (s: number) => boolean): number => signs.filter(pred).length;
  push<WesternFactOf<"wBalance">>({
    kind: "wBalance",
    fire: count((s) => s % 4 === 0), earth: count((s) => s % 4 === 1), air: count((s) => s % 4 === 2), water: count((s) => s % 4 === 3),
    cardinal: count((s) => s % 3 === 0), fixed: count((s) => s % 3 === 1), mutable: count((s) => s % 3 === 2),
  });
  return facts;
}

/** Natal facts that involve a planet (for a period's factRefs). */
function refsFor(facts: readonly WesternFact[], lord: Graha): string[] {
  return facts.filter((f) => {
    switch (f.kind) {
      case "wPlacement": return f.body === lord;
      case "wHouseRuler": return f.ruler === lord;
      case "wAspect": return (f.a === lord || f.b === lord) && f.closeness !== "wide";
      case "wAngle": return f.ruler === lord;
      case "wBalance": return false;
    }
  }).map((f) => f.id);
}

export interface WesternResult {
  analysis: WesternAnalysis;
  periodDates: PeriodDates;
  nextLabel: number;
}

export function analyzeWestern(w: WesternChart, asOf: IsoDate, ids: FactIds, labelStart: number): WesternResult {
  const ascSign = signIndex(w.ascendantLon);
  const lon = {} as Record<WesternPoint, number | null>;
  for (const p of w.planets) lon[WESTERN_NAME[p.planet]] = p.lon;
  lon.Ascendant = w.ascendantLon;
  lon.Midheaven = w.midheavenLon;
  const natal: Natal = { ascSign, lon, house: (l) => westernHouse(l, w.ascendantLon, w.cusps) };
  const facts = natalFacts(w, natal, ids);

  // Profection years run birthday to birthday; find the one containing asOf.
  const yearStart = (k: number): IsoDate => addMonths(w.birthDate, 12 * k);
  let k0 = Math.max(0, Number(asOf.slice(0, 4)) - Number(w.birthDate.slice(0, 4)) - 1);
  while (yearStart(k0 + 1) <= asOf) k0++;

  const targets: WesternPoint[] = [...GRAHAS, "Ascendant", "Midheaven"];
  const describe = (start: IsoDate, end: IsoDate): { transits: WesternTransitStay[]; aspects: WesternTransitHit[] } => {
    const stays = new Map<string, WesternTransitStay>();
    const hits = new Map<string, WesternTransitHit>();
    for (const s of w.transits) {
      if (s.date < start || s.date >= end) continue;
      for (const planet of TRANSIT_PLANETS) {
        const tl = s[planet];
        const stay: WesternTransitStay = { planet, sign: signName(signIndex(tl)), house: natal.house(tl) };
        stays.set(`${planet}|${stay.sign}|${stay.house}`, stay);
        for (const to of targets) {
          const nl = lon[to];
          if (nl === null) continue;
          const hit = aspectBetween(tl, nl, () => TRANSIT_ORB);
          // The nodal axis is read by conjunction and opposition only.
          if (!hit || (planet === "NorthNode" && hit.aspect !== "conjunction" && hit.aspect !== "opposition")) continue;
          hits.set(`${planet}|${hit.aspect}|${to}`, { planet, aspect: hit.aspect, to });
        }
      }
    }
    return { transits: [...stays.values()].slice(0, 9), aspects: [...hits.values()].slice(0, 24) };
  };

  const periods: WesternPeriodFact[] = [];
  const periodDates: PeriodDates = {};
  let n = labelStart;
  const add = (level: WesternPeriodFact["level"], order: number, k: number, start: IsoDate, end: IsoDate): void => {
    const sign = signAt(ascSign, (k % 12) + 1);
    const lord = SIGN_LORD[sign] as Graha;
    const house = (k % 12) + 1;
    const lordHouse = natal.house(lon[lord] as number);
    const label = `P${n++}`;
    periods.push({
      label, level, order, status: periodStatus(start, end, asOf),
      profection: { house, sign: signName(sign), lord },
      activatedHouses: [...new Set([house, lordHouse])].sort((a, b) => a - b),
      factRefs: refsFor(facts, lord).slice(0, 40),
      ...describe(start, end),
    });
    periodDates[label] = { start, end };
  };
  for (let i = 0; i < PROFECTION_YEARS; i++) add("year", i, k0 + i, yearStart(k0 + i), yearStart(k0 + i + 1));
  for (let i = 0; i < QUARTER_YEARS; i++) {
    for (let q = 0; q < 4; q++) {
      const start = addMonths(w.birthDate, 12 * (k0 + i) + 3 * q);
      add("quarter", i * 4 + q, k0 + i, start, addMonths(w.birthDate, 12 * (k0 + i) + 3 * (q + 1)));
    }
  }

  const sunSign = signIndex(lon.Sun as number);
  const moonSign = signIndex(lon.Moon as number);
  return {
    analysis: {
      zodiac: "tropical",
      houseSystem: w.cusps ? "placidus" : "whole-sign",
      ascendant: { sign: signName(ascSign), ruler: SIGN_LORD[ascSign] as WesternRuler },
      sun: { sign: signName(sunSign) },
      moon: { sign: signName(moonSign) },
      facts,
      periods,
    },
    periodDates,
    nextLabel: n,
  };
}
