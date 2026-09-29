// SPDX-License-Identifier: AGPL-3.0-or-later
// Last-line leak scanner over the exact serialized request body. Payload leaves are enums,
// labels (≤ P60 / F250) and integers ≤ 56, so any of these patterns means something is wrong.

export interface LeakFinding {
  rule: "non-integer-number" | "iso-date" | "long-digit-run" | "time-of-day";
  match: string;
}

const RULES: readonly { rule: LeakFinding["rule"]; re: RegExp }[] = [
  { rule: "non-integer-number", re: /\d+\.\d+/g },
  { rule: "iso-date", re: /\d{4}-\d{2}-\d{2}/g },
  { rule: "long-digit-run", re: /\d{4,}/g },
  { rule: "time-of-day", re: /\b\d{1,2}:\d{2}\b/g },
];

/** Scan a serialized body. The request id (a UUID) is excluded by the caller or allowed here. */
export function scanForLeaks(body: string): LeakFinding[] {
  const withoutUuids = body.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>");
  const out: LeakFinding[] = [];
  for (const { rule, re } of RULES) {
    for (const m of withoutUuids.matchAll(re)) out.push({ rule, match: m[0] });
  }
  return out;
}
