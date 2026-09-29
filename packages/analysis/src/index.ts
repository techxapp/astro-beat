// SPDX-License-Identifier: AGPL-3.0-or-later
export { analyze, splitAnalysis, ANALYSIS_VERSION, type AnalyzeOptions } from "./analyze.ts";
export { natalContext, type NatalContext } from "./context.ts";
export { dignityD1, dignityBySign } from "./dignity.ts";
export { naturalRelation, temporaryFriend, compoundRelation, relationBucket } from "./relations.ts";
export { aspectsOf, aspectsSign } from "./aspects.ts";
export { exchanges, functionalRole, badhakaLord, marakaFacts, lordOfHouse } from "./lordship.ts";
export { combustionOrb, isCombust, planetaryWar, isGandanta, baladiAvastha, closenessBucket } from "./states.ts";
export { vargaSign, ANALYSIS_VARGAS } from "./vargas.ts";
export { bhinnashtakavarga, sarvashtakavarga, BAV_TABLE } from "./ashtakavarga.ts";
export { charaKarakas } from "./karakas.ts";
export { YOGA_CATALOG, yogaDefinition, detectYogas, type YogaDefinition } from "./yogas/index.ts";
export { buildYogaContext, analyzeParashari, parashariFactRefs } from "./parashari.ts";
export { buildPeriods, periodStatus, mutualPositionOf } from "./periods.ts";
export { transitTimeline, transitEvents } from "./transits.ts";
export {
  KP_SUB_TABLE, kpLordsAt, subBoundaryDistance, UNITS_PER_DEGREE, bhavaOf, cuspOwner, kpOwnedHouses,
  kpContext, houseSignificators, planetSignifies, analyzeKp, kpFactRefs, type SubDivision, type KpLords,
} from "./kp/index.ts";
export * from "./tables.ts";
export { subPeriodsOf } from "./subperiods.ts";
