// SPDX-License-Identifier: AGPL-3.0-or-later
// Pythagorean numerology from a birth date and (optionally) a name. Runs on the device: the date
// and the name never leave it, only the reduced numbers do. Period dates go to a local-only map.
import type { CoreNumber, NumerologyAnalysis, NumerologyFact, NumerologyPeriodFact } from "@astro/schema/analysis";
import type { IsoDate, KarmicDebt, NumerologyValue } from "@astro/schema/enums";
import type { PeriodDates } from "@astro/schema/local";

export interface NumerologyInput {
  /** local birth date, YYYY-MM-DD */
  birthDate: IsoDate;
  /** full birth name; name numbers are skipped when absent or without Latin letters */
  name?: string | undefined;
}

export interface NumerologyOptions {
  /** today's date, local; marks period status and picks the personal year and month */
  asOf: IsoDate;
  /** first period label number (default 1) */
  labelStart?: number;
  /** first fact id number (default 1) */
  factStart?: number;
}

export interface NumerologyResult {
  analysis: NumerologyAnalysis;
  periodDates: PeriodDates;
}

const MASTERS = new Set([11, 22, 33]);
const DEBTS = new Set([13, 14, 16, 19]);
/** Personal years and months are counted in years after this many from now. */
export const PERSONAL_YEARS = 7;
export const PERSONAL_MONTHS = 12;

const digitSum = (n: number): number => String(n).split("").reduce((s, c) => s + Number(c), 0);

/** Reduce to one digit, keeping 11, 22 and 33 unless `keepMasters` is false. */
export function reduce(n: number, keepMasters = true): NumerologyValue {
  let x = Math.abs(Math.trunc(n));
  while (x > 9 && !(keepMasters && MASTERS.has(x))) x = digitSum(x);
  return x as NumerologyValue;
}

/** Reduce and report the first karmic-debt number (13, 14, 16, 19) passed through on the way. */
export function reduceWithDebt(n: number): { value: NumerologyValue; karmicDebt?: KarmicDebt } {
  let x = Math.abs(Math.trunc(n));
  let debt: KarmicDebt | undefined;
  while (x > 9 && !MASTERS.has(x)) {
    if (debt === undefined && DEBTS.has(x)) debt = x as KarmicDebt;
    x = digitSum(x);
  }
  return debt === undefined ? { value: x as NumerologyValue } : { value: x as NumerologyValue, karmicDebt: debt };
}

/** Pythagorean letter values: A=1 … I=9, J=1 … R=9, S=1 … Z=8. */
export const letterValue = (ch: string): number => ((ch.charCodeAt(0) - 65) % 9) + 1;
const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/** Uppercase Latin letters per name part, accents removed. */
export function nameParts(name: string): string[] {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z]+/).filter((p) => p.length > 0);
}

/** Sum each name part (reduced) and reduce the total, the usual way that preserves master numbers. */
function nameNumber(parts: readonly string[], pick: (ch: string) => boolean): { value: NumerologyValue; karmicDebt?: KarmicDebt } | null {
  const sums = parts.map((p) => [...p].filter(pick).reduce((s, ch) => s + letterValue(ch), 0)).filter((s) => s > 0);
  if (sums.length === 0) return null;
  return reduceWithDebt(sums.reduce((s, x) => s + reduce(x), 0));
}

