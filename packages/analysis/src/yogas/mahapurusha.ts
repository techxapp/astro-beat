// SPDX-License-Identifier: AGPL-3.0-or-later
import type { YogaId } from "@astro/schema/analysis";
import type { Graha } from "@astro/schema/enums";
import { EXALTATION, isKendra, OWN_SIGNS } from "../tables.ts";
import type { YogaDefinition } from "./types.ts";

const make = (id: YogaId, planet: Graha, name: string): YogaDefinition => ({
  id,
  family: "mahapurusha",
  definition: `${name}: ${planet} in a kendra (1, 4, 7, 10) from the lagna, in its own or exaltation sign.`,
  sourceNote: "BPHS ch. 75 (Pancha Mahapurusha Yoga); Phaladeepika ch. 6.",
  variant: "kendra-from-lagna-only (some authors also count kendras from the Moon)",
  detect: (ctx) => {
    const s = ctx.sign[planet];
    const dignified = s === EXALTATION[planet] || OWN_SIGNS[planet].includes(s);
    return dignified && isKendra(ctx.house[planet]) ? [{ planets: [planet] }] : [];
  },
});

export const MAHAPURUSHA: readonly YogaDefinition[] = [
  make("ruchaka", "Mars", "Ruchaka"),
  make("bhadra", "Mercury", "Bhadra"),
  make("hamsa", "Jupiter", "Hamsa"),
  make("malavya", "Venus", "Malavya"),
  make("sasa", "Saturn", "Sasa"),
];
