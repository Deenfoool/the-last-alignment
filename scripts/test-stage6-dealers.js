"use strict";
const assert = require("node:assert/strict");
const Catalog = require("../src/data/card-catalog.js");
const Dealers = require("../src/data/dealer-catalog.js");
const AI = require("../src/core/dealer-ai.js");

globalThis.BitayaMastBattle = require("../src/core/stage4-battle-engine.js");
globalThis.BitayaMastCardCatalog = Catalog;
globalThis.BitayaMastDealerCatalog = Dealers;
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
require("../src/core/stage6-battle-runtime.js");
const Engine = globalThis.BitayaMastBattle;

assert.equal(Dealers.dealers.length, 7);
assert.equal(Dealers.dealers.filter((dealer) => dealer.tier === "common").length, 4);
assert.equal(Dealers.dealers.filter((dealer) => dealer.tier === "elite").length, 2);
assert.equal(Dealers.dealers.filter((dealer) => dealer.tier === "boss").length, 1);
assert.equal(new Set(Dealers.dealers.map((dealer) => dealer.archetype)).size, 7);

function baseConfig(dealerId, seed) {
  return {
    battleId: `stage6-${dealerId}-${seed}`,
    dealerId,
    seed,
    cards: Catalog.engineCards,
    rules: { handSize: 5, maxHandSize: 10, shieldResetsEachTurn: true },
    player: { name: "Игрок", maxHp: 50, maxEnergy: 3, deck: Catalog.buildDeck("player", seed) },
    dealer: { name: "Временный", maxHp: 10, maxEnergy: 1, deck: Catalog.buildDeck("dealer", seed) }
  };
}

function firstAffordable(state, actorId) {
  const actor = state.actors[actorId];
  return actor.hand.find((card) => card.blockedFor <= 0 && Engine.effectiveCost(state, actorId, card) <= actor.energy) || null;
}

Dealers.dealers.forEach((profile, index) => {
  const deckA = Dealers.buildDealerDeck(Catalog, profile.id, 700 + index);
  const deckB = Dealers.buildDealerDeck(Catalog, profile.id, 700 + index);
  assert.equal(deckA.length, 10, `${profile.id}: колода должна содержать 10 карт`);
  assert.equal(new Set(deckA).size, 10, `${profile.id}: карты колоды не должны повторяться`);
  assert.deepEqual(deckA, deckB, `${profile.id}: колода должна быть детерминированной`);

  let state = Engine.createBattle(baseConfig(profile.id, 9000 + index));
  assert.equal(state.dealerId, profile.id);
  assert.equal(state.actors.dealer.name, profile.name);
  assert.equal(state.actors.dealer.maxHp, profile.maxHp);
  assert.equal(state.actors.dealer.maxEnergy, profile.maxEnergy);
  assert.equal(state.actors.dealer.drawPile.length + state.actors.dealer.hand.length, 10);
  assert.ok(state.dealerAbility && state.dealerAbility.id === profile.ability.id);

  const publicState = JSON.parse(JSON.stringify(state));
  const choiceA = AI.chooseCard(publicState, profile, { assumeNextTurn: true, engine: Engine });
  const choiceB = AI.chooseCard(publicState, profile, { assumeNextTurn: true, engine: Engine });
  assert.equal(choiceA && choiceA.instanceId, choiceB && choiceB.instanceId, `${profile.id}: решение должно повторяться`);

  const hiddenChanged = JSON.parse(JSON.stringify(publicState));
  hiddenChanged.actors.player.hand.reverse();
  hiddenChanged.actors.player.hand.forEach((card, cardIndex) => { card.definitionId = Catalog.cards[cardIndex % Catalog.cards.length].id; });
  const choiceHidden = AI.chooseCard(hiddenChanged, profile, { assumeNextTurn: true, engine: Engine });
  assert.equal(choiceA && choiceA.instanceId, choiceHidden && choiceHidden.instanceId, `${profile.id}: ИИ не должен читать скрытые карты игрока`);

  const playerCard = firstAffordable(state, "player");
  if (playerCard) state = Engine.executeCommand(state, { type: "playCard", actorId: "player", cardInstanceId: playerCard.instanceId }).state;
  if (state.phase === Engine.PHASES.PLAYER && !state.winner) state = Engine.executeCommand(state, { type: "endTurn", actorId: "player" }).state;
  let safety = 0;
  while (state.phase === Engine.PHASES.DEALER && !state.winner && safety < 8) {
    const card = AI.chooseCard(state, profile, { engine: Engine });
    if (!card) break;
    state = Engine.executeCommand(state, { type: "playCard", actorId: "dealer", cardInstanceId: card.instanceId }).state;
    safety += 1;
  }
  if (state.phase === Engine.PHASES.DEALER && !state.winner) state = Engine.executeCommand(state, { type: "endTurn", actorId: "dealer" }).state;
  Engine.validateState(state);

  const replay = Engine.replayBattle(baseConfig(profile.id, 9000 + index), state.commandLog);
  assert.equal(Engine.stateHash(replay), Engine.stateHash(state), `${profile.id}: повтор боя должен совпадать`);
});

const sysadmin = Engine.createBattle(baseConfig("sysadmin", 123));
assert.equal(sysadmin.actors.dealer.shield, 8, "Сисадмин должен начинать с firewall");
const boss = Engine.createBattle(baseConfig("house_master", 321));
assert.equal(boss.actors.dealer.shield, 10, "Босс должен начинать с защиты стола");

const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/ui/stage3-app.js"), "utf8");
assert.match(source, /function dealerChoice\(assumeNextTurn\)/);
assert.match(source, /function renderIntent\(\)/);
assert.match(source, /Шулер проиграл/);

console.log("Stage 6 dealer tests passed:", Dealers.dealers.map((dealer) => dealer.id).join(", "));
