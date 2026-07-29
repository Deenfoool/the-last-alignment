"use strict";
const assert = require("node:assert/strict");
const Content = require("../src/data/act1-content.js");
const Catalog = require("../src/core/release-card-balance.js");
const Dealers = require("../src/core/release-dealer-balance.js");
const Run = require("../src/core/release-run-balance.js");
const Achievements = require("../src/core/release-achievements.js");
const Audio = require("../src/core/release-audio.js");

assert.equal(Catalog.RELEASE_VERSION, "1.0.0-rc1");
assert.equal(Catalog.cards.length, 30);
assert.equal(Catalog.getCard("troika_pass", { upgrade: 1 }).cost, 1, "Бесплатный энергетический цикл должен быть закрыт");
assert.equal(Catalog.getCard("zero_receipt", { upgrade: 1 }).cost, 1, "Двойной бесплатный добор должен стоить энергию");
assert.equal(Catalog.getCard("revolver").effects[0].amount, 18);
assert.equal(Catalog.getCard("tax_audit", { upgrade: 1 }).effects[0].amount, 17);
assert.ok(Catalog.balance.report.every((entry) => Number.isFinite(entry.base) && Number.isFinite(entry.upgrade)));

assert.equal(Dealers.dealers.length, 7);
assert.deepEqual(Dealers.dealers.map((dealer) => dealer.maxHp), [46, 54, 50, 48, 68, 64, 88]);
assert.ok(Dealers.getDealer("house_master").maxHp > Dealers.getDealer("shuler").maxHp);
assert.equal(Dealers.getDealer("house_master").mistakeRate, 0);

function safeEventChoice(event, run) {
  return event.choices.find((choice) => {
    if (choice.cost && choice.cost > run.gold) return false;
    return !(choice.effects || []).some((effect) => (effect.op === "hp" || effect.op === "max_hp") && Number(effect.amount || 0) < 0);
  }) || event.choices.find((choice) => !choice.cost || choice.cost <= run.gold) || event.choices[0];
}
function finishCurrentNode(run) {
  if (run.status === Run.STATUS.BATTLE) {
    const context = run.battleContext;
    run = Run.completeBattle(run, { runId: run.runId, nodeId: context.nodeId, winner: "player", playerHp: Math.max(1, run.hp - 3) }, Catalog);
  }
  if (run.status === Run.STATUS.REWARD) run = Run.chooseReward(run, null, Catalog);
  if (run.status === Run.STATUS.NODE && run.pending.type === "event") {
    const event = Content.byEventId[run.pending.eventId];
    run = Run.resolveEvent(run, safeEventChoice(event, run).id, Catalog);
  }
  if (run.status === Run.STATUS.NODE && run.pending.type === "rest") run = Run.restHeal(run);
  if (run.status === Run.STATUS.NODE && run.pending.type === "treasure") run = run.pending.artifacts.length ? Run.takeTreasure(run, run.pending.artifacts[0].offerId) : Run.claimEmptyTreasure(run);
  return run;
}

let run = Run.createRun({ seed: 90210, deck: Catalog.buildDeck("player", 90210), unlockedArtifacts: Content.artifacts.map((item) => item.id) });
assert.equal(run.gold, 65);
assert.equal(run.releaseVersion, "1.0.0-rc1");
const shop = run.map.layers[1].find((node) => node.type === "shop");
const routeStart = run.map.layers[0].find((node) => node.next.includes(shop.id));
assert.ok(routeStart, "Маршрут должен позволять проверить магазин");
run = Run.enterNode(run, routeStart.id, Catalog);
run = finishCurrentNode(run);
assert.equal(run.status, Run.STATUS.ACTIVE);
assert.ok(run.availableNodeIds.includes(shop.id));
run = Run.enterNode(run, shop.id, Catalog);
assert.deepEqual(run.pending.cards.map((offer) => offer.price), [40, 50, 65, 80]);
assert.equal(run.pending.artifact && run.pending.artifact.price, 110);
assert.equal(run.pending.healPrice, 30);
assert.equal(run.pending.healAmount, 16);
assert.equal(run.pending.removePrice, 55);

const oldSave = require("../src/core/act-run-engine.js").createRun({ seed: 77, deck: Catalog.buildDeck("player", 77) });
const migrated = Run.migrate(oldSave);
assert.equal(migrated.releaseVersion, "1.0.0-rc1");
assert.equal(migrated.economyVersion, 2);

assert.equal(Achievements.DEFINITIONS.length, 12);
let achievementState = Achievements.create();
const victoryRun = Object.assign({}, run, { status: "victory", hp: 55, stats: Object.assign({}, run.stats, { battlesWon: 4, elitesDefeated: 1, cardsAdded: 10, cardsUpgraded: 8, cardsRemoved: 5, goldEarned: 500 }) });
const profile = { runs: 3, victories: 1, defeats: 2, bossKills: 1, elitesDefeated: 1, nodesVisited: 24, totalGoldEarned: 500, cardsAdded: 10, cardsRemoved: 5, cardsUpgraded: 8, discoveredCards: Catalog.cards.map((card) => card.id), discoveredArtifacts: Content.artifacts.map((item) => item.id) };
const evaluated = Achievements.evaluate(achievementState, { profile, run: victoryRun });
achievementState = evaluated.state;
assert.equal(Achievements.progress(achievementState).unlocked, Achievements.DEFINITIONS.length);
assert.equal(Audio.normalize({ master: 2, sfx: -1, musicVolume: .5 }).master, 1);
assert.equal(Audio.normalize({ master: 2, sfx: -1, musicVolume: .5 }).sfx, 0);

console.log("Stage 9 release integration passed", { cards: Catalog.cards.length, dealers: Dealers.dealers.length, achievements: Achievements.progress(achievementState).unlocked });