// SPDX-License-Identifier: AGPL-3.0-or-later
// Naisargika (natural), tatkalika (temporary) and panchadha (five-fold compound) maitri.
import type { CompoundRelation } from "@astro/schema/analysis";
import type { Planet } from "@astro/schema/enums";
import { houseFrom } from "./tables.ts";

type Natural = "friend" | "neutral" | "enemy";

/**
 * Natural relationships, BPHS ch. 3. Rows for Rahu/Ketu follow a common modern convention
 * (the classical texts give no table for the nodes); relations *toward* a node mirror the node's row.
 */
const NATURAL: Record<Planet, { friends: Planet[]; enemies: Planet[] }> = {
  Sun: { friends: ["Moon", "Mars", "Jupiter"], enemies: ["Venus", "Saturn"] },
  Moon: { friends: ["Sun", "Mercury"], enemies: [] },
  Mars: { friends: ["Sun", "Moon", "Jupiter"], enemies: ["Mercury"] },
  Mercury: { friends: ["Sun", "Venus"], enemies: ["Moon"] },
  Jupiter: { friends: ["Sun", "Moon", "Mars"], enemies: ["Mercury", "Venus"] },
  Venus: { friends: ["Mercury", "Saturn"], enemies: ["Sun", "Moon"] },
  Saturn: { friends: ["Mercury", "Venus"], enemies: ["Sun", "Moon", "Mars"] },
  Rahu: { friends: ["Mercury", "Venus", "Saturn"], enemies: ["Sun", "Moon", "Mars"] },
  Ketu: { friends: ["Mars", "Venus", "Saturn"], enemies: ["Sun", "Moon"] },
};

export function naturalRelation(a: Planet, b: Planet): Natural {
  if (a === b) return "friend";
  const isNode = (p: Planet): boolean => p === "Rahu" || p === "Ketu";
  // Toward a node, mirror the node's own row; node↔node is neutral.
  if (isNode(b) && !isNode(a)) return naturalRelation(b, a);
  if (isNode(a) && isNode(b)) return "neutral";
  const row = NATURAL[a];
  if (row.friends.includes(b)) return "friend";
  if (row.enemies.includes(b)) return "enemy";
  return "neutral";
}

/** Temporary friendship: b in the 2nd, 3rd, 4th, 10th, 11th or 12th sign from a. */
export function temporaryFriend(signA: number, signB: number): boolean {
  const h = houseFrom(signA, signB);
  return h === 2 || h === 3 || h === 4 || h === 10 || h === 11 || h === 12;
}

export function compoundRelation(a: Planet, b: Planet, signA: number, signB: number): CompoundRelation {
  const nat = naturalRelation(a, b);
  const temp = temporaryFriend(signA, signB);
  if (nat === "friend") return temp ? "adhi-mitra" : "sama";
  if (nat === "neutral") return temp ? "mitra" : "shatru";
  return temp ? "sama" : "adhi-shatru";
}

export function relationBucket(c: CompoundRelation): "friends" | "neutral" | "enemies" {
  if (c === "adhi-mitra" || c === "mitra") return "friends";
  if (c === "sama") return "neutral";
  return "enemies";
}
