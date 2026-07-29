"use strict";
const Catalog = require("../src/data/card-catalog.js");

const result = Catalog.validateCatalog();
if (!result.ok) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}

const counts = Catalog.cards.reduce((accumulator, card) => {
  accumulator.types[card.type] = (accumulator.types[card.type] || 0) + 1;
  accumulator.rarities[card.rarity] = (accumulator.rarities[card.rarity] || 0) + 1;
  card.tags.forEach((tag) => accumulator.tags.add(tag));
  return accumulator;
}, { types: {}, rarities: {}, tags: new Set() });

for (const card of Catalog.cards) {
  const adult = Catalog.getCard(card.id, { safe: false, upgrade: 0 });
  const safe = Catalog.getCard(card.id, { safe: true, upgrade: 0 });
  const upgraded = Catalog.getCard(card.id, { safe: false, upgrade: 1 });
  if (!adult || !safe || !upgraded) throw new Error(`Не удалось получить представления карты ${card.id}.`);
  if (adult.short === safe.short && adult.lore === safe.lore) throw new Error(`Безопасный текст карты ${card.id} не отличается от взрослого.`);
  if (!upgraded.name.endsWith("+")) throw new Error(`Улучшенная карта ${card.id} не помечена плюсом.`);
  if (!Catalog.artDataUri(card).startsWith("data:image/svg+xml")) throw new Error(`Иллюстрация ${card.id} не создана.`);
}

const playerDeck = Catalog.buildDeck("player", 103);
const dealerDeck = Catalog.buildDeck("dealer", 103);
if (playerDeck.length !== 10 || dealerDeck.length !== 10) throw new Error("Стартовые колоды должны содержать по 10 карт.");
if (new Set(playerDeck).size !== 10 || new Set(dealerDeck).size !== 10) throw new Error("В демонстрационной сдаче не должно быть повторов.");

console.log(JSON.stringify({ cards: Catalog.cards.length, types: counts.types, rarities: counts.rarities, synergyTags: counts.tags.size, playerDeck, dealerDeck }, null, 2));
