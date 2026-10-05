// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_CONVENTIONS, type AnalysisConventions } from "@astro/schema/analysis";
import type { Chart, WesternChart } from "@astro/schema/chart";
import type { IsoDate } from "@astro/schema/enums";
import type { Analysis } from "@astro/schema/local";
import { analyzeKp } from "./kp/index.ts";
import { analyzeParashari, FactIds } from "./parashari.ts";
import { analyzeWestern } from "./western.ts";

/** Bump on any change that alters analysis output (the vault cache is keyed by it). */
export const ANALYSIS_VERSION = "0.2.0";

export interface AnalyzeOptions {
  /** today's date, local; only used to mark period status. Never leaves the device. */
  asOf: IsoDate;
  conventions?: AnalysisConventions;
  /** tropical view of the chart from the engine (`westernChart`); without it `western` is null */
  western?: WesternChart;
}

/** Chart → Analysis. Pure and deterministic in (chart, western, asOf, conventions, ANALYSIS_VERSION). */
export function analyze(chart: Chart, opts: AnalyzeOptions): Analysis {
  const conventions = opts.conventions ?? DEFAULT_CONVENTIONS;
  const ids = new FactIds(1);
  const par = analyzeParashari(chart, conventions, opts.asOf, ids, 1);
  const kp = analyzeKp(chart, conventions, opts.asOf, ids, par.nextLabel);
  const western = opts.western ? analyzeWestern(opts.western, opts.asOf, ids, kp ? kp.nextLabel : par.nextLabel) : null;
  const { engineVersion: _v, ...settings } = chart.settings;
  return {
    analysisVersion: ANALYSIS_VERSION,
    settings,
    conventions,
    parashari: par.analysis,
    kp: kp ? kp.analysis : null,
    western: western ? western.analysis : null,
    localOnly: {
      periodDates: { ...par.periodDates, ...(kp ? kp.periodDates : {}), ...(western ? western.periodDates : {}) },
      marakaFacts: par.maraka,
    },
  };
}

/** Split an analysis into the part the payload builder may see and the local-only part. */
export function splitAnalysis(a: Analysis): { publicPart: Omit<Analysis, "localOnly">; localOnly: Analysis["localOnly"] } {
  const { localOnly, ...publicPart } = a;
  return { publicPart, localOnly };
}
