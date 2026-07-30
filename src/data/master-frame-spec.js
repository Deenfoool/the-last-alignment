"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastMasterFrameSpec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = 1;
  const ASPECT_RATIO = Object.freeze([16, 9]);
  const ZONES = Object.freeze({
    hud: Object.freeze({ x: 0.00, y: 0.02, width: 0.18, height: 0.47 }),
    timer: Object.freeze({ x: 0.01, y: 0.53, width: 0.23, height: 0.31 }),
    dealer: Object.freeze({ x: 0.27, y: 0.08, width: 0.49, height: 0.45 }),
    table: Object.freeze({ x: 0.21, y: 0.43, width: 0.69, height: 0.30 }),
    hand: Object.freeze({ x: 0.18, y: 0.66, width: 0.68, height: 0.33 }),
    tooltip: Object.freeze({ x: 0.66, y: 0.35, width: 0.29, height: 0.24 }),
  });
  const RULES = Object.freeze({
    frontalCamera: true,
    dealerCentered: true,
    playerBodyVisible: false,
    physicalCardsOnly: true,
    gameplayTextOnCardFace: false,
    physicalTimer: true,
    singleWarmKeyLight: true,
    vignetteEdges: true,
  });
  function validate() {
    const errors = [];
    Object.entries(ZONES).forEach(([name, zone]) => {
      ["x", "y", "width", "height"].forEach((key) => {
        if (!Number.isFinite(zone[key]) || zone[key] < 0 || zone[key] > 1) errors.push(`${name}.${key}`);
      });
      if (zone.x + zone.width > 1.01 || zone.y + zone.height > 1.01) errors.push(`${name}.bounds`);
    });
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
  }
  return Object.freeze({ VERSION, ASPECT_RATIO, ZONES, RULES, validate });
});