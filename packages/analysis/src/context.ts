// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AnalysisConventions } from "@astro/schema/analysis";
import type { PlanetPos, SystemChart } from "@astro/schema/chart";
import { PLANETS, type Planet } from "@astro/schema/enums";
import { houseFrom, signIndex } from "./tables.ts";

/** Whole-sign natal context derived from a system chart. */
export interface NatalContext {
  conventions: AnalysisConventions;
  lagnaSign: number;
  ascendantLon: number;
  pos: Record<Planet, PlanetPos>;
  lon: Record<Planet, number>;
  sign: Record<Planet, number>;
  /** whole-sign house from lagna, 1..12 */
  house: Record<Planet, number>;
  /** planets by sign index */
  occupants: Planet[][];
}

export function natalContext(chart: SystemChart, conventions: AnalysisConventions): NatalContext {
  const pos = {} as Record<Planet, PlanetPos>;
  for (const p of chart.planets) pos[p.planet] = p;
  for (const p of PLANETS) if (!pos[p]) throw new Error(`chart is missing ${p}`);
  const lagnaSign = signIndex(chart.ascendantLon);
  const lon = {} as Record<Planet, number>;
  const sign = {} as Record<Planet, number>;
  const house = {} as Record<Planet, number>;
  const occupants: Planet[][] = Array.from({ length: 12 }, () => []);
  for (const p of PLANETS) {
    lon[p] = pos[p].lon;
    sign[p] = signIndex(pos[p].lon);
    house[p] = houseFrom(lagnaSign, sign[p]);
    (occupants[sign[p]] as Planet[]).push(p);
  }
  return { conventions, lagnaSign, ascendantLon: chart.ascendantLon, pos, lon, sign, house, occupants };
}

/** Planets in the sign that is house `h` from lagna. */
export const occupantsOfHouse = (ctx: NatalContext, h: number): Planet[] =>
  ctx.occupants[(ctx.lagnaSign + h - 1) % 12] as Planet[];
