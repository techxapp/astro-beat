// SPDX-License-Identifier: AGPL-3.0-or-later
// `pnpm inversion-report [--check] [--charts N]`: measure candidate-set sizes per system and topic
// on the golden set; with --check, fail if any falls below the agreed threshold (Q1).
import { analyze } from "@astro/analysis";
import { DEFAULT_ENGINE_SETTINGS, ReferenceEngine } from "@astro/core";
import { buildPayload } from "@astro/payload";
import { TOPICS } from "@astro/schema/enums";
import { readFileSync, writeFileSync } from "node:fs";
import { GOLDEN } from "./index.ts";
import { invertPayload, type InversionResult } from "./inversion.ts";

const args = process.argv.slice(2);
const check = args.includes("--check");
const nIdx = args.indexOf("--charts");
const nCharts = nIdx >= 0 ? Number(args[nIdx + 1]) : 4;

interface Thresholds {
  /** minimum effective hours of worldwide ambiguity, per system */
  minEffectiveHours: Record<"parashari" | "kp", number>;
  /** minimum candidate days, per system */
  minCandidateDays: Record<"parashari" | "kp", number>;
}
const thresholds = JSON.parse(readFileSync(new URL("../inversion-thresholds.json", import.meta.url), "utf8")) as Thresholds;

const rows: (InversionResult & { chart: string })[] = [];
const charts = GOLDEN.filter((g) => Math.abs(g.birth.place.lat) < 60).slice(0, nCharts);
const started = Date.now();
for (const g of charts) {
  const { chart } = ReferenceEngine.computeChart(g.birth, DEFAULT_ENGINE_SETTINGS);
  const { localOnly: _l, ...pub } = analyze(chart, { asOf: "2026-09-29" });
  for (const system of ["parashari", "kp"] as const) {
    for (const topic of TOPICS) {
      const { payload } = buildPayload(pub, system, topic);
      rows.push({ chart: g.id, ...invertPayload(payload) });
    }
  }
}

const fmt = (r: (typeof rows)[number]): string =>
  `${r.chart}  ${r.system.padEnd(9)} ${r.topic.padEnd(9)} days=${String(r.candidateDays).padStart(4)} hours=${r.candidateHours.toFixed(1).padStart(6)} loc=${(100 * r.locationFraction).toFixed(3).padStart(7)}% effective=${r.effectiveHours.toFixed(4)}h`;
console.log(rows.map(fmt).join("\n"));

const summary: Record<string, { minEffectiveHours: number; medianEffectiveHours: number; minDays: number; medianDays: number; medianHours: number }> = {};
for (const system of ["parashari", "kp"] as const) {
  const rs = rows.filter((r) => r.system === system);
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  summary[system] = {
    minEffectiveHours: Math.min(...rs.map((r) => r.effectiveHours)),
    medianEffectiveHours: med(rs.map((r) => r.effectiveHours)),
    minDays: Math.min(...rs.map((r) => r.candidateDays)),
    medianDays: med(rs.map((r) => r.candidateDays)),
    medianHours: med(rs.map((r) => r.candidateHours)),
  };
}
console.log("\nSummary:", JSON.stringify(summary, null, 2), `\n(${((Date.now() - started) / 1000).toFixed(0)} s)`);
writeFileSync(new URL("../inversion-report.json", import.meta.url), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), summary, rows }, null, 1));

if (check) {
  const failures = rows.filter((r) => r.effectiveHours < thresholds.minEffectiveHours[r.system] || r.candidateDays < thresholds.minCandidateDays[r.system]);
  if (failures.length > 0) {
    console.error(`\nInversion threshold violated by ${failures.length} payload(s):\n${failures.map(fmt).join("\n")}`);
    process.exit(1);
  }
  console.log("Inversion thresholds met.");
}
