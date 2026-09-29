// SPDX-License-Identifier: AGPL-3.0-or-later
// Deterministic facts: the "before rulebook" output of @astro/analysis.
// Everything outside `localOnly` is categorical: enums, labels and small integers.
import { z } from "zod";
import { EngineSettings } from "./chart.ts";
import {
  CharaKaraka, Dignity, FactId, HouseNum, Nakshatra, PeriodLabel, Planet, Sign, Varga, type YogaFamily,
} from "./enums.ts";

export { FactId, PeriodLabel };

export const YOGA_IDS = [
  "ruchaka", "bhadra", "hamsa", "malavya", "sasa", "gajakesari", "budha-aditya",
  "raja-kendra-trikona", "dhana", "viparita-harsha", "viparita-sarala", "viparita-vimala", "neecha-bhanga",
  "parivartana", "kemadruma", "chandra-mangala", "sunapha", "anapha", "durudhara", "adhi",
] as const;
export const YogaId = z.enum(YOGA_IDS);
export type YogaId = z.infer<typeof YogaId>;

/** Family of each yoga (topic allowlists select by family). */
export const YOGA_FAMILY: Readonly<Record<YogaId, YogaFamily>> = {
  ruchaka: "mahapurusha", bhadra: "mahapurusha", hamsa: "mahapurusha", malavya: "mahapurusha", sasa: "mahapurusha",
  gajakesari: "lunar", sunapha: "lunar", anapha: "lunar", durudhara: "lunar", kemadruma: "lunar", "chandra-mangala": "lunar", adhi: "lunar",
  "budha-aditya": "solar",
  "raja-kendra-trikona": "raja",
  dhana: "dhana",
  "viparita-harsha": "viparita", "viparita-sarala": "viparita", "viparita-vimala": "viparita",
  "neecha-bhanga": "cancellation",
  parivartana: "parivartana",
};

export const YogaModifier = z.enum([
  "participant-exalted", "participant-debilitated", "participant-combust", "involves-dusthana", "cancelled", "in-kendra",
]);
export type YogaModifier = z.infer<typeof YogaModifier>;

export const AspectKind = z.enum(["7", "mars-4", "mars-8", "jupiter-5", "jupiter-9", "saturn-3", "saturn-10", "node-5", "node-9"]);
export type AspectKind = z.infer<typeof AspectKind>;

export const CompoundRelation = z.enum(["adhi-mitra", "mitra", "sama", "shatru", "adhi-shatru"]);
export type CompoundRelation = z.infer<typeof CompoundRelation>;

export const Avastha = z.enum(["bala", "kumara", "yuva", "vriddha", "mrita"]);
export type Avastha = z.infer<typeof Avastha>;

export const FunctionalRole = z.enum(["benefic", "malefic", "yogakaraka", "neutral", "badhaka"]);
export type FunctionalRole = z.infer<typeof FunctionalRole>;

