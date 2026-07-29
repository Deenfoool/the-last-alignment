"use strict";
const assert = require("node:assert/strict");
const Catalog = require("../src/data/card-catalog.js");
const Engine = require("../src/core/stage4-battle-engine.js");

function config(deck) {
  return {
    battleId: "stage4-test",
    seed: 424242,
    cards: Catalog.engineCards,
    rules: { handSize: 5, maxHandSize: 10, shieldResetsEachTurn: true, catalogVersion: Catalog.DATA_VERSION },
    player: { name: "Игрок", maxHp: 50, maxEnergy: 9, deck: deck || Catalog.buildDeck("player", 424242) },
    dealer: { name: "Шулер", maxHp: 50, maxEnergy: 9, deck: Catalog.buildDeck("dealer", 424242) },
  };
}

let state = Engine.createBattle(config());
assert.equal(state.saveVersion, 2);
assert.equal(Object.keys(state.cardCatalog).length, 30);
assert.equal(state.actors.player.hand.length, 5);
assert.equal(state.actors.player.drawPile.length, 5);
Engine.validateState(state);

const upgraded = Engine.createBattle(config([{ id: "ace_clubs", upgrade: 1 }, "cleaning_card", "brick", "coffee_3in1", "zero_receipt"]));
const upgradedAce = [...upgraded.actors.player.hand, ...upgraded.actors.player.drawPile].find((card) => card.definitionId === "ace_clubs");
assert.equal(upgradedAce.upgrade, 1);
assert.equal(Engine.resolveCardDefinition(upgraded, upgradedAce).effects[0].amount, 11);

function forceHand(input, actorId, definitionIds) {
  const copy = JSON.parse(JSON.stringify(input));
  const actor = copy.actors[actorId];
  const all = [...actor.hand, ...actor.drawPile, ...actor.discardPile, ...actor.exilePile];
  actor.hand = []; actor.drawPile = []; actor.discardPile = []; actor.exilePile = [];
  definitionIds.forEach((id) => {
    const index = all.findIndex((card) => card.definitionId === id);
    assert.ok(index >= 0, `Не найдена карта ${id}`);
    actor.hand.push(all.splice(index, 1)[0]);
  });
  actor.drawPile.push(...all);
  actor.energy = 20;
  return copy;
}

state = Engine.createBattle(config(["antidepressants", "blue_screen", "rewind_tape", "brick", "ace_clubs", "coffee_3in1", "zero_receipt", "cleaning_card", "bank_card", "loyalty_card"]));
state.actors.player.statuses.burn = { stacks: 2, duration: 2, timing: "turn_start" };
state = forceHand(state, "player", ["antidepressants", "brick", "ace_clubs", "coffee_3in1", "zero_receipt"]);
let card = state.actors.player.hand.find((item) => item.definitionId === "antidepressants");
state = Engine.executeCommand(state, { type: "playCard", actorId: "player", cardInstanceId: card.instanceId }).state;
assert.equal(state.actors.player.statuses.burn, undefined);

card = state.actors.player.hand.find((item) => item.definitionId === "brick");
state = Engine.executeCommand(state, { type: "upgradeCard", actorId: "player", cardInstanceId: card.instanceId }).state;
assert.equal(state.actors.player.hand.find((item) => item.instanceId === card.instanceId).upgrade, 1);

const preTimeout = Engine.stateHash(state);
state = Engine.executeCommand(state, { type: "expireTurn", actorId: "player", penalty: Engine.TIMEOUT_PENALTIES.DISCARD_RANDOM }).state;
assert.notEqual(Engine.stateHash(state), preTimeout);
assert.equal(state.phase, Engine.PHASES.DEALER);

let replayState = Engine.createBattle(config(["ace_clubs", "brick", "cleaning_card", "bank_card", "coffee_3in1", "zero_receipt", "loyalty_card", "blue_pill", "shawarma_coupon", "memory_card"]));
const playable = replayState.actors.player.hand.find((item) => Engine.effectiveCost(replayState, "player", item) <= replayState.actors.player.energy);
replayState = Engine.executeCommand(replayState, { type: "playCard", actorId: "player", cardInstanceId: playable.instanceId }).state;
replayState = Engine.executeCommand(replayState, { type: "expireTurn", actorId: "player", penalty: Engine.TIMEOUT_PENALTIES.DISCARD_RANDOM }).state;
const replay = Engine.replayBattle(replayState.initialConfig, replayState.commandLog);
assert.equal(Engine.stateHash(replay), Engine.stateHash(replayState));

const legacy = JSON.parse(JSON.stringify(state));
legacy.saveVersion = 1;
legacy.engineVersion = "1.0.0-stage1";
legacy.actors.player.stats = { cardsPlayed: 0, damageDealt: 0, damageTaken: 0, cardsStolen: 0, cardsBurned: 0 };
const migrated = Engine.migrateSave(legacy);
assert.equal(migrated.saveVersion, 2);
assert.equal(migrated.actors.player.stats.cardsRepaired, 0);

console.log("Stage 4 engine tests passed", Engine.stateHash(state));
