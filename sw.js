"use strict";

const CACHE_NAME = "bitaya-mast-v11-first-act";
const BUNDLE_PARTS = Array.from({ length: 7 }, (_, index) => `./.upgrade/part${String(index).padStart(2, "0")}.txt`);
const CURRENT_ASSETS = [
  "./index.html",
  "./legacy.html",
  "./styles/stage2.css",
  "./styles/stage3.css",
  "./styles/stage4.css",
  "./styles/stage5.css",
  "./styles/stage6.css",
  "./styles/stage7.css",
  "./src/core/battle-engine.js",
  "./src/core/timed-battle-engine.js",
  "./src/core/timer-settings.js",
  "./src/core/stage4-battle-engine.js",
  "./src/core/stage4-runtime.js",
  "./src/core/stage6-battle-runtime.js",
  "./src/core/stage7-battle-runtime.js",
  "./src/core/dealer-ai.js",
  "./src/core/content-settings.js",
  "./src/core/deck-view-model.js",
  "./src/core/act-run-engine.js",
  "./src/core/run-profile.js",
  "./src/data/card-catalog.js",
  "./src/data/dealer-catalog.js",
  "./src/data/act1-content.js",
  "./src/data/stage2-cards.js",
  "./src/data/stage4-assets.js",
  "./src/data/stage2-assets-scene.js",
  "./src/data/stage2-assets-a.js",
  "./src/data/stage2-assets-b.js",
  "./src/ui/stage2-app.js",
  "./src/ui/stage3-app.js",
  "./src/ui/stage4-runtime.js",
  "./src/ui/stage5-deck.js",
  "./src/ui/stage6-app-loader.js",
  "./src/ui/stage6-dealers.js",
  "./src/ui/stage7-act.js",
  "./src/ui/stage3-initial-save-guard.js"
];
const LEGACY_ASSETS = [
  "./brand-runtime.js",
  "./compatibility-runtime.js",
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
  "./assets/theme/node-elite.svg",
  ...BUNDLE_PARTS
];
const ASSETS = ["./", "./manifest.webmanifest", "./sw.js", ...CURRENT_ASSETS, ...LEGACY_ASSETS];

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
  return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/legacy.html");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (isApplicationShell(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});