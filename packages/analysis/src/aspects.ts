// SPDX-License-Identifier: AGPL-3.0-or-later
// Graha drishti (sign-based, whole houses).
import type { AnalysisConventions, AspectKind } from "@astro/schema/analysis";
import type { Planet } from "@astro/schema/enums";

/** Aspects cast by a planet as (house offset counted inclusively, kind). */
export function aspectsOf(p: Planet, nodeAspects: AnalysisConventions["nodeAspects"]): { offset: number; kind: AspectKind }[] {
  const seventh = { offset: 7, kind: "7" as const };
  switch (p) {
    case "Mars":
      return [{ offset: 4, kind: "mars-4" }, seventh, { offset: 8, kind: "mars-8" }];
    case "Jupiter":
      return [{ offset: 5, kind: "jupiter-5" }, seventh, { offset: 9, kind: "jupiter-9" }];
    case "Saturn":
      return [{ offset: 3, kind: "saturn-3" }, seventh, { offset: 10, kind: "saturn-10" }];
    case "Rahu":
    case "Ketu":
      if (nodeAspects === "none") return [];
      if (nodeAspects === "7") return [seventh];
      return [{ offset: 5, kind: "node-5" }, seventh, { offset: 9, kind: "node-9" }];
    default:
      return [seventh];
  }
}

/** Does `from` (in sign `fromSign`) aspect sign `toSign`? */
export function aspectsSign(from: Planet, fromSign: number, toSign: number, nodeAspects: AnalysisConventions["nodeAspects"]): boolean {
  const h = ((toSign - fromSign + 12) % 12) + 1;
  return aspectsOf(from, nodeAspects).some((a) => a.offset === h);
}
