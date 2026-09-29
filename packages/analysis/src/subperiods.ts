// SPDX-License-Identifier: AGPL-3.0-or-later
// Explorer-only: derive the next Vimshottari level (e.g. SD within a PD) on demand. Charts store
// MD/AD/PD only, which keeps chart files well under the 1 MB import limit. Dates are day-precise.
import type { DashaPeriod } from "@astro/schema/chart";
import type { Planet } from "@astro/schema/enums";
import { VIMSHOTTARI_ORDER, VIMSHOTTARI_YEARS } from "./tables.ts";

const DAY = 86_400_000;
const toMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const NEXT_LEVEL = { MD: "AD", AD: "PD", PD: "SD" } as const;

export function subPeriodsOf(p: DashaPeriod): DashaPeriod[] {
  if (p.level === "SD") return [];
  const lord = p.path[p.path.length - 1] as Planet;
  const start = toMs(p.start);
  const span = toMs(p.end) - start;
  const i0 = VIMSHOTTARI_ORDER.indexOf(lord);
  const out: DashaPeriod[] = [];
  let t = start;
  for (let k = 0; k < 9; k++) {
    const sub = VIMSHOTTARI_ORDER[(i0 + k) % 9] as Planet;
    const d = (span * VIMSHOTTARI_YEARS[sub]) / 120;
    out.push({
      level: NEXT_LEVEL[p.level],
      path: [...p.path, sub],
      start: toIso(Math.round(t / DAY) * DAY),
      end: toIso(Math.round((t + d) / DAY) * DAY),
    });
    t += d;
  }
  return out;
}
