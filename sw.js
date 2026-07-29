"use strict";

const CACHE_NAME = "bitaya-mast-v5-stage-one";
const BUNDLE_PARTS = Array.from({ length: 7 }, (_, index) => `./.upgrade/part${String(index).padStart(2, "0")}.txt`);
const RUNTIME_ASSETS = [
  "./brand-runtime.js",
  "./compatibility-runtime.js",
  "./src/core/battle-engine.js",
  "./src/core/sample-cards.js",
  "./theme-enhancer.css",
  "./theme-enhancer.js",
  "./assets/theme/deck.svg",
  "./assets/theme/hero.svg",
  "./assets/theme/enemy.svg",
  "./assets/theme/icon-attack.svg",
  "./assets/theme/icon-skill.svg",
  "./assets/theme/icon-power.svg",
  "./assets/theme/node-battle.svg",
  "./assets/theme/node-event.svg",
  "./assets/theme/node-rest.svg",
  "./assets/theme/node-elite.svg"
];
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./sw.js", ...BUNDLE_PARTS, ...RUNTIME_ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isApplicationShell(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;

  if (isApplicationShell(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
