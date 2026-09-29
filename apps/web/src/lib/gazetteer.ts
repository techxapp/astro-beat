// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadStaticJson } from "../net/static.ts";
// Offline place search over GeoNames data (CC BY 4.0) served from /geo. Loaded from our own
// origin only; nothing about the query leaves the device.

export interface Place {
  name: string;
  admin: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
}

type Row = [name: string, admin: string, country: string, lat: number, lon: number, tz: string];

let index: Promise<Place[]> | null = null;

const fold = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

async function load(): Promise<Place[]> {
  // The committed seed is small; `scripts/build-gazetteer.mjs` writes the full cities15000 index.
  const rows = (await loadStaticJson<Row[]>("/geo/cities.json")) ?? [];
  return rows.map(([name, admin, country, lat, lon, tz]) => ({ name, admin, country, lat, lon, tz }));
}

export async function searchPlaces(query: string, limit = 12): Promise<Place[]> {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  index ??= load();
  const all = await index;
  const starts: Place[] = [];
  const contains: Place[] = [];
  for (const p of all) {
    const n = fold(p.name);
    if (n.startsWith(q)) starts.push(p);
    else if (n.includes(q)) contains.push(p);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export const placeLabel = (p: Place): string => [p.name, p.admin, p.country].filter(Boolean).join(", ");
