// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Planet } from "@astro/schema/enums";
import { houseFrom, isKendra, signAt } from "../tables.ts";
import type { YogaContext, YogaDefinition } from "./types.ts";

/** Planets counted for Sunapha/Anapha/Durudhara/Kemadruma: the five tara grahas (no Sun, no nodes). */
const TARA: readonly Planet[] = ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const inSign = (ctx: YogaContext, s: number, from: readonly Planet[]): Planet[] => from.filter((p) => ctx.sign[p] === s);

const second = (ctx: YogaContext): Planet[] => inSign(ctx, signAt(ctx.sign.Moon, 2), TARA);
const twelfth = (ctx: YogaContext): Planet[] => inSign(ctx, signAt(ctx.sign.Moon, 12), TARA);

export const LUNAR: readonly YogaDefinition[] = [
  {
    id: "gajakesari",
    family: "lunar",
    definition: "Gajakesari: Jupiter in a kendra (1, 4, 7, 10) from the Moon.",
    sourceNote: "BPHS ch. 36; Phaladeepika ch. 6.",
    variant: "basic (no strength or aspect conditions)",
    detect: (ctx) => (isKendra(houseFrom(ctx.sign.Moon, ctx.sign.Jupiter)) ? [{ planets: ["Jupiter", "Moon"] }] : []),
  },
  {
    id: "sunapha",
    family: "lunar",
    definition: "Sunapha: one or more of Mars, Mercury, Jupiter, Venus, Saturn in the 2nd from the Moon, none in the 12th.",
    sourceNote: "BPHS ch. 37; Saravali ch. 13.",
    variant: "tara grahas only; superseded by Durudhara when the 12th is also occupied",
    detect: (ctx) => {
      const s = second(ctx);
      return s.length > 0 && twelfth(ctx).length === 0 ? [{ planets: ["Moon", ...s] }] : [];
    },
  },
  {
    id: "anapha",
    family: "lunar",
    definition: "Anapha: one or more of Mars, Mercury, Jupiter, Venus, Saturn in the 12th from the Moon, none in the 2nd.",
    sourceNote: "BPHS ch. 37; Saravali ch. 13.",
    variant: "tara grahas only; superseded by Durudhara when the 2nd is also occupied",
    detect: (ctx) => {
      const t = twelfth(ctx);
      return t.length > 0 && second(ctx).length === 0 ? [{ planets: ["Moon", ...t] }] : [];
    },
  },
  {
    id: "durudhara",
    family: "lunar",
    definition: "Durudhara: tara grahas in both the 2nd and the 12th from the Moon.",
    sourceNote: "BPHS ch. 37; Saravali ch. 13.",
    variant: "tara grahas only",
    detect: (ctx) => {
      const s = second(ctx);
      const t = twelfth(ctx);
      return s.length > 0 && t.length > 0 ? [{ planets: ["Moon", ...s, ...t] }] : [];
    },
  },
  {
    id: "kemadruma",
    family: "lunar",
    definition: "Kemadruma: no tara graha in the 2nd or 12th from the Moon. Marked cancelled when any planet other than the Moon occupies a kendra from the lagna or from the Moon.",
    sourceNote: "BPHS ch. 37; cancellation per Phaladeepika ch. 6.",
    variant: "cancellation: kendra from lagna or Moon (Sun and nodes count for cancellation)",
    detect: (ctx) => {
      if (second(ctx).length > 0 || twelfth(ctx).length > 0) return [];
      const others: Planet[] = ["Sun", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
      const cancelled = others.some((p) => isKendra(ctx.house[p]) || isKendra(houseFrom(ctx.sign.Moon, ctx.sign[p])));
      return [{ planets: ["Moon"], ...(cancelled ? { modifiers: ["cancelled" as const] } : {}) }];
    },
  },
  {
    id: "chandra-mangala",
    family: "lunar",
    definition: "Chandra-Mangala: the Moon and Mars in the same sign or in mutual 7th.",
    sourceNote: "Phaladeepika ch. 6; Saravali.",
    variant: "conjunction or mutual 7th aspect",
    detect: (ctx) => {
      const h = houseFrom(ctx.sign.Moon, ctx.sign.Mars);
      return h === 1 || h === 7 ? [{ planets: ["Moon", "Mars"] }] : [];
    },
  },
  {
    id: "adhi",
    family: "lunar",
    definition: "Adhi: at least two of Mercury, Jupiter, Venus in the 6th, 7th or 8th from the Moon, with no Sun, Mars or Saturn there.",
    sourceNote: "BPHS ch. 37; Phaladeepika ch. 6 (texts differ on how many benefics are required).",
    variant: "adhi-2-of-3, no malefic in 6/7/8 from Moon",
    detect: (ctx) => {
      const in678 = (p: Planet): boolean => {
        const h = houseFrom(ctx.sign.Moon, ctx.sign[p]);
        return h >= 6 && h <= 8;
      };
      const benefics = (["Mercury", "Jupiter", "Venus"] as Planet[]).filter(in678);
      const malefics = (["Sun", "Mars", "Saturn"] as Planet[]).filter(in678);
      return benefics.length >= 2 && malefics.length === 0 ? [{ planets: ["Moon", ...benefics] }] : [];
    },
  },
];
