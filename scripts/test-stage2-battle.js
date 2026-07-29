"use strict";
const assert = require("node:assert/strict");
const Engine = require("../src/core/battle-engine.js");
const cards = require("../src/data/stage2-cards.js");
const config = {
  battleId: "stage2-ci", seed: 240729, cards,
  rules: { handSize: 5, maxHandSize: 10, shieldResetsEachTurn: true },
  player: { name: "Игрок", maxHp: 50, maxEnergy: 3, deck: ["ace_clubs", "ace_clubs", "cleaning_card", "bank_card", "troika_pass", "brick", "red_pill", "loyalty_card", "empty_discount", "marked_card"] },
  dealer: { name: "Шулер", maxHp: 48, maxEnergy: 3, deck: ["headshot", "ace_clubs", "brick", "brick", "bank_card", "cleaning_card", "marked_card", "loyalty_card", "empty_discount", "red_pill"] }
};
let state = Engine.createBattle(config);
assert.equal(state.phase, Engine.PHASES.PLAYER);
assert.equal(state.actors.player.hand.length, 5);
assert.equal(state.actors.dealer.hand.length, 5);
const first = state.actors.player.hand.find((card) => Engine.effectiveCost(state, "player", card) <= state.actors.player.energy && card.blockedFor <= 0);
assert.ok(first, "У игрока должна быть доступная карта");
state = Engine.executeCommand(state, { type: "playCard", actorId: "player", cardInstanceId: first.instanceId }).state;
state = Engine.executeCommand(state, { type: "endTurn", actorId: "player" }).state;
let safety = 0;
while (state.phase === Engine.PHASES.DEALER && !state.winner && safety < 6) {
  const card = state.actors.dealer.hand.find((item) => item.blockedFor <= 0 && Engine.effectiveCost(state, "dealer", item) <= state.actors.dealer.energy);
  if (!card) break;
  state = Engine.executeCommand(state, { type: "playCard", actorId: "dealer", cardInstanceId: card.instanceId }).state;
  safety += 1;
}
if (state.phase === Engine.PHASES.DEALER && !state.winner) state = Engine.executeCommand(state, { type: "endTurn", actorId: "dealer" }).state;
assert.ok(state.winner || state.phase === Engine.PHASES.PLAYER);
Engine.validateState(state);
const replay = Engine.replayBattle(config, state.commandLog);
assert.equal(Engine.stateHash(replay), Engine.stateHash(state));
console.log("Stage 2 battle smoke test passed", Engine.stateHash(state));
