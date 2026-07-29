"use strict";
(function (root) {
  const RELEASE_VERSION = "13";

  function loadBrowserSource(url) {
    if (!root || !root.document || typeof root.XMLHttpRequest !== "function") return false;
    const request = new root.XMLHttpRequest();
    request.open("GET", url, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300 || request.status === 0)) throw new Error(`Не удалось загрузить релизный модуль ${url}: ${request.status}.`);
    (0, eval)(`${request.responseText}\n//# sourceURL=${url.split("?")[0]}`);
    return true;
  }

  function installReleaseBootstrap() {
    if (!root || !root.document || root.BitayaMastReleaseBootstrap) return;
    [
      `src/core/release-card-balance.js?v=${RELEASE_VERSION}`,
      `src/core/release-dealer-balance.js?v=${RELEASE_VERSION}`,
      `src/core/release-run-balance.js?v=${RELEASE_VERSION}`,
      `src/core/release-achievements.js?v=${RELEASE_VERSION}`,
      `src/core/release-audio.js?v=${RELEASE_VERSION}`,
      `src/core/deck-view-model.js?v=${RELEASE_VERSION}`
    ].forEach(loadBrowserSource);
    root.BitayaMastReleaseBootstrap = Object.freeze({ version: "1.0.0-rc1", loadedAt: Date.now() });

    if (!root.document.querySelector('link[data-release-style="stage9"]')) {
      const style = root.document.createElement("link");
      style.rel = "stylesheet";
      style.href = `styles/stage9.css?v=${RELEASE_VERSION}`;
      style.dataset.releaseStyle = "stage9";
      root.document.head.append(style);
    }
    const loadUi = () => {
      if (root.document.querySelector('script[data-release-ui="stage9"]')) return;
      const script = root.document.createElement("script");
      script.src = `src/ui/stage9-release.js?v=${RELEASE_VERSION}`;
      script.dataset.releaseUi = "stage9";
      script.onerror = () => console.error("Не удалось загрузить релизный интерфейс этапа 9.");
      root.document.body.append(script);
    };
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", () => root.setTimeout(loadUi, 0), { once: true });
    else root.setTimeout(loadUi, 0);
  }

  installReleaseBootstrap();

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
    if (Content && typeof Content.projectEngineCards === "function") prepared.cards = Content.projectEngineCards(Catalog.cards, Content.load());
    return prepared;
  }

  const wrapped = Object.freeze(Object.assign({}, Engine, {
    createBattle(config) { return Engine.createBattle(prepare(config)); },
    replayBattle(initialConfig, commands) { return Engine.replayBattle(prepare(initialConfig), commands); },
  }));

  root.BitayaMastBattle = wrapped;
  root.BitayaMastStage4Runtime = Object.freeze({ shouldUseCatalogDecks, prepare, releaseBootstrap: root.BitayaMastReleaseBootstrap || null });
})(typeof globalThis !== "undefined" ? globalThis : this);