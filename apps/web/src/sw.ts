// SPDX-License-Identifier: AGPL-3.0-or-later
// Precache-only service worker. It never touches API requests (they go to another origin and
// are not intercepted) and never caches anything at runtime.
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;
export {};

// Replaced at build time by the vite plugin with { version, urls }.
const MANIFEST = "__PRECACHE_MANIFEST__" as unknown as { version: string; urls: string[] };
const CACHE = `astro-beat-static-${MANIFEST.version}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(MANIFEST.urls)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("astro-beat-static-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept the API or anything cross-origin
  const path = req.mode === "navigate" ? "/" : url.pathname;
  if (!MANIFEST.urls.includes(path)) return;
  event.respondWith(caches.match(path, { cacheName: CACHE }).then((hit) => hit ?? fetch(req)));
});
