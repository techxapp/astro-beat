// SPDX-License-Identifier: AGPL-3.0-or-later
// ChartFile v1. Analysis is never stored in files: it is recomputed on import.
import { z } from "zod";
import { PredictionResponse } from "./api.ts";
import { Chart } from "./chart.ts";
import { FactId, IsoDate, PeriodLabel, System } from "./enums.ts";

export const FILE_VERSION = 1 as const;

/** A prediction as kept locally: the response plus the label→date snapshot used to render it. */
export const StoredPrediction = z.strictObject({
  id: z.uuid(),
  system: System,
  createdAt: IsoDate,
  response: PredictionResponse,
  /** payload label → local dates at the time of the reading */
  periodDates: z.record(PeriodLabel, z.strictObject({ start: IsoDate, end: IsoDate })),
  /** payload fact id → analysis fact id, for basis chips */
  factIdMap: z.record(FactId, FactId),
});
export type StoredPrediction = z.infer<typeof StoredPrediction>;

const Hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const B64 = (maxLen: number) => z.string().max(maxLen).regex(/^[A-Za-z0-9+/]*={0,2}$/);

export const ChartOnlyFile = z.strictObject({
  format: z.literal("astro-beat"),
  fileVersion: z.literal(FILE_VERSION),
  kind: z.literal("chart-only"),
  chart: Chart,
  predictions: z.array(StoredPrediction).max(200).optional(),
  /** SHA-256 over canonical JSON of the file without `checksum` */
  checksum: z.strictObject({ alg: z.literal("SHA-256"), value: Hex64 }),
});
export type ChartOnlyFile = z.infer<typeof ChartOnlyFile>;

export const EncryptedProfileHeader = z.strictObject({
  format: z.literal("astro-beat"),
  fileVersion: z.literal(FILE_VERSION),
  kind: z.literal("encrypted-profile"),
  kdf: z.strictObject({
    name: z.literal("PBKDF2-SHA256"),
    iterations: z.int().min(100_000).max(10_000_000),
    salt: B64(64),
  }),
  cipher: z.strictObject({ name: z.literal("AES-256-GCM"), iv: B64(32) }),
});
export type EncryptedProfileHeader = z.infer<typeof EncryptedProfileHeader>;

export const EncryptedProfileFile = EncryptedProfileHeader.extend({
  /** AES-GCM ciphertext (with tag); AAD = canonical JSON of the header */
  ciphertext: B64(1_400_000),
});
export type EncryptedProfileFile = z.infer<typeof EncryptedProfileFile>;

export const ChartFile = z.discriminatedUnion("kind", [ChartOnlyFile, EncryptedProfileFile]);
export type ChartFile = z.infer<typeof ChartFile>;
