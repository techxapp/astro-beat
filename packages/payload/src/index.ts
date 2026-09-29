// SPDX-License-Identifier: AGPL-3.0-or-later
import { PredictionRequest } from "@astro/schema/api";
import type { PredictionPayload } from "@astro/schema/payload";
import { scanForLeaks } from "./leaks.ts";

export { buildPayload, selectPeriods, PayloadUnavailableError, MAX_FACTS, MAX_PERIODS, type BuiltPayload } from "./build.ts";
export { TOPIC_SPECS, KP_TOPIC_SPECS, type TopicSpec, type KpTopicSpec, type PeriodWindow } from "./topics.ts";
export { scanForLeaks, type LeakFinding } from "./leaks.ts";

export class PayloadLeakError extends Error {
  readonly findings: ReturnType<typeof scanForLeaks>;
  constructor(findings: ReturnType<typeof scanForLeaks>) {
    super(`Refusing to send: ${findings.length} suspicious token(s) in the request body.`);
    this.findings = findings;
    this.name = "PayloadLeakError";
  }
}

/**
 * Serialize the request exactly once. The returned string is what the consent screen shows and
 * what is sent, byte for byte.
 */
export function serializeRequest(payload: PredictionPayload, requestId: string, promptVersion?: string): string {
  const req = PredictionRequest.parse({ requestId, ...(promptVersion ? { promptVersion } : {}), payload });
  const body = JSON.stringify(req);
  const findings = scanForLeaks(body);
  if (findings.length > 0) throw new PayloadLeakError(findings);
  return body;
}
