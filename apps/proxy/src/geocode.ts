// SPDX-License-Identifier: AGPL-3.0-or-later
// Opt-in place lookup via the Open-Meteo Geocoding API (GeoNames-based, no key). The host is
// fixed; only the typed place text is sent, with no cookies and no client IP or headers.
// NOTE: Open-Meteo's free tier is for non-commercial use; revisit if that changes.
import { GeocodePlace } from "@astro/schema/api";

export class GeocodeError extends Error {
  readonly kind: "timeout" | "http" | "shape";
  constructor(kind: "timeout" | "http" | "shape", message: string) {
    super(message);
    this.kind = kind;
    this.name = "GeocodeError";
  }
}

export type Geocoder = (query: string, timeoutMs: number) => Promise<GeocodePlace[]>;

interface OpenMeteoBody {
  results?: {
    name?: unknown; latitude?: unknown; longitude?: unknown; timezone?: unknown; admin1?: unknown; country_code?: unknown;
  }[];
}

export function openMeteoGeocoder(fetchImpl: typeof fetch = fetch): Geocoder {
  return async (query, timeoutMs) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "10");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    let res: Response;
    try {
      res = await fetchImpl(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    } catch (e) {
      if (ctrl.signal.aborted) throw new GeocodeError("timeout", "geocoder timed out");
      throw new GeocodeError("http", e instanceof Error ? e.name : "network error");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new GeocodeError("http", `geocoder status ${res.status}`);
    const body = (await res.json().catch(() => null)) as OpenMeteoBody | null;
    if (!body || typeof body !== "object") throw new GeocodeError("shape", "bad geocoder body");
    // No results is a normal answer: Open-Meteo omits `results` entirely.
    const places: GeocodePlace[] = [];
    for (const r of body.results ?? []) {
      const parsed = GeocodePlace.safeParse({
        name: r.name, admin: r.admin1 ?? "", country: r.country_code ?? "", lat: r.latitude, lon: r.longitude, tz: r.timezone,
      });
      if (parsed.success) places.push(parsed.data);
    }
    return places;
  };
}
