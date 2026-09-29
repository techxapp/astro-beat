// SPDX-License-Identifier: AGPL-3.0-or-later
// Ayanamsas: a fixed value at an epoch, carried forward with general precession in longitude
// (Lieske 1977). Epoch values follow the Swiss Ephemeris sidereal-mode table.
import { J2000 } from "./time.ts";

export type AyanamsaId = "lahiri" | "raman" | "kp-old" | "kp-new";

const EPOCHS: Record<Exclude<AyanamsaId, "kp-new">, { jd: number; value: number }> = {
  // SE_SIDM_LAHIRI: 23°15'00.658" (minus the IAE nutation correction) at 1956-03-21
  lahiri: { jd: 2435553.5, value: 23.250182778 - 0.004658035 },
  // SE_SIDM_RAMAN
  raman: { jd: 2415020.0, value: 21.01444 },
  // SE_SIDM_KRISHNAMURTI (the classic "KP old" ayanamsa)
  "kp-old": { jd: 2415020.0, value: 22.363889 },
};

/** General precession in longitude since J2000, arcseconds. */
function precessionArcsec(jdTt: number): number {
  const T = (jdTt - J2000) / 36525;
  return 5029.0966 * T + 1.11113 * T * T - 0.000006 * T * T * T;
}

export class UnsupportedAyanamsaError extends Error {
  constructor(id: string) {
    super(`Ayanamsa "${id}" is not available in the reference engine; it needs the Swiss Ephemeris adapter.`);
    this.name = "UnsupportedAyanamsaError";
  }
}

export function ayanamsa(id: AyanamsaId, jdTt: number): number {
  if (id === "kp-new") throw new UnsupportedAyanamsaError(id);
  const e = EPOCHS[id];
  return e.value + (precessionArcsec(jdTt) - precessionArcsec(e.jd)) / 3600;
}
