// SPDX-License-Identifier: AGPL-3.0-or-later
// Canary unit test (M6): sentinel births through the full local pipeline; the serialized request
// for every system (including Western, numerology and combined) × topic must contain no trace of the
// birth data in any encoding.
import { analyze } from "@astro/analysis";
import { DEFAULT_ENGINE_SETTINGS, ReferenceEngine, westernChart } from "@astro/core";
import { numerology } from "@astro/numerology";
import { buildCombinedPayload, buildNumerologyPayload, buildPayload, scanForLeaks, serializeRequest } from "@astro/payload";
import { BRANCHES, TOPICS } from "@astro/schema/enums";
import type { PredictionPayload } from "@astro/schema/payload";
import { describe, expect, it } from "vitest";
import { SENTINELS } from "../src/index.ts";

function needles(b: (typeof SENTINELS)[number], jdUt: number, chartText: { lons: number[]; dates: string[] }): string[] {
  const [y, m, d] = b.localDate.split("-");
  const out = [
    b.name ?? "", b.notes ?? "", b.place.label, ...b.place.label.split(/[ ,]+/).filter((s) => s.length > 3), b.timezone.iana,
    ...b.timezone.iana.split("/"), b.localDate, `${d}/${m}/${y}`, `${m}/${d}/${y}`, `${d}.${m}.${y}`, y!, b.localTime, b.localTime.replace(":", ""),
    String(b.timezone.utcOffsetMinutes === 0 ? "UTC+00" : b.timezone.utcOffsetMinutes),
    String(Math.round((jdUt - 2440587.5) * 86400000)), String(Math.round((jdUt - 2440587.5) * 86400)),
    jdUt.toFixed(1), jdUt.toFixed(3),
  ];
  for (const p of [1, 2, 3, 4]) out.push(b.place.lat.toFixed(p), b.place.lon.toFixed(p));
  for (const lon of chartText.lons) out.push(lon.toFixed(2), lon.toFixed(4));
  out.push(...chartText.dates);
  return out.filter((s) => s.length >= 3);
}

describe("canary: nothing identifying reaches the request body", () => {
  for (const b of SENTINELS) {
    it(`${b.name}`, () => {
      const { chart, temporal } = ReferenceEngine.computeChart(b, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
      const asOf = "2026-09-29";
      const western = westernChart(chart, { asOf });
      const { localOnly, ...pub } = analyze(chart, { asOf, western });
      const num = numerology({ birthDate: b.localDate, name: b.name }, { asOf });
      const chartText = {
        lons: [...chart.parashari.planets, ...chart.kp.planets, ...western.planets].map((p) => p.lon)
          .concat(chart.parashari.ascendantLon, ...(chart.kp.cusps ?? []), western.ascendantLon, ...(western.cusps ?? [])),
        dates: [...Object.values(localOnly.periodDates), ...Object.values(num.periodDates)].flatMap((d) => [d.start, d.end]).slice(0, 600),
      };
      const ns = needles(b, temporal.jdUt, chartText);
      const payloads: PredictionPayload[] = [];
      for (const topic of TOPICS) {
        for (const system of ["parashari", "kp", "western"] as const) {
          if (system === "kp" && !pub.kp) continue;
          payloads.push(buildPayload(pub, system, topic).payload);
        }
        payloads.push(buildNumerologyPayload(num.analysis, topic).payload);
        const branches = BRANCHES.filter((x) => x !== "kp" || pub.kp);
        payloads.push(buildCombinedPayload({ analysis: pub, numerology: num.analysis }, branches, topic).payload);
      }
      for (const payload of payloads) {
        const body = serializeRequest(payload, "00000000-0000-4000-8000-000000000000");
        expect(scanForLeaks(body)).toEqual([]);
        for (const n of ns) expect(body, `leaked ${n} (${payload.system}/${payload.topic})`).not.toContain(n);
      }
      expect(payloads.length).toBeGreaterThanOrEqual(28);
    }, 60_000);
  }
});
