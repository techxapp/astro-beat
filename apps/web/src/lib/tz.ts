// SPDX-License-Identifier: AGPL-3.0-or-later
// Historical UTC offsets from the browser's own tz database (Intl), fully offline.

function offsetAt(iana: string, utcMs: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: iana, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

export function isValidZone(iana: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: iana });
    return true;
  } catch {
    return false;
  }
}

/**
 * UTC offset (minutes, east-positive) in force at a local civil date/time in a zone.
 * For times inside a DST gap or overlap the earlier offset is used; the UI shows the result and
 * lets the user override it.
 */
export function utcOffsetMinutes(iana: string, localDate: string, localTime: string): number {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  const [hh = 0, mm = 0, ss = 0] = localTime.split(":").map(Number);
  const localAsUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  const first = offsetAt(iana, localAsUtc);
  const second = offsetAt(iana, localAsUtc - first * 60000);
  return first === second ? first : Math.max(first, second);
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  const a = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
