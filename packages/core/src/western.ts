// SPDX-License-Identifier: AGPL-3.0-or-later
// Tropical (Western) view of a chart. Natal positions are the chart's sidereal ones shifted back
// by the ayanamsa, so they stay exactly consistent with the Vedic charts; slow-mover transits
// around "today" are sampled from the ephemeris for profection-year and transit timing.
import type { Chart, PlanetPos, WesternChart } from "@astro/schema/chart";
import type { IsoDate } from "@astro/schema/enums";
import { tropicalLongitude } from "./ephemeris.ts";
import { norm360 } from "./math.ts";
import { ayanamsa } from "./sidereal.ts";
import { isoDateFromJd, jdFromIsoDate, jdTtFromUt } from "./time.ts";

export interface WesternOptions {
  /** today's date, local */
  asOf: IsoDate;
  /** transit sampling window around asOf, days */
  daysBefore?: number;
  daysAfter?: number;
  stepDays?: number;
}

/**
 * The UT birth date of a chart. The dasha tree is clipped to begin at birth, so the first
 * period starts on the birth date (to within the day, which is all the ayanamsa needs).
 */
export function chartBirthDate(chart: Chart): IsoDate {
  const first = chart.parashari.dasha.periods.find((p) => p.level === "MD");
  if (!first) throw new Error("chart has no dasha periods");
  return first.start;
}

export function westernChart(chart: Chart, opts: WesternOptions): WesternChart {
  const birthDate = chartBirthDate(chart);
  const tt = jdTtFromUt(jdFromIsoDate(birthDate) + 0.5);
  // A day's error in the epoch moves the ayanamsa by about 0.14″.
  const parOffset = ayanamsa(chart.settings.parashari.ayanamsa, tt);
  const kpOffset = ayanamsa(chart.settings.kp.ayanamsa, tt);
  const planets: PlanetPos[] = chart.parashari.planets.map((p) => ({ ...p, lon: norm360(p.lon + parOffset) }));
  const cusps = chart.kp.cusps ? chart.kp.cusps.map((c) => norm360(c + kpOffset)) : null;

  const step = opts.stepDays ?? 2;
  const from = jdFromIsoDate(opts.asOf) - (opts.daysBefore ?? 370);
  const to = jdFromIsoDate(opts.asOf) + (opts.daysAfter ?? 7 * 366);
  const transits: WesternChart["transits"] = [];
  for (let jd = from; jd <= to; jd += step) {
    const t = jdTtFromUt(jd + 0.5);
    transits.push({
      date: isoDateFromJd(jd + 0.5),
      Jupiter: tropicalLongitude("Jupiter", t, chart.settings.nodeType),
      Saturn: tropicalLongitude("Saturn", t, chart.settings.nodeType),
      NorthNode: tropicalLongitude("Rahu", t, chart.settings.nodeType),
    });
  }

  return {
    birthDate,
    ascendantLon: norm360(chart.parashari.ascendantLon + parOffset),
    midheavenLon: cusps ? (cusps[9] as number) : null,
    cusps,
    planets,
    transits,
  };
}
