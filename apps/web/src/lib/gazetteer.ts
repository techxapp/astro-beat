// SPDX-License-Identifier: AGPL-3.0-or-later
import { geocodeOnline } from "../net/api.ts";
import { loadStaticJson } from "../net/static.ts";
import { isValidZone } from "./tz.ts";
// Place search over GeoNames data (CC BY 4.0) served from /geo. `searchPlaces` is fully offline:
// loaded from our own origin only, nothing about the query leaves the device. `searchPlacesOnline`
// is the explicit, user-triggered fallback and sends the typed text to our proxy.

export interface Place {
  name: string;
  admin: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
}

type Row = [name: string, admin: string, country: string, lat: number, lon: number, tz: string];
interface Entry {
  place: Place;
  name: string;
  full: string;
}

let index: Promise<Entry[]> | null = null;

export const fold = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

async function load(): Promise<Entry[]> {
  // `scripts/build-gazetteer.mjs` writes this from GeoNames cities5000, sorted by population.
  const rows = (await loadStaticJson<Row[]>("/geo/cities.json")) ?? [];
  return rows.map(([name, admin, country, lat, lon, tz]) => {
    const n = fold(name);
    return { place: { name, admin, country, lat, lon, tz }, name: n, full: `${n} ${fold(admin)}` };
  });
}

export async function searchPlaces(query: string, limit = 12): Promise<Place[]> {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  index ??= load();
  const all = await index;
  const starts: Place[] = [];
  const contains: Place[] = [];
  const region: Place[] = [];
  for (const e of all) {
    if (e.name.startsWith(q)) starts.push(e.place);
    else if (e.name.includes(q)) contains.push(e.place);
    else if (e.full.includes(q)) region.push(e.place);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains, ...region].slice(0, limit);
}

/** Explicit online lookup through our proxy. Never call this without a user action. */
export async function searchPlacesOnline(query: string): Promise<Place[]> {
  const found = await geocodeOnline(query.trim());
  return found.filter((p) => isValidZone(p.tz));
}

export const placeLabel = (p: Place): string => [p.name, p.admin, p.country].filter(Boolean).join(", ");
