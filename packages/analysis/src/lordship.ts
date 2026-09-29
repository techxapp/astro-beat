// SPDX-License-Identifier: AGPL-3.0-or-later
// House lords, exchanges, functional roles by lagna, badhaka, maraka (local only).
import type { FunctionalRole } from "@astro/schema/analysis";
import type { MarakaFact } from "@astro/schema/local";
import { GRAHAS, type Graha, type Planet } from "@astro/schema/enums";
import { occupantsOfHouse, type NatalContext } from "./context.ts";
import { houseFrom, isDusthana, NATURAL_BENEFICS, ownedHouses, SIGN_LORD, signAt } from "./tables.ts";

export const lordOfHouse = (lagnaSign: number, h: number): Graha => SIGN_LORD[signAt(lagnaSign, h)] as Graha;

export interface Exchange {
  planets: [Planet, Planet];
  houses: [number, number];
  type: "maha" | "khala" | "dainya";
}

/** Parivartana: A in a sign of B while B is in a sign of A. */
export function exchanges(ctx: NatalContext): Exchange[] {
  const out: Exchange[] = [];
  for (let i = 0; i < GRAHAS.length; i++) {
    for (let j = i + 1; j < GRAHAS.length; j++) {
      const a = GRAHAS[i] as Graha;
      const b = GRAHAS[j] as Graha;
      if (SIGN_LORD[ctx.sign[a]] === b && SIGN_LORD[ctx.sign[b]] === a) {
        const houses: [number, number] = [ctx.house[a], ctx.house[b]];
        const type = houses.some(isDusthana) ? "dainya" : houses.includes(3) ? "khala" : "maha";
        out.push({ planets: [a, b], houses, type });
      }
    }
  }
  return out;
}

/**
 * Functional nature by lagna (simplified BPHS ch. 34 scoring):
 *   trikona (1, 5, 9) +2; kendra (4, 7, 10) 0 for natural benefics (kendradhipati dosha), +1 for malefics;
 *   3, 6, 11 −2; 8 −2 (not for the lagna lord, Sun or Moon); 2, 12 neutral.
 *   Owning a kendra (4/7/10) and a trikona (5/9) → yogakaraka. Score ≥ 2 benefic, ≤ −1 malefic.
 */
export function functionalRole(p: Graha, lagnaSign: number): Exclude<FunctionalRole, "badhaka"> {
  const houses = ownedHouses(p, lagnaSign);
  const ownsKendra = houses.some((h) => h === 4 || h === 7 || h === 10);
  const ownsTrikona = houses.some((h) => h === 5 || h === 9);
  if (ownsKendra && ownsTrikona) return "yogakaraka";
  const benefic = NATURAL_BENEFICS.includes(p);
  let score = 0;
  for (const h of houses) {
    if (h === 1 || h === 5 || h === 9) score += 2;
    else if (h === 4 || h === 7 || h === 10) score += benefic ? 0 : 1;
    else if (h === 3 || h === 6 || h === 11) score -= 2;
    else if (h === 8 && !houses.includes(1) && p !== "Sun" && p !== "Moon") score -= 2;
  }
  if (score >= 2) return "benefic";
  if (score <= -1) return "malefic";
  return "neutral";
}

/** Badhaka lord: 11th for movable lagnas, 9th for fixed, 7th for dual. */
export function badhakaLord(lagnaSign: number): Graha {
  const m = lagnaSign % 3; // 0 movable, 1 fixed, 2 dual
  return lordOfHouse(lagnaSign, m === 0 ? 11 : m === 1 ? 9 : 7);
}

/** Maraka indicators. Explorer only; never part of any payload. */
export function marakaFacts(ctx: NatalContext): MarakaFact[] {
  const out: MarakaFact[] = [
    { planet: lordOfHouse(ctx.lagnaSign, 2), reason: "lord-of-2" },
    { planet: lordOfHouse(ctx.lagnaSign, 7), reason: "lord-of-7" },
  ];
  for (const p of occupantsOfHouse(ctx, 2)) out.push({ planet: p, reason: "in-2" });
  for (const p of occupantsOfHouse(ctx, 7)) out.push({ planet: p, reason: "in-7" });
  return out;
}

export { houseFrom };
