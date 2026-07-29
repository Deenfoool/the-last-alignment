"use strict";
(function (root, factory) {
  const base = root && root.BitayaMastActRun || (typeof module === "object" && module.exports ? require("./act-run-engine.js") : null);
  const api = factory(base);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.BitayaMastActRun = api; root.BitayaMastReleaseRunBalance = api.balance; }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Base) {
  if (!Base) throw new Error("Release run balance requires act run engine.");
  const RELEASE_VERSION = "1.0.0-rc1";
  const ECONOMY_VERSION = 2;
  const PRICES = Object.freeze({ startGold: 65, commonReward: 36, eliteReward: 64, cards: [40, 50, 65, 80], artifact: 110, heal: 30, remove: 55, healAmount: 16 });
  function stamp(state) { state.releaseVersion = RELEASE_VERSION; state.economyVersion = ECONOMY_VERSION; return state; }
  function createRun(options) {
    const input = Object.assign({}, options || {});
    if (input.gold == null) input.gold = PRICES.startGold;
    return stamp(Base.createRun(input));
  }
  function rebalanceShop(state) {
    if (!state || !state.pending || state.pending.type !== "shop") return state;
    const discountRatio = state.pending.cards && state.pending.cards[0] && state.pending.cards[0].price ? state.pending.cards[0].price / 45 : 1;
    state.pending.cards.forEach((offer, index) => { offer.price = Math.max(1, Math.round(PRICES.cards[index] * discountRatio)); });
    if (state.pending.artifact) state.pending.artifact.price = Math.max(1, Math.round(PRICES.artifact * discountRatio));
    state.pending.healPrice = Math.max(1, Math.round(PRICES.heal * discountRatio));
    state.pending.healAmount = PRICES.healAmount;
    state.pending.removePrice = Math.max(1, Math.round(PRICES.remove * discountRatio));
    return state;
  }
  function enterNode(inputState, nodeId, catalog) { return stamp(rebalanceShop(Base.enterNode(inputState, nodeId, catalog))); }
  function completeBattle(inputState, result, catalog) {
    const node = inputState && inputState.map && inputState.map.nodes && inputState.map.nodes.find((item) => item.id === inputState.currentNodeId);
    const state = Base.completeBattle(inputState, result, catalog);
    if (result && result.winner === "player" && node && node.type !== "boss") {
      const targetGold = node.type === "elite" ? PRICES.eliteReward : PRICES.commonReward;
      const event = state.history.slice().reverse().find((entry) => entry.type === "BATTLE_WON" && entry.payload && entry.payload.nodeId === node.id);
      const awarded = Number(event && event.payload.gold || state.pending && state.pending.gold || 0);
      const delta = targetGold - awarded;
      state.gold = Math.max(0, state.gold + delta);
      if (state.stats) state.stats.goldEarned = Math.max(0, Number(state.stats.goldEarned || 0) + delta);
      if (event) event.payload.gold = targetGold;
      if (state.pending && state.pending.type === "reward") state.pending.gold = targetGold;
    }
    return stamp(state);
  }
  function migrate(raw) { return stamp(Base.migrate(raw)); }
  const balance = Object.freeze({ version: RELEASE_VERSION, economyVersion: ECONOMY_VERSION, prices: PRICES });
  return Object.freeze(Object.assign({}, Base, { RELEASE_VERSION, ECONOMY_VERSION, createRun, enterNode, completeBattle, migrate, balance }));
});