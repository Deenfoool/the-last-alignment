"use strict";
(function (root, factory) {
  const catalog = typeof module === "object" && module.exports
    ? require("./card-catalog.js")
    : root.BitayaMastCardCatalog;
  const cards = factory(catalog);
  if (typeof module === "object" && module.exports) module.exports = cards;
  if (root) root.BitayaMastCards = cards;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Catalog) {
  if (!Catalog || !Array.isArray(Catalog.engineCards)) throw new Error("Card catalog is required.");
  return Catalog.engineCards;
});
