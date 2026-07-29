"use strict";
(function (root) {
  const Engine = root.BitayaMastBattle;
  const Catalog = root.BitayaMastCardCatalog;
  if (!Engine || !Catalog) throw new Error("Stage 4 runtime requires battle engine and card catalog.");

  function shouldUseCatalogDecks(config) {
    if (!config || config.disableCatalogDecks) return false;
    if (config.useCatalogDecks) return true;
    return typeof config.battleId === "string" && config.battleId.startsWith("slice-");
  }

  const wrapped = Object.freeze(Object.assign({}, Engine, {
    createBattle(config) {
      const prepared = shouldUseCatalogDecks(config) ? Catalog.decorateBattleConfig(config) : config;
      return Engine.createBattle(prepared);
    },
    replayBattle(initialConfig, commands) {
      const prepared = shouldUseCatalogDecks(initialConfig) ? Catalog.decorateBattleConfig(initialConfig) : initialConfig;
      return Engine.replayBattle(prepared, commands);
    },
  }));

  root.BitayaMastBattle = wrapped;
  root.BitayaMastStage4Runtime = Object.freeze({ shouldUseCatalogDecks });
})(typeof globalThis !== "undefined" ? globalThis : this);
