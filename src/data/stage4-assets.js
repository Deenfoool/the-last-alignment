"use strict";
(function (root) {
  const Catalog = root.BitayaMastCardCatalog;
  if (!Catalog) throw new Error("Stage 4 assets require BitayaMastCardCatalog.");
  const assets = root.BitayaMastAssets = root.BitayaMastAssets || {};
  Catalog.cards.forEach((card) => {
    if (!assets[card.art.key]) assets[card.art.key] = Catalog.artDataUri(card);
  });
  root.BitayaMastCardArtCount = Catalog.cards.length;
})(typeof globalThis !== "undefined" ? globalThis : this);
