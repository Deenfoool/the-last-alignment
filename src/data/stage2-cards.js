"use strict";
(function (root, factory) {
  const cards = factory();
  if (typeof module === "object" && module.exports) module.exports = cards;
  if (root) root.BitayaMastCards = cards;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return Object.freeze([
    {
      id: "troika_pass", name: "Тройка", type: "skill", rarity: "uncommon", cost: 1, target: "self",
      art: "troika", icon: "⚡", stat: "+1",
      short: "+1 энергия и 1 карта.", lore: "Поезд ушёл, а ход остался.",
      effects: [{ op: "energy", amount: 1, target: "self" }, { op: "draw", amount: 1, target: "self" }], tags: ["energy", "draw"]
    },
    {
      id: "cleaning_card", name: "Визитка клининга", type: "skill", rarity: "common", cost: 1, target: "self",
      art: "cleaning", icon: "✚", stat: "4",
      short: "4 щита и 2 лечения.", lore: "Отмоют всё. Вопросы задавать не будут.",
      effects: [{ op: "shield", amount: 4, target: "self" }, { op: "heal", amount: 2, target: "self" }], tags: ["shield", "heal"]
    },
    {
      id: "bank_card", name: "Банковская карта", type: "defense", rarity: "uncommon", cost: 2, target: "self",
      art: "bank-card", icon: "🛡", stat: "7",
      short: "7 щита. Возьми карту.", lore: "Лимит доверия закончился вчера.",
      effects: [{ op: "shield", amount: 7, target: "self" }, { op: "draw", amount: 1, target: "self" }], tags: ["shield", "draw"]
    },
    {
      id: "ace_clubs", name: "Туз крести", type: "attack", rarity: "common", cost: 1, target: "opponent",
      art: "ace", icon: "⚔", stat: "8",
      short: "Наносит 8 урона.", lore: "Козырь не спрашивает разрешения.",
      effects: [{ op: "damage", amount: 8, target: "opponent" }], tags: ["damage"]
    },
    {
      id: "empty_discount", name: "Пустая скидочная", type: "curse", rarity: "curse", cost: 1, target: "none",
      art: "discount", icon: "∅", stat: "0",
      short: "Ничего не происходит.", lore: "Срок действия истёк до выдачи.",
      effects: [{ op: "noop" }], tags: ["noop", "curse"]
    },
    {
      id: "brick", name: "Кирпич", type: "attack", rarity: "common", cost: 1, target: "opponent",
      art: "brick", icon: "⚒", stat: "6",
      short: "6 урона. Ломает карту.", lore: "Аргумент весом примерно три килограмма.",
      effects: [{ op: "damage", amount: 6, target: "opponent" }, { op: "break", amount: 1, duration: 2, target: "opponent" }], tags: ["damage", "break"]
    },
    {
      id: "red_pill", name: "Красная таблетка", type: "power", rarity: "rare", cost: 2, target: "self",
      art: "red-pill", icon: "✦", stat: "+1",
      short: "Лечит 5. Даёт силу.", lore: "Обратной дороги в меню уже нет.",
      effects: [{ op: "heal", amount: 5, target: "self" }, { op: "status", statusId: "strength", stacks: 1, duration: 3, timing: "turn_end", target: "self" }], tags: ["heal", "strength"]
    },
    {
      id: "headshot", name: "Удар в голову", type: "attack", rarity: "rare", cost: 2, target: "opponent",
      art: "gun", icon: "☠", stat: "10",
      short: "10 урона. Уязвимость.", lore: "Предупредительный выстрел. Последний.",
      effects: [{ op: "damage", amount: 10, target: "opponent" }, { op: "status", statusId: "vulnerable", stacks: 1, duration: 2, timing: "turn_end", target: "opponent" }], tags: ["damage", "vulnerable"]
    },
    {
      id: "loyalty_card", name: "Карта лояльности", type: "skill", rarity: "uncommon", cost: 1, target: "self",
      art: "loyalty", icon: "%", stat: "−1",
      short: "Карты дешевле на 1.", lore: "Магазин помнит тебя. Даже когда ты не хочешь.",
      effects: [{ op: "status", statusId: "discount", stacks: 1, duration: 2, timing: "turn_end", target: "self" }], tags: ["discount"]
    },
    {
      id: "marked_card", name: "Меченая карта", type: "skill", rarity: "epic", cost: 2, target: "opponent",
      art: "playing-card", icon: "♠", stat: "1",
      short: "Крадёт карту из руки.", lore: "Чужая карта всегда лежит удобнее.",
      effects: [{ op: "steal", target: "opponent", zones: ["hand"] }], tags: ["steal"]
    }
  ]);
});
