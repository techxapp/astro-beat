// SPDX-License-Identifier: AGPL-3.0-or-later
// Jaimini chara karakas: ranked by degrees within sign (Rahu counted backwards from 30°).
import type { CharaKaraka, Planet } from "@astro/schema/enums";
import type { NatalContext } from "./context.ts";
import { degInSign } from "./tables.ts";

const EIGHT: readonly CharaKaraka[] = ["AK", "AmK", "BK", "MK", "PiK", "PK", "GK", "DK"];
const SEVEN: readonly CharaKaraka[] = ["AK", "AmK", "BK", "MK", "PK", "GK", "DK"];

export function charaKarakas(ctx: NatalContext, count: 7 | 8): { karaka: CharaKaraka; planet: Planet }[] {
  const planets: Planet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  if (count === 8) planets.push("Rahu");
  const deg = (p: Planet): number => (p === "Rahu" ? 30 - degInSign(ctx.lon[p]) : degInSign(ctx.lon[p]));
  const ranked = [...planets].sort((a, b) => deg(b) - deg(a));
  const names = count === 8 ? EIGHT : SEVEN;
  return ranked.map((planet, i) => ({ karaka: names[i] as CharaKaraka, planet }));
}
