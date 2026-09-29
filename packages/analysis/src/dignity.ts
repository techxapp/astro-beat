// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AnalysisConventions, CompoundRelation } from "@astro/schema/analysis";
import type { Dignity, Planet } from "@astro/schema/enums";
import { compoundRelation } from "./relations.ts";
import {
  degInSign, EXALTATION, isGraha, MOOLATRIKONA, nodeDignityTable, OWN_SIGNS, SIGN_LORD, signIndex,
} from "./tables.ts";

const FROM_COMPOUND: Record<CompoundRelation, Dignity> = {
  "adhi-mitra": "great-friend", mitra: "friend", sama: "neutral", shatru: "enemy", "adhi-shatru": "great-enemy",
};

/**
 * D1 dignity from full longitude. `natalSigns` gives each planet's D1 sign for the temporary
 * component of the compound relationship with the sign lord.
 */
export function dignityD1(
  planet: Planet, lon: number, natalSigns: Record<Planet, number>, conv: AnalysisConventions["nodeDignity"],
): Dignity {
  const s = signIndex(lon);
  const deg = degInSign(lon);
  if (isGraha(planet)) {
    const ex = EXALTATION[planet];
    if (s === (ex + 6) % 12) return "debilitated";
    const mt = MOOLATRIKONA[planet];
    if (s === ex) {
      // Moon: Taurus 0–3° exalted, rest moolatrikona. Mercury: Virgo 0–15° exalted, 15–20° MT, 20–30° own.
      if (planet === "Moon" && deg >= 3) return "moolatrikona";
      if (planet === "Mercury" && deg >= 15) return deg < 20 ? "moolatrikona" : "own";
      return "exalted";
    }
    if (s === mt.sign && deg >= mt.from && deg < mt.to) return "moolatrikona";
    if (OWN_SIGNS[planet].includes(s)) return "own";
  } else {
    const t = nodeDignityTable(conv)[planet];
    if (t) {
      if (s === t.exalt) return "exalted";
      if (s === (t.exalt + 6) % 12) return "debilitated";
      if (s === t.own) return "own";
    }
  }
  const lord = SIGN_LORD[s] as Planet;
  return FROM_COMPOUND[compoundRelation(planet, lord, natalSigns[planet], natalSigns[lord])];
}

/** Sign-only dignity for varga placements (no degrees); compound relation uses D1 positions. */
export function dignityBySign(
  planet: Planet, vargaSign: number, natalSigns: Record<Planet, number>, conv: AnalysisConventions["nodeDignity"],
): Dignity {
  if (isGraha(planet)) {
    const ex = EXALTATION[planet];
    if (vargaSign === ex) return "exalted";
    if (vargaSign === (ex + 6) % 12) return "debilitated";
    if (OWN_SIGNS[planet].includes(vargaSign)) return "own";
  } else {
    const t = nodeDignityTable(conv)[planet];
    if (t) {
      if (vargaSign === t.exalt) return "exalted";
      if (vargaSign === (t.exalt + 6) % 12) return "debilitated";
      if (vargaSign === t.own) return "own";
    }
  }
  const lord = SIGN_LORD[vargaSign] as Planet;
  return FROM_COMPOUND[compoundRelation(planet, lord, natalSigns[planet], natalSigns[lord])];
}
