// SPDX-License-Identifier: AGPL-3.0-or-later
// Output post-checks: grounding (fact ids, period labels) and date/age redaction.
import type { PredictionOutput } from "@astro/schema/api";
import type { PredictionPayload } from "@astro/schema/payload";

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const DATE_PATTERNS: readonly RegExp[] = [
  /\b\d{4}-\d{1,2}-\d{1,2}\b/g, // ISO dates
  /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g, // 12/03/2027
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, "gi"), // March 3(, 2027)
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b(?:,?\\s+\\d{4})?`, "gi"), // 3rd of March
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+(?:of\\s+)?\\d{4}\\b`, "gi"), // March 2027
  /\b(?:1[6-9]|2[0-2])\d{2}s?\b/g, // bare years 1600–2299 (and decades)
  /\b(?:at\s+(?:the\s+)?age\s+(?:of\s+)?|aged\s+)\d{1,3}\b/gi, // at the age of 34
  /\b\d{1,3}\s*(?:years?|yrs?)[\s-]*old\b/gi, // 34 years old
];

export const REDACTION = "[date removed]";

export function redactDates(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const re of DATE_PATTERNS) {
    out = out.replace(re, () => {
      count++;
      return REDACTION;
    });
  }
  return { text: out, count };
}

export interface CheckedOutput {
  output: PredictionOutput;
  unknownFactIds: string[];
  unknownPeriods: string[];
  datesRedacted: number;
}

export function postCheck(output: PredictionOutput, payload: PredictionPayload): CheckedOutput {
  const factIds = new Set(payload.facts.map((f) => f.id));
  const periods = new Set(payload.periods.map((p) => p.label));
  const unknownFactIds = new Set<string>();
  const unknownPeriods = new Set<string>();
  for (const t of output.themes) for (const b of t.basis) if (!factIds.has(b)) unknownFactIds.add(b);
  for (const p of output.periods) {
    if (!periods.has(p.period)) unknownPeriods.add(p.period);
    for (const b of p.basis) if (!factIds.has(b)) unknownFactIds.add(b);
  }
  let datesRedacted = 0;
  // Redaction can lengthen a string, so clamp back to the schema's limits.
  const r = (s: string, max: number): string => {
    const x = redactDates(s);
    datesRedacted += x.count;
    return x.text.slice(0, max);
  };
  const cleaned: PredictionOutput = {
    summary: r(output.summary, 1200),
    themes: output.themes.map((t) => ({ ...t, title: r(t.title, 80), detail: r(t.detail, 800) })),
    periods: output.periods.map((p) => ({ ...p, headline: r(p.headline, 100), detail: r(p.detail, 600) })),
    limitations: output.limitations.map((l) => r(l, 200)),
    declined: output.declined,
  };
  return {
    output: cleaned,
    unknownFactIds: [...unknownFactIds].slice(0, 20),
    unknownPeriods: [...unknownPeriods].slice(0, 20),
    datesRedacted,
  };
}
