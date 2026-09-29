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

export const System = z.enum(["parashari", "kp"]);
export type System = z.infer<typeof System>;

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
