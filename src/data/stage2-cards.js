"use strict";
(function (root, factory) {
  const catalog = typeof module === "object" && module.exports
    ? require("./card-catalog.js")
    : root.BitayaMastCardCatalog;
  const content = typeof module === "object" && module.exports
    ? require("../core/content-settings.js")
    : root.BitayaMastContentSettings;
  const cards = factory(catalog, content);
  if (typeof module === "object" && module.exports) module.exports = cards;
  if (root) root.BitayaMastCards = cards;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Catalog, Content) {
  if (!Catalog || !Array.isArray(Catalog.cards)) throw new Error("Card catalog is required.");
  if (!Content || typeof Content.projectEngineCards !== "function") return Catalog.engineCards;
  return Content.projectEngineCards(Catalog.cards, Content.load());
});
