"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastPhysicalCardSpec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = 2;
  const CANVAS = Object.freeze({ width: 320, height: 448, safe: 16 });
  const EXPORTS = Object.freeze({ desktop: [320, 448], mobile: [240, 336], thumbnail: [160, 224] });
  const FAN = Object.freeze({ desktopOverlap: [0.42, 0.58], mobileOverlap: [0.62, 0.74], minAngle: -16, maxAngle: 16, hoverLift: 76 });
  const FORBIDDEN_FACE_TERMS = Object.freeze(["урон", "щит", "энерг", "редк", "стоимость", "добор", "лечение", "сила", "уязвим", "эффект"]);
  const CARDS = Object.freeze([
    Object.freeze({ id: "bank_card", material: "plastic", shape: "landscape-card", naturalText: ["БАНК", "DEBIT"], accent: "#b7b3a6" }),
    Object.freeze({ id: "loyalty_card", material: "plastic", shape: "landscape-card", naturalText: ["КАРТА ПОКУПАТЕЛЯ"], accent: "#8e3027" }),
    Object.freeze({ id: "troika_pass", material: "plastic", shape: "landscape-card", naturalText: ["ТРОЙКА"], accent: "#31556b" }),
    Object.freeze({ id: "cleaning_card", material: "paper", shape: "landscape-card", naturalText: ["ЧИСТЫЙ ДОМ"], accent: "#d3c49e" }),
    Object.freeze({ id: "ace_clubs", material: "paper", shape: "portrait-card", naturalText: ["A", "♣"], accent: "#d8cfb5" }),
    Object.freeze({ id: "brick", material: "brick", shape: "landscape-object", naturalText: [], accent: "#7a3928" }),
    Object.freeze({ id: "red_pill", material: "foil", shape: "portrait-blister", naturalText: [], accent: "#a43c32" }),
    Object.freeze({ id: "blue_pill", material: "foil", shape: "portrait-blister", naturalText: [], accent: "#42667d" }),
    Object.freeze({ id: "memory_card_8mb", material: "plastic", shape: "portrait-device", naturalText: ["8 MB"], accent: "#272723" }),
    Object.freeze({ id: "expired_pass", material: "laminated-paper", shape: "portrait-card", naturalText: ["ПРОПУСК", "ПРОСРОЧЕН"], accent: "#c7b98f" }),
  ]);
  const byId = Object.freeze(Object.fromEntries(CARDS.map((card) => [card.id, card])));
  function normalizeFaceText(value) { return String(value || "").toLocaleLowerCase("ru-RU"); }
  function validateFaceText(text) {
    const normalized = normalizeFaceText(text);
    return Object.freeze({ ok: !FORBIDDEN_FACE_TERMS.some((term) => normalized.includes(term)), forbidden: FORBIDDEN_FACE_TERMS.filter((term) => normalized.includes(term)) });
  }
  function fanTransform(index, total, mobile) {
    const count = Math.max(1, Number(total) || 1);
    const center = (count - 1) / 2;
    const position = Number(index) - center;
    const spread = mobile ? 18 : 28;
    const angle = count === 1 ? 0 : Math.max(FAN.minAngle, Math.min(FAN.maxAngle, position * (32 / Math.max(1, count - 1))));
    return Object.freeze({ x: position * spread, y: Math.abs(position) * (mobile ? 3 : 5), angle });
  }
  function validate() {
    const errors = [];
    if (CARDS.length !== 10) errors.push(`expected 10 cards, got ${CARDS.length}`);
    const ids = new Set();
    CARDS.forEach((card) => {
      if (ids.has(card.id)) errors.push(`duplicate ${card.id}`); else ids.add(card.id);
      const text = card.naturalText.join(" ");
      const check = validateFaceText(text);
      if (!check.ok) errors.push(`${card.id}: ${check.forbidden.join(",")}`);
    });
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
  }
  return Object.freeze({ VERSION, CANVAS, EXPORTS, FAN, FORBIDDEN_FACE_TERMS, CARDS, byId, validateFaceText, fanTransform, validate });
});