"use strict";
const Catalog = require("../src/data/card-catalog.js");
const Engine = require("../src/core/stage4-battle-engine.js");

function score(state, actorId, card) {
  const actor = state.actors[actorId];
  const definition = Engine.resolveCardDefinition(state, card);
  let value = 0;
  for (const effect of definition.effects) {
    if (effect.op === "damage") value += effect.amount * 4;
    if (effect.op === "shield") value += effect.amount * (actor.hp < actor.maxHp * .5 ? 2 : 1);
    if (effect.op === "heal") value += effect.amount * (actor.hp < actor.maxHp * .6 ? 2.5 : .4);
    if (["steal", "break", "block", "burn", "cleanse", "return_from_discard"].includes(effect.op)) value += 9;
    if (effect.op === "status") value += 7;
    if (effect.op === "draw") value += effect.amount * 3;
    if (effect.op === "energy") value += effect.amount * 4;
    if (effect.op === "noop") value -= 30;
  }
  return value - Engine.effectiveCost(state, actorId, card);
}

function run(seed) {
  const config = Catalog.decorateBattleConfig({
    battleId: `simulation-${seed}`,
    seed,
    rules: { handSize: 5, maxHandSize: 10, shieldResetsEachTurn: true },
    player: { name: "Игрок", maxHp: 50, maxEnergy: 3 },
    dealer: { name: "Шулер", maxHp: 48, maxEnergy: 3 },
  });
  let state = Engine.createBattle(config);
  let commands = 0;
  while (!state.winner && commands < 140) {
    const actorId = state.phase === Engine.PHASES.PLAYER ? "player" : "dealer";
    const actor = state.actors[actorId];
    const playable = actor.hand
      .filter((card) => card.blockedFor <= 0 && Engine.effectiveCost(state, actorId, card) <= actor.energy)
      .sort((a, b) => score(state, actorId, b) - score(state, actorId, a))[0];
    if (playable) state = Engine.executeCommand(state, { type: "playCard", actorId, cardInstanceId: playable.instanceId }).state;
    else state = Engine.executeCommand(state, { type: "endTurn", actorId }).state;
    commands += 1;
  }
  Engine.validateState(state);
  const replay = Engine.replayBattle(config, state.commandLog);
  if (Engine.stateHash(replay) !== Engine.stateHash(state)) throw new Error(`Повтор симуляции ${seed} разошёлся.`);
  return { winner: state.winner || "stalemate", commands };
}

const totals = { player: 0, dealer: 0, draw: 0, stalemate: 0, maxCommands: 0 };
for (let seed = 1; seed <= 20; seed += 1) {
  const result = run(seed);
  totals[result.winner] += 1;
  totals.maxCommands = Math.max(totals.maxCommands, result.commands);
}
if (totals.stalemate > 5) throw new Error(`Слишком много затяжных боёв: ${totals.stalemate}.`);
console.log("20 catalog simulations passed", totals);
