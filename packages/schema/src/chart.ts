// SPDX-License-Identifier: AGPL-3.0-or-later
// Raw computed chart. LOCAL ONLY: lives in files and the vault, never in a payload.
import { z } from "zod";
import { IsoDate, Lon, Planet, Sign } from "./enums.ts";

export const EngineSettings = z.strictObject({
  engineVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  nodeType: z.enum(["mean", "true"]),
  parashari: z.strictObject({ ayanamsa: z.enum(["lahiri", "raman"]), houseSystem: z.literal("whole-sign") }),
  kp: z.strictObject({ ayanamsa: z.enum(["kp-new", "kp-old"]), houseSystem: z.literal("placidus") }),
});
export type EngineSettings = z.infer<typeof EngineSettings>;

export const PlanetPos = z.strictObject({
  planet: Planet,
  lon: Lon,
  /** degrees per day */
  speed: z.number().min(-30).max(30),
  retrograde: z.boolean(),
});
export type PlanetPos = z.infer<typeof PlanetPos>;

export const DashaLevel = z.enum(["MD", "AD", "PD", "SD"]);
export type DashaLevel = z.infer<typeof DashaLevel>;

export const DashaPeriod = z.strictObject({
  level: DashaLevel,
  path: z.array(Planet).min(1).max(4),
  start: IsoDate,
  end: IsoDate,
});
export type DashaPeriod = z.infer<typeof DashaPeriod>;

export const SystemChart = z.strictObject({
  ascendantLon: Lon,
  planets: z.array(PlanetPos).length(9),
  dasha: z.strictObject({
    yearLength: z.enum(["365.25", "360"]),
    periods: z.array(DashaPeriod).max(8000),
  }),
});
export type SystemChart = z.infer<typeof SystemChart>;

export const KpSystemChart = SystemChart.extend({
  /** Placidus cusps 1..12; null when Placidus is undefined (|lat| ≳ 66°). */
  cusps: z.array(Lon).length(12).nullable(),
});
export type KpSystemChart = z.infer<typeof KpSystemChart>;

export const TransitPlanet = z.enum(["Jupiter", "Saturn", "Rahu", "Ketu"]);
export type TransitPlanet = z.infer<typeof TransitPlanet>;

export const Ingress = z.strictObject({
  planet: TransitPlanet,
  sign: Sign,
  date: IsoDate,
  retrogradeReentry: z.boolean(),
});
export type Ingress = z.infer<typeof Ingress>;

export const Chart = z.strictObject({
  settings: EngineSettings,
  parashari: SystemChart,
  kp: KpSystemChart,
  /** Sidereal (Parashari ayanamsa) sign ingresses from birth, ~120 years. */
  ingresses: z.array(Ingress).max(600),
});
export type Chart = z.infer<typeof Chart>;
// Signs, nakshatras, vargas and houses are pure functions of longitude and are derived in analysis.

/**
 * Tropical (Western) positions derived from a Chart, plus transit samples around "today".
 * Computed by the worker for each analysis and never stored or sent.
 */
export const WesternChart = z.strictObject({
  /** UT birth date (the first dasha period starts at birth); profection years start on its anniversaries */
  birthDate: IsoDate,
  ascendantLon: Lon,
  /** null when Placidus is undefined (|lat| ≳ 66°) */
  midheavenLon: Lon.nullable(),
  /** tropical Placidus cusps 1..12; null when undefined (whole-sign houses are used instead) */
  cusps: z.array(Lon).length(12).nullable(),
  /** tropical positions; Rahu is the North Node and Ketu the South Node */
  planets: z.array(PlanetPos).length(9),
  /** tropical longitudes of the slow movers, sampled at a fixed step */
  transits: z.array(z.strictObject({ date: IsoDate, Jupiter: Lon, Saturn: Lon, NorthNode: Lon })).max(3000),
});
export type WesternChart = z.infer<typeof WesternChart>;
