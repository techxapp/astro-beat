// SPDX-License-Identifier: AGPL-3.0-or-later
// Divisional charts (Parashara's schemes, BPHS ch. 6).
import type { Varga } from "@astro/schema/enums";
import { degInSign, isOddSign, signIndex } from "./tables.ts";

const MOVABLE = [0, 3, 6, 9];
const FIXED = [1, 4, 7, 10];
const modality = (s: number): "movable" | "fixed" | "dual" =>
  MOVABLE.includes(s) ? "movable" : FIXED.includes(s) ? "fixed" : "dual";

/** Varga sign index for a sidereal longitude. */
export function vargaSign(varga: Varga, lon: number): number {
  const s = signIndex(lon);
  const d = degInSign(lon);
  const part = (n: number): number => Math.min(n - 1, Math.floor((d * n) / 30));
  const odd = isOddSign(s);
  switch (varga) {
    case "D1":
      return s;
    case "D2": // Hora: odd signs Sun (Leo) then Moon (Cancer); even signs reversed
      return (d < 15) === odd ? 4 : 3;
    case "D3": // Drekkana: same, 5th, 9th
      return (s + 4 * part(3)) % 12;
    case "D4": // Chaturthamsha: same, 4th, 7th, 10th
      return (s + 3 * part(4)) % 12;
    case "D7": // Saptamsha: odd from same sign, even from the 7th
      return (s + (odd ? 0 : 6) + part(7)) % 12;
    case "D9": // Navamsha: continuous from Aries
      return Math.floor((lon * 9) / 30) % 12;
    case "D10": // Dashamsha: odd from same, even from the 9th
      return (s + (odd ? 0 : 8) + part(10)) % 12;
    case "D12": // Dwadashamsha: from same sign
      return (s + part(12)) % 12;
    case "D16": { // Shodashamsha: movable Aries, fixed Leo, dual Sagittarius
      const start = { movable: 0, fixed: 4, dual: 8 }[modality(s)];
      return (start + part(16)) % 12;
    }
    case "D20": { // Vimshamsha: movable Aries, fixed Sagittarius, dual Leo
      const start = { movable: 0, fixed: 8, dual: 4 }[modality(s)];
      return (start + part(20)) % 12;
    }
    case "D24": // Chaturvimshamsha: odd from Leo, even from Cancer
      return ((odd ? 4 : 3) + part(24)) % 12;
    case "D27": // Bhamsha: continuous from Aries (fire Aries, earth Cancer, air Libra, water Capricorn)
      return Math.floor((lon * 27) / 30) % 12;
    case "D30": { // Trimshamsha (Parashara): unequal parts ruled by Mars, Saturn, Jupiter, Mercury, Venus
      if (odd) {
        if (d < 5) return 0; // Aries
        if (d < 10) return 10; // Aquarius
        if (d < 18) return 8; // Sagittarius
        if (d < 25) return 2; // Gemini
        return 6; // Libra
      }
      if (d < 5) return 1; // Taurus
      if (d < 12) return 5; // Virgo
      if (d < 20) return 11; // Pisces
      if (d < 25) return 9; // Capricorn
      return 7; // Scorpio
    }
    case "D40": // Khavedamsha: odd from Aries, even from Libra
      return ((odd ? 0 : 6) + part(40)) % 12;
    case "D45": { // Akshavedamsha: movable Aries, fixed Leo, dual Sagittarius
      const start = { movable: 0, fixed: 4, dual: 8 }[modality(s)];
      return (start + part(45)) % 12;
    }
    case "D60": // Shashtiamsha: from same sign
      return (s + part(60)) % 12;
  }
}

/** Vargas computed by analysis (D1 is the natal chart itself). */
export const ANALYSIS_VARGAS: readonly Varga[] = ["D2", "D3", "D4", "D7", "D9", "D10", "D12", "D16", "D20", "D24", "D27", "D30", "D40", "D45", "D60"];
