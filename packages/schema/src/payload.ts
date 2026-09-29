// SPDX-License-Identifier: AGPL-3.0-or-later
// The only data that leaves the device. Leaves are enums, literals, FactId / PeriodLabel strings
// and integers in [0, 56]. No floats, no dates, no free text (tested in payload.invariants.test.ts).
import { z } from "zod";
import { Fact, KpFact, PeriodFact } from "./analysis.ts";
import { EngineSettings } from "./chart.ts";
import { Nakshatra, Planet, Sign, Topic } from "./enums.ts";

/** Period facts as sent: `order` is dropped (labels are renumbered chronologically per payload). */
export const PayloadPeriodFact = PeriodFact.omit({ order: true });
export type PayloadPeriodFact = z.infer<typeof PayloadPeriodFact>;

export const PAYLOAD_VERSION = 3 as const;

const PayloadCommon = {
  payloadVersion: z.literal(PAYLOAD_VERSION),
  topic: Topic,
  nodeType: EngineSettings.shape.nodeType,
  lagna: z.strictObject({ sign: Sign, lord: Planet }),
  moon: z.strictObject({ sign: Sign, nakshatra: Nakshatra, pada: z.int().min(1).max(4) }),
  periods: z.array(PayloadPeriodFact).max(60),
  // reserved for the future local rulebook (§5.4): findings: z.array(RuleFinding)
};

export const ParashariPayload = z.strictObject({
  system: z.literal("parashari"),
  ayanamsa: EngineSettings.shape.parashari.shape.ayanamsa,
  ...PayloadCommon,
  facts: z.array(Fact).max(250),
});
export const KpPayload = z.strictObject({
  system: z.literal("kp"),
  ayanamsa: EngineSettings.shape.kp.shape.ayanamsa,
  ...PayloadCommon,
  facts: z.array(KpFact).max(120),
});

export const PredictionPayload = z.discriminatedUnion("system", [ParashariPayload, KpPayload]);
export type PredictionPayload = z.infer<typeof PredictionPayload>;
export type ParashariPayload = z.infer<typeof ParashariPayload>;
export type KpPayload = z.infer<typeof KpPayload>;