// ---------------------------------------------------------------- calendar helpers
const pad = (n: number): string => String(n).padStart(2, "0");
const daysIn = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
function addMonths(iso: IsoDate, months: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${pad(nm)}-${pad(Math.min(d, daysIn(ny, nm)))}`;
}
const statusOf = (start: IsoDate, end: IsoDate, asOf: IsoDate): NumerologyPeriodFact["status"] =>
  end <= asOf ? "past" : start <= asOf ? "current" : "upcoming";

export function numerology(input: NumerologyInput, opts: NumerologyOptions): NumerologyResult {
  const [by, bm, bd] = input.birthDate.split("-").map(Number) as [number, number, number];
  let factN = opts.factStart ?? 1;
  let labelN = opts.labelStart ?? 1;
  const facts: NumerologyFact[] = [];
  const core = (number: CoreNumber, r: { value: NumerologyValue; karmicDebt?: KarmicDebt }): void => {
    facts.push({ id: `F${factN++}`, kind: "numCore", number, ...r });
  };

  const lifePath = reduceWithDebt(reduce(bm) + reduce(bd) + reduce(digitSum(by)));
  core("lifePath", lifePath);
  core("birthday", reduceWithDebt(bd));

  const parts = input.name ? nameParts(input.name) : [];
  const expression = nameNumber(parts, () => true);
  if (expression) {
    core("expression", expression);
    const soul = nameNumber(parts, (ch) => VOWELS.has(ch));
    if (soul) core("soulUrge", soul);
    const personality = nameNumber(parts, (ch) => !VOWELS.has(ch));
    if (personality) core("personality", personality);
    core("maturity", reduceWithDebt(lifePath.value + expression.value));
    const counts = new Map<number, number>();
    for (const ch of parts.join("")) counts.set(letterValue(ch), (counts.get(letterValue(ch)) ?? 0) + 1);
    const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !counts.has(d));
    facts.push({ id: `F${factN++}`, kind: "numKarmicLessons", missing });
    const max = Math.max(...counts.values());
    facts.push({ id: `F${factN++}`, kind: "numHiddenPassion", values: [...counts].filter(([, c]) => c === max).map(([d]) => d).sort((a, b) => a - b) });
  }

  const periods: NumerologyPeriodFact[] = [];
  const periodDates: PeriodDates = {};
  const add = (level: NumerologyPeriodFact["level"], order: number, start: IsoDate, end: IsoDate, value: NumerologyValue, challenge?: number): void => {
    const label = `P${labelN++}`;
    periods.push({ label, level, order, status: statusOf(start, end, opts.asOf), value, ...(challenge === undefined ? {} : { challenge }) });
    periodDates[label] = { start, end };
  };

  // Pinnacles and challenges: the first ends at age 36 minus the single-digit life path, then 9-year cycles.
  const m = reduce(bm, false);
  const d = reduce(bd, false);
  const y = reduce(digitSum(by), false);
  const pinnacles = [reduce(m + d), reduce(d + y), 0, reduce(m + y)] as NumerologyValue[];
  pinnacles[2] = reduce((pinnacles[0] as number) + (pinnacles[1] as number));
  const c1 = Math.abs(m - d);
  const c2 = Math.abs(d - y);
  const challenges = [c1, c2, Math.abs(c1 - c2), Math.abs(m - y)];
  const firstEnd = 36 - reduce(lifePath.value, false);
  const ages = [0, firstEnd, firstEnd + 9, firstEnd + 18, 100];
  for (let i = 0; i < 4; i++) {
    add("pinnacle", i, addMonths(input.birthDate, 12 * (ages[i] as number)), addMonths(input.birthDate, 12 * (ages[i + 1] as number)),
      pinnacles[i] as NumerologyValue, challenges[i]);
  }

  // Personal years (calendar years) and months.
  const [ay, am] = opts.asOf.split("-").map(Number) as [number, number];
  const personalYear = (year: number): number => reduce(m + d + reduce(digitSum(year), false), false);
  for (let i = 0; i < PERSONAL_YEARS; i++) {
    add("personalYear", i, `${ay + i}-01-01`, `${ay + i + 1}-01-01`, personalYear(ay + i) as NumerologyValue);
  }
  for (let i = 0; i < PERSONAL_MONTHS; i++) {
    const start = addMonths(`${ay}-${pad(am)}-01`, i);
    const [sy, sm] = start.split("-").map(Number) as [number, number];
    add("personalMonth", i, start, addMonths(start, 1), reduce(personalYear(sy) + sm, false));
  }

  return {
    analysis: { method: "pythagorean", nameUsed: expression !== null, facts, periods },
    periodDates,
  };
}
