// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Reference (approximate) ephemeris in pure TypeScript.
//
// Orbital elements and perturbation terms: Paul Schlyter, "How to compute planetary positions"
// (elements referred to the mean ecliptic and equinox of date; accuracy ~1–2′ for the Sun, Moon
// and planets over roughly 1800–2100). Lunar node: Meeus, Astronomical Algorithms ch. 47.
//
// This engine lets the whole pipeline run and be tested offline. It is NOT the production engine:
// the Swiss Ephemeris WASM adapter (see ./engine.ts `ChartEngine`) replaces it once the
// packages/core design (open question Q2) lands, and the golden tests tighten to 1″.
import type { Planet } from "@astro/schema/enums";
import { atan2d, cosd, DEG, norm360, RAD, sind } from "./math.ts";
import { J2000 } from "./time.ts";

export interface EclipticPos {
  /** tropical ecliptic longitude of date, degrees */
  lon: number;
  /** ecliptic latitude, degrees */
  lat: number;
}

/** Days since 2000 Jan 0.0 (Schlyter's `d`), from JD (TT). */
const dayNumber = (jdTt: number): number => jdTt - 2451543.5;

function solveKepler(mDeg: number, e: number): number {
  const m = norm360(mDeg) * DEG;
  let ecc = m + e * Math.sin(m) * (1 + e * Math.cos(m));
  for (let i = 0; i < 30; i++) {
    const delta = (ecc - e * Math.sin(ecc) - m) / (1 - e * Math.cos(ecc));
    ecc -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return ecc; // radians
}

interface Elements {
  N: number;
  i: number;
  w: number;
  a: number;
  e: number;
  M: number;
}

type Body = "Mercury" | "Venus" | "Mars" | "Jupiter" | "Saturn";

function elements(body: Body | "Sun" | "Moon", d: number): Elements {
  switch (body) {
    case "Sun":
      return { N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.047 + 0.9856002585 * d };
    case "Moon":
      return {
        N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d,
        a: 60.2666, e: 0.0549, M: 115.3654 + 13.0649929509 * d,
      };
    case "Mercury":
      return {
        N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.0e-8 * d, w: 29.1241 + 1.01444e-5 * d,
        a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d,
      };
    case "Venus":
      return {
        N: 76.6799 + 2.4659e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.891 + 1.38374e-5 * d,
        a: 0.72333, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d,
      };
    case "Mars":
      return {
        N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d,
        a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d,
      };
    case "Jupiter":
      return {
        N: 100.4542 + 2.76854e-5 * d, i: 1.303 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d,
        a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.895 + 0.0830853001 * d,
      };
    case "Saturn":
      return {
        N: 113.6634 + 2.3898e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d,
        a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.967 + 0.0334442282 * d,
      };
  }
}

/** Position in the orbital frame → ecliptic rectangular coordinates. */
function orbitToEcliptic(el: Elements): { x: number; y: number; z: number; r: number } {
  const E = solveKepler(el.M, el.e);
  const xv = el.a * (Math.cos(E) - el.e);
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const v = Math.atan2(yv, xv) * RAD;
  const r = Math.hypot(xv, yv);
  const vw = v + el.w;
  const x = r * (cosd(el.N) * cosd(vw) - sind(el.N) * sind(vw) * cosd(el.i));
  const y = r * (sind(el.N) * cosd(vw) + cosd(el.N) * sind(vw) * cosd(el.i));
  const z = r * sind(vw) * sind(el.i);
  return { x, y, z, r };
}

function sunGeocentric(d: number): { lon: number; r: number; M: number; w: number } {
  const el = elements("Sun", d);
  const E = solveKepler(el.M, el.e);
  const xv = Math.cos(E) - el.e;
  const yv = Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const v = Math.atan2(yv, xv) * RAD;
  return { lon: norm360(v + el.w), r: Math.hypot(xv, yv), M: el.M, w: el.w };
}

export function sunPosition(jdTt: number): EclipticPos {
  return { lon: sunGeocentric(dayNumber(jdTt)).lon, lat: 0 };
}

export function moonPosition(jdTt: number): EclipticPos {
  const d = dayNumber(jdTt);
  const el = elements("Moon", d);
  const p = orbitToEcliptic(el);
  let lon = atan2d(p.y, p.x);
  let lat = atan2d(p.z, Math.hypot(p.x, p.y));
  const sun = elements("Sun", d);
  const Ms = sun.M;
  const Mm = el.M;
  const Ls = Ms + sun.w;
  const Lm = Mm + el.w + el.N;
  const D = Lm - Ls;
  const F = Lm - el.N;
  lon +=
    -1.274 * sind(Mm - 2 * D) +
    0.658 * sind(2 * D) -
    0.186 * sind(Ms) -
    0.059 * sind(2 * Mm - 2 * D) -
    0.057 * sind(Mm - 2 * D + Ms) +
    0.053 * sind(Mm + 2 * D) +
    0.046 * sind(2 * D - Ms) +
    0.041 * sind(Mm - Ms) -
    0.035 * sind(D) -
    0.031 * sind(Mm + Ms) -
    0.015 * sind(2 * F - 2 * D) +
    0.011 * sind(Mm - 4 * D);
  lat +=
    -0.173 * sind(F - 2 * D) -
    0.055 * sind(Mm - F - 2 * D) -
    0.046 * sind(Mm + F - 2 * D) +
    0.033 * sind(F + 2 * D) +
    0.017 * sind(2 * Mm + F);
  return { lon: norm360(lon), lat };
}

export function planetPosition(body: Body, jdTt: number): EclipticPos {
  const d = dayNumber(jdTt);
  const el = elements(body, d);
  const h = orbitToEcliptic(el);
  let lonh = atan2d(h.y, h.x);
  let lath = atan2d(h.z, Math.hypot(h.x, h.y));
  if (body === "Jupiter" || body === "Saturn") {
    const Mj = elements("Jupiter", d).M;
    const Ms = elements("Saturn", d).M;
    if (body === "Jupiter") {
      lonh +=
        -0.332 * sind(2 * Mj - 5 * Ms - 67.6) -
        0.056 * sind(2 * Mj - 2 * Ms + 21) +
        0.042 * sind(3 * Mj - 5 * Ms + 21) -
        0.036 * sind(Mj - 2 * Ms) +
        0.022 * cosd(Mj - Ms) +
        0.023 * sind(2 * Mj - 3 * Ms + 52) -
        0.016 * sind(Mj - 5 * Ms - 69);
    } else {
      lonh +=
        0.812 * sind(2 * Mj - 5 * Ms - 67.6) -
        0.229 * cosd(2 * Mj - 4 * Ms - 2) +
        0.119 * sind(Mj - 2 * Ms - 3) +
        0.046 * sind(2 * Mj - 6 * Ms - 69) +
        0.014 * sind(Mj - 3 * Ms + 32);
      lath += -0.02 * cosd(2 * Mj - 4 * Ms - 2) + 0.018 * sind(2 * Mj - 6 * Ms - 49);
    }
  }
  const xh = h.r * cosd(lath) * cosd(lonh);
  const yh = h.r * cosd(lath) * sind(lonh);
  const zh = h.r * sind(lath);
  const sun = sunGeocentric(d);
  const xg = xh + sun.r * cosd(sun.lon);
  const yg = yh + sun.r * sind(sun.lon);
  return { lon: norm360(atan2d(yg, xg)), lat: atan2d(zh, Math.hypot(xg, yg)) };
}

/** Lunar ascending node (Rahu), tropical longitude of date. Meeus ch. 47. */
export function lunarNode(jdTt: number, kind: "mean" | "true"): number {
  const T = (jdTt - J2000) / 36525;
  const omega = 125.0445479 - 1934.1362891 * T + 0.0020754 * T ** 2 + T ** 3 / 467441 - T ** 4 / 60616000;
  if (kind === "mean") return norm360(omega);
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T ** 2 + T ** 3 / 545868 - T ** 4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T ** 2 + T ** 3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T ** 2 + T ** 3 / 69699 - T ** 4 / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T ** 2 - T ** 3 / 3526000 + T ** 4 / 863310000;
  return norm360(
    omega - 1.4979 * sind(2 * (D - F)) - 0.15 * sind(M) - 0.1226 * sind(2 * D) + 0.1176 * sind(2 * F) - 0.0801 * sind(2 * (Mp - F)),
  );
}

/** Tropical longitude of date for any of the nine grahas. */
export function tropicalLongitude(planet: Planet, jdTt: number, nodeType: "mean" | "true"): number {
  switch (planet) {
    case "Sun":
      return sunPosition(jdTt).lon;
    case "Moon":
      return moonPosition(jdTt).lon;
    case "Rahu":
      return lunarNode(jdTt, nodeType);
    case "Ketu":
      return norm360(lunarNode(jdTt, nodeType) + 180);
    default:
      return planetPosition(planet, jdTt).lon;
  }
}

/** Mean obliquity of the ecliptic (IAU 1980), degrees. */
export function meanObliquity(jdTt: number): number {
  const T = (jdTt - J2000) / 36525;
  return 23.4392911 - (46.815 * T + 0.00059 * T ** 2 - 0.001813 * T ** 3) / 3600;
}

/** Greenwich mean sidereal time in degrees (Meeus 12.4), from JD (UT). */
export function gmstDegrees(jdUt: number): number {
  const T = (jdUt - J2000) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jdUt - J2000) + 0.000387933 * T ** 2 - T ** 3 / 38710000);
}
