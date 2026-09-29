// SPDX-License-Identifier: AGPL-3.0-or-later
// Transit timeline for Jupiter, Saturn, Rahu, Ketu from chart ingresses, and per-period events.
import type { TransitEvent } from "@astro/schema/analysis";
import type { Chart, TransitPlanet } from "@astro/schema/chart";
import type { IsoDate } from "@astro/schema/enums";
import { houseFrom, signIndex, signName } from "./tables.ts";

export interface TransitSegment {
  planet: TransitPlanet;
  sign: number;
  from: IsoDate;
  /** null when the segment runs past the ingress horizon */
  to: IsoDate | null;
}

const SIGN_INDEX: Record<string, number> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [signName(i), i]),
);

const PLANETS: readonly TransitPlanet[] = ["Saturn", "Jupiter", "Rahu", "Ketu"];

export function transitTimeline(chart: Chart, birthDate: IsoDate): TransitSegment[] {
  const out: TransitSegment[] = [];
  for (const planet of PLANETS) {
    const natal = chart.parashari.planets.find((p) => p.planet === planet);
    if (!natal) continue;
    let current: TransitSegment = { planet, sign: signIndex(natal.lon), from: birthDate, to: null };
    for (const ing of chart.ingresses) {
      if (ing.planet !== planet) continue;
      current.to = ing.date;
      out.push(current);
      current = { planet, sign: SIGN_INDEX[ing.sign] as number, from: ing.date, to: null };
    }
    out.push(current);
  }
  return out.filter((s) => s.to === null || s.to > s.from);
}

export interface TransitFrame {
  /** house of a transit sign counted from the lagna (whole sign, or KP bhava) */
  houseFromLagna: (sign: number) => number;
  moonSign: number;
  /** SAV bindus per sign (Parashari only) */
  sav?: readonly number[];
}

const PRIORITY: Record<TransitPlanet, number> = { Saturn: 0, Jupiter: 1, Rahu: 2, Ketu: 3 };

export function transitEvents(timeline: readonly TransitSegment[], start: IsoDate, end: IsoDate, frame: TransitFrame, max = 12): TransitEvent[] {
  const hits = timeline.filter((s) => s.from < end && (s.to === null || s.to > start));
  hits.sort((a, b) => PRIORITY[a.planet] - PRIORITY[b.planet] || a.from.localeCompare(b.from));
  return hits.slice(0, max)
    .sort((a, b) => a.from.localeCompare(b.from) || PRIORITY[a.planet] - PRIORITY[b.planet])
    .map((s) => {
      const fromMoon = houseFrom(frame.moonSign, s.sign);
      const ev: TransitEvent = {
        planet: s.planet,
        sign: signName(s.sign),
        houseFromLagna: frame.houseFromLagna(s.sign),
        houseFromMoon: fromMoon,
        spansBoundary: s.from < start || s.to === null || s.to > end,
      };
      if (frame.sav) {
        ev.savBindus = frame.sav[s.sign] as number;
        ev.sadeSati = s.planet !== "Saturn" ? "none" : fromMoon === 12 ? "rising" : fromMoon === 1 ? "peak" : fromMoon === 2 ? "setting" : "none";
      }
      return ev;
    });
}
