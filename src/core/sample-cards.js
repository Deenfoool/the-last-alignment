"use strict";

(function (root, factory) {
  const cards = factory();
  if (typeof module === "object" && module.exports) module.exports = cards;
  if (root) root.BitayaMastSampleCards = cards;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return Object.freeze([
    { id: "strike", name: "Удар", type: "attack", rarity: "common", cost: 1, target: "opponent", effects: [{ op: "damage", amount: 6 }] },
    { id: "guard", name: "Щит", type: "defence", rarity: "common", cost: 1, target: "self", effects: [{ op: "shield", amount: 5 }] },
    { id: "bandage", name: "Пластырь", type: "skill", rarity: "common", cost: 1, target: "self", effects: [{ op: "heal", amount: 3 }] },
    { id: "pickpocket", name: "Карманник", type: "skill", rarity: "rare", cost: 2, target: "opponent", effects: [{ op: "steal", zones: ["hand"] }] },
    { id: "bent_chip", name: "Гнутый чип", type: "skill", rarity: "uncommon", cost: 1, target: "opponent", effects: [{ op: "break", amount: 1, duration: 2, zones: ["hand"] }] },
    { id: "red_stamp", name: "Красный штамп", type: "skill", rarity: "rare", cost: 2, target: "opponent", effects: [{ op: "block", duration: 1, zones: ["hand"] }] },
    { id: "shredder", name: "Шредер", type: "skill", rarity: "epic", cost: 3, target: "opponent", effects: [{ op: "burn", zones: ["hand", "discardPile"] }] },
    { id: "bad_advice", name: "Плохой совет", type: "curse", rarity: "common", cost: 1, target: "none", effects: [{ op: "noop" }] },
    { id: "rage", name: "Злость", type: "power", rarity: "uncommon", cost: 1, target: "self", effects: [{ op: "status", statusId: "strength", stacks: 2, duration: 3, timing: "turn_end" }] },
    { id: "receipt", name: "Чек", type: "skill", rarity: "common", cost: 0, target: "self", effects: [{ op: "draw", amount: 1 }, { op: "energy", amount: 1 }], exhaust: true }
  ]);
});
