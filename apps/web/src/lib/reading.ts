// SPDX-License-Identifier: AGPL-3.0-or-later
// Prepare a reading request: pick the payload builder for the system, then resolve the payload's
// period labels to local dates and keep only chart-analysis fact ids for the explorer chips.
import { numerology, type NumerologyResult } from "@astro/numerology";
import {
  availableBranches, buildCombinedPayload, buildNumerologyPayload, buildPayload, PayloadUnavailableError, type BuiltPayload,
} from "@astro/payload";
import type { AnalysisPublic } from "@astro/schema/analysis";
import type { Branch, IsoDate, System, Topic } from "@astro/schema/enums";
import type { BirthInput } from "@astro/schema/identifying";
import type { Analysis, PeriodDates } from "@astro/schema/local";
import type { PredictionPayload } from "@astro/schema/payload";

/** Numerology from the profile's birth date and name; null for chart-only imports (no birth data). */
export function numerologyFor(birth: BirthInput | undefined, asOf: IsoDate): NumerologyResult | null {
  return birth ? numerology({ birthDate: birth.localDate, name: birth.name }, { asOf }) : null;
}

export interface PreparedReading {
  payload: PredictionPayload;
  periodDates: PeriodDates;
  factIdMap: Record<string, string>;
}

/** Branches a reading can use for this profile. */
export function readingBranches(analysis: AnalysisPublic, birth: BirthInput | undefined, asOf: IsoDate): Branch[] {
  return availableBranches({ analysis, numerology: numerologyFor(birth, asOf)?.analysis ?? null });
}

export function prepareReading(
  analysis: Analysis, birth: BirthInput | undefined, system: System, topic: Topic, branches: readonly Branch[], asOf: IsoDate,
): PreparedReading {
  // Only the public half of the analysis reaches the payload builder.
  const { localOnly, ...publicPart } = analysis;
  const num = system === "numerology" || system === "combined" ? numerologyFor(birth, asOf) : null;
  let built: BuiltPayload;
  if (system === "numerology") {
    if (!num) throw new PayloadUnavailableError("Numerology needs the birth date, which this profile does not have.");
    built = buildNumerologyPayload(num.analysis, topic);
  } else if (system === "combined") {
    built = buildCombinedPayload({ analysis: publicPart, numerology: num?.analysis ?? null }, branches, topic);
  } else {
    built = buildPayload(publicPart, system, topic);
  }
  const periodDates: PeriodDates = {};
  for (const [label, source] of Object.entries(built.periodLabelMap)) {
    const dates = built.origin.periods[label] === "numerology" ? num?.periodDates : localOnly.periodDates;
    const d = dates?.[source];
    if (d) periodDates[label] = d;
  }
  const factIdMap = Object.fromEntries(Object.entries(built.factIdMap).filter(([id]) => built.origin.facts[id] === "analysis"));
  return { payload: built.payload, periodDates, factIdMap };
}