const PlacementFact = z.strictObject({
  id: FactId, kind: z.literal("placement"), planet: Planet, sign: Sign, house: HouseNum,
  nakshatra: Nakshatra, pada: z.int().min(1).max(4), nakshatraLord: Planet, dignity: Dignity,
  retrograde: z.boolean(), combust: z.boolean(), vargottama: z.boolean(), gandanta: z.boolean(),
  avastha: Avastha, planetaryWar: z.enum(["none", "won", "lost"]),
});
const LordshipFact = z.strictObject({ id: FactId, kind: z.literal("lordship"), house: HouseNum, lord: Planet, lordHouse: HouseNum, lordSign: Sign });
const AspectFact = z.strictObject({
  id: FactId, kind: z.literal("aspect"), from: Planet, toHouse: HouseNum, toPlanets: z.array(Planet).max(8), aspect: AspectKind,
});
const ConjunctionFact = z.strictObject({
  id: FactId, kind: z.literal("conjunction"), planets: z.array(Planet).min(2).max(9), house: HouseNum,
  closeness: z.enum(["tight", "moderate", "wide"]),
});
const ExchangeFact = z.strictObject({
  id: FactId, kind: z.literal("exchange"), planets: z.tuple([Planet, Planet]), houses: z.tuple([HouseNum, HouseNum]),
  type: z.enum(["maha", "khala", "dainya"]),
});
const FunctionalRoleFact = z.strictObject({ id: FactId, kind: z.literal("functionalRole"), planet: Planet, role: FunctionalRole });
const RelationshipFact = z.strictObject({ id: FactId, kind: z.literal("relationship"), a: Planet, b: Planet, compound: CompoundRelation });
const VargaFact = z.strictObject({ id: FactId, kind: z.literal("varga"), varga: Varga, planet: Planet, sign: Sign, house: HouseNum, dignity: Dignity });
const VargaLagnaFact = z.strictObject({ id: FactId, kind: z.literal("vargaLagna"), varga: Varga, sign: Sign });
const SavFact = z.strictObject({ id: FactId, kind: z.literal("sav"), house: HouseNum, bindus: z.int().min(0).max(56) });
const CharaKarakaFact = z.strictObject({ id: FactId, kind: z.literal("charaKaraka"), karaka: CharaKaraka, planet: Planet });
const YogaFact = z.strictObject({
  id: FactId, kind: z.literal("yoga"), yoga: YogaId, planets: z.array(Planet).max(9), houses: z.array(HouseNum).max(12),
  modifiers: z.array(YogaModifier).max(6),
});

export const Fact = z.discriminatedUnion("kind", [
  PlacementFact, LordshipFact, AspectFact, ConjunctionFact, ExchangeFact, FunctionalRoleFact,
  RelationshipFact, VargaFact, VargaLagnaFact, SavFact, CharaKarakaFact, YogaFact,
]);
export type Fact = z.infer<typeof Fact>;
export type FactOf<K extends Fact["kind"]> = Extract<Fact, { kind: K }>;

// ---------------------------------------------------------------- KP facts (system: "kp")
const KpLords = { signLord: Planet, starLord: Planet, subLord: Planet, subSubLord: Planet.optional() };
const KpCuspFact = z.strictObject({ id: FactId, kind: z.literal("kpCusp"), cusp: HouseNum, sign: Sign, ...KpLords });
const KpPlanetFact = z.strictObject({
  id: FactId, kind: z.literal("kpPlanet"), planet: Planet, sign: Sign, bhava: HouseNum, retrograde: z.boolean(), ...KpLords,
});
const KpSignificatorsFact = z.strictObject({
  id: FactId, kind: z.literal("kpSignificators"), house: HouseNum,
  /** planets in the star of occupants */
  a: z.array(Planet).max(9),
  /** occupants */
  b: z.array(Planet).max(9),
  /** planets in the star of the cusp's sign lord */
  c: z.array(Planet).max(9),
  /** the cusp's sign lord (plus conjoined planets when that convention is on) */
  d: z.array(Planet).max(9),
});
const KpPlanetSignifiesFact = z.strictObject({
  id: FactId, kind: z.literal("kpPlanetSignifies"), planet: Planet, houses: z.array(HouseNum).max(12),
  viaStarLord: z.array(HouseNum).max(12), viaSubLord: z.array(HouseNum).max(12),
});
export const KpFact = z.discriminatedUnion("kind", [KpCuspFact, KpPlanetFact, KpSignificatorsFact, KpPlanetSignifiesFact]);
export type KpFact = z.infer<typeof KpFact>;
export type KpFactOf<K extends KpFact["kind"]> = Extract<KpFact, { kind: K }>;

// ---------------------------------------------------------------- periods
export const TransitEvent = z.strictObject({
  planet: z.enum(["Jupiter", "Saturn", "Rahu", "Ketu"]),
  sign: Sign,
  houseFromLagna: HouseNum,
  houseFromMoon: HouseNum,
  /** Parashari only (ashtakavarga is not a KP concept). */
  savBindus: z.int().min(0).max(56).optional(),
  /** Parashari only. */
  sadeSati: z.enum(["none", "rising", "peak", "setting"]).optional(),
  spansBoundary: z.boolean(),
});
export type TransitEvent = z.infer<typeof TransitEvent>;

