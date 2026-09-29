// SPDX-License-Identifier: AGPL-3.0-or-later
// Identifying data. Never reachable from payload / prompts / proxy (lint-enforced).
import { z } from "zod";
import { Chart } from "./chart.ts";
import { IsoDate } from "./enums.ts";
import { StoredPrediction } from "./file.ts";

export const BirthInput = z.strictObject({
  name: z.string().max(100).optional(),
  localDate: IsoDate,
  localTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  timeAccuracy: z.enum(["exact", "approx", "unknown"]),
  place: z.strictObject({
    label: z.string().max(200),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  timezone: z.strictObject({
    iana: z.string().max(64),
    utcOffsetMinutes: z.int().min(-16 * 60).max(16 * 60),
    overridden: z.boolean(),
  }),
  notes: z.string().max(5000).optional(),
});
export type BirthInput = z.infer<typeof BirthInput>;

export const ChartTemporal = z.strictObject({
  jdUt: z.number(),
  utcInstant: z.iso.datetime(),
  ayanamsaValue: z.number(),
  siderealTime: z.number(),
  deltaT: z.number(),
});
export type ChartTemporal = z.infer<typeof ChartTemporal>;

/** Plaintext inside an encrypted profile file. */
export const ProfilePlain = z.strictObject({
  profileId: z.uuid(),
  birth: BirthInput,
  temporal: ChartTemporal,
  chart: Chart,
  predictions: z.array(StoredPrediction).max(200),
});
export type ProfilePlain = z.infer<typeof ProfilePlain>;
