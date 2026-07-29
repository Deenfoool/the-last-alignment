"use strict";
const assert = require("node:assert/strict");
global.BitayaMastAct1Content = require("../src/data/act1-content.js");
global.BitayaMastCardCatalog = { cards: [], engineCards: [] };
global.BitayaMastContentSettings = { load: () => ({ mode: "adult" }), projectEngineCards: () => [] };
const PHASES = { PLAYER: "player_turn", DEALER: "dealer_turn", FINISHED: "finished" };
const Base = {
  PHASES,
  BattleRuleError: class BattleRuleError extends Error {},
  createBattle(config) {
    const playerCards = Array.from({ length: 10 }, (_, index) => ({ instanceId: `c${index + 1}`, definitionId: `old${index}`, owner: "player", upgrade: 0, costModifier: 0, brokenFor: 0, blockedFor: 0, tags: [] }));
    return { seed: config.seed, phase: PHASES.PLAYER, winner: null, round: 1, turn: 1, nextCardSeq: 21, nextEventSeq: 1, eventLog: [], commandLog: [], rules: { handSize: 5 }, initialConfig: config, actors: { player: { hp: config.player.hp, maxHp: config.player.maxHp, shield: 0, energy: 3, maxEnergy: 3, statuses: {}, stats: {}, drawPile: playerCards.slice(5), hand: playerCards.slice(0, 5), discardPile: [], exilePile: [] }, dealer: { hp: 50, maxHp: 50, shield: 0, energy: 3, maxEnergy: 3, statuses: {}, stats: {}, drawPile: [], hand: [], discardPile: [], exilePile: [] } } };
  },
  executeCommand(state) { const next = JSON.parse(JSON.stringify(state)); next.phase = PHASES.FINISHED; next.winner = "player"; return { state: next, events: [] }; },
  validateState() { return true; },
  stateHash(state) { return String(state.actors.player.hp); },
  migrateSave(state) { return JSON.parse(JSON.stringify(state)); },
};
global.BitayaMastBattle = Base;
require("../src/core/stage7-battle-runtime.js");
const Engine = global.BitayaMastBattle;
const deck = Array.from({ length: 14 }, (_, index) => ({ id: `card${index}`, upgrade: index % 2 }));
const context = { runId: "r1", nodeId: "n1", dealerId: "shuler", battleId: "r1-n1", battleSeed: 42, playerHp: 30, playerMaxHp: 70, deck, artifacts: ["reinforced_sleeve", "brass_knuckles", "metro_token", "pocket_mirror"] };
const state = Engine.createBattle({ actRun: context, player: {}, dealer: {} });
assert.equal(state.actors.player.hand.length, 5);
assert.equal(state.actors.player.drawPile.length, 9);
assert.equal(state.actors.player.shield, 6);
assert.equal(state.actors.player.maxEnergy, 4);
assert.equal(state.actors.player.energy, 4);
assert.equal(state.actors.player.statuses.strength.stacks, 1);
assert.equal(state.actors.dealer.statuses.vulnerable.stacks, 1);
assert.equal(new Set([...state.actors.player.hand, ...state.actors.player.drawPile].map((card) => card.definitionId)).size, 14);
const replay = Engine.createBattle({ actRun: context, player: {}, dealer: {} });
assert.deepEqual(state.actors.player.hand.map((card) => card.definitionId), replay.actors.player.hand.map((card) => card.definitionId));
console.log("Stage 7 battle runtime passed");