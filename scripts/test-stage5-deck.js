"use strict";
const assert = require("node:assert/strict");
const Catalog = require("../src/data/card-catalog.js");
const Content = require("../src/core/content-settings.js");
const Model = require("../src/core/deck-view-model.js");

const memory = {
  values: new Map(),
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; },
  setItem(key, value) { this.values.set(key, value); },
};

assert.equal(Content.load(memory).mode, Content.MODES.ADULT);
assert.equal(Content.save({ mode: Content.MODES.SAFE }, memory).mode, Content.MODES.SAFE);
assert.equal(Content.load(memory).mode, Content.MODES.SAFE);

for (const card of Catalog.cards) {
  const adult = Content.projectCard(card, { mode: Content.MODES.ADULT }, false);
  const safe = Content.projectCard(card, { mode: Content.MODES.SAFE }, false);
  const adultUpgrade = Content.projectCard(card, { mode: Content.MODES.ADULT }, true);
  const safeUpgrade = Content.projectCard(card, { mode: Content.MODES.SAFE }, true);
  assert.deepEqual(adult.effects, safe.effects, `${card.id}: фильтр изменил базовую механику`);
  assert.deepEqual(adultUpgrade.effects, safeUpgrade.effects, `${card.id}: фильтр изменил улучшенную механику`);
  assert.equal(adult.cost, safe.cost, `${card.id}: фильтр изменил стоимость`);
  assert.equal(adultUpgrade.cost, safeUpgrade.cost, `${card.id}: фильтр изменил стоимость улучшения`);
  assert.ok(safe.short && safe.lore, `${card.id}: отсутствует безопасный текст`);
}

const fakeCards = Catalog.cards.slice(0, 10).map((card, index) => ({
  instanceId: `test-${index}`,
  definitionId: card.id,
  upgrade: index === 0 ? 1 : 0,
}));
const save = {
  state: {
    actors: {
      player: {
        drawPile: fakeCards.slice(0, 4),
        hand: fakeCards.slice(4, 7),
        discardPile: fakeCards.slice(7, 9),
        exilePile: fakeCards.slice(9),
      },
    },
  },
};

assert.equal(Model.currentDeck(save).length, 10);
assert.equal(Model.entriesForView(Model.VIEWS.STARTER, save).length, 10);
assert.equal(Model.entriesForView(Model.VIEWS.COLLECTION, save).length, 30);

const all = Model.query({
  filters: { view: Model.VIEWS.COLLECTION, sort: Model.SORTS.NAME },
  settings: { mode: Content.MODES.ADULT },
  save,
});
assert.equal(all.length, 30);

for (const type of Model.TYPE_ORDER) {
  const filtered = Model.query({
    filters: { view: Model.VIEWS.COLLECTION, type },
    settings: { mode: Content.MODES.SAFE },
    save,
  });
  assert.ok(filtered.length > 0, `Нет карт типа ${type}`);
  assert.ok(filtered.every((item) => item.card.type === type));
}

for (const rarity of Model.RARITY_ORDER) {
  const filtered = Model.query({
    filters: { view: Model.VIEWS.COLLECTION, rarity },
    settings: { mode: Content.MODES.ADULT },
    save,
  });
  assert.ok(filtered.length > 0, `Нет карт редкости ${rarity}`);
  assert.ok(filtered.every((item) => item.card.rarity === rarity));
}

const search = Model.query({
  filters: { view: Model.VIEWS.COLLECTION, search: "щит" },
  settings: { mode: Content.MODES.ADULT },
  save,
});
assert.ok(search.length > 0, "Поиск по описанию не нашёл карты со щитом");

const upgraded = Model.query({
  filters: { view: Model.VIEWS.CURRENT, forceUpgrade: true },
  settings: { mode: Content.MODES.SAFE },
  save,
});
assert.ok(upgraded.every((item) => item.card.upgraded));
assert.notEqual(
  Content.dealerLine("«В каждой игре я знаю, где у тебя слабое место»", { mode: "safe" }),
  "«В каждой игре я знаю, где у тебя слабое место»"
);

console.log("Stage 5 deck and content tests passed", {
  cards: all.length,
  currentDeck: Model.currentDeck(save).length,
  searchResults: search.length,
});
