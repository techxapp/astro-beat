// SPDX-License-Identifier: AGPL-3.0-or-later
// KP analysis: cusp and planet lords, bhava occupancy, significators, KP Vimshottari periods.
import type { AnalysisConventions, KpAnalysis, KpFact } from "@astro/schema/analysis";
import type { Chart } from "@astro/schema/chart";
import { PLANETS, type IsoDate, type Planet } from "@astro/schema/enums";
import type { PeriodDates } from "@astro/schema/local";
import type { FactIds } from "../parashari.ts";
import { buildPeriods } from "../periods.ts";
import { houseFrom, nakshatraName, padaOf, SIGN_LORD, signIndex, signName } from "../tables.ts";
import { transitEvents, transitTimeline } from "../transits.ts";
import { bhavaOf } from "./cusps.ts";
import { houseSignificators, kpContext, planetSignifies, type KpContext } from "./significators.ts";
import { kpLordsAt } from "./subs.ts";

export * from "./subs.ts";
export * from "./cusps.ts";
export * from "./significators.ts";

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

export interface KpResult {
  analysis: KpAnalysis;
  periodDates: PeriodDates;
  nextLabel: number;
  ctx: KpContext;
}

export function analyzeKp(
  chart: Chart, conventions: AnalysisConventions, asOf: IsoDate, ids: FactIds, labelStart: number,
): KpResult | null {
  const cusps = chart.kp.cusps;
  if (!cusps) return null;
  const ctx = kpContext(chart.kp.planets, cusps, conventions);
  const facts: KpFact[] = [];
  const add = (f: WithoutId<KpFact>): void => {
    facts.push({ id: ids.next(), ...f } as KpFact);
  };

  cusps.forEach((c, i) => {
    const l = kpLordsAt(c);
    add({ kind: "kpCusp", cusp: i + 1, sign: l.sign, signLord: l.signLord, starLord: l.starLord, subLord: l.subLord, subSubLord: l.subSubLord });
  });
  for (const p of PLANETS) {
    const l = kpLordsAt(ctx.lon[p]);
    add({
      kind: "kpPlanet", planet: p, sign: l.sign, bhava: ctx.bhava[p], retrograde: ctx.retrograde[p],
      signLord: l.signLord, starLord: l.starLord, subLord: l.subLord, subSubLord: l.subSubLord,
    });
  }
  for (const s of houseSignificators(ctx)) add({ kind: "kpSignificators", ...s });
  const signifies = new Map<Planet, number[]>();
  for (const p of PLANETS) {
    const s = planetSignifies(ctx, p);
    signifies.set(p, s.houses);
    add({ kind: "kpPlanetSignifies", ...s });
  }

  const moon = chart.kp.planets.find((p) => p.planet === "Moon")!;
  const moonSign = signIndex(moon.lon);
  const birthDate = chart.kp.dasha.periods[0]?.start ?? asOf;
  const timeline = transitTimeline(chart, birthDate);
  const frame = { houseFromLagna: (s: number) => bhavaOf(s * 30 + 15, cusps), moonSign };
  const { periods, dates, nextLabel } = buildPeriods(chart.kp.dasha.periods, asOf, labelStart, {
    activatedHouses: (lords) => [...new Set(lords.flatMap((l) => signifies.get(l) ?? []))].sort((a, b) => a - b),
    factRefs: (lords) => kpFactRefs(facts, lords),
    transits: (level, start, end) => (level === "MD" ? [] : transitEvents(timeline, start, end, frame)),
  });

  const lagnaSign = signIndex(cusps[0] as number);
  return {
    analysis: {
      lagna: { sign: signName(lagnaSign), lord: SIGN_LORD[lagnaSign] as Planet },
      moon: { sign: signName(moonSign), nakshatra: nakshatraName(moon.lon), pada: padaOf(moon.lon) },
      facts,
      periods,
    },
    periodDates: dates,
    nextLabel,
    ctx,
  };
}

const KP_PRIORITY: Record<KpFact["kind"], number> = { kpPlanet: 0, kpPlanetSignifies: 1, kpCusp: 2, kpSignificators: 3 };

export function kpFactRefs(facts: readonly KpFact[], lords: readonly Planet[]): string[] {
  const has = (p: Planet): boolean => lords.includes(p);
  return facts
    .filter((f) => {
      switch (f.kind) {
        case "kpPlanet": case "kpPlanetSignifies": return has(f.planet);
        case "kpCusp": return has(f.subLord);
        case "kpSignificators": return f.a.some(has) || f.b.some(has);
      }
    })
    .sort((a, b) => KP_PRIORITY[a.kind] - KP_PRIORITY[b.kind])
    .slice(0, 40)
    .map((f) => f.id);
}

export { houseFrom };
