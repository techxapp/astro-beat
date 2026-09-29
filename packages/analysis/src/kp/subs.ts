// SPDX-License-Identifier: AGPL-3.0-or-later
// KP sub table: each nakshatra (13°20′) divided into 9 subs in proportion to Vimshottari years,
// starting from the nakshatra lord; subs crossing a sign boundary are split → 249 divisions.
// Generated, not hand-typed. Integer arithmetic in units of 1/18 arc-minute (1/1080°) is exact:
// nakshatra = 14 400 u, sub = 120·years u, sub-sub = years₁·years₂ u, sign = 32 400 u.
import type { Planet, Sign } from "@astro/schema/enums";
import { SIGN_LORD, signName, VIMSHOTTARI_ORDER, VIMSHOTTARI_YEARS } from "../tables.ts";

export const UNITS_PER_DEGREE = 1080;
const NAK_UNITS = 14_400;
const SIGN_UNITS = 32_400;
const CIRCLE_UNITS = 388_800;

export interface SubDivision {
  /** 1-based index in the 249-row table */
  index: number;
  /** start / end in units of 1/1080° */
  startUnits: number;
  endUnits: number;
  sign: Sign;
  signLord: Planet;
  starLord: Planet;
  subLord: Planet;
}

const sequenceFrom = (first: Planet): Planet[] => {
  const i = VIMSHOTTARI_ORDER.indexOf(first);
  return Array.from({ length: 9 }, (_, k) => VIMSHOTTARI_ORDER[(i + k) % 9] as Planet);
};

function buildTable(): SubDivision[] {
  const rows: SubDivision[] = [];
  for (let n = 0; n < 27; n++) {
    const star = VIMSHOTTARI_ORDER[n % 9] as Planet;
    let start = n * NAK_UNITS;
    for (const sub of sequenceFrom(star)) {
      const end = start + 120 * VIMSHOTTARI_YEARS[sub];
      const nextSignBoundary = (Math.floor(start / SIGN_UNITS) + 1) * SIGN_UNITS;
      const pieces: [number, number][] = end > nextSignBoundary ? [[start, nextSignBoundary], [nextSignBoundary, end]] : [[start, end]];
      for (const [a, b] of pieces) {
        const signIdx = Math.floor(a / SIGN_UNITS);
        rows.push({
          index: rows.length + 1, startUnits: a, endUnits: b, sign: signName(signIdx),
          signLord: SIGN_LORD[signIdx] as Planet, starLord: star, subLord: sub,
        });
      }
      start = end;
    }
  }
  return rows;
}

export const KP_SUB_TABLE: readonly SubDivision[] = buildTable();

export interface KpLords {
  sign: Sign;
  signLord: Planet;
  starLord: Planet;
  subLord: Planet;
  subSubLord: Planet;
}

/** Sign, star, sub and sub-sub lords of a sidereal (KP ayanamsa) longitude. */
export function kpLordsAt(lon: number): KpLords {
  const u = Math.min(CIRCLE_UNITS - 1e-9, Math.max(0, lon * UNITS_PER_DEGREE));
  // binary search over the table
  let lo = 0;
  let hi = KP_SUB_TABLE.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((KP_SUB_TABLE[mid] as SubDivision).startUnits <= u) lo = mid;
    else hi = mid - 1;
  }
  const row = KP_SUB_TABLE[lo] as SubDivision;
  // Sub-sub: subdivide the whole (unsplit) sub, starting from the sub lord.
  const nakStart = Math.floor(u / NAK_UNITS) * NAK_UNITS;
  let subStart = nakStart;
  for (const s of sequenceFrom(row.starLord)) {
    if (s === row.subLord) break;
    subStart += 120 * VIMSHOTTARI_YEARS[s];
  }
  const subYears = VIMSHOTTARI_YEARS[row.subLord];
  let t = subStart;
  let subSubLord: Planet = row.subLord;
  for (const ss of sequenceFrom(row.subLord)) {
    const len = subYears * VIMSHOTTARI_YEARS[ss];
    if (u < t + len) {
      subSubLord = ss;
      break;
    }
    t += len;
  }
  return { sign: row.sign, signLord: row.signLord, starLord: row.starLord, subLord: row.subLord, subSubLord };
}

/** Degrees remaining (forward) / elapsed (backward) until the sub lord changes at this longitude. */
export function subBoundaryDistance(lon: number): { forward: number; backward: number } {
  const u = lon * UNITS_PER_DEGREE;
  const row = KP_SUB_TABLE.find((r) => u >= r.startUnits && u < r.endUnits) ?? (KP_SUB_TABLE[KP_SUB_TABLE.length - 1] as SubDivision);
  return { forward: (row.endUnits - u) / UNITS_PER_DEGREE, backward: (u - row.startUnits) / UNITS_PER_DEGREE };
}
