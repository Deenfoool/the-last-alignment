"use strict";
const assert = require("node:assert/strict");
const Content = require("../src/data/act1-content.js");
const Run = require("../src/core/act-run-engine.js");
const Profile = require("../src/core/run-profile.js");
const cardIds = [
  "ace_clubs", "cleaning_card", "bank_card", "troika_pass", "brick", "red_pill", "loyalty_card", "coffee_3in1", "blue_pill", "shawarma_coupon",
  "empty_discount", "expired_pass", "pc_virus", "marked_card", "headshot", "tax_audit", "revolver", "memory_card", "pirate_disc", "insurance"
];
const catalog = { cards: cardIds.map((id, index) => ({ id, type: ["empty_discount", "expired_pass"].includes(id) ? "curse" : index % 4 === 0 ? "attack" : index % 4 === 1 ? "defense" : index % 4 === 2 ? "skill" : "power", rarity: index < 10 ? "common" : "rare" })) };
function newRun(seed) { return Run.createRun({ seed, deck: cardIds.slice(0, 10), unlockedArtifacts: Content.artifacts.map((item) => item.id) }); }
const first = newRun(12345);
const second = newRun(12345);
assert.equal(Run.stateHash(first), Run.stateHash(second), "Одинаковый seed должен давать одинаковый маршрут");
assert.equal(first.map.layers.length, 8);
assert.equal(first.map.layers.at(-1)[0].type, "boss");
assert.equal(first.availableNodeIds.length, 3);
let run = first;
let guard = 0;
while (run.status !== Run.STATUS.VICTORY && guard < 40) {
  guard += 1;
  if (run.status === Run.STATUS.ACTIVE) run = Run.enterNode(run, run.availableNodeIds[0], catalog);
  if (run.status === Run.STATUS.BATTLE) {
    const context = run.battleContext;
    run = Run.completeBattle(run, { runId: run.runId, nodeId: context.nodeId, winner: "player", playerHp: Math.max(1, run.hp - 2) }, catalog);
  }
  if (run.status === Run.STATUS.REWARD) run = Run.chooseReward(run, run.pending.cards[0] && run.pending.cards[0].offerId, catalog);
  if (run.status === Run.STATUS.NODE && run.pending.type === "event") {
    const event = Content.byEventId[run.pending.eventId];
    const affordable = event.choices.find((choice) => !choice.cost || choice.cost <= run.gold) || event.choices[0];
    run = Run.resolveEvent(run, affordable.id, catalog);
  }
  if (run.status === Run.STATUS.NODE && run.pending.type === "shop") run = Run.leaveShop(run);
  if (run.status === Run.STATUS.NODE && run.pending.type === "rest") run = Run.restHeal(run);
  if (run.status === Run.STATUS.NODE && run.pending.type === "treasure") run = run.pending.artifacts.length ? Run.takeTreasure(run, run.pending.artifacts[0].offerId) : Run.claimEmptyTreasure(run);
}
assert.equal(run.status, Run.STATUS.VICTORY, "Маршрут должен завершаться победой над боссом");
assert.ok(run.stats.nodesVisited >= 8);
assert.ok(run.stats.battlesWon >= 1);
assert.ok(run.stats.score > 0);
Run.validate(run);
const restored = Run.migrate(JSON.parse(JSON.stringify(run)));
assert.equal(Run.stateHash(restored), Run.stateHash(run));
let defeat = newRun(77);
defeat = Run.enterNode(defeat, defeat.availableNodeIds.find((id) => Run.nodeById(defeat, id).type === "battle") || defeat.availableNodeIds[0], catalog);
while (defeat.status === Run.STATUS.NODE) {
  if (defeat.pending.type === "event") defeat = Run.resolveEvent(defeat, Content.byEventId[defeat.pending.eventId].choices[0].id, catalog);
  else if (defeat.pending.type === "shop") defeat = Run.leaveShop(defeat);
  else if (defeat.pending.type === "rest") defeat = Run.restHeal(defeat);
  else if (defeat.pending.type === "treasure") defeat = defeat.pending.artifacts.length ? Run.takeTreasure(defeat, defeat.pending.artifacts[0].offerId) : Run.claimEmptyTreasure(defeat);
}
if (defeat.status === Run.STATUS.ACTIVE) defeat = Run.enterNode(defeat, defeat.availableNodeIds.find((id) => ["battle", "elite"].includes(Run.nodeById(defeat, id).type)) || defeat.availableNodeIds[0], catalog);
if (defeat.status === Run.STATUS.BATTLE) defeat = Run.completeBattle(defeat, { runId: defeat.runId, nodeId: defeat.battleContext.nodeId, winner: "dealer", playerHp: 0 }, catalog);
assert.equal(defeat.status, Run.STATUS.DEFEAT);
let profile = Profile.create();
profile = Profile.recordFinishedRun(profile, run);
assert.equal(profile.victories, 1);
assert.ok(profile.unlockedArtifacts.includes("house_key"));
assert.equal(new Set(profile.unlockedArtifacts).size, profile.unlockedArtifacts.length);
console.log("Stage 7 act model passed", { score: run.stats.score, nodes: run.stats.nodesVisited, artifacts: run.artifacts.length });