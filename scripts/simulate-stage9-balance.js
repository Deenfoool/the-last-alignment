"use strict";
const assert = require("node:assert/strict");
const Content = require("../src/data/act1-content.js");
const Catalog = require("../src/core/release-card-balance.js");
const Run = require("../src/core/release-run-balance.js");

const priority = { rest: 0, treasure: 1, shop: 2, event: 3, battle: 4, elite: 5, boss: 6 };
function safeChoice(event, run) {
  return event.choices.find((choice) => {
    if (choice.cost && choice.cost > run.gold) return false;
    return !(choice.effects || []).some((effect) => (effect.op === "hp" || effect.op === "max_hp") && Number(effect.amount || 0) < 0);
  }) || event.choices.find((choice) => !choice.cost || choice.cost <= run.gold) || event.choices[0];
}
function nextNode(run) {
  return run.availableNodeIds.map((id) => Run.nodeById(run, id)).sort((a, b) => priority[a.type] - priority[b.type] || a.index - b.index)[0];
}
function complete(seed) {
  let run = Run.createRun({ seed, deck: Catalog.buildDeck("player", seed), unlockedArtifacts: Content.artifacts.map((item) => item.id) });
  let guard = 0;
  while (run.status !== Run.STATUS.VICTORY && run.status !== Run.STATUS.DEFEAT && guard < 80) {
    guard += 1;
    if (run.status === Run.STATUS.ACTIVE) run = Run.enterNode(run, nextNode(run).id, Catalog);
    if (run.status === Run.STATUS.BATTLE) {
      const node = Run.currentNode(run); const loss = node.type === "boss" ? 8 : node.type === "elite" ? 5 : 3;
      run = Run.completeBattle(run, { runId: run.runId, nodeId: run.battleContext.nodeId, winner: "player", playerHp: Math.max(1, run.hp - loss) }, Catalog);
    }
    if (run.status === Run.STATUS.REWARD) {
      const offer = run.deck.length < 14 ? run.pending.cards[0] : null;
      run = Run.chooseReward(run, offer && offer.offerId, Catalog);
    }
    if (run.status === Run.STATUS.NODE && run.pending.type === "event") {
      const event = Content.byEventId[run.pending.eventId]; run = Run.resolveEvent(run, safeChoice(event, run).id, Catalog);
    }
    if (run.status === Run.STATUS.NODE && run.pending.type === "shop") {
      if (run.hp < run.maxHp - run.pending.healAmount && run.gold >= run.pending.healPrice) run = Run.buyShopHeal(run);
      run = Run.leaveShop(run);
    }
    if (run.status === Run.STATUS.NODE && run.pending.type === "rest") run = run.hp < run.maxHp * .7 ? Run.restHeal(run) : Run.restUpgrade(run, run.deck.find((card) => card.upgrade === 0)?.uid || run.deck[0].uid);
    if (run.status === Run.STATUS.NODE && run.pending.type === "treasure") run = run.pending.artifacts.length ? Run.takeTreasure(run, run.pending.artifacts[0].offerId) : Run.claimEmptyTreasure(run);
    Run.validate(run);
  }
  assert.equal(run.status, Run.STATUS.VICTORY, `Seed ${seed} не дошёл до победы`);
  assert.ok(guard < 80, `Seed ${seed} превысил ограничение действий`);
  assert.ok(run.gold >= 0 && run.gold < 1000, `Seed ${seed}: экономика вышла за разумный диапазон`);
  assert.ok(run.deck.length >= 5 && run.deck.length <= 18, `Seed ${seed}: размер колоды вне диапазона`);
  return run;
}

const summary = { runs: 500, minGold: Infinity, maxGold: 0, minHp: Infinity, maxDeck: 0, totalScore: 0 };
for (let seed = 1; seed <= summary.runs; seed += 1) {
  const run = complete(seed * 7919);
  summary.minGold = Math.min(summary.minGold, run.gold); summary.maxGold = Math.max(summary.maxGold, run.gold); summary.minHp = Math.min(summary.minHp, run.hp); summary.maxDeck = Math.max(summary.maxDeck, run.deck.length); summary.totalScore += run.stats.score;
}
summary.averageScore = Math.round(summary.totalScore / summary.runs);
assert.ok(summary.minHp > 0);
assert.ok(summary.averageScore > 1000);
console.log("Stage 9 complete-run simulation passed", summary);