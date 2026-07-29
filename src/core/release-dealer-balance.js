"use strict";
(function (root, factory) {
  const base = root && root.BitayaMastDealerCatalog || (typeof module === "object" && module.exports ? require("../data/dealer-catalog.js") : null);
  const api = factory(base);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.BitayaMastDealerCatalog = api; root.BitayaMastReleaseDealerBalance = api.balance; }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Base) {
  if (!Base) throw new Error("Release dealer balance requires dealer catalog.");
  const DATA_VERSION = 2;
  const RELEASE_VERSION = "1.0.0-rc1";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const deepFreeze = (value) => { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(deepFreeze); return value; };
  const OVERRIDES = Object.freeze({
    shuler: { maxHp: 46, mistakeRate: .20 },
    collector: { maxHp: 54, mistakeRate: .13 },
    sysadmin: { maxHp: 50, mistakeRate: .12 },
    projectionist: { maxHp: 48, mistakeRate: .11 },
    archivist: { maxHp: 68, mistakeRate: .06 },
    mascot: { maxHp: 64, mistakeRate: .16 },
    house_master: { maxHp: 88, mistakeRate: 0 }
  });
  const dealers = deepFreeze(Base.dealers.map((dealer) => Object.assign(clone(dealer), clone(OVERRIDES[dealer.id] || {}))));
  const byId = deepFreeze(Object.fromEntries(dealers.map((dealer) => [dealer.id, dealer])));
  function getDealer(id) { return byId[id] || byId.shuler; }
  function normalizeId(id) { return getDealer(id).id; }
  function readSelection(storage) { try { return normalizeId(storage && storage.getItem(Base.STORAGE_KEY)); } catch (error) { return "shuler"; } }
  function saveSelection(id, storage) { const normalized = normalizeId(id); try { if (storage) storage.setItem(Base.STORAGE_KEY, normalized); } catch (error) {} return normalized; }
  function quoteFor(dealer, key, safe) { return Base.quoteFor(typeof dealer === "string" ? getDealer(dealer) : dealer, key, safe); }
  function decorateBattleConfig(input, catalog, dealerId) {
    const profile = getDealer(dealerId || input && input.dealerId);
    const config = Base.decorateBattleConfig(input, catalog, profile.id);
    config.dealer = Object.assign({}, config.dealer || {}, { name: profile.name, maxHp: profile.maxHp, hp: profile.maxHp, maxEnergy: profile.maxEnergy });
    config.rules = Object.assign({}, config.rules || {}, { dealerId: profile.id, dealerCatalogVersion: DATA_VERSION, releaseBalanceVersion: RELEASE_VERSION });
    return config;
  }
  const balance = deepFreeze({ version: RELEASE_VERSION, overrides: clone(OVERRIDES), difficultyCurve: dealers.map((dealer) => ({ id: dealer.id, tier: dealer.tier, hp: dealer.maxHp, energy: dealer.maxEnergy, difficulty: dealer.difficulty, mistakeRate: dealer.mistakeRate })) });
  return Object.freeze(Object.assign({}, Base, { DATA_VERSION, RELEASE_VERSION, dealers, byId, getDealer, normalizeId, readSelection, saveSelection, quoteFor, decorateBattleConfig, balance }));
});