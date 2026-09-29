// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_CONVENTIONS, type AnalysisConventions } from "@astro/schema/analysis";
import type { SystemChart } from "@astro/schema/chart";
import { PLANETS, type Planet } from "@astro/schema/enums";
import { natalContext } from "../src/context.ts";
import { buildYogaContext } from "../src/parashari.ts";
import type { YogaContext } from "../src/yogas/types.ts";

/** Default placement spreads planets over signs so that nothing is accidentally conjunct. */
const DEFAULT_LON: Record<Planet, number> = {
  Sun: 15, Moon: 45, Mars: 75, Mercury: 25, Jupiter: 135, Venus: 165, Saturn: 195, Rahu: 285, Ketu: 105,
};

export function systemChart(asc: number, lons: Partial<Record<Planet, number>> = {}, retro: Planet[] = []): SystemChart {
  const merged = { ...DEFAULT_LON, ...lons };
  if (lons.Rahu !== undefined && lons.Ketu === undefined) merged.Ketu = (lons.Rahu + 180) % 360;
  return {
    ascendantLon: asc,
    planets: PLANETS.map((planet) => ({ planet, lon: merged[planet], speed: retro.includes(planet) ? -0.1 : 1, retrograde: retro.includes(planet) })),
    dasha: { yearLength: "365.25", periods: [] },
  };
}

export function yogaCtx(asc: number, lons: Partial<Record<Planet, number>> = {}, conv: Partial<AnalysisConventions> = {}): YogaContext {
  return buildYogaContext(natalContext(systemChart(asc, lons), { ...DEFAULT_CONVENTIONS, ...conv }));
}

/** Longitude at `deg` degrees into sign index `sign` (Aries = 0). */
export const at = (sign: number, deg = 15): number => sign * 30 + deg;
