// SPDX-License-Identifier: AGPL-3.0-or-later
// Classical reference tables (BPHS unless noted). Signs are 0-based indices (Aries = 0).
import type { AnalysisConventions } from "@astro/schema/analysis";
import { NAKSHATRAS, SIGNS, type Graha, type Nakshatra, type Planet, type Sign } from "@astro/schema/enums";

export const SIGN_LORD: readonly Graha[] = [
  "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
];

export const VIMSHOTTARI_ORDER: readonly Planet[] = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
export const VIMSHOTTARI_YEARS: Readonly<Record<Planet, number>> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

export const signIndex = (lon: number): number => Math.floor(lon / 30) % 12;
export const signName = (idx: number): Sign => SIGNS[((idx % 12) + 12) % 12] as Sign;
export const degInSign = (lon: number): number => lon - 30 * Math.floor(lon / 30);
/** House number (1..12) of sign `to` counted from sign `from`. */
export const houseFrom = (from: number, to: number): number => ((((to - from) % 12) + 12) % 12) + 1;
/** Sign index `n` houses from `from` (n = 1 is the same sign). */
export const signAt = (from: number, n: number): number => (((from + n - 1) % 12) + 12) % 12;
export const isOddSign = (idx: number): boolean => idx % 2 === 0;

export const nakshatraIndex = (lon: number): number => Math.min(26, Math.floor((lon * 27) / 360));
export const nakshatraName = (lon: number): Nakshatra => NAKSHATRAS[nakshatraIndex(lon)] as Nakshatra;
export const padaOf = (lon: number): number => (Math.floor((lon * 108) / 360) % 4) + 1;
export const nakshatraLord = (lon: number): Planet => VIMSHOTTARI_ORDER[nakshatraIndex(lon) % 9] as Planet;

export const KENDRAS = [1, 4, 7, 10] as const;
export const TRIKONAS = [1, 5, 9] as const;
export const DUSTHANAS = [6, 8, 12] as const;
export const isKendra = (h: number): boolean => h === 1 || h === 4 || h === 7 || h === 10;
export const isDusthana = (h: number): boolean => h === 6 || h === 8 || h === 12;

export const NATURAL_BENEFICS: readonly Planet[] = ["Moon", "Mercury", "Jupiter", "Venus"];

// ---------------------------------------------------------------- dignity tables
export const EXALTATION: Readonly<Record<Graha, number>> = {
  Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6,
};
/** Moolatrikona sign and degree range [from, to). */
export const MOOLATRIKONA: Readonly<Record<Graha, { sign: number; from: number; to: number }>> = {
  Sun: { sign: 4, from: 0, to: 20 },
  Moon: { sign: 1, from: 3, to: 30 },
  Mars: { sign: 0, from: 0, to: 12 },
  Mercury: { sign: 5, from: 15, to: 20 },
  Jupiter: { sign: 8, from: 0, to: 10 },
  Venus: { sign: 6, from: 0, to: 15 },
  Saturn: { sign: 10, from: 0, to: 20 },
};
export const OWN_SIGNS: Readonly<Record<Graha, readonly number[]>> = {
  Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10],
};

/** Node dignity convention (varies between texts; see Q4). */
export function nodeDignityTable(conv: AnalysisConventions["nodeDignity"]): Partial<Record<"Rahu" | "Ketu", { exalt: number; own: number }>> {
  switch (conv) {
    case "none":
      return {};
    case "taurus-scorpio":
      return { Rahu: { exalt: 1, own: 10 }, Ketu: { exalt: 7, own: 7 } };
    case "gemini-sagittarius":
      return { Rahu: { exalt: 2, own: 10 }, Ketu: { exalt: 8, own: 7 } };
  }
}

export const isGraha = (p: Planet): p is Graha => p !== "Rahu" && p !== "Ketu";

/** Houses (1..12, whole-sign from lagna) owned by a planet. Nodes own none. */
export function ownedHouses(p: Planet, lagnaSign: number): number[] {
  if (!isGraha(p)) return [];
  return OWN_SIGNS[p].map((s) => houseFrom(lagnaSign, s)).sort((a, b) => a - b);
}
