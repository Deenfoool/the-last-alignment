"use strict";
(function (root) {
  const VERSION = 1;
  if (!String.prototype.padStart) String.prototype.padStart = function (length, fill) { const source = String(this); const token = fill === undefined ? " " : String(fill); if (source.length >= length || !token) return source; return (new Array(Math.ceil((length - source.length) / token.length) + 1).join(token)).slice(0, length - source.length) + source; };
  if (!Object.values) Object.values = function (object) { return Object.keys(Object(object)).map((key) => object[key]); };
  if (!Object.entries) Object.entries = function (object) { return Object.keys(Object(object)).map((key) => [key, object[key]]); };
  if (!Element.prototype.matches) Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
  if (!Element.prototype.closest) Element.prototype.closest = function (selector) { let current = this; while (current && current.nodeType === 1) { if (current.matches(selector)) return current; current = current.parentElement; } return null; };
  if (!root.CSS) root.CSS = {};
  if (!root.CSS.escape) root.CSS.escape = function (value) { return String(value).replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character.codePointAt(0).toString(16)} `); };

  const dialogProbe = document.createElement("dialog");
  if (typeof dialogProbe.showModal !== "function") {
    const show = function () { if (this.tagName !== "DIALOG") return; this.setAttribute("open", ""); this.setAttribute("aria-modal", "true"); this.style.display = "block"; document.body.classList.add("dialog-fallback-open"); };
    const close = function () { if (this.tagName !== "DIALOG") return; this.removeAttribute("open"); this.style.display = "none"; document.body.classList.remove("dialog-fallback-open"); this.dispatchEvent(new Event("close")); };
    if (!Element.prototype.showModal) Object.defineProperty(Element.prototype, "showModal", { configurable: true, value: show });
    if (!Element.prototype.close) Object.defineProperty(Element.prototype, "close", { configurable: true, value: close });
    document.documentElement.classList.add("dialog-fallback");
  }

  if (!("inert" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "inert", {
      configurable: true,
      get() { return this.hasAttribute("data-inert-fallback"); },
      set(value) {
        if (value) {
          this.setAttribute("data-inert-fallback", "");
          this.setAttribute("aria-hidden", "true");
          this.dataset.previousPointerEvents = this.style.pointerEvents || "";
          this.style.pointerEvents = "none";
        } else {
          this.removeAttribute("data-inert-fallback");
          this.removeAttribute("aria-hidden");
          this.style.pointerEvents = this.dataset.previousPointerEvents || "";
          delete this.dataset.previousPointerEvents;
        }
      },
    });
  }

  function syncViewport() {
    const viewport = root.visualViewport;
    const height = viewport ? viewport.height : root.innerHeight;
    const offset = viewport ? Math.max(0, root.innerHeight - viewport.height - viewport.offsetTop) : 0;
    document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
    document.documentElement.style.setProperty("--keyboard-offset", `${Math.round(offset)}px`);
  }
  syncViewport();
  root.addEventListener("resize", syncViewport, { passive: true });
  root.addEventListener("orientationchange", () => root.setTimeout(syncViewport, 120), { passive: true });
  if (root.visualViewport) {
    root.visualViewport.addEventListener("resize", syncViewport, { passive: true });
    root.visualViewport.addEventListener("scroll", syncViewport, { passive: true });
  }

  const recentClicks = new WeakMap();
  document.addEventListener("click", (event) => {
    const target = event.target && event.target.closest ? event.target.closest("button, [role='button'], a.icon-button") : null;
    if (!target || target.dataset.allowRapidClick === "true" || target.disabled) return;
    const now = Date.now();
    const previous = recentClicks.get(target) || 0;
    if (now - previous < 320) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    recentClicks.set(target, now);
  }, true);

  document.addEventListener("pointerdown", (event) => {
    document.documentElement.dataset.input = event.pointerType === "touch" ? "touch" : "pointer";
  }, { passive: true, capture: true });
  document.addEventListener("keydown", () => { document.documentElement.dataset.input = "keyboard"; }, true);

  root.BitayaMastCompatibilityV8 = Object.freeze({ VERSION, syncViewport });
})(typeof globalThis !== "undefined" ? globalThis : this);
