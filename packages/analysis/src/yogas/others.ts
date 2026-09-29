// SPDX-License-Identifier: AGPL-3.0-or-later
// Solar, raja, dhana, viparita, neecha-bhanga and parivartana yogas.
import type { Planet } from "@astro/schema/enums";
import { EXALTATION, houseFrom, isDusthana, isGraha, isKendra, SIGN_LORD } from "../tables.ts";
import type { YogaContext, YogaDefinition, YogaHit } from "./types.ts";

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];

/** Distinct associated pairs drawn from two sets of planets. */
function associatedPairs(ctx: YogaContext, as: Planet[], bs: Planet[], accept: (a: Planet, b: Planet) => boolean): YogaHit[] {
  const seen = new Set<string>();
  const out: YogaHit[] = [];
  for (const a of uniq(as)) {
    for (const b of uniq(bs)) {
      if (a === b || !accept(a, b)) continue;
      const key = [a, b].sort().join("|");
      if (seen.has(key) || !ctx.associated(a, b)) continue;
      seen.add(key);
      out.push({ planets: [a, b].sort() as Planet[] });
    }
  }
  return out;
}

export const SOLAR: readonly YogaDefinition[] = [
  {
    id: "budha-aditya",
    family: "solar",
    definition: "Budha-Aditya: the Sun and Mercury in the same sign.",
    sourceNote: "Popular yoga; described in Jataka Parijata. Combust Mercury is flagged via modifiers.",
    variant: "same sign, no orb condition",
    detect: (ctx) => (ctx.sign.Sun === ctx.sign.Mercury ? [{ planets: ["Sun", "Mercury"] }] : []),
  },
];

export const RAJA: readonly YogaDefinition[] = [
  {
    id: "raja-kendra-trikona",
    family: "raja",
    definition: "Raja (kendra–trikona): a lord of a kendra (1, 4, 7, 10) associated with a lord of a trikona (1, 5, 9) by conjunction, mutual aspect or exchange; a single planet owning both a kendra (4, 7, 10) and a trikona (5, 9) counts on its own.",
    sourceNote: "BPHS ch. 39 (Raja Yoga).",
    variant: "association = same sign, mutual graha drishti or parivartana; yogakaraka counts alone",
    detect: (ctx) => {
      const kendraLords = [1, 4, 7, 10].map(ctx.lord);
      const trikonaLords = [1, 5, 9].map(ctx.lord);
      const hits = associatedPairs(ctx, kendraLords, trikonaLords, () => true);
      for (const p of uniq(kendraLords)) {
        const owns = ctx.owns(p);
        if (owns.some((h) => h === 4 || h === 7 || h === 10) && owns.some((h) => h === 5 || h === 9)) hits.push({ planets: [p] });
      }
      return hits;
    },
  },
];

export const DHANA: readonly YogaDefinition[] = [
  {
    id: "dhana",
    family: "dhana",
    definition: "Dhana: association (conjunction, mutual aspect or exchange) between a lord of 2 or 11 and a lord of 1, 5 or 9 (or between the lords of 2 and 11).",
    sourceNote: "BPHS ch. 41 (Dhana Yoga).",
    variant: "pairs among lords of 1, 2, 5, 9, 11 including at least one of 2/11",
    detect: (ctx) => {
      const wealth = [2, 11].map(ctx.lord);
      const support = [1, 2, 5, 9, 11].map(ctx.lord);
      return associatedPairs(ctx, wealth, support, () => true);
    },
  },
];

const viparita = (id: "viparita-harsha" | "viparita-sarala" | "viparita-vimala", house: 6 | 8 | 12, name: string): YogaDefinition => ({
  id,
  family: "viparita",
  definition: `${name}: the lord of the ${house}th house placed in the 6th, 8th or 12th house.`,
  sourceNote: "Uttara Kalamrita; Phaladeepika ch. 6 (Viparita Raja Yoga).",
  variant: "placement only (no condition on association with other dusthana lords)",
  detect: (ctx) => {
    const l = ctx.lord(house);
    return isDusthana(ctx.house[l]) ? [{ planets: [l] }] : [];
  },
});

export const VIPARITA: readonly YogaDefinition[] = [
  viparita("viparita-harsha", 6, "Harsha"),
  viparita("viparita-sarala", 8, "Sarala"),
  viparita("viparita-vimala", 12, "Vimala"),
];

export const CANCELLATION: readonly YogaDefinition[] = [
  {
    id: "neecha-bhanga",
    family: "cancellation",
    definition: "Neecha-bhanga: a debilitated planet whose debilitation-sign lord, or the planet exalted in that sign, occupies a kendra from the lagna (or from the Moon, per setting).",
    sourceNote: "BPHS ch. 28; Phaladeepika ch. 7 lists further conditions not implemented here.",
    variant: "dispositor-or-exaltation-lord in kendra (setting: from lagna, or from lagna or Moon)",
    detect: (ctx) => {
      const out: YogaHit[] = [];
      for (const p of ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const) {
        if (ctx.dignity[p] !== "debilitated") continue;
        const debSign = ctx.sign[p];
        const dispositor = SIGN_LORD[debSign] as Planet;
        const exaltedThere = (Object.keys(EXALTATION) as (keyof typeof EXALTATION)[]).find((g) => EXALTATION[g] === debSign);
        const candidates = uniq([dispositor, ...(exaltedThere ? [exaltedThere] : [])]).filter((c) => c !== p);
        const fromMoon = ctx.conventions.neechaBhanga === "kendra-from-lagna-or-moon";
        const cancellers = candidates.filter((c) => isKendra(ctx.house[c]) || (fromMoon && isKendra(houseFrom(ctx.sign.Moon, ctx.sign[c]))));
        if (cancellers.length > 0) out.push({ planets: [p, ...cancellers] });
      }
      return out;
    },
  },
];

export const PARIVARTANA: readonly YogaDefinition[] = [
  {
    id: "parivartana",
    family: "parivartana",
    definition: "Parivartana: two planets each in a sign owned by the other (see the exchange facts for maha / khala / dainya).",
    sourceNote: "Phaladeepika ch. 6.",
    variant: "all exchanges between the seven grahas",
    detect: (ctx) => {
      const out: YogaHit[] = [];
      const gs = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;
      for (let i = 0; i < gs.length; i++) {
        for (let j = i + 1; j < gs.length; j++) {
          const a = gs[i] as Planet;
          const b = gs[j] as Planet;
          if (isGraha(a) && isGraha(b) && SIGN_LORD[ctx.sign[a]] === b && SIGN_LORD[ctx.sign[b]] === a) out.push({ planets: [a, b] });
        }
      }
      return out;
    },
  },
];
