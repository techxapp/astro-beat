// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

export const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"] as const;
export const Planet = z.enum(PLANETS);
export type Planet = z.infer<typeof Planet>;

/** The seven visible grahas (no nodes). */
export const GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;
export type Graha = (typeof GRAHAS)[number];

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;
export const Sign = z.enum(SIGNS);
export type Sign = z.infer<typeof Sign>;

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "PurvaPhalguni", "UttaraPhalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "PurvaAshadha", "UttaraAshadha", "Shravana", "Dhanishta", "Shatabhisha", "PurvaBhadrapada",
  "UttaraBhadrapada", "Revati",
] as const;
export const Nakshatra = z.enum(NAKSHATRAS);
export type Nakshatra = z.infer<typeof Nakshatra>;

export const VARGAS = ["D1", "D2", "D3", "D4", "D7", "D9", "D10", "D12", "D16", "D20", "D24", "D27", "D30", "D40", "D45", "D60"] as const;
export const Varga = z.enum(VARGAS);
export type Varga = z.infer<typeof Varga>;

export const DIGNITIES = [
  "exalted", "moolatrikona", "own", "great-friend", "friend", "neutral", "enemy", "great-enemy", "debilitated",
] as const;
export const Dignity = z.enum(DIGNITIES);
export type Dignity = z.infer<typeof Dignity>;

export const TOPICS = ["career", "marriage", "finance", "health", "education", "children", "general"] as const;
export const Topic = z.enum(TOPICS);
export type Topic = z.infer<typeof Topic>;

/** The branches a reading can come from. */
export const BRANCHES = ["parashari", "kp", "western", "numerology"] as const;
export const Branch = z.enum(BRANCHES);
export type Branch = z.infer<typeof Branch>;

/** A reading's system: one branch, or "combined" (several branches compared side by side). */
export const SYSTEMS = [...BRANCHES, "combined"] as const;
export const System = z.enum(SYSTEMS);
export type System = z.infer<typeof System>;

/** Systems whose payload is built from the chart analysis alone (numerology needs the birth date). */
export type ChartSystem = "parashari" | "kp" | "western";

export const HouseNum = z.int().min(1).max(12);
export type HouseNum = number;

export const IsoDate = z.iso.date();
export type IsoDate = string;

/** Sidereal or tropical ecliptic longitude in degrees, [0, 360). */
export const Lon = z.number().min(0).lt(360);

export const CHARA_KARAKAS = ["AK", "AmK", "BK", "MK", "PiK", "PK", "GK", "DK"] as const;
export const CharaKaraka = z.enum(CHARA_KARAKAS);
export type CharaKaraka = z.infer<typeof CharaKaraka>;

export const YOGA_FAMILIES = ["mahapurusha", "raja", "dhana", "viparita", "lunar", "solar", "parivartana", "cancellation"] as const;
export const YogaFamily = z.enum(YOGA_FAMILIES);
export type YogaFamily = z.infer<typeof YogaFamily>;

export const FactId = z.string().regex(/^F\d{1,4}$/);
export type FactId = string;
export const PeriodLabel = z.string().regex(/^P\d{1,4}$/);
export type PeriodLabel = string;

// ---------------------------------------------------------------- Western (tropical) astrology
/** Bodies of the reference engine in Western naming. Outer planets need the Swiss Ephemeris adapter. */
export const WESTERN_BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "NorthNode", "SouthNode"] as const;
export const WesternBody = z.enum(WESTERN_BODIES);
export type WesternBody = z.infer<typeof WesternBody>;

export const WESTERN_POINTS = [...WESTERN_BODIES, "Ascendant", "Midheaven"] as const;
export const WesternPoint = z.enum(WESTERN_POINTS);
export type WesternPoint = z.infer<typeof WesternPoint>;

export const WESTERN_ASPECTS = ["conjunction", "sextile", "square", "trine", "opposition"] as const;
export const WesternAspect = z.enum(WESTERN_ASPECTS);
export type WesternAspect = z.infer<typeof WesternAspect>;

/** Essential dignity by sign (traditional rulerships). Nodes have none. */
export const WesternDignity = z.enum(["domicile", "exaltation", "detriment", "fall", "peregrine", "none"]);
export type WesternDignity = z.infer<typeof WesternDignity>;

// ---------------------------------------------------------------- numerology (Pythagorean)
/** Reduced numerology values: 0..9 plus the master numbers 11, 22 and 33. */
export const NumerologyValue = z.union([z.int().min(0).max(9), z.literal(11), z.literal(22), z.literal(33)]);
export type NumerologyValue = z.infer<typeof NumerologyValue>;
export const KarmicDebt = z.union([z.literal(13), z.literal(14), z.literal(16), z.literal(19)]);
export type KarmicDebt = z.infer<typeof KarmicDebt>;
