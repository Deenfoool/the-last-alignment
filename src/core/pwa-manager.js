"use strict";
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastPwa = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const VERSION = 1;
  let registration = null;
  let deferredInstall = null;
  let reloading = false;
  let lastError = null;
  const listeners = new Set();

  function notify(type, detail) {
    const event = { type, detail: detail || {}, at: Date.now() };
    listeners.forEach((listener) => { try { listener(event); } catch (error) { /* listener isolation */ } });
    if (root && typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") root.dispatchEvent(new CustomEvent(`bitaya:pwa:${type}`, { detail: event.detail }));
  }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function supported() { return Boolean(root && root.navigator && "serviceWorker" in root.navigator); }
  function displayMode() {
    if (!root || !root.matchMedia) return "browser";
    if (root.matchMedia("(display-mode: standalone)").matches) return "standalone";
    if (root.navigator && root.navigator.standalone) return "standalone";
    return "browser";
  }
  function bindRegistration(next) {
    registration = next;
    if (registration.waiting) notify("update-ready", { registration });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      notify("update-found", {});
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && root.navigator.serviceWorker.controller) notify("update-ready", { registration });
        if (worker.state === "activated") notify("activated", {});
      });
    });
    return registration;
  }
  async function register(url) {
    if (!supported()) return null;
    try {
      const next = await root.navigator.serviceWorker.register(url || "./sw.js", { scope: "./", updateViaCache: "none" });
      bindRegistration(next);
      root.setTimeout(() => checkForUpdate().catch(() => null), 1800);
      return next;
    } catch (error) {
      lastError = error;
      notify("error", { message: error.message || String(error) });
      return null;
    }
  }
  async function checkForUpdate() {
    if (!supported()) return null;
    if (!registration) registration = await root.navigator.serviceWorker.getRegistration("./");
    if (!registration) return register("./sw.js");
    try { await registration.update(); return registration; }
    catch (error) { lastError = error; notify("error", { message: error.message || String(error) }); return registration; }
  }
  async function applyUpdate() {
    if (!registration) registration = await root.navigator.serviceWorker.getRegistration("./");
    if (!registration || !registration.waiting) return false;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }
  async function workerVersion() {
    if (!supported()) return null;
    const target = root.navigator.serviceWorker.controller || (registration && (registration.active || registration.waiting));
    const Channel = root.MessageChannel || (typeof MessageChannel !== "undefined" ? MessageChannel : null);
    if (!target || !Channel) return null;
    return new Promise((resolve) => {
      const channel = new Channel();
      const timeout = root.setTimeout(() => resolve(null), 1200);
      channel.port1.onmessage = (event) => { root.clearTimeout(timeout); resolve(event.data || null); };
      target.postMessage({ type: "GET_VERSION" }, [channel.port2]);
    });
  }
  async function clearCaches() {
    let removed = 0;
    if (root.caches && typeof root.caches.keys === "function") {
      const keys = await root.caches.keys();
      const selected = keys.filter((key) => key.startsWith("bitaya-mast-"));
      await Promise.all(selected.map((key) => root.caches.delete(key)));
      removed = selected.length;
    }
    if (supported()) {
      if (!registration) registration = await root.navigator.serviceWorker.getRegistration("./");
      if (registration) {
        try { await registration.unregister(); } catch (error) { lastError = error; }
        registration = null;
      }
    }
    return removed;
  }
  async function cacheStatus() {
    if (!root.caches || typeof root.caches.keys !== "function") return { supported: false, keys: [] };
    try { return { supported: true, keys: (await root.caches.keys()).filter((key) => key.startsWith("bitaya-mast-")) }; }
    catch (error) { return { supported: true, keys: [], error: error.message }; }
  }
  function canInstall() { return Boolean(deferredInstall); }
  async function promptInstall() {
    if (!deferredInstall) return { outcome: "unavailable" };
    deferredInstall.prompt();
    const result = await deferredInstall.userChoice;
    deferredInstall = null;
    notify("install-result", result);
    return result;
  }
  async function status() {
    const cache = await cacheStatus();
    const version = await workerVersion();
    return {
      supported: supported(),
      controlled: Boolean(root.navigator && root.navigator.serviceWorker && root.navigator.serviceWorker.controller),
      registered: Boolean(registration),
      waiting: Boolean(registration && registration.waiting),
      installing: Boolean(registration && registration.installing),
      online: root.navigator ? root.navigator.onLine !== false : true,
      displayMode: displayMode(),
      installAvailable: canInstall(),
      worker: version,
      caches: cache,
      lastError: lastError ? lastError.message || String(lastError) : null,
    };
  }

  if (root && root.addEventListener) {
    root.addEventListener("online", () => { notify("online", {}); checkForUpdate().catch(() => null); });
    root.addEventListener("offline", () => notify("offline", {}));
    root.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstall = event; notify("install-available", {}); });
    root.addEventListener("appinstalled", () => { deferredInstall = null; notify("installed", {}); });
    if (supported()) root.navigator.serviceWorker.addEventListener("controllerchange", () => {
      notify("controller-changed", {});
      if (!reloading) { reloading = true; root.location.reload(); }
    });
  }

  return Object.freeze({ VERSION, supported, displayMode, subscribe, register, checkForUpdate, applyUpdate, workerVersion, clearCaches, cacheStatus, canInstall, promptInstall, status });
});
