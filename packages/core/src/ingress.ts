// SPDX-License-Identifier: AGPL-3.0-or-later
// Sidereal sign-ingress search for the slow movers used by transit events.
import type { Ingress, TransitPlanet } from "@astro/schema/chart";
import { SIGNS } from "@astro/schema/enums";
import { tropicalLongitude } from "./ephemeris.ts";
import { norm180, norm360 } from "./math.ts";
import { ayanamsa, type AyanamsaId } from "./sidereal.ts";
import { isoDateFromJd, jdTtFromUt } from "./time.ts";

const TRANSIT_PLANETS: readonly TransitPlanet[] = ["Jupiter", "Saturn", "Rahu", "Ketu"];
/** Normal direction of motion: +1 direct, -1 retrograde (nodes). */
const NORMAL_DIRECTION: Record<TransitPlanet, 1 | -1> = { Jupiter: 1, Saturn: 1, Rahu: -1, Ketu: -1 };

export interface IngressOptions {
  ayanamsa: AyanamsaId;
  nodeType: "mean" | "true";
  /** search horizon in years from `jdStartUt` */
  years: number;
  /** step in days */
  stepDays?: number;
}

function siderealLon(planet: TransitPlanet, jdUt: number, opts: IngressOptions): number {
  const tt = jdTtFromUt(jdUt);
  return norm360(tropicalLongitude(planet, tt, opts.nodeType) - ayanamsa(opts.ayanamsa, tt));
}

const signIdx = (lon: number): number => Math.floor(lon / 30) % 12;

export function findIngresses(jdStartUt: number, opts: IngressOptions): Ingress[] {
  const step = opts.stepDays ?? 1;
  const jdEnd = jdStartUt + opts.years * 365.25;
  const out: (Ingress & { jd: number })[] = [];
  for (const planet of TRANSIT_PLANETS) {
    let prevJd = jdStartUt;
    let prevLon = siderealLon(planet, prevJd, opts);
    let prevSign = signIdx(prevLon);
    /** sign → JD it was last entered (birth counts as an entry) */
    const lastEntered = new Map<number, number>([[prevSign, jdStartUt]]);
    for (let jd = jdStartUt + step; jd <= jdEnd; jd += step) {
      const lon = siderealLon(planet, jd, opts);
      const sign = signIdx(lon);
      if (sign !== prevSign) {
        // Bisect for the crossing instant (to ~1 minute).
        let lo = prevJd;
        let hi = jd;
        while (hi - lo > 1 / 1440) {
          const mid = (lo + hi) / 2;
          if (signIdx(siderealLon(planet, mid, opts)) === prevSign) lo = mid;
          else hi = mid;
        }
        const direction = Math.sign(norm180(lon - prevLon));
        const seen = lastEntered.get(sign);
        const reentry = direction !== NORMAL_DIRECTION[planet] || (seen !== undefined && hi - seen < 400);
        out.push({ planet, sign: SIGNS[sign] as Ingress["sign"], date: isoDateFromJd(hi), retrogradeReentry: reentry, jd: hi });
        lastEntered.set(sign, hi);
        prevSign = sign;
      }
      prevJd = jd;
      prevLon = lon;
    }
  }
  return out.sort((a, b) => a.jd - b.jd).map(({ jd: _jd, ...rest }) => rest);
}
