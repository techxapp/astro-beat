// SPDX-License-Identifier: AGPL-3.0-or-later
import type { YogaId, YogaModifier } from "@astro/schema/analysis";
import type { Dignity, Planet, YogaFamily } from "@astro/schema/enums";
import type { NatalContext } from "../context.ts";

export interface YogaContext extends NatalContext {
  dignity: Record<Planet, Dignity>;
  combust: Record<Planet, boolean>;
  /** house lord (1..12) → planet */
  lord: (house: number) => Planet;
  /** houses owned by a planet (whole sign) */
  owns: (p: Planet) => number[];
  /** association: same sign, mutual graha drishti, or sign exchange */
  associated: (a: Planet, b: Planet) => boolean;
}

export interface YogaHit {
  planets: Planet[];
  /** extra modifiers the detector knows about (e.g. "cancelled"); generic ones are added by the runner */
  modifiers?: YogaModifier[];
}

/**
 * One yoga definition. Detection only: meaning and weighting are rulebook work (§5.4).
 * `variant` names the definition used where texts disagree; every such choice is listed for review.
 */
export interface YogaDefinition {
  id: YogaId;
  family: YogaFamily;
  definition: string;
  sourceNote: string;
  variant: string;
  detect: (ctx: YogaContext) => YogaHit[];
}
