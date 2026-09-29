// SPDX-License-Identifier: AGPL-3.0-or-later
// KP significators: four levels per house, and houses signified per planet.
import type { AnalysisConventions } from "@astro/schema/analysis";
import { PLANETS, type Planet } from "@astro/schema/enums";
import { SIGN_LORD, signIndex } from "../tables.ts";
import { angularDistance } from "../states.ts";
import { bhavaOf, cuspOwner, kpOwnedHouses } from "./cusps.ts";
import { kpLordsAt } from "./subs.ts";

export interface KpContext {
  conventions: AnalysisConventions;
  cusps: readonly number[];
  lon: Record<Planet, number>;
  retrograde: Record<Planet, boolean>;
  bhava: Record<Planet, number>;
  starLord: Record<Planet, Planet>;
  subLord: Record<Planet, Planet>;
}

/** Conjunction orb used when the "conjunctions count" convention is on. */
export const KP_CONJUNCTION_ORB = 10 / 3; // 3°20′

export function kpContext(
  planets: readonly { planet: Planet; lon: number; retrograde: boolean }[],
  cusps: readonly number[],
  conventions: AnalysisConventions,
): KpContext {
  const lon = {} as Record<Planet, number>;
  const retrograde = {} as Record<Planet, boolean>;
  const bhava = {} as Record<Planet, number>;
  const starLord = {} as Record<Planet, Planet>;
  const subLord = {} as Record<Planet, Planet>;
  for (const p of planets) {
    lon[p.planet] = p.lon;
    retrograde[p.planet] = p.retrograde;
    bhava[p.planet] = bhavaOf(p.lon, cusps);
    const l = kpLordsAt(p.lon);
    starLord[p.planet] = l.starLord;
    subLord[p.planet] = l.subLord;
  }
  return { conventions, cusps, lon, retrograde, bhava, starLord, subLord };
}

const sortPlanets = (xs: Iterable<Planet>): Planet[] => {
  const set = new Set(xs);
  return PLANETS.filter((p) => set.has(p));
};
const sortHouses = (xs: Iterable<number>): number[] => [...new Set(xs)].sort((a, b) => a - b);

const conjoined = (ctx: KpContext, p: Planet): Planet[] =>
  PLANETS.filter((q) => q !== p && angularDistance(ctx.lon[p], ctx.lon[q]) <= KP_CONJUNCTION_ORB);

/** Houses a planet occupies or owns, including the node rule (a node also acts for its sign lord). */
function ownSignification(ctx: KpContext, p: Planet): number[] {
  const houses = [ctx.bhava[p], ...kpOwnedHouses(p, ctx.cusps)];
  if (ctx.conventions.kpNodeRule && (p === "Rahu" || p === "Ketu")) {
    const dispositor = SIGN_LORD[signIndex(ctx.lon[p])] as Planet;
    houses.push(ctx.bhava[dispositor], ...kpOwnedHouses(dispositor, ctx.cusps));
  }
  return sortHouses(houses);
}

export interface HouseSignificators {
  house: number;
  a: Planet[];
  b: Planet[];
  c: Planet[];
  d: Planet[];
}

export function houseSignificators(ctx: KpContext): HouseSignificators[] {
  const out: HouseSignificators[] = [];
  for (let h = 1; h <= 12; h++) {
    const occupants = new Set(PLANETS.filter((p) => ctx.bhava[p] === h));
    const owner = cuspOwner(ctx.cusps, h);
    const owners = new Set<Planet>([owner]);
    if (ctx.conventions.kpSignificatorConjunctions) {
      for (const o of [...occupants]) for (const q of conjoined(ctx, o)) occupants.add(q);
      for (const q of conjoined(ctx, owner)) owners.add(q);
    }
    if (ctx.conventions.kpNodeRule) {
      for (const node of ["Rahu", "Ketu"] as const) {
        const dispositor = SIGN_LORD[signIndex(ctx.lon[node])] as Planet;
        if (ctx.bhava[dispositor] === h) occupants.add(node);
        if (dispositor === owner) owners.add(node);
      }
    }
    out.push({
      house: h,
      a: sortPlanets(PLANETS.filter((p) => occupants.has(ctx.starLord[p]))),
      b: sortPlanets(occupants),
      c: sortPlanets(PLANETS.filter((p) => owners.has(ctx.starLord[p]))),
      d: sortPlanets(owners),
    });
  }
  return out;
}

export interface PlanetSignifies {
  planet: Planet;
  houses: number[];
  viaStarLord: number[];
  viaSubLord: number[];
}

export function planetSignifies(ctx: KpContext, p: Planet): PlanetSignifies {
  const viaStarLord = ownSignification(ctx, ctx.starLord[p]);
  const viaSubLord = ownSignification(ctx, ctx.subLord[p]);
  return { planet: p, houses: sortHouses([...viaStarLord, ...ownSignification(ctx, p)]), viaStarLord, viaSubLord };
}
