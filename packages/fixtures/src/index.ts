// SPDX-License-Identifier: AGPL-3.0-or-later
// Golden and sentinel inputs. All births here are synthetic (no real people).
import type { BirthInput } from "@astro/schema/identifying";

/** Sentinel inputs for canary / no-leak tests: distinctive values that must never appear in a request. */
export const SENTINELS: readonly BirthInput[] = [
  {
    name: "Zyxwv Canary", localDate: "1987-03-21", localTime: "14:05", timeAccuracy: "exact",
    place: { label: "Pune, Maharashtra, IN", lat: 18.5204, lon: 73.8567 },
    timezone: { iana: "Asia/Kolkata", utcOffsetMinutes: 330, overridden: false },
    notes: "canary-note-qwerty",
  },
  {
    name: "Qqq Sentinel", localDate: "2001-11-09", localTime: "23:47:12", timeAccuracy: "approx",
    place: { label: "Reykjavík, IS", lat: 64.1466, lon: -21.9426 },
    timezone: { iana: "Atlantic/Reykjavik", utcOffsetMinutes: 0, overridden: false },
  },
];

/** Deterministic PRNG (mulberry32) so the golden set is stable across runs. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACES = [
  { label: "Delhi", lat: 28.65, lon: 77.23, iana: "Asia/Kolkata", off: 330 },
  { label: "Chennai", lat: 13.08, lon: 80.27, iana: "Asia/Kolkata", off: 330 },
  { label: "London", lat: 51.51, lon: -0.13, iana: "Europe/London", off: 0 },
  { label: "New York", lat: 40.71, lon: -74.01, iana: "America/New_York", off: -300 },
  { label: "Sydney", lat: -33.87, lon: 151.21, iana: "Australia/Sydney", off: 600 },
  { label: "São Paulo", lat: -23.55, lon: -46.63, iana: "America/Sao_Paulo", off: -180 },
  { label: "Nairobi", lat: -1.29, lon: 36.82, iana: "Africa/Nairobi", off: 180 },
  { label: "Tokyo", lat: 35.69, lon: 139.69, iana: "Asia/Tokyo", off: 540 },
  { label: "Tromsø", lat: 69.65, lon: 18.96, iana: "Europe/Oslo", off: 60 }, // Placidus undefined → kp null
];

/**
 * ~30 synthetic golden births (fixed standard-time offsets, no DST). Expected values from a
 * reference tool go in golden/expected/<id>.json (pending the choice of tool, Q4b).
 */
export const GOLDEN: readonly { id: string; birth: BirthInput }[] = (() => {
  const rnd = mulberry32(20260929);
  const out: { id: string; birth: BirthInput }[] = [];
  for (let i = 0; i < 30; i++) {
    const p = PLACES[i % PLACES.length] as (typeof PLACES)[number];
    const year = 1930 + Math.floor(rnd() * 90);
    const month = 1 + Math.floor(rnd() * 12);
    const day = 1 + Math.floor(rnd() * 28);
    const minutes = Math.floor(rnd() * 1440);
    const pad = (n: number) => String(n).padStart(2, "0");
    out.push({
      id: `g${pad(i + 1)}`,
      birth: {
        localDate: `${year}-${pad(month)}-${pad(day)}`,
        localTime: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
        timeAccuracy: "exact",
        place: { label: p.label, lat: p.lat, lon: p.lon },
        timezone: { iana: p.iana, utcOffsetMinutes: p.off, overridden: true },
      },
    });
  }
  return out;
})();

export { invertPayload, type InversionResult } from "./inversion.ts";
