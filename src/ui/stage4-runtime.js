"use strict";
(function () {
  const Catalog = window.BitayaMastCardCatalog;
  if (!Catalog) return;

  const STYLE_ID = "visual-stage3-physical-cards";
  const TOOLTIP_ID = "physicalCardTooltip";
  const coarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)");
  const rarityByLabel = {
    "обычная": "common",
    "необычная": "uncommon",
    "редкая": "rare",
    "эпическая": "epic",
    "легендарная": "legendary",
    "проклятие": "curse",
  };

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = "styles/visual-stage3-cards.css?v=14";
    document.head.append(link);
    document.documentElement.classList.add("visual-physical-cards");
  }

  function tooltip() {
    let node = document.getElementById(TOOLTIP_ID);
    if (node) return node;
    node = document.createElement("aside");
    node.id = TOOLTIP_ID;
    node.className = "physical-card-tooltip";
    node.setAttribute("role", "tooltip");
    node.setAttribute("aria-hidden", "true");
    node.dataset.open = "false";
    node.innerHTML = '<header><h3></h3><span class="physical-cost"></span></header><div class="physical-meta"></div><p class="physical-effect"></p><p class="physical-lore"></p><p class="physical-warning">КАРТА СЕЙЧАС НЕДОСТУПНА</p>';
    document.body.append(node);
    return node;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function physicalKind(name) {
    const value = cleanText(name).toLocaleLowerCase("ru-RU");
    if (/банк|скидоч|лояльн/.test(value)) return "plastic";
    if (/тройк|билет|проезд/.test(value)) return "transport";
    if (/визит|договор|чек|купон|пропуск|провер/.test(value)) return "paper";
    if (/туз|мечен|карта$/.test(value)) return "playing";
    if (/таблет|антидепресс/.test(value)) return "medicine";
    if (/памят|диск|кассет|вирус|экран/.test(value)) return "digital";
    return "object";
  }

  function extractCard(card) {
    const name = cleanText(card.querySelector(".card-name") && card.querySelector(".card-name").textContent);
    const cost = cleanText(card.querySelector(".card-cost") && card.querySelector(".card-cost").textContent);
    const rarityLabel = cleanText(card.querySelector(".card-rarity") && card.querySelector(".card-rarity").textContent).toLocaleLowerCase("ru-RU");
    const body = card.querySelector(".card-body");
    const loreNode = body && body.querySelector("small");
    const lore = cleanText(loreNode && loreNode.textContent);
    let effect = "";
    if (body) {
      const clone = body.cloneNode(true);
      clone.querySelectorAll("small").forEach((node) => node.remove());
      effect = cleanText(clone.textContent);
    }
    const art = card.querySelector(".card-art");
    const backgroundImage = art ? art.style.backgroundImage : "";
    const rarity = rarityByLabel[rarityLabel] || card.dataset.rarity || "common";
    return { name, cost, rarity, rarityLabel, effect, lore, backgroundImage };
  }

  function storeInfo(card, info) {
    card.dataset.physicalName = info.name;
    card.dataset.physicalCost = info.cost;
    card.dataset.physicalRarity = info.rarity;
    card.dataset.physicalRarityLabel = info.rarityLabel;
    card.dataset.physicalEffect = info.effect;
    card.dataset.physicalLore = info.lore;
    card.dataset.physicalKind = physicalKind(info.name);
    card.dataset.rarity = info.rarity;
  }

  function renderFace(card, info) {
    const face = document.createElement("span");
    face.className = "physical-card-face";
    if (info.backgroundImage) face.style.backgroundImage = info.backgroundImage;
    const label = document.createElement("span");
    label.className = "physical-card-object-label";
    label.textContent = info.name;
    face.append(label);
    card.replaceChildren(face);
  }

  function positionTooltip(card) {
    const node = tooltip();
    const rect = card.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    const estimatedHeight = node.offsetHeight || 170;
    const above = rect.top - estimatedHeight - 14;
    node.style.left = `${left}px`;
    node.style.top = `${Math.max(12, above)}px`;
  }

  function showTooltip(card) {
    const node = tooltip();
    node.querySelector("h3").textContent = card.dataset.physicalName || "КАРТА";
    node.querySelector(".physical-cost").textContent = `СТОИМОСТЬ: ${card.dataset.physicalCost || "0"}`;
    node.querySelector(".physical-meta").textContent = `${card.dataset.physicalRarityLabel || card.dataset.physicalRarity || "обычная"} · ${card.dataset.physicalKind || "предмет"}`;
    node.querySelector(".physical-effect").textContent = card.dataset.physicalEffect || "Описание отсутствует.";
    node.querySelector(".physical-lore").textContent = card.dataset.physicalLore || "";
    node.dataset.unplayable = card.dataset.unplayable || "false";
    node.dataset.open = "true";
    node.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => positionTooltip(card));
  }

  function hideTooltip(force) {
    if (!force && document.querySelector(".game-card.physical-selected")) return;
    const node = document.getElementById(TOOLTIP_ID);
    if (!node) return;
    node.dataset.open = "false";
    node.setAttribute("aria-hidden", "true");
  }

  function clearTouchSelection(except) {
    document.querySelectorAll(".game-card.physical-selected").forEach((card) => {
      if (card === except) return;
      card.classList.remove("physical-selected");
      delete card.dataset.touchArmed;
    });
  }

  function bindCard(card) {
    if (card.dataset.physicalHandlers === "true") return;
    card.dataset.physicalHandlers = "true";
    card.addEventListener("pointerenter", () => {
      if (!coarsePointer || !coarsePointer.matches) showTooltip(card);
    });
    card.addEventListener("pointerleave", () => {
      if (!coarsePointer || !coarsePointer.matches) hideTooltip(false);
    });
    card.addEventListener("focus", () => showTooltip(card));
    card.addEventListener("blur", () => hideTooltip(false));
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement)) return;
    const existingFace = card.querySelector(":scope > .physical-card-face");
    if (existingFace) return;
    const info = extractCard(card);
    if (!info.name) return;
    const wasDisabled = Boolean(card.disabled);
    storeInfo(card, info);
    card.dataset.unplayable = wasDisabled ? "true" : "false";
    card.disabled = false;
    card.setAttribute("aria-disabled", wasDisabled ? "true" : "false");
    card.setAttribute("aria-describedby", TOOLTIP_ID);
    renderFace(card, info);
    bindCard(card);
  }

  function enhanceCards() {
    document.querySelectorAll(".game-card").forEach(enhanceCard);
  }

  function interceptCardClick(event) {
    const card = event.target.closest && event.target.closest(".game-card");
    if (!card) return;
    const isTouchMode = Boolean(coarsePointer && coarsePointer.matches);
    if (isTouchMode && card.dataset.touchArmed !== "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearTouchSelection(card);
      card.dataset.touchArmed = "true";
      card.classList.add("physical-selected");
      showTooltip(card);
      return;
    }
    if (card.dataset.unplayable === "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      card.classList.add("physical-selected");
      showTooltip(card);
      return;
    }
    clearTouchSelection();
    hideTooltip(true);
  }

  function interceptOutside(event) {
    if (event.target.closest && event.target.closest(".game-card")) return;
    clearTouchSelection();
    hideTooltip(true);
  }

  installStyles();
  tooltip();
  const badge = document.querySelector("#catalogBadge");
  if (badge) badge.textContent = `${Catalog.cards.length} КАРТ · ФИЗИЧЕСКАЯ РУКА`;
  document.documentElement.dataset.catalogVersion = String(Catalog.DATA_VERSION);
  document.addEventListener("click", interceptCardClick, true);
  document.addEventListener("pointerdown", interceptOutside, true);
  window.addEventListener("resize", () => {
    const selected = document.querySelector(".game-card.physical-selected");
    if (selected) positionTooltip(selected);
  });
  enhanceCards();
  new MutationObserver(enhanceCards).observe(document.body, { childList: true, subtree: true });
})();
