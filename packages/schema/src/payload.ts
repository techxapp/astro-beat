// SPDX-License-Identifier: AGPL-3.0-or-later
// The only data that leaves the device. Leaves are enums, literals, FactId / PeriodLabel strings
// and integers in [0, 56]. No floats, no dates, no free text (tested in payload.invariants.test.ts).
import { z } from "zod";
import {
  Fact, KpFact, NumerologyAnalysis, NumerologyFact, NumerologyPeriodFact, PeriodFact, WesternAnalysis, WesternFact, WesternPeriodFact,
} from "./analysis.ts";
import { EngineSettings } from "./chart.ts";
import { Nakshatra, Planet, Sign, Topic } from "./enums.ts";

/** Period facts as sent: `order` is dropped (labels are renumbered chronologically per payload). */
export const PayloadPeriodFact = PeriodFact.omit({ order: true });
export type PayloadPeriodFact = z.infer<typeof PayloadPeriodFact>;
export const WesternPayloadPeriod = WesternPeriodFact.omit({ order: true });
export type WesternPayloadPeriod = z.infer<typeof WesternPayloadPeriod>;
export const NumerologyPayloadPeriod = NumerologyPeriodFact.omit({ order: true });
export type NumerologyPayloadPeriod = z.infer<typeof NumerologyPayloadPeriod>;

export const PAYLOAD_VERSION = 3 as const;

const VedicCommon = {
  nodeType: EngineSettings.shape.nodeType,
  lagna: z.strictObject({ sign: Sign, lord: Planet }),
  moon: z.strictObject({ sign: Sign, nakshatra: Nakshatra, pada: z.int().min(1).max(4) }),
  periods: z.array(PayloadPeriodFact).max(60),
  // reserved for the future local rulebook (§5.4): findings: z.array(RuleFinding)
};

// One branch's facts. A single-branch payload is a part plus the header; a combined payload
// carries several parts whose fact ids and period labels are numbered across all of them.
export const ParashariPart = z.strictObject({
  system: z.literal("parashari"),
  ayanamsa: EngineSettings.shape.parashari.shape.ayanamsa,
  ...VedicCommon,
  facts: z.array(Fact).max(250),
});
export const KpPart = z.strictObject({
  system: z.literal("kp"),
  ayanamsa: EngineSettings.shape.kp.shape.ayanamsa,
  ...VedicCommon,
  facts: z.array(KpFact).max(120),
});
export const WesternPart = z.strictObject({
  system: z.literal("western"),
  zodiac: WesternAnalysis.shape.zodiac,
  houseSystem: WesternAnalysis.shape.houseSystem,
  ascendant: WesternAnalysis.shape.ascendant,
  sun: WesternAnalysis.shape.sun,
  moon: WesternAnalysis.shape.moon,
  facts: z.array(WesternFact).max(150),
  periods: z.array(WesternPayloadPeriod).max(30),
});
export const NumerologyPart = z.strictObject({
  system: z.literal("numerology"),
  method: NumerologyAnalysis.shape.method,
  nameUsed: NumerologyAnalysis.shape.nameUsed,
  facts: z.array(NumerologyFact).max(40),
  periods: z.array(NumerologyPayloadPeriod).max(40),
});
export const PayloadPart = z.discriminatedUnion("system", [ParashariPart, KpPart, WesternPart, NumerologyPart]);
export type PayloadPart = z.infer<typeof PayloadPart>;

const Header = { payloadVersion: z.literal(PAYLOAD_VERSION), topic: Topic };

export const ParashariPayload = ParashariPart.extend(Header);
export const KpPayload = KpPart.extend(Header);
export const WesternPayload = WesternPart.extend(Header);
export const NumerologyPayload = NumerologyPart.extend(Header);
export const CombinedPayload = z.strictObject({
  system: z.literal("combined"),
  ...Header,
  parts: z.array(PayloadPart).min(2).max(4)
    .refine((ps) => new Set(ps.map((p) => p.system)).size === ps.length, { message: "each branch at most once" }),
});

export const PredictionPayload = z.discriminatedUnion("system", [ParashariPayload, KpPayload, WesternPayload, NumerologyPayload, CombinedPayload]);
export type PredictionPayload = z.infer<typeof PredictionPayload>;
export type ParashariPayload = z.infer<typeof ParashariPayload>;
export type KpPayload = z.infer<typeof KpPayload>;
export type WesternPayload = z.infer<typeof WesternPayload>;
export type NumerologyPayload = z.infer<typeof NumerologyPayload>;
export type CombinedPayload = z.infer<typeof CombinedPayload>;
export type ParashariPart = z.infer<typeof ParashariPart>;
export type KpPart = z.infer<typeof KpPart>;
export type WesternPart = z.infer<typeof WesternPart>;
export type NumerologyPart = z.infer<typeof NumerologyPart>;

/** The branch parts of a payload: its parts if combined, else the payload itself. */
export function payloadParts(p: PredictionPayload): PayloadPart[] {
  return p.system === "combined" ? p.parts : [p];
}

/** Every fact id a payload defines (across parts). */
export function payloadFactIds(p: PredictionPayload): Set<string> {
  return new Set(payloadParts(p).flatMap((part) => part.facts.map((f) => f.id)));
}

/** Every period label a payload defines (across parts). */
export function payloadPeriodLabels(p: PredictionPayload): Set<string> {
  return new Set(payloadParts(p).flatMap((part) => part.periods.map((x) => x.label)));
}
