// SPDX-License-Identifier: AGPL-3.0-or-later
// Same-origin static data (e.g. the offline gazetteer). Precached by the service worker.
export async function loadStaticJson<T>(path: `/${string}`): Promise<T | null> {
  const res = await fetch(path, { credentials: "omit", referrerPolicy: "no-referrer" });
  return res.ok ? ((await res.json()) as T) : null;
}
