"use strict";
const assert = require("node:assert/strict");
const Catalog = require("../src/core/release-card-balance.js");
const Dealers = require("../src/core/release-dealer-balance.js");
const AI = require("../src/core/dealer-ai.js");

globalThis.BitayaMastBattle = require("../src/core/stage4-battle-engine.js");
globalThis.BitayaMastCardCatalog = Catalog;
globalThis.BitayaMastDealerCatalog = Dealers;
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
require("../src/core/stage6-battle-runtime.js");
const Engine = globalThis.BitayaMastBattle;

function config(dealerId, seed) {
  return { battleId: `release-sim-${dealerId}-${seed}`, dealerId, seed, cards: Catalog.engineCards, rules: { handSize: 5, maxHandSize: 10, shieldResetsEachTurn: true }, player: { name: "Игрок", maxHp: 70, maxEnergy: 3, deck: Catalog.buildDeck("player", seed) }, dealer: { name: "Дилер", maxHp: 50, maxEnergy: 3, deck: [] } };
}
function scoreCard(state, actorId, card) {
  const definition = state.cardCatalog[card.definitionId]; let score = 0;
  (definition.effects || []).forEach((effect) => {
    if (effect.op === "damage") score += Number(effect.amount || 0) * 5;
    if (effect.op === "shield") score += Number(effect.amount || 0) * (state.actors[actorId].hp < 30 ? 3 : 1.3);
    if (effect.op === "heal") score += Number(effect.amount || 0) * (state.actors[actorId].hp < 40 ? 3 : .7);
    if (effect.op === "draw") score += Number(effect.amount || 0) * 5;
    if (effect.op === "energy") score += Number(effect.amount || 0) * 6;
    if (["steal", "block", "break", "burn"].includes(effect.op)) score += 10;
    if (effect.op === "status") score += effect.statusId === "strength" ? 12 : 7;
    if (effect.op === "noop") score -= 40;
  });
  return score - Engine.effectiveCost(state, actorId, card) * 2;
}
function playerChoice(state) {
  const actor = state.actors.player;
  return actor.hand.filter((card) => card.blockedFor <= 0 && Engine.effectiveCost(state, "player", card) <= actor.energy).sort((a, b) => scoreCard(state, "player", b) - scoreCard(state, "player", a))[0] || null;
}
function simulate(dealer, seed) {
  let state = Engine.createBattle(config(dealer.id, seed)); let commands = 0;
  while (!state.winner && commands < 420) {
    if (state.phase === Engine.PHASES.PLAYER) {
      const card = playerChoice(state);
      state = card ? Engine.executeCommand(state, { type: "playCard", actorId: "player", cardInstanceId: card.instanceId }).state : Engine.executeCommand(state, { type: "endTurn", actorId: "player" }).state;
    } else if (state.phase === Engine.PHASES.DEALER) {
      const card = AI.chooseCard(state, dealer, { engine: Engine });
      state = card ? Engine.executeCommand(state, { type: "playCard", actorId: "dealer", cardInstanceId: card.instanceId }).state : Engine.executeCommand(state, { type: "endTurn", actorId: "dealer" }).state;
    }
    Engine.validateState(state); commands += 1;
  }
  assert.ok(state.winner, `${dealer.id}/${seed}: бой не завершился за ${commands} команд`);
  assert.ok(commands < 420);
  const replay = Engine.replayBattle(config(dealer.id, seed), state.commandLog);
  assert.equal(Engine.stateHash(replay), Engine.stateHash(state), `${dealer.id}/${seed}: повтор боя разошёлся`);
  return { winner: state.winner, commands, rounds: state.round, playerHp: state.actors.player.hp, dealerHp: state.actors.dealer.hp };
}

const report = {};
Dealers.dealers.forEach((dealer, dealerIndex) => {
  const results = [];
  for (let index = 0; index < 12; index += 1) results.push(simulate(dealer, 10000 + dealerIndex * 1000 + index * 97));
  report[dealer.id] = { playerWins: results.filter((item) => item.winner === "player").length, dealerWins: results.filter((item) => item.winner === "dealer").length, averageCommands: Math.round(results.reduce((sum, item) => sum + item.commands, 0) / results.length), averageRounds: Number((results.reduce((sum, item) => sum + item.rounds, 0) / results.length).toFixed(1)) };
  assert.ok(report[dealer.id].averageCommands < 240, `${dealer.id}: бои слишком затянуты`);
});
assert.ok(report.house_master.averageRounds >= report.shuler.averageRounds * .65, "Босс не должен завершаться заметно быстрее первого дилера");
console.log("Stage 9 dealer simulation passed", report);