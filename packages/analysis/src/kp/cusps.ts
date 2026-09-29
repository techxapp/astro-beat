// SPDX-License-Identifier: AGPL-3.0-or-later
// Placidus bhava occupancy and cusp ownership.
import type { Planet } from "@astro/schema/enums";
import { SIGN_LORD, signIndex } from "../tables.ts";

/** Bhava (1..12) containing a longitude, by Placidus cusp spans [cusp n, cusp n+1). */
export function bhavaOf(lon: number, cusps: readonly number[]): number {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i] as number;
    const b = cusps[(i + 1) % 12] as number;
    const span = (b - a + 360) % 360;
    const off = (lon - a + 360) % 360;
    if (off < span) return i + 1;
  }
  return 12; // unreachable for well-formed cusps
}

/** KP house owner: the lord of the sign on the cusp. */
export const cuspOwner = (cusps: readonly number[], house: number): Planet => SIGN_LORD[signIndex(cusps[house - 1] as number)] as Planet;

/** Houses (1..12) whose cusp sign a planet rules. */
export function kpOwnedHouses(p: Planet, cusps: readonly number[]): number[] {
  const out: number[] = [];
  for (let h = 1; h <= 12; h++) if (cuspOwner(cusps, h) === p) out.push(h);
  return out;
}
