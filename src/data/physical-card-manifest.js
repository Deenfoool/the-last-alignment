"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastPhysicalCards = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = 1;
  const MASTER = Object.freeze({ width: 512, height: 768, anchorX: 256, anchorY: 740, safeInset: 28 });
  const cards = Object.freeze([
    { id: "troika_pass", object: "transport_pass", silhouette: "three_horses", file: "troika-pass" },
    { id: "cleaning_card", object: "paper_business_card", silhouette: "bucket_brush", file: "cleaning-card" },
    { id: "bank_card", object: "bank_card", silhouette: "chip_emblem", file: "bank-card" },
    { id: "ace_clubs", object: "playing_card", silhouette: "large_club", file: "ace-clubs" },
    { id: "empty_discount", object: "discount_card", silhouette: "geometric_emblem", file: "empty-discount" },
    { id: "brick", object: "thin_brick", silhouette: "chipped_brick", file: "brick" },
    { id: "red_pill", object: "blister_pack", silhouette: "single_red_capsule", file: "red-pill" },
    { id: "headshot", object: "photo_card", silhouette: "impact_head", file: "headshot" },
    { id: "loyalty_card", object: "loyalty_card", silhouette: "punch_marks", file: "loyalty-card" },
    { id: "marked_card", object: "marked_playing_card", silhouette: "red_scratch", file: "marked-card" }
  ].map((entry, index) => Object.freeze(Object.assign({
    index,
    png: `assets/cards/physical/${entry.file}.png`,
    webp: `assets/cards/physical/${entry.file}.webp`,
    containsGameplayText: false,
    usesRealBrand: false
  }, entry))));
  const byId = Object.freeze(Object.fromEntries(cards.map((card) => [card.id, card])));
  const fan = Object.freeze({
    desktop: Object.freeze({ rotationStep: 4.5, maxRotation: 20, overlapRatio: 0.58, hoverLift: 42, hoverScale: 1.08 }),
    mobile: Object.freeze({ rotationStep: 3, maxRotation: 13, overlapRatio: 0.64, selectedLift: 30, selectedScale: 1.06 })
  });
  function asset(id, format) {
    const card = byId[id];
    if (!card) return null;
    return format === "png" ? card.png : card.webp;
  }
  function validate(list) {
    const source = list || cards;
    const errors = [];
    if (!Array.isArray(source) || source.length !== 10) errors.push("Ожидалось ровно 10 эталонных физических карт.");
    const ids = new Set();
    (Array.isArray(source) ? source : []).forEach((card) => {
      if (!card.id || ids.has(card.id)) errors.push(`Некорректный или повторяющийся id: ${card.id || "—"}`);
      ids.add(card.id);
      if (card.containsGameplayText) errors.push(`${card.id}: боевой текст запрещён на лицевой стороне.`);
      if (card.usesRealBrand) errors.push(`${card.id}: реальные бренды запрещены.`);
      if (!card.png || !card.webp) errors.push(`${card.id}: отсутствуют пути экспорта.`);
    });
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
  }
  return Object.freeze({ VERSION, MASTER, cards, byId, fan, asset, validate });
});
