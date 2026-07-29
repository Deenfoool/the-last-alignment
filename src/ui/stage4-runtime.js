"use strict";
(function () {
  const Catalog = window.BitayaMastCardCatalog;
  if (!Catalog) return;
  const rarityByLabel = {
    "обычная": "common",
    "необычная": "uncommon",
    "редкая": "rare",
    "эпическая": "epic",
    "легендарная": "legendary",
    "проклятие": "curse",
  };

  function enhanceCards() {
    document.querySelectorAll(".game-card").forEach((card) => {
      const label = card.querySelector(".card-rarity");
      const rarity = label && rarityByLabel[label.textContent.trim().toLowerCase()];
      if (rarity) card.dataset.rarity = rarity;
    });
  }

  const badge = document.querySelector("#catalogBadge");
  if (badge) badge.textContent = `${Catalog.cards.length} КАРТ · ${new Set(Catalog.cards.flatMap((card) => card.tags)).size} СИНЕРГИЙ`;
  document.documentElement.dataset.catalogVersion = String(Catalog.DATA_VERSION);
  enhanceCards();
  new MutationObserver(enhanceCards).observe(document.body, { childList: true, subtree: true });
})();
