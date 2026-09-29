// SPDX-License-Identifier: AGPL-3.0-or-later
// Structural checks beyond the schema: dasha contiguity and lord order, ingress ordering.
import type { Chart, DashaPeriod, SystemChart } from "@astro/schema/chart";
import type { Planet } from "@astro/schema/enums";

const ORDER: readonly Planet[] = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const next = (p: Planet): Planet => ORDER[(ORDER.indexOf(p) + 1) % 9] as Planet;
const LEVEL_DEPTH = { MD: 1, AD: 2, PD: 3, SD: 4 } as const;

function checkDasha(name: string, sys: SystemChart): string[] {
  const problems: string[] = [];
  const byLevel = new Map<string, DashaPeriod[]>();
  for (const p of sys.dasha.periods) {
    if (p.path.length !== LEVEL_DEPTH[p.level]) problems.push(`${name}: ${p.level} path length ${p.path.length}`);
    if (p.end < p.start) problems.push(`${name}: period ends before it starts`);
    const list = byLevel.get(p.level) ?? [];
    list.push(p);
    byLevel.set(p.level, list);
  }
  for (const [level, list] of byLevel) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1] as DashaPeriod;
      const b = list[i] as DashaPeriod;
      if (b.start !== a.end) {
        problems.push(`${name}: ${level} periods not contiguous at index ${i}`);
        break;
      }
      const la = a.path[a.path.length - 1] as Planet;
      const lb = b.path[b.path.length - 1] as Planet;
      const sameParent = a.path.slice(0, -1).join() === b.path.slice(0, -1).join();
      // Within a parent, lords follow the Vimshottari order; a new parent starts with its own lord.
      const expected = sameParent ? next(la) : (b.path[b.path.length - 2] as Planet);
      if (lb !== expected) {
        problems.push(`${name}: ${level} lord order broken at index ${i}`);
        break;
      }
    }
  }
  return problems;
}

export function chartSanityProblems(chart: Chart): string[] {
  const problems = [...checkDasha("parashari", chart.parashari), ...checkDasha("kp", chart.kp)];
  for (const sys of [chart.parashari, chart.kp]) {
    const names = sys.planets.map((p) => p.planet);
    if (new Set(names).size !== 9) problems.push("duplicate planets");
  }
  const byPlanet = new Map<string, string>();
  for (const ing of chart.ingresses) {
    const prev = byPlanet.get(ing.planet);
    if (prev !== undefined && ing.date < prev) {
      problems.push(`ingresses out of order for ${ing.planet}`);
      break;
    }
    byPlanet.set(ing.planet, ing.date);
  }
  return problems;
}
