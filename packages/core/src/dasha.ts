// SPDX-License-Identifier: AGPL-3.0-or-later
// Vimshottari dasha tree (MD/AD/PD/SD) from the sidereal Moon.
import type { DashaPeriod } from "@astro/schema/chart";
import type { Planet } from "@astro/schema/enums";
import { isoDateFromJd } from "./time.ts";

export const VIMSHOTTARI_ORDER: readonly Planet[] = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
export const VIMSHOTTARI_YEARS: Readonly<Record<Planet, number>> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};
export const NAKSHATRA_SPAN = 360 / 27;

export type YearLength = "365.25" | "360";

/** Nakshatra lord of a sidereal longitude. */
export function nakshatraLordOf(lon: number): Planet {
  const idx = Math.floor(lon / NAKSHATRA_SPAN) % 27;
  return VIMSHOTTARI_ORDER[idx % 9] as Planet;
}

/** The sequence of 9 lords starting at `first`. */
export function sequenceFrom(first: Planet): Planet[] {
  const i = VIMSHOTTARI_ORDER.indexOf(first);
  return Array.from({ length: 9 }, (_, k) => VIMSHOTTARI_ORDER[(i + k) % 9] as Planet);
}

export interface DashaOptions {
  yearLength: YearLength;
  /** deepest level to generate (MD=1 … SD=4) */
  depth: 1 | 2 | 3 | 4;
}

const LEVELS = ["MD", "AD", "PD", "SD"] as const;

/**
 * Generate one full 120-year Vimshottari cycle starting at the (pre-birth) start of the birth
 * mahadasha, clipped to begin at birth. Periods that end before birth are dropped.
 */
export function vimshottari(moonSiderealLon: number, jdBirthUt: number, opts: DashaOptions): DashaPeriod[] {
  const yearDays = opts.yearLength === "360" ? 360 : 365.25;
  const nakPos = moonSiderealLon / NAKSHATRA_SPAN;
  const elapsedFraction = nakPos - Math.floor(nakPos);
  const firstLord = nakshatraLordOf(moonSiderealLon);
  const mdStart = jdBirthUt - elapsedFraction * VIMSHOTTARI_YEARS[firstLord] * yearDays;
  const out: DashaPeriod[] = [];

  const walk = (path: Planet[], start: number, durationDays: number, level: number): void => {
    const end = start + durationDays;
    if (end > jdBirthUt) {
      out.push({
        level: LEVELS[level - 1] as DashaPeriod["level"],
        path,
        start: isoDateFromJd(Math.max(start, jdBirthUt)),
        end: isoDateFromJd(end),
      });
    }
    if (level >= opts.depth) return;
    let t = start;
    for (const sub of sequenceFrom(path[path.length - 1] as Planet)) {
      const d = (durationDays * VIMSHOTTARI_YEARS[sub]) / 120;
      if (t + d > jdBirthUt) walk([...path, sub], t, d, level + 1);
      t += d;
    }
  };

  let t = mdStart;
  for (const lord of sequenceFrom(firstLord)) {
    const d = VIMSHOTTARI_YEARS[lord] * yearDays;
    walk([lord], t, d, 1);
    t += d;
  }
  // The walk is chronological within each level; a stable sort groups by level.
  return out.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
}
