// SPDX-License-Identifier: AGPL-3.0-or-later
// Ascendant, MC and Placidus cusps (tropical, of date).
import { acosd, atan2d, cosd, norm360, sind, tand } from "./math.ts";

/** Tropical ascendant from local sidereal time (RAMC, degrees), latitude and obliquity. */
export function ascendant(ramc: number, lat: number, eps: number): number {
  return norm360(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps))));
}

export function midheaven(ramc: number, eps: number): number {
  return norm360(atan2d(sind(ramc), cosd(ramc) * cosd(eps)));
}

/** Ecliptic longitude of the ecliptic point with right ascension `ra`. */
const eclipticFromRa = (ra: number, eps: number): number => norm360(atan2d(sind(ra), cosd(ra) * cosd(eps)));
/** Declination of the ecliptic point with right ascension `ra`. */
const declFromRa = (ra: number, eps: number): number => Math.atan(tand(eps) * sind(ra)) * (180 / Math.PI);

/**
 * Placidus cusps 1..12 (tropical). Returns null when the semi-arcs are undefined
 * (circumpolar ecliptic points, |lat| ≳ 66°).
 */
export function placidusCusps(ramc: number, lat: number, eps: number): number[] | null {
  if (Math.abs(lat) >= 90 - eps) return null;
  /** Semi-diurnal arc of the ecliptic point with RA `ra`; NaN if circumpolar. */
  const sda = (ra: number): number => {
    const x = -tand(lat) * tand(declFromRa(ra, eps));
    if (x < -1 || x > 1) return Number.NaN;
    return acosd(x);
  };
  const solve = (f: (ra: number) => number): number | null => {
    let ra = f(ramc + 90);
    for (let k = 0; k < 100; k++) {
      const next = f(ra);
      if (Number.isNaN(next)) return null;
      const diff = Math.abs(((next - ra + 540) % 360) - 180);
      ra = next;
      if (diff < 1e-9) break;
    }
    return eclipticFromRa(ra, eps);
  };
  // Above the horizon, east: cusp 11 and 12 trisect the semi-diurnal arc from the MC.
  const c11 = solve((ra) => ramc + sda(ra) / 3);
  const c12 = solve((ra) => ramc + (2 * sda(ra)) / 3);
  // Below the horizon, east: cusps 2 and 3 trisect the semi-nocturnal arc from the ascendant to the IC.
  const c2 = solve((ra) => ramc + 180 - (2 * (180 - sda(ra))) / 3);
  const c3 = solve((ra) => ramc + 180 - (180 - sda(ra)) / 3);
  if (c11 === null || c12 === null || c2 === null || c3 === null) return null;
  const c1 = ascendant(ramc, lat, eps);
  const c10 = midheaven(ramc, eps);
  const cusps = [c1, c2, c3, norm360(c10 + 180), norm360(c11 + 180), norm360(c12 + 180),
    norm360(c1 + 180), norm360(c2 + 180), norm360(c3 + 180), c10, c11, c12];
  // Sanity: cusps must be in zodiacal order.
  for (let i = 0; i < 12; i++) {
    const span = norm360((cusps[(i + 1) % 12] as number) - (cusps[i] as number));
    if (span <= 0 || span >= 180) return null;
  }
  return cusps;
}
