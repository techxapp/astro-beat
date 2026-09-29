// SPDX-License-Identifier: AGPL-3.0-or-later
// Combustion, graha yuddha, gandanta, baladi avastha, conjunction closeness.
import type { AnalysisConventions, Avastha } from "@astro/schema/analysis";
import type { Planet } from "@astro/schema/enums";
import { degInSign, isOddSign, nakshatraIndex, padaOf, signIndex } from "./tables.ts";

const angularDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Combustion orbs in degrees (Surya Siddhanta / BPHS as commonly tabulated). */
export function combustionOrb(planet: Planet, retrograde: boolean, conv: AnalysisConventions["combustion"]): number | null {
  const reduce = conv === "classical";
  switch (planet) {
    case "Moon": return 12;
    case "Mars": return 17;
    case "Mercury": return reduce && retrograde ? 12 : 14;
    case "Jupiter": return 11;
    case "Venus": return reduce && retrograde ? 8 : 10;
    case "Saturn": return 15;
    default: return null; // Sun, Rahu, Ketu are never combust
  }
}

export function isCombust(planet: Planet, lon: number, retrograde: boolean, sunLon: number, conv: AnalysisConventions["combustion"]): boolean {
  const orb = combustionOrb(planet, retrograde, conv);
  return orb !== null && angularDistance(lon, sunLon) <= orb;
}

const WAR_PLANETS: readonly Planet[] = ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

/**
 * Graha yuddha: two of Mars–Saturn within 1° of longitude. The winner convention is a setting
 * (classical texts judge by latitude/brightness, which the chart does not carry).
 */
export function planetaryWar(lon: Record<Planet, number>, conv: AnalysisConventions["planetaryWarWinner"]): Map<Planet, "won" | "lost"> {
  const out = new Map<Planet, "won" | "lost">();
  const best = new Map<Planet, number>();
  for (let i = 0; i < WAR_PLANETS.length; i++) {
    for (let j = i + 1; j < WAR_PLANETS.length; j++) {
      const a = WAR_PLANETS[i] as Planet;
      const b = WAR_PLANETS[j] as Planet;
      const d = angularDistance(lon[a], lon[b]);
      if (d > 1) continue;
      // Compare along the zodiac: "lower" is the one behind the other by < 180°.
      const aLower = ((lon[b] - lon[a] + 360) % 360) < 180;
      const lowerWins = conv === "lower-longitude";
      const winner = aLower === lowerWins ? a : b;
      const loser = winner === a ? b : a;
      for (const [p, r] of [[winner, "won"], [loser, "lost"]] as const) {
        if (!best.has(p) || (best.get(p) as number) > d) {
          best.set(p, d);
          out.set(p, r);
        }
      }
    }
  }
  return out;
}

/** Gandanta: the last pada of a water-sign nakshatra or the first pada of the following fire-sign nakshatra. */
export function isGandanta(lon: number): boolean {
  const n = nakshatraIndex(lon);
  const p = padaOf(lon);
  return ((n === 8 || n === 17 || n === 26) && p === 4) || ((n === 0 || n === 9 || n === 18) && p === 1);
}

const AVASTHAS: readonly Avastha[] = ["bala", "kumara", "yuva", "vriddha", "mrita"];

/** Baladi avastha: 6° segments, reversed in even signs. */
export function baladiAvastha(lon: number): Avastha {
  const seg = Math.min(4, Math.floor(degInSign(lon) / 6));
  return AVASTHAS[isOddSign(signIndex(lon)) ? seg : 4 - seg] as Avastha;
}

export function closenessBucket(gapDeg: number): "tight" | "moderate" | "wide" {
  if (gapDeg <= 3) return "tight";
  if (gapDeg <= 8) return "moderate";
  return "wide";
}

export { angularDistance };
