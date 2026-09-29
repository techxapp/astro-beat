// SPDX-License-Identifier: AGPL-3.0-or-later
// Canary unit test (M6): sentinel births through the full local pipeline; the serialized request
// for every system × topic must contain no trace of the birth data in any encoding.
import { analyze } from "@astro/analysis";
import { DEFAULT_ENGINE_SETTINGS, ReferenceEngine } from "@astro/core";
import { buildPayload, scanForLeaks, serializeRequest } from "@astro/payload";
import { TOPICS } from "@astro/schema/enums";
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
      const { localOnly, ...pub } = analyze(chart, { asOf: "2026-09-29" });
      const chartText = {
        lons: [...chart.parashari.planets, ...chart.kp.planets].map((p) => p.lon).concat(chart.parashari.ascendantLon, ...(chart.kp.cusps ?? [])),
        dates: Object.values(localOnly.periodDates).flatMap((d) => [d.start, d.end]).slice(0, 400),
      };
      const ns = needles(b, temporal.jdUt, chartText);
      let checked = 0;
      for (const system of ["parashari", "kp"] as const) {
        if (system === "kp" && !pub.kp) continue;
        for (const topic of TOPICS) {
          const body = serializeRequest(buildPayload(pub, system, topic).payload, "00000000-0000-4000-8000-000000000000");
          expect(scanForLeaks(body)).toEqual([]);
          for (const n of ns) expect(body, `leaked ${n}`).not.toContain(n);
          checked++;
        }
      }
      expect(checked).toBeGreaterThanOrEqual(7);
    }, 60_000);
  }
});
