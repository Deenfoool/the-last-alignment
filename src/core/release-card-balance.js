"use strict";
(function (root, factory) {
  const base = root && root.BitayaMastCardCatalog || (typeof module === "object" && module.exports ? require("../data/card-catalog.js") : null);
  const api = factory(base);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.BitayaMastCardCatalog = api;
    root.BitayaMastReleaseCardBalance = api.balance;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Base) {
  if (!Base) throw new Error("Release card balance requires the card catalog.");
  const DATA_VERSION = 2;
  const RELEASE_VERSION = "1.0.0-rc1";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const deepFreeze = (value) => { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(deepFreeze); return value; };
  const PATCHES = Object.freeze({
    troika_pass: { upgrade: { cost: 1, text: { adult: { short: "+1 энергия и 1 карта." }, safe: { short: "+1 молния и ещё одна карточка." } } } },
    coffee_3in1: { upgrade: { cost: 1, text: { adult: { short: "Лечит 5 и даёт 1 энергию." }, safe: { short: "Лечит 5 и даёт 1 энергию." } } } },
    zero_receipt: { upgrade: { cost: 1, text: { adult: { short: "Возьми 2 карты за 1 энергию." }, safe: { short: "Возьми две карточки за 1 энергию." } } } },
    marked_card: { upgrade: { cost: 2, effects: [{ op: "steal", target: "opponent", zones: ["hand"] }, { op: "break", amount: 1, duration: 2, target: "opponent", zones: ["hand"] }], stat: "2", text: { adult: { short: "Крадёт карту и ломает другую." }, safe: { short: "Забирает карту и замедляет другую." } } } },
    pc_virus: { upgrade: { cost: 2, text: { adult: { short: "Блокирует 2 карты и ослабляет." }, safe: { short: "Усыпляет две карты и ослабляет соперника." } } } },
    fine_print: { upgrade: { cost: 2, text: { adult: { short: "Крадёт 2 карты и ломает третью." }, safe: { short: "Забирает две карты и замедляет ещё одну." } } } },
    insurance_policy: { upgrade: { cost: 2, text: { adult: { short: "8 щита. Регенерация 2 на 5 ходов." }, safe: { short: "8 защиты и по 2 лечения пять ходов." } } } },
    revolver: { stat: "18", effects: [{ op: "damage", amount: 18, target: "opponent" }], text: { adult: { short: "18 урона. Изгоняется." }, safe: { short: "Наносит 18 урона и покидает бой." } }, upgrade: { stat: "23", effects: [{ op: "damage", amount: 23, target: "opponent" }], text: { adult: { short: "23 урона. Стоит 2 и изгоняется." }, safe: { short: "23 урона за 2 энергии, затем карта отдыхает." } } } },
    tax_audit: { stat: "13", effects: [{ op: "damage", amount: 13, target: "opponent" }, { op: "discard_random", target: "opponent", zones: ["hand"] }], text: { adult: { short: "13 урона. Сбрасывает карту." }, safe: { short: "13 урона и соперник теряет карту из руки." } }, upgrade: { stat: "17", effects: [{ op: "damage", amount: 17, target: "opponent" }, { op: "discard_random", target: "opponent", zones: ["hand"] }, { op: "break", amount: 1, duration: 2, target: "opponent" }], text: { adult: { short: "17 урона, сброс и поломка." }, safe: { short: "17 урона, одна карта уходит, другая замедляется." } } } },
    red_button: { effects: [{ op: "damage", amount: 20, target: "opponent" }, { op: "damage", amount: 7, target: "self" }], text: { adult: { short: "20 урона. Ты получаешь 7." }, safe: { short: "20 урона сопернику и 7 урона тебе." } }, upgrade: { effects: [{ op: "damage", amount: 24, target: "opponent" }, { op: "damage", amount: 5, target: "self" }], text: { adult: { short: "24 урона сопернику, 5 тебе. Стоит 2." }, safe: { short: "24 урона сопернику и 5 тебе за 2 энергии." } } } }
  });
  function merge(target, patch) {
    const output = clone(target);
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) output[key] = merge(output[key], value);
      else output[key] = clone(value);
    });
    return output;
  }
  const cards = deepFreeze(Base.cards.map((card) => merge(card, PATCHES[card.id])));
  const byId = deepFreeze(Object.fromEntries(cards.map((card) => [card.id, card])));
  function engineCard(card) { return deepFreeze({ id: card.id, name: card.name, type: card.type, rarity: card.rarity, cost: card.cost, target: card.target, exhaust: Boolean(card.exhaust), effects: clone(card.effects), tags: clone(card.tags), upgrade: clone(card.upgrade), art: card.art.key, stat: card.stat, short: card.text.adult.short, lore: card.text.adult.lore, text: clone(card.text) }); }
  const engineCards = deepFreeze(cards.map(engineCard));
  function getCard(id, options) {
    const base = byId[id]; if (!base) return null;
    const safe = Boolean(options && options.safe); const upgraded = Number(options && options.upgrade) > 0 && base.upgrade; const mode = safe ? "safe" : "adult"; const view = clone(base);
    view.short = base.text[mode].short; view.lore = base.text[mode].lore;
    if (upgraded) { const patch = base.upgrade; view.name = `${base.name}+`; view.cost = patch.cost == null ? base.cost : patch.cost; view.stat = patch.stat == null ? base.stat : patch.stat; view.effects = clone(patch.effects || base.effects); view.target = patch.target || base.target; view.exhaust = patch.exhaust == null ? Boolean(base.exhaust) : Boolean(patch.exhaust); view.tags = clone(patch.tags || base.tags); view.short = patch.text && patch.text[mode] && patch.text[mode].short ? patch.text[mode].short : view.short; }
    return view;
  }
  function decorateBattleConfig(input) { const config = Base.decorateBattleConfig(input); config.cards = engineCards; config.rules = Object.assign({}, config.rules || {}, { catalogVersion: DATA_VERSION, releaseBalanceVersion: RELEASE_VERSION }); return config; }
  function effectValue(effect) {
    const amount = Number(effect.amount || effect.stacks || 1);
    return ({ damage: 1, shield: .72, heal: .78, draw: 3.8, energy: 4.5, discard_random: 3.1, steal: 5.2, break: 3.2, block: 3.6, burn: 2.4, cleanse: 2.5, return_from_discard: 4.2, status: 2.8, noop: 0 })[effect.op] * amount || 1;
  }
  function cardPower(card, upgraded) { const source = upgraded && card.upgrade ? Object.assign({}, card, card.upgrade) : card; const cost = Math.max(.5, Number(source.cost || 0) + .5); const value = (source.effects || []).reduce((sum, effect) => sum + effectValue(effect), 0); return Number((value / cost).toFixed(2)); }
  const balance = deepFreeze({ version: RELEASE_VERSION, patches: clone(PATCHES), report: cards.map((card) => ({ id: card.id, base: cardPower(card, false), upgrade: cardPower(card, true) })) });
  const validation = Base.validateCatalog(cards); if (!validation.ok) throw new Error(["Release balance produced an invalid catalog:", ...validation.errors].join("\n"));
  return Object.freeze(Object.assign({}, Base, { DATA_VERSION, RELEASE_VERSION, cards, byId, engineCards, getCard, decorateBattleConfig, cardPower, balance }));
});