export const PeriodLevel = z.enum(["MD", "AD", "PD", "SD"]);
export const PeriodStatus = z.enum(["past", "current", "upcoming"]);
export const LordRelation = z.enum(["same", "friends", "neutral", "enemies"]);
export const MutualPosition = z.enum(["1-1", "2-12", "3-11", "4-10", "5-9", "6-8", "7-7"]);
export type PeriodLevel = z.infer<typeof PeriodLevel>;
export type PeriodStatus = z.infer<typeof PeriodStatus>;
export type LordRelation = z.infer<typeof LordRelation>;
export type MutualPosition = z.infer<typeof MutualPosition>;

export const PeriodFact = z.strictObject({
  label: PeriodLabel,
  level: PeriodLevel,
  lords: z.array(Planet).min(1).max(4),
  /** chronological index within its level (local only; dropped from payloads) */
  order: z.int().min(0),
  status: PeriodStatus,
  /** MD↔AD / AD↔PD (Parashari only) */
  lordRelation: LordRelation.optional(),
  mutualPosition: MutualPosition.optional(),
  /** owned + occupied by lords (Parashari) or signified by lords (KP) */
  activatedHouses: z.array(HouseNum).max(12),
  /** natal facts involving the lords */
  factRefs: z.array(FactId).max(40),
  transits: z.array(TransitEvent).max(12),
});
export type PeriodFact = z.infer<typeof PeriodFact>;

// ---------------------------------------------------------------- conventions (Q4 / Q4a)
export const AnalysisConventions = z.strictObject({
  /** Rahu/Ketu graha drishti. */
  nodeAspects: z.enum(["none", "7", "5-7-9"]),
  charaKarakas: z.union([z.literal(7), z.literal(8)]),
  combustion: z.enum(["classical", "classical-no-retro-reduction"]),
  neechaBhanga: z.enum(["kendra-from-lagna-or-moon", "kendra-from-lagna"]),
  planetaryWarWinner: z.enum(["lower-longitude", "higher-longitude"]),
  nodeDignity: z.enum(["none", "taurus-scorpio", "gemini-sagittarius"]),
  kpSignificatorConjunctions: z.boolean(),
  kpNodeRule: z.boolean(),
});
export type AnalysisConventions = z.infer<typeof AnalysisConventions>;

export const DEFAULT_CONVENTIONS: AnalysisConventions = {
  nodeAspects: "5-7-9",
  charaKarakas: 8,
  combustion: "classical",
  neechaBhanga: "kendra-from-lagna-or-moon",
  planetaryWarWinner: "lower-longitude",
  nodeDignity: "taurus-scorpio",
  kpSignificatorConjunctions: false,
  kpNodeRule: true,
};

// ---------------------------------------------------------------- analysis
const SystemAnalysisBase = {
  lagna: z.strictObject({ sign: Sign, lord: Planet }),
  moon: z.strictObject({ sign: Sign, nakshatra: Nakshatra, pada: z.int().min(1).max(4) }),
  periods: z.array(PeriodFact).max(8000),
};
export const ParashariAnalysis = z.strictObject({ ...SystemAnalysisBase, facts: z.array(Fact).max(2000) });
export type ParashariAnalysis = z.infer<typeof ParashariAnalysis>;
export const KpAnalysis = z.strictObject({ ...SystemAnalysisBase, facts: z.array(KpFact).max(2000) });
export type KpAnalysis = z.infer<typeof KpAnalysis>;

export const AnalysisPublic = z.strictObject({
  analysisVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  settings: EngineSettings.omit({ engineVersion: true }),
  conventions: AnalysisConventions,
  parashari: ParashariAnalysis,
  /** null if Placidus is unavailable for this latitude */
  kp: KpAnalysis.nullable(),
});
export type AnalysisPublic = z.infer<typeof AnalysisPublic>;
// The local-only half (period dates, maraka) lives in ./local.ts so that the payload
// builder, which may import this module, cannot even name its type.
