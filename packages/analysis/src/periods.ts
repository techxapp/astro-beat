// SPDX-License-Identifier: AGPL-3.0-or-later
// Period facts: labelled MD/AD/PD periods with categorical context. Real dates go only to the
// local-only PeriodDates map.
import type { LordRelation, MutualPosition, PeriodFact, TransitEvent } from "@astro/schema/analysis";
import type { DashaPeriod } from "@astro/schema/chart";
import type { IsoDate, Planet } from "@astro/schema/enums";
import type { PeriodDates } from "@astro/schema/local";
import { houseFrom } from "./tables.ts";

export interface PeriodHooks {
  lordRelation?: (parent: Planet, child: Planet) => LordRelation;
  mutualPosition?: (parent: Planet, child: Planet) => MutualPosition;
  activatedHouses: (lords: readonly Planet[]) => number[];
  factRefs: (lords: readonly Planet[]) => string[];
  transits: (level: PeriodFact["level"], start: IsoDate, end: IsoDate) => TransitEvent[];
}

export function periodStatus(start: IsoDate, end: IsoDate, asOf: IsoDate): PeriodFact["status"] {
  if (end <= asOf) return "past";
  if (start <= asOf) return "current";
  return "upcoming";
}

export function mutualPositionOf(signA: number, signB: number): MutualPosition {
  const h = houseFrom(signA, signB);
  const k = Math.min(h, 14 - h);
  return (["1-1", "2-12", "3-11", "4-10", "5-9", "6-8", "7-7"] as const)[k - 1] as MutualPosition;
}

/**
 * Label MD, AD and PD periods P{labelStart}… (grouped by level, chronological within a level).
 * SD periods stay in the chart for the explorer and are not labelled.
 */
export function buildPeriods(
  dasha: readonly DashaPeriod[], asOf: IsoDate, labelStart: number, hooks: PeriodHooks,
): { periods: PeriodFact[]; dates: PeriodDates; nextLabel: number } {
  const periods: PeriodFact[] = [];
  const dates: PeriodDates = {};
  let n = labelStart;
  const orderByLevel: Record<string, number> = {};
  for (const d of dasha) {
    if (d.level === "SD") continue;
    const label = `P${n++}`;
    const order = orderByLevel[d.level] ?? 0;
    orderByLevel[d.level] = order + 1;
    const lords = d.path;
    const fact: PeriodFact = {
      label,
      level: d.level,
      lords: [...lords],
      order,
      status: periodStatus(d.start, d.end, asOf),
      activatedHouses: hooks.activatedHouses(lords),
      factRefs: hooks.factRefs(lords).slice(0, 40),
      transits: hooks.transits(d.level, d.start, d.end),
    };
    if (lords.length >= 2) {
      const parent = lords[lords.length - 2] as Planet;
      const child = lords[lords.length - 1] as Planet;
      if (hooks.lordRelation) fact.lordRelation = hooks.lordRelation(parent, child);
      if (hooks.mutualPosition) fact.mutualPosition = hooks.mutualPosition(parent, child);
    }
    periods.push(fact);
    dates[label] = { start: d.start, end: d.end };
  }
  return { periods, dates, nextLabel: n };
}
