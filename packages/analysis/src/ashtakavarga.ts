// SPDX-License-Identifier: AGPL-3.0-or-later
// Bhinnashtakavarga / Sarvashtakavarga (BPHS ch. 66–69). Totals: Sun 48, Moon 49, Mars 39,
// Mercury 54, Jupiter 56, Venus 52, Saturn 39; SAV 337.
import { GRAHAS, type Graha } from "@astro/schema/enums";
import type { NatalContext } from "./context.ts";
import { houseFrom } from "./tables.ts";

type Contributor = Graha | "Lagna";
const CONTRIBUTORS: readonly Contributor[] = [...GRAHAS, "Lagna"];

/** For each BAV owner, the houses (counted from each contributor) that receive a bindu. */
export const BAV_TABLE: Readonly<Record<Graha, Readonly<Record<Contributor, readonly number[]>>>> = {
  Sun: {
    Sun: [1, 2, 4, 7, 8, 9, 10, 11], Moon: [3, 6, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11], Mercury: [3, 5, 6, 9, 10, 11, 12],
    Jupiter: [5, 6, 9, 11], Venus: [6, 7, 12], Saturn: [1, 2, 4, 7, 8, 9, 10, 11], Lagna: [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun: [3, 6, 7, 8, 10, 11], Moon: [1, 3, 6, 7, 10, 11], Mars: [2, 3, 5, 6, 9, 10, 11], Mercury: [1, 3, 4, 5, 7, 8, 10, 11],
    Jupiter: [1, 4, 7, 8, 10, 11, 12], Venus: [3, 4, 5, 7, 9, 10, 11], Saturn: [3, 5, 6, 11], Lagna: [3, 6, 10, 11],
  },
  Mars: {
    Sun: [3, 5, 6, 10, 11], Moon: [3, 6, 11], Mars: [1, 2, 4, 7, 8, 10, 11], Mercury: [3, 5, 6, 11],
    Jupiter: [6, 10, 11, 12], Venus: [6, 8, 11, 12], Saturn: [1, 4, 7, 8, 9, 10, 11], Lagna: [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun: [5, 6, 9, 11, 12], Moon: [2, 4, 6, 8, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11], Mercury: [1, 3, 5, 6, 9, 10, 11, 12],
    Jupiter: [6, 8, 11, 12], Venus: [1, 2, 3, 4, 5, 8, 9, 11], Saturn: [1, 2, 4, 7, 8, 9, 10, 11], Lagna: [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11], Moon: [2, 5, 7, 9, 11], Mars: [1, 2, 4, 7, 8, 10, 11], Mercury: [1, 2, 4, 5, 6, 9, 10, 11],
    Jupiter: [1, 2, 3, 4, 7, 8, 10, 11], Venus: [2, 5, 6, 9, 10, 11], Saturn: [3, 5, 6, 12], Lagna: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun: [8, 11, 12], Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12], Mars: [3, 5, 6, 9, 11, 12], Mercury: [3, 5, 6, 9, 11],
    Jupiter: [5, 8, 9, 10, 11], Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11], Saturn: [3, 4, 5, 8, 9, 10, 11], Lagna: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun: [1, 2, 4, 7, 8, 10, 11], Moon: [3, 6, 11], Mars: [3, 5, 6, 10, 11, 12], Mercury: [6, 8, 9, 10, 11, 12],
    Jupiter: [5, 6, 11, 12], Venus: [6, 11, 12], Saturn: [3, 5, 6, 11], Lagna: [1, 3, 4, 6, 10, 11],
  },
};

/** BAV per owner, indexed by sign (0 = Aries). */
export function bhinnashtakavarga(ctx: NatalContext): Record<Graha, number[]> {
  const out = {} as Record<Graha, number[]>;
  for (const owner of GRAHAS) {
    const bindus = new Array<number>(12).fill(0);
    for (const c of CONTRIBUTORS) {
      const from = c === "Lagna" ? ctx.lagnaSign : ctx.sign[c];
      for (let s = 0; s < 12; s++) {
        if (BAV_TABLE[owner][c].includes(houseFrom(from, s))) bindus[s] = (bindus[s] as number) + 1;
      }
    }
    out[owner] = bindus;
  }
  return out;
}

/** SAV indexed by sign (0 = Aries). */
export function sarvashtakavarga(ctx: NatalContext): number[] {
  const bav = bhinnashtakavarga(ctx);
  return Array.from({ length: 12 }, (_, s) => GRAHAS.reduce((sum, g) => sum + (bav[g][s] as number), 0));
}
