"use strict";
const assert = require("node:assert/strict");
const Settings = require("../src/core/timer-settings.js");
const Engine = require("../src/core/timed-battle-engine.js");
const cards = require("../src/data/stage2-cards.js");

assert.deepEqual(Settings.normalize(null), {
  settingsVersion: 1,
  mode: Settings.MODES.CLASSIC,
  timerEnabled: false,
  seconds: 0,
  penalty: Settings.PENALTIES.END_TURN,
});
assert.equal(Settings.fromPreset(Settings.MODES.RELAXED, null).seconds, 60);
assert.equal(Settings.fromPreset(Settings.MODES.HARDCORE, null).seconds, 30);
assert.equal(Settings.normalize({ mode: "custom", seconds: 2 }).seconds, 10);
assert.equal(Settings.normalize({ mode: "custom", seconds: 500 }).seconds, 180);
assert.equal(Settings.migrate({ timerEnabled: true, timerSeconds: 45 }).mode, Settings.MODES.CUSTOM);
assert.equal(Settings.formatClock(65), "01:05");

function config(extraPlayer) {
  return {
    battleId: "timer-test",
    seed: 90210,
    cards,
    rules: { handSize: 5, maxHandSize: 10, shieldResetsEachTurn: false },
    player: Object.assign({ name: "Игрок", maxHp: 20, maxEnergy: 3, deck: ["ace_clubs", "cleaning_card", "bank_card", "troika_pass", "brick", "red_pill"] }, extraPlayer || {}),
    dealer: { name: "Шулер", maxHp: 20, maxEnergy: 3, deck: ["headshot", "ace_clubs", "brick", "bank_card", "cleaning_card", "marked_card"] },
  };
}

function expire(penalty, amount, extraPlayer) {
  const initialConfig = config(extraPlayer);
  const initial = Engine.createBattle(initialConfig);
  const result = Engine.executeCommand(initial, { type: "expireTurn", actorId: "player", penalty, amount });
  Engine.validateState(result.state);
  const replay = Engine.replayBattle(initialConfig, result.state.commandLog);
  assert.equal(Engine.stateHash(replay), Engine.stateHash(result.state));
  assert.equal(result.state.commandLog.at(-1).type, "expireTurn");
  assert.ok(result.events.some((event) => event.type === "TIME_EXPIRED"));
  return { initial, result };
}

{
  const { result } = expire(Settings.PENALTIES.END_TURN);
  assert.equal(result.state.phase, Engine.PHASES.DEALER);
}

{
  const { initial, result } = expire(Settings.PENALTIES.DISCARD_RANDOM);
  assert.equal(result.state.actors.player.hand.length, initial.actors.player.hand.length - 1);
  assert.equal(result.state.actors.player.discardPile.length, initial.actors.player.discardPile.length + 1);
  assert.ok(result.events.some((event) => event.type === "CARD_DISCARDED" && event.payload.reason === "timeout"));
}

{
  const { result } = expire(Settings.PENALTIES.DAMAGE, 3, { shield: 2 });
  assert.equal(result.state.actors.player.shield, 0);
  assert.equal(result.state.actors.player.hp, 19);
  assert.ok(result.events.some((event) => event.type === "DAMAGE_DEALT" && event.payload.source === "timeout"));
}

{
  const { result } = expire(Settings.PENALTIES.DEALER_ENERGY, 1);
  assert.equal(result.state.actors.dealer.energy, result.state.actors.dealer.maxEnergy + 1);
  assert.ok(result.events.some((event) => event.type === "ENERGY_CHANGED" && event.payload.source === "timeout"));
}

{
  const { result } = expire(Settings.PENALTIES.DAMAGE, 3, { hp: 2, shield: 0 });
  assert.equal(result.state.phase, Engine.PHASES.FINISHED);
  assert.equal(result.state.winner, Engine.SIDES.DEALER);
}

console.log("Stage 3 timer settings and timeout penalties passed");
