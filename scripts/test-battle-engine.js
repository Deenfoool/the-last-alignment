"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/core/battle-engine.js");
const cards = require("../src/core/sample-cards.js");

function config(seed = 1337) {
  return {
    battleId: "test-battle",
    seed,
    cards,
    rules: { handSize: 10, maxHandSize: 12, shieldResetsEachTurn: true },
    player: { name: "Игрок", maxHp: 30, maxEnergy: 7, deck: cards.map((card) => card.id) },
    dealer: { name: "Дилер", maxHp: 30, maxEnergy: 7, deck: cards.map((card) => card.id) }
  };
}

function cardId(state, actorId, definitionId) {
  const card = state.actors[actorId].hand.find((item) => item.definitionId === definitionId);
  assert.ok(card, `Карта ${definitionId} отсутствует в руке ${actorId}`);
  return card.instanceId;
}

function command(state, value) {
  return Engine.executeCommand(state, value).state;
}

(function deterministicCreation() {
  const first = Engine.createBattle(config(42));
  const second = Engine.createBattle(config(42));
  assert.equal(Engine.stateHash(first), Engine.stateHash(second), "Одинаковый seed должен создавать одинаковый бой");
})();

(function damageShieldHeal() {
  let state = Engine.createBattle(config(11));
  state = command(state, { type: "playCard", actorId: "player", cardInstanceId: cardId(state, "player", "guard"), targetId: "player" });
  assert.equal(state.actors.player.shield, 5);
  state = command(state, { type: "endTurn", actorId: "player" });
  state = command(state, { type: "playCard", actorId: "dealer", cardInstanceId: cardId(state, "dealer", "strike"), targetId: "player" });
  assert.equal(state.actors.player.hp, 29, "Щит должен поглотить 5 из 6 урона");
  state = command(state, { type: "playCard", actorId: "dealer", cardInstanceId: cardId(state, "dealer", "bandage"), targetId: "dealer" });
  assert.equal(state.actors.dealer.hp, 30, "Лечение не должно превышать максимум");
})();

(function stealBreakBurn() {
  let state = Engine.createBattle(config(22));
  const dealerHandBefore = state.actors.dealer.hand.length;
  state = command(state, { type: "playCard", actorId: "player", cardInstanceId: cardId(state, "player", "pickpocket"), targetId: "dealer" });
  assert.equal(state.actors.dealer.hand.length, dealerHandBefore - 1);
  assert.equal(state.actors.player.stats.cardsStolen, 1);
  state = command(state, { type: "playCard", actorId: "player", cardInstanceId: cardId(state, "player", "bent_chip"), targetId: "dealer" });
  assert.ok(state.actors.dealer.hand.some((card) => card.costModifier > 0), "Поломка должна увеличить стоимость карты");
  state = command(state, { type: "playCard", actorId: "player", cardInstanceId: cardId(state, "player", "shredder"), targetId: "dealer" });
  assert.equal(state.actors.dealer.exilePile.length, 1, "Сожжённая карта должна уйти в изгнание");
})();

(function uselessCardConsumesEnergy() {
  let state = Engine.createBattle(config(33));
  const before = state.actors.player.energy;
  state = command(state, { type: "playCard", actorId: "player", cardInstanceId: cardId(state, "player", "bad_advice") });
  assert.equal(state.actors.player.energy, before - 1);
  assert.ok(state.eventLog.some((event) => event.type === "NO_EFFECT"));
})();

(function roundAndActorTurns() {
  let state = Engine.createBattle(config(44));
  assert.equal(state.round, 1);
  state = command(state, { type: "endTurn", actorId: "player" });
  assert.equal(state.phase, Engine.PHASES.DEALER);
  state = command(state, { type: "endTurn", actorId: "dealer" });
  assert.equal(state.phase, Engine.PHASES.PLAYER);
  assert.equal(state.round, 2);
})();

(function rejectsImpossibleCommand() {
  const state = Engine.createBattle(config(55));
  assert.throws(
    () => Engine.executeCommand(state, { type: "endTurn", actorId: "dealer" }),
    (error) => error instanceof Engine.BattleRuleError && error.code === "NOT_ACTOR_TURN"
  );
})();

(function replayIsExact() {
  const initial = config(66);
  let state = Engine.createBattle(initial);
  const commands = [];
  function run(value) {
    state = Engine.executeCommand(state, value).state;
    commands.push(state.commandLog[state.commandLog.length - 1]);
  }
  run({ type: "playCard", actorId: "player", cardInstanceId: cardId(state, "player", "strike"), targetId: "dealer" });
  run({ type: "endTurn", actorId: "player" });
  run({ type: "playCard", actorId: "dealer", cardInstanceId: cardId(state, "dealer", "guard"), targetId: "dealer" });
  run({ type: "endTurn", actorId: "dealer" });
  const replayed = Engine.replayBattle(initial, commands);
  assert.equal(Engine.stateHash(replayed), Engine.stateHash(state), "Повтор должен приводить к тому же состоянию");
})();

(function migratesLegacySave() {
  const state = Engine.createBattle(config(77));
  const legacy = JSON.parse(JSON.stringify(state));
  legacy.saveVersion = 0;
  const migrated = Engine.migrateSave(legacy);
  assert.equal(migrated.saveVersion, Engine.SAVE_VERSION);
  assert.equal(Engine.validateState(migrated), true);
})();

console.log("Battle engine tests passed: deterministic state, turns, zones, effects, replay and migration.");
