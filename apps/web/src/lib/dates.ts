// SPDX-License-Identifier: AGPL-3.0-or-later
/** Today's local date (YYYY-MM-DD). Used only on this device, to mark period status. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
