"use strict";
(function (root) {
  const Engine = root.BitayaMastBattle;
  const Catalog = root.BitayaMastCardCatalog;
  const Content = root.BitayaMastContentSettings;
  if (!Engine || !Catalog) throw new Error("Stage 4 runtime requires battle engine and card catalog.");

  function shouldUseCatalogDecks(config) {
    if (!config || config.disableCatalogDecks) return false;
    if (config.useCatalogDecks) return true;
    return typeof config.battleId === "string" && config.battleId.startsWith("slice-");
  }

  function prepare(config) {
    if (!shouldUseCatalogDecks(config)) return config;
    const prepared = Catalog.decorateBattleConfig(config);
    if (Content && typeof Content.projectEngineCards === "function") {
      prepared.cards = Content.projectEngineCards(Catalog.cards, Content.load());
    }
    return prepared;
  }

  const wrapped = Object.freeze(Object.assign({}, Engine, {
    createBattle(config) {
      return Engine.createBattle(prepare(config));
    },
    replayBattle(initialConfig, commands) {
      return Engine.replayBattle(prepare(initialConfig), commands);
    },
  }));

  root.BitayaMastBattle = wrapped;
  root.BitayaMastStage4Runtime = Object.freeze({ shouldUseCatalogDecks, prepare });
})(typeof globalThis !== "undefined" ? globalThis : this);
