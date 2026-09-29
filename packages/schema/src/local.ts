// SPDX-License-Identifier: AGPL-3.0-or-later
// Local-only analysis output. Never reachable from payload / prompts / proxy (lint-enforced).
import { z } from "zod";
import { AnalysisPublic } from "./analysis.ts";
import { IsoDate, PeriodLabel, Planet } from "./enums.ts";

export const MarakaFact = z.strictObject({
  planet: Planet,
  reason: z.enum(["lord-of-2", "lord-of-7", "in-2", "in-7"]),
});
export type MarakaFact = z.infer<typeof MarakaFact>;

export const PeriodDates = z.record(PeriodLabel, z.strictObject({ start: IsoDate, end: IsoDate }));
export type PeriodDates = z.infer<typeof PeriodDates>;

export const AnalysisLocalOnly = z.strictObject({
  /** labels are unique across both systems */
  periodDates: PeriodDates,
  marakaFacts: z.array(MarakaFact).max(40),
});
export type AnalysisLocalOnly = z.infer<typeof AnalysisLocalOnly>;

export const Analysis = AnalysisPublic.extend({ localOnly: AnalysisLocalOnly });
export type Analysis = z.infer<typeof Analysis>;
