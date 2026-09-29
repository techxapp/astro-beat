// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar ↔ Julian Day (Meeus, Astronomical Algorithms ch. 7) and ΔT (Espenak & Meeus polynomials).

export const J2000 = 2451545.0;

/** Julian Day for a proleptic Gregorian (after 1582-10-15) or Julian calendar date; `day` may be fractional. */
export function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const gregorian = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
  const a = Math.floor(y / 100);
  const b = gregorian ? 2 - a + Math.floor(a / 4) : 0;
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
  /** fraction of day, [0, 1) */
  fraction: number;
}

export function calendarFromJd(jd: number): CalendarDate {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day, fraction: f };
}

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

/** UT calendar date (YYYY-MM-DD) containing the given JD. */
export function isoDateFromJd(jd: number): string {
  const { year, month, day } = calendarFromJd(jd);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function isoInstantFromJd(jd: number): string {
  const { year, month, day, fraction } = calendarFromJd(jd);
  let ms = Math.round(fraction * 86_400_000);
  if (ms >= 86_400_000) ms = 86_399_999;
  const hh = Math.floor(ms / 3_600_000);
  const mm = Math.floor((ms % 3_600_000) / 60_000);
  const ss = Math.floor((ms % 60_000) / 1000);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:${pad(ss)}Z`;
}

export function jdFromIsoDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return julianDay(y, m, d);
}

/**
 * Julian Day (UT) of a local civil date/time with a fixed UTC offset.
 * `localTime` is "HH:MM" or "HH:MM:SS".
 */
export function jdUtFromLocal(localDate: string, localTime: string, utcOffsetMinutes: number): number {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  const [hh = 0, mm = 0, ss = 0] = localTime.split(":").map(Number);
  const minutes = hh * 60 + mm + ss / 60 - utcOffsetMinutes;
  return julianDay(y, m, d) + minutes / 1440;
}

/** ΔT = TT − UT in seconds (Espenak & Meeus 2006 polynomial fits). */
export function deltaTSeconds(decimalYear: number): number {
  const y = decimalYear;
  if (y >= 1800 && y < 1860) {
    const t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4
      + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (y >= 1860 && y < 1900) {
    const t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y >= 1900 && y < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y >= 1920 && y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y >= 1941 && y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y >= 1961 && y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y >= 1986 && y < 2005) {
    const t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y >= 2005 && y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  const u = (y - 1820) / 100;
  if (y >= 2050 && y < 2150) return -20 + 32 * u * u - 0.5628 * (2150 - y);
  return -20 + 32 * u * u;
}

export function decimalYearFromJd(jd: number): number {
  return 2000 + (jd - J2000) / 365.25;
}

/** JD (TT) from JD (UT). */
export function jdTtFromUt(jdUt: number): number {
  return jdUt + deltaTSeconds(decimalYearFromJd(jdUt)) / 86400;
}
