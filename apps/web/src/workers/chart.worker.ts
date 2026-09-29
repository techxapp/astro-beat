// SPDX-License-Identifier: AGPL-3.0-or-later
// Chart worker: @astro/core (ephemeris) wired into @astro/analysis. No network access.
/// <reference lib="webworker" />
import { analyze, kpLordsAt } from "@astro/analysis";
import { momentFromBirth, ReferenceEngine } from "@astro/core";
import type { CuspSensitivity, Envelope, WorkerRequest, WorkerResponse } from "./protocol.ts";

declare const self: DedicatedWorkerGlobalScope;

function sensitivity(req: Extract<WorkerRequest, { type: "sensitivity" }>): CuspSensitivity[] | null {
  const m = momentFromBirth(req.birth);
  const ay = req.settings.kp.ayanamsa;
  const base = ReferenceEngine.siderealAngles(m, ay).cusps;
  if (!base) return null;
  const baseSubs = base.map((c) => kpLordsAt(c).subLord);
  const at = (minutes: number) => ReferenceEngine.siderealAngles({ ...m, jdUt: m.jdUt + minutes / 1440 }, ay).cusps;
  const out: CuspSensitivity[] = base.map((_, i) => ({ cusp: i + 1, earlier: null, later: null }));
  for (const dir of [-1, 1] as const) {
    for (let k = 1; k <= 60; k++) {
      const cusps = at(dir * k);
      if (!cusps) break;
      cusps.forEach((c, i) => {
        const row = out[i] as CuspSensitivity;
        const key = dir < 0 ? "earlier" : "later";
        if (row[key] === null && kpLordsAt(c).subLord !== baseSubs[i]) row[key] = k;
      });
    }
  }
  return out;
}

function handle(req: WorkerRequest): WorkerResponse {
  switch (req.type) {
    case "compute": {
      const { chart, temporal } = ReferenceEngine.computeChart(req.birth, req.settings);
      return { type: "compute", chart, temporal, analysis: analyze(chart, { asOf: req.asOf, conventions: req.conventions }) };
    }
    case "analyze":
      return { type: "analyze", analysis: analyze(req.chart, { asOf: req.asOf, conventions: req.conventions }) };
    case "sensitivity":
      return { type: "sensitivity", cusps: sensitivity(req) };
  }
}

self.onmessage = (e: MessageEvent<{ id: number; req: WorkerRequest }>) => {
  const { id, req } = e.data;
  let msg: Envelope<WorkerResponse>;
  try {
    msg = { id, ok: true, result: handle(req) };
  } catch (err) {
    msg = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(msg);
};
