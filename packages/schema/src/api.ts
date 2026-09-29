// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { FactId, PeriodLabel, System, Topic } from "./enums.ts";
import { PredictionPayload } from "./payload.ts";

/** e.g. "career@1", "kp-marriage@2" */
export const PromptVersion = z.string().regex(/^[a-z]+(-[a-z]+)*@\d{1,4}$/);

export const PredictionRequest = z.strictObject({
  requestId: z.uuid(),
  promptVersion: PromptVersion.optional(),
  payload: PredictionPayload,
});
export type PredictionRequest = z.infer<typeof PredictionRequest>;

export const DECLINE_REASONS = ["medical", "death_longevity", "pregnancy_outcome", "legal", "financial_advice", "identity_inference"] as const;

export const PredictionOutput = z.strictObject({
  summary: z.string().max(1200),
  themes: z.array(z.strictObject({
    title: z.string().max(80),
    detail: z.string().max(800),
    tone: z.enum(["supportive", "mixed", "challenging"]),
    basis: z.array(FactId).min(1).max(8),
  })).min(1).max(6),
  periods: z.array(z.strictObject({
    period: PeriodLabel,
    headline: z.string().max(100),
    detail: z.string().max(600),
    confidence: z.enum(["tentative", "moderate", "stronger"]),
    basis: z.array(FactId).max(6),
  })).max(12),
  limitations: z.array(z.string().max(200)).max(5),
  declined: z.array(z.enum(DECLINE_REASONS)).max(6),
});
export type PredictionOutput = z.infer<typeof PredictionOutput>;

export const PredictionResponse = z.strictObject({
  requestId: z.uuid(),
  system: System,
  topic: Topic,
  promptVersion: PromptVersion,
  model: z.string().max(100),
  output: PredictionOutput,
  checks: z.strictObject({
    unknownFactIds: z.array(z.string().max(40)).max(20),
    unknownPeriods: z.array(z.string().max(40)).max(20),
    /** calendar dates / years the model wrote despite instructions; removed from the text */
    datesRedacted: z.int().min(0).max(1000),
  }),
  usage: z.strictObject({ inputTokens: z.int().min(0), outputTokens: z.int().min(0) }),
});
export type PredictionResponse = z.infer<typeof PredictionResponse>;

export const SessionResponse = z.strictObject({ token: z.string().max(400), expiresAt: z.iso.datetime() });
export type SessionResponse = z.infer<typeof SessionResponse>;

export const MetaResponse = z.strictObject({
  service: z.literal("astro-beat-proxy"),
  apiVersion: z.literal(1),
  sourceUrl: z.string().max(300),
  commit: z.string().max(64),
  prompts: z.array(PromptVersion).max(64),
  limits: z.strictObject({ maxBodyBytes: z.int(), perMinute: z.int(), perSessionPerDay: z.int() }),
});
export type MetaResponse = z.infer<typeof MetaResponse>;

export const ERROR_CODES = [
  "invalid_json", "invalid_payload", "unauthorized", "bad_origin", "payload_too_large", "unsupported_media_type",
  "unsupported_version", "rate_limited", "upstream_error", "model_output_invalid", "budget_exhausted",
  "upstream_timeout", "not_found", "method_not_allowed",
] as const;
export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorResponse = z.strictObject({
  error: ErrorCode,
  /** issue paths only, never values */
  issues: z.array(z.strictObject({ path: z.array(z.union([z.string().max(64), z.int()])).max(16) })).max(20).optional(),
  retryAfter: z.int().min(0).optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
