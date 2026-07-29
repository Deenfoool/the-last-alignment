"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastContentSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = 1;
  const STORAGE_KEY = "bitaya-mast-content-settings-v1";
  const MODES = Object.freeze({ ADULT: "adult", SAFE: "safe" });
  const DEFAULTS = Object.freeze({ version: VERSION, mode: MODES.ADULT });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      version: VERSION,
      mode: source.mode === MODES.SAFE ? MODES.SAFE : MODES.ADULT,
    };
  }

  function resolveStorage(storage) {
    if (storage && typeof storage.getItem === "function") return storage;
    try {
      if (typeof localStorage !== "undefined") return localStorage;
    } catch (error) {
      return null;
    }
    return null;
  }

  function load(storage) {
    const target = resolveStorage(storage);
    if (!target) return normalize(DEFAULTS);
    try {
      const raw = target.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : normalize(DEFAULTS);
    } catch (error) {
      return normalize(DEFAULTS);
    }
  }

  function save(next, storage) {
    const normalized = normalize(next);
    const target = resolveStorage(storage);
    if (target) {
      try { target.setItem(STORAGE_KEY, JSON.stringify(normalized)); }
      catch (error) { /* localStorage can be unavailable in private WebView modes */ }
    }
    return normalized;
  }

  function isSafe(settings) {
    return normalize(settings).mode === MODES.SAFE;
  }

  function textFor(card, settings, upgraded) {
    const mode = normalize(settings).mode;
    const baseText = card && card.text && card.text[mode] ? card.text[mode] : {};
    const upgradeText = upgraded && card && card.upgrade && card.upgrade.text && card.upgrade.text[mode]
      ? card.upgrade.text[mode]
      : {};
    return {
      short: upgradeText.short || baseText.short || card.short || "",
      lore: upgradeText.lore || baseText.lore || card.lore || "",
    };
  }

  function projectCard(card, settings, upgraded) {
    if (!card) return null;
    const useUpgrade = Boolean(upgraded && card.upgrade);
    const patch = useUpgrade ? card.upgrade : {};
    const text = textFor(card, settings, useUpgrade);
    return {
      id: card.id,
      name: useUpgrade ? `${card.name}+` : card.name,
      type: card.type,
      rarity: card.rarity,
      cost: patch.cost == null ? card.cost : patch.cost,
      target: patch.target || card.target,
      exhaust: patch.exhaust == null ? Boolean(card.exhaust) : Boolean(patch.exhaust),
      effects: clone(patch.effects || card.effects || []),
      tags: clone(patch.tags || card.tags || []),
      art: card.art && card.art.key ? card.art.key : card.art,
      artDefinition: clone(card.art),
      icon: card.icon || "?",
      stat: patch.stat == null ? card.stat : patch.stat,
      short: text.short,
      lore: text.lore,
      text: clone(card.text || {}),
      upgrade: clone(card.upgrade || null),
      upgraded: useUpgrade,
    };
  }

  function projectEngineCards(cards, settings) {
    return Object.freeze((cards || []).map((card) => Object.freeze(projectCard(card, settings, false))));
  }

  const SAFE_DEALER_LINES = Object.freeze({
    "«В каждой игре я знаю, где у тебя слабое место»": "«В каждой игре я стараюсь заметить твою ошибку»",
    "«Рано радуешься. Долг ещё не закрыт»": "«Рано радуешься. Партия ещё не закончена»",
    "Предупредительный выстрел. Последний.": "Точный ход. Постарайся ответить лучше.",
  });

  function dealerLine(value, settings) {
    const text = String(value == null ? "" : value);
    if (!isSafe(settings)) return text;
    if (SAFE_DEALER_LINES[text]) return SAFE_DEALER_LINES[text];
    return text
      .replace(/долг/gi, "счёт")
      .replace(/последн(?:ий|яя|ее)/gi, "важный")
      .replace(/слабое место/gi, "ошибку");
  }

  return Object.freeze({
    VERSION,
    STORAGE_KEY,
    MODES,
    DEFAULTS,
    normalize,
    load,
    save,
    isSafe,
    textFor,
    projectCard,
    projectEngineCards,
    dealerLine,
  });
});
