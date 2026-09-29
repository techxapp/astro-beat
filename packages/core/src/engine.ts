// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Chart, EngineSettings, KpSystemChart, PlanetPos, SystemChart } from "@astro/schema/chart";
import { PLANETS, type Planet } from "@astro/schema/enums";
import type { BirthInput, ChartTemporal } from "@astro/schema/identifying";
import { vimshottari, type YearLength } from "./dasha.ts";
import { gmstDegrees, meanObliquity, tropicalLongitude } from "./ephemeris.ts";
import { ascendant, placidusCusps } from "./houses.ts";
import { findIngresses } from "./ingress.ts";
import { norm180, norm360 } from "./math.ts";
import { ayanamsa, type AyanamsaId } from "./sidereal.ts";
import { decimalYearFromJd, deltaTSeconds, isoInstantFromJd, jdTtFromUt, jdUtFromLocal } from "./time.ts";

export const ENGINE_VERSION = "0.1.0";

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  engineVersion: ENGINE_VERSION,
  nodeType: "mean",
  parashari: { ayanamsa: "lahiri", houseSystem: "whole-sign" },
  kp: { ayanamsa: "kp-old", houseSystem: "placidus" },
};

/** The moment and place a chart is cast for. Identifying: local only. */
export interface ChartMoment {
  jdUt: number;
  lat: number;
  /** east-positive */
  lon: number;
}

export interface ChartOptions {
  yearLength?: YearLength;
  /** ingress search horizon, years */
  ingressYears?: number;
}

/**
 * The engine interface. `ReferenceEngine` (pure TS, ~1′) implements it today; a Swiss Ephemeris
 * WASM adapter will implement the same interface (Q2).
 */
export interface ChartEngine {
  readonly id: string;
  computeChart(input: BirthInput, settings: EngineSettings, opts?: ChartOptions): { chart: Chart; temporal: ChartTemporal };
  /** Sidereal longitudes of the nine grahas at a moment (used by the inversion harness). */
  siderealPositions(jdUt: number, ayanamsaId: AyanamsaId, nodeType: "mean" | "true"): PlanetPos[];
  /** Sidereal ascendant (and Placidus cusps when defined) at a moment and place. */
  siderealAngles(m: ChartMoment, ayanamsaId: AyanamsaId): { ascendant: number; cusps: number[] | null };
}

export function momentFromBirth(input: BirthInput): ChartMoment {
  return {
    jdUt: jdUtFromLocal(input.localDate, input.localTime, input.timezone.utcOffsetMinutes),
    lat: input.place.lat,
    lon: input.place.lon,
  };
}

function siderealPositions(jdUt: number, ayanamsaId: AyanamsaId, nodeType: "mean" | "true"): PlanetPos[] {
  const tt = jdTtFromUt(jdUt);
  const ayan = ayanamsa(ayanamsaId, tt);
  const h = 0.5;
  return PLANETS.map((planet: Planet): PlanetPos => {
    const lon = norm360(tropicalLongitude(planet, tt, nodeType) - ayan);
    const speed = norm180(tropicalLongitude(planet, tt + h, nodeType) - tropicalLongitude(planet, tt - h, nodeType)) / (2 * h);
    const retrograde = planet === "Rahu" || planet === "Ketu" ? (nodeType === "mean" ? true : speed < 0) : speed < 0;
    return { planet, lon, speed, retrograde };
  });
}

function siderealAngles(m: ChartMoment, ayanamsaId: AyanamsaId): { ascendant: number; cusps: number[] | null; lst: number } {
  const tt = jdTtFromUt(m.jdUt);
  const eps = meanObliquity(tt);
  const lst = norm360(gmstDegrees(m.jdUt) + m.lon);
  const ayan = ayanamsa(ayanamsaId, tt);
  const tropCusps = placidusCusps(lst, m.lat, eps);
  return {
    ascendant: norm360(ascendant(lst, m.lat, eps) - ayan),
    cusps: tropCusps ? tropCusps.map((c) => norm360(c - ayan)) : null,
    lst,
  };
}

function systemChart(m: ChartMoment, ayanamsaId: AyanamsaId, nodeType: "mean" | "true", yearLength: YearLength): SystemChart {
  const planets = siderealPositions(m.jdUt, ayanamsaId, nodeType);
  const moon = planets.find((p) => p.planet === "Moon") as PlanetPos;
  return {
    ascendantLon: siderealAngles(m, ayanamsaId).ascendant,
    planets,
    dasha: { yearLength, periods: vimshottari(moon.lon, m.jdUt, { yearLength, depth: 3 }) },
  };
}

export function computeChartAt(m: ChartMoment, settings: EngineSettings, opts: ChartOptions = {}): Chart {
  const yearLength = opts.yearLength ?? "365.25";
  const parashari = systemChart(m, settings.parashari.ayanamsa, settings.nodeType, yearLength);
  const kpBase = systemChart(m, settings.kp.ayanamsa, settings.nodeType, yearLength);
  const kp: KpSystemChart = { ...kpBase, cusps: siderealAngles(m, settings.kp.ayanamsa).cusps };
  const ingresses = findIngresses(m.jdUt, {
    ayanamsa: settings.parashari.ayanamsa,
    nodeType: settings.nodeType,
    years: opts.ingressYears ?? 120,
  });
  return { settings, parashari, kp, ingresses };
}

export const ReferenceEngine: ChartEngine = {
  id: "reference-ts",
  computeChart(input, settings, opts) {
    const m = momentFromBirth(input);
    const chart = computeChartAt(m, settings, opts);
    const tt = jdTtFromUt(m.jdUt);
    const temporal: ChartTemporal = {
      jdUt: m.jdUt,
      utcInstant: isoInstantFromJd(m.jdUt),
      ayanamsaValue: ayanamsa(settings.parashari.ayanamsa, tt),
      siderealTime: siderealAngles(m, settings.parashari.ayanamsa).lst,
      deltaT: deltaTSeconds(decimalYearFromJd(m.jdUt)),
    };
    return { chart, temporal };
  },
  siderealPositions,
  siderealAngles(m, id) {
    const { ascendant: asc, cusps } = siderealAngles(m, id);
    return { ascendant: asc, cusps };
  },
};
