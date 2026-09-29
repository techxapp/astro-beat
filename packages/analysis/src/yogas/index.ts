// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FactOf, YogaModifier } from "@astro/schema/analysis";
import type { Planet } from "@astro/schema/enums";
import { isDusthana, isKendra } from "../tables.ts";
import { LUNAR } from "./lunar.ts";
import { MAHAPURUSHA } from "./mahapurusha.ts";
import { CANCELLATION, DHANA, PARIVARTANA, RAJA, SOLAR, VIPARITA } from "./others.ts";
import type { YogaContext, YogaDefinition } from "./types.ts";

export type { YogaContext, YogaDefinition, YogaHit } from "./types.ts";

export const YOGA_CATALOG: readonly YogaDefinition[] = [
  ...MAHAPURUSHA, ...LUNAR, ...SOLAR, ...RAJA, ...DHANA, ...VIPARITA, ...CANCELLATION, ...PARIVARTANA,
];

export const yogaDefinition = (id: string): YogaDefinition | undefined => YOGA_CATALOG.find((y) => y.id === id);

const ORDER: readonly YogaModifier[] = [
  "participant-exalted", "participant-debilitated", "participant-combust", "involves-dusthana", "cancelled", "in-kendra",
];

/** Run every detector; returns yoga facts without ids. */
export function detectYogas(ctx: YogaContext): Omit<FactOf<"yoga">, "id">[] {
  const out: Omit<FactOf<"yoga">, "id">[] = [];
  for (const def of YOGA_CATALOG) {
    for (const hit of def.detect(ctx)) {
      const planets = [...new Set(hit.planets)] as Planet[];
      const houses = [...new Set(planets.map((p) => ctx.house[p]))].sort((a, b) => a - b);
      const mods = new Set<YogaModifier>(hit.modifiers ?? []);
      if (planets.some((p) => ctx.dignity[p] === "exalted")) mods.add("participant-exalted");
      if (planets.some((p) => ctx.dignity[p] === "debilitated")) mods.add("participant-debilitated");
      if (planets.some((p) => ctx.combust[p])) mods.add("participant-combust");
      if (houses.some(isDusthana)) mods.add("involves-dusthana");
      if (houses.some(isKendra)) mods.add("in-kendra");
      out.push({ kind: "yoga", yoga: def.id, planets, houses, modifiers: ORDER.filter((m) => mods.has(m)) });
    }
  }
  return out;
}
