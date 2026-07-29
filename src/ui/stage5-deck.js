"use strict";
(function () {
  const Catalog = window.BitayaMastCardCatalog;
  const Content = window.BitayaMastContentSettings;
  const Model = window.BitayaMastDeckViewModel;
  const Assets = window.BitayaMastAssets || {};
  if (!Catalog || !Content || !Model) throw new Error("Не загружены модули меню колоды.");

  const TYPE_LABELS = Object.freeze({ all: "Все", attack: "Атака", defense: "Защита", skill: "Приём", power: "Сила", curse: "Проклятие" });
  const RARITY_LABELS = Object.freeze({ all: "Все", common: "Обычная", uncommon: "Необычная", rare: "Редкая", epic: "Эпическая", legendary: "Легендарная", curse: "Проклятие" });
  const VIEW_LABELS = Object.freeze({ current: "Текущая", starter: "Стартовая", collection: "Все карты" });
  const STATUS_LABELS = Object.freeze({ strength: "Сила", vulnerable: "Уязвимость", weak: "Слабость", burn: "Ожог", regeneration: "Регенерация", thorns: "Шипы", discount: "Скидка" });
  const ZONE_LABELS = Object.freeze({ drawPile: "в колоде", hand: "в руке", discardPile: "в сбросе", exilePile: "изгнана", starter: "стартовая", collection: "коллекция" });

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const dom = {
    overlay: $("#deckOverlay"), screen: $("#deckScreen"), open: $("#deckButton"), close: $("#deckClose"), grid: $("#deckGrid"), empty: $("#deckEmpty"), resultCount: $("#deckResultCount"), deckCount: $("#deckViewCount"), detail: $("#deckDetail"), detailClose: $("#deckDetailClose"),
    search: $("#deckSearch"), sort: $("#deckSort"), upgradeAll: $("#deckUpgradeAll"), typeFilters: $("#deckTypeFilters"), rarityFilters: $("#deckRarityFilters"), viewTabs: $("#deckViewTabs"), contentToggle: $("#contentModeToggle"), modeNote: $("#contentModeNote"), app: $("#app"), setup: $("#setupOverlay"), settingsButton: $("#settingsButton"), setupCancel: $("#setupCancel"), dealerQuote: $("#dealerQuote"),
  };

  let settings = Content.load();
  let initialMode = settings.mode;
  let filters = Model.normalizeFilters({ view: Model.VIEWS.CURRENT, sort: Model.SORTS.NAME });
  let save = null;
  let selectedKey = null;
  let detailUpgrade = false;
  let pausedViaSetup = false;
  let modeChanged = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function effectText(effect) {
    const amount = Number(effect.amount || 0);
    switch (effect.op) {
      case "damage": return `Наносит ${amount} урона.`;
      case "shield": return `Даёт ${amount} щита.`;
      case "heal": return `Лечит на ${amount}.`;
      case "energy": return `${amount >= 0 ? "+" : ""}${amount} энергии.`;
      case "draw": return `Берёт ${amount} ${amount === 1 ? "карту" : "карты"}.`;
      case "status": return `${STATUS_LABELS[effect.statusId] || effect.statusId}: ${effect.stacks || 1}, ${effect.duration || "∞"} ход.`;
      case "steal": return "Крадёт случайную карту соперника.";
      case "break": return `Ломает карту: +${effect.amount || 1} к стоимости на ${effect.duration || 1} ход.`;
      case "block": return `Блокирует карту на ${effect.duration || 1} ход.`;
      case "burn": return `Сжигает ${effect.amount || 1} карту.`;
      case "repair": return `Ремонтирует до ${effect.amount || 1} карт.`;
      case "return_from_discard": return `Возвращает ${effect.amount || 1} карту из сброса.`;
      case "discard_random": return `Сбрасывает ${effect.amount || 1} случайную карту.`;
      case "cleanse": return `Снимает до ${effect.amount || 1} негативных эффектов.`;
      case "noop": return "Не производит механического эффекта.";
      default: return `Эффект: ${effect.op}.`;
    }
  }

  function artFor(card) {
    return Assets[card.art] || Catalog.artDataUri(card.id);
  }

  function pauseBattle() {
    if (!dom.setup || !dom.setup.hidden || !dom.settingsButton) return;
    dom.settingsButton.click();
    if (!dom.setup.hidden) {
      pausedViaSetup = true;
      document.body.classList.add("deck-hides-setup");
    }
  }

  function resumeBattle() {
    document.body.classList.remove("deck-hides-setup");
    if (pausedViaSetup && dom.setupCancel && !dom.setupCancel.hidden) dom.setupCancel.click();
    pausedViaSetup = false;
  }

  function openDeck() {
    pauseBattle();
    let storage = null;
    try { storage = window.localStorage; } catch (error) { storage = null; }
    save = Model.readSave(storage);
    settings = Content.load(storage);
    initialMode = settings.mode;
    modeChanged = false;
    dom.overlay.hidden = false;
    dom.app.inert = true;
    document.body.classList.add("deck-open");
    syncControls();
    render();
    requestAnimationFrame(() => dom.search.focus());
  }

  function closeDeck() {
    dom.overlay.hidden = true;
    dom.screen.classList.remove("detail-open");
    dom.app.inert = false;
    document.body.classList.remove("deck-open");
    resumeBattle();
    if (modeChanged || settings.mode !== initialMode) window.location.reload();
  }

  function syncControls() {
    dom.search.value = filters.search;
    dom.sort.value = filters.sort;
    dom.upgradeAll.checked = filters.forceUpgrade;
    $$('[data-deck-view]', dom.viewTabs).forEach((button) => button.classList.toggle("active", button.dataset.deckView === filters.view));
    $$('[data-filter-type]', dom.typeFilters).forEach((button) => button.classList.toggle("active", button.dataset.filterType === filters.type));
    $$('[data-filter-rarity]', dom.rarityFilters).forEach((button) => button.classList.toggle("active", button.dataset.filterRarity === filters.rarity));
    $$('[data-content-mode]', dom.contentToggle).forEach((button) => button.classList.toggle("active", button.dataset.contentMode === settings.mode));
    dom.modeNote.textContent = settings.mode === Content.MODES.SAFE
      ? "Безопасный текст включён. Механика карт не меняется."
      : "Взрослый текст включён: чёрный юмор и жёсткие реплики.";
  }

  function queryItems() {
    return Model.query({ filters, settings, save });
  }

  function keyFor(item) {
    return `${item.entry.instanceId}:${item.card.id}`;
  }

  function render() {
    const items = queryItems();
    if (!items.some((item) => keyFor(item) === selectedKey)) selectedKey = items[0] ? keyFor(items[0]) : null;
    dom.resultCount.textContent = `${items.length} ${items.length === 1 ? "КАРТА" : "КАРТ"}`;
    const allViewEntries = Model.entriesForView(filters.view, save);
    dom.deckCount.textContent = `${VIEW_LABELS[filters.view]}: ${allViewEntries.length}`;
    dom.empty.hidden = items.length > 0;
    dom.grid.replaceChildren(...items.map(renderCardButton));
    renderDetail(items.find((item) => keyFor(item) === selectedKey) || null);
    syncControls();
  }

  function renderCardButton(item) {
    const card = item.card;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "deck-card";
    button.dataset.type = card.type;
    button.dataset.rarity = card.rarity;
    button.dataset.key = keyFor(item);
    if (button.dataset.key === selectedKey) button.classList.add("selected");
    if (card.upgraded) button.classList.add("upgraded");
    button.setAttribute("aria-label", `${card.name}. Стоимость ${card.cost}. ${card.short}`);
    button.innerHTML = `<span class="deck-card-top"><b>${card.cost}</b><strong>${escapeHtml(card.name)}</strong><i>${escapeHtml(card.stat)}</i></span><span class="deck-card-art" style="background-image:url('${artFor(card)}')"></span><span class="deck-card-short">${escapeHtml(card.short)}</span><span class="deck-card-foot">${escapeHtml(TYPE_LABELS[card.type])} · ${escapeHtml(RARITY_LABELS[card.rarity])}</span>`;
    button.addEventListener("focus", () => selectItem(item, false));
    button.addEventListener("mouseenter", () => {
      if (window.matchMedia("(hover: hover)").matches) selectItem(item, false);
    });
    button.addEventListener("click", () => selectItem(item, true));
    return button;
  }

  function selectItem(item, openMobile) {
    selectedKey = keyFor(item);
    detailUpgrade = filters.forceUpgrade || item.entry.upgrade > 0;
    $$(".deck-card", dom.grid).forEach((button) => button.classList.toggle("selected", button.dataset.key === selectedKey));
    renderDetail(item);
    if (openMobile && window.matchMedia("(max-width: 900px)").matches) dom.screen.classList.add("detail-open");
  }

  function renderDetail(item) {
    if (!item) {
      dom.detail.innerHTML = '<p class="deck-detail-empty">Карты по выбранным фильтрам не найдены.</p>';
      return;
    }
    const base = Catalog.byId[item.card.id];
    const card = Content.projectCard(base, settings, detailUpgrade);
    const baseView = Content.projectCard(base, settings, false);
    const upgradeView = Content.projectCard(base, settings, true);
    const effects = card.effects.map((effect) => `<li>${escapeHtml(effectText(effect))}</li>`).join("");
    const tags = card.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    dom.detail.innerHTML = `
      <button id="deckDetailClose" class="deck-detail-close" type="button">← К КАРТАМ</button>
      <div class="detail-version-tabs" role="group" aria-label="Версия карты">
        <button type="button" data-detail-upgrade="0" class="${detailUpgrade ? "" : "active"}">БАЗОВАЯ</button>
        <button type="button" data-detail-upgrade="1" class="${detailUpgrade ? "active" : ""}">УЛУЧШЕННАЯ</button>
      </div>
      <article class="deck-card deck-card-preview" data-type="${card.type}" data-rarity="${card.rarity}">
        <span class="deck-card-top"><b>${card.cost}</b><strong>${escapeHtml(card.name)}</strong><i>${escapeHtml(card.stat)}</i></span>
        <span class="deck-card-art" style="background-image:url('${artFor(card)}')"></span>
        <span class="deck-card-short">${escapeHtml(card.short)}</span>
        <span class="deck-card-foot">${escapeHtml(TYPE_LABELS[card.type])} · ${escapeHtml(RARITY_LABELS[card.rarity])}</span>
      </article>
      <section class="detail-block"><h3>МЕХАНИКА</h3><ul>${effects}</ul></section>
      <section class="detail-block lore"><h3>ЛОР</h3><p>${escapeHtml(card.lore)}</p></section>
      <section class="detail-compare"><div><span>БАЗА</span><b>${baseView.cost}⚡ · ${escapeHtml(baseView.stat)}</b></div><div><span>УЛУЧШЕНИЕ</span><b>${upgradeView.cost}⚡ · ${escapeHtml(upgradeView.stat)}</b></div></section>
      <section class="detail-block"><h3>ТЕГИ СИНЕРГИЙ</h3><div class="detail-tags">${tags}</div></section>
      <p class="detail-zone">${escapeHtml(ZONE_LABELS[item.entry.zone] || item.entry.zone)}${item.entry.upgrade ? " · уже улучшена" : ""}</p>`;
    $("#deckDetailClose", dom.detail).addEventListener("click", () => dom.screen.classList.remove("detail-open"));
    $$('[data-detail-upgrade]', dom.detail).forEach((button) => button.addEventListener("click", () => {
      detailUpgrade = button.dataset.detailUpgrade === "1";
      renderDetail(item);
    }));
  }

  function setMode(mode) {
    settings = Content.save({ mode });
    modeChanged = settings.mode !== initialMode;
    document.documentElement.dataset.contentMode = settings.mode;
    if (dom.dealerQuote) dom.dealerQuote.textContent = Content.dealerLine(dom.dealerQuote.textContent, settings);
    render();
  }

  dom.open.addEventListener("click", openDeck);
  dom.close.addEventListener("click", closeDeck);
  dom.detailClose.addEventListener("click", () => dom.screen.classList.remove("detail-open"));
  dom.overlay.addEventListener("click", (event) => { if (event.target === dom.overlay) closeDeck(); });
  dom.search.addEventListener("input", () => { filters = Model.normalizeFilters(Object.assign({}, filters, { search: dom.search.value })); render(); });
  dom.sort.addEventListener("change", () => { filters = Model.normalizeFilters(Object.assign({}, filters, { sort: dom.sort.value })); render(); });
  dom.upgradeAll.addEventListener("change", () => { filters = Model.normalizeFilters(Object.assign({}, filters, { forceUpgrade: dom.upgradeAll.checked })); detailUpgrade = filters.forceUpgrade; render(); });
  dom.viewTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-deck-view]");
    if (!button) return;
    filters = Model.normalizeFilters(Object.assign({}, filters, { view: button.dataset.deckView })); selectedKey = null; render();
  });
  dom.typeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-type]");
    if (!button) return;
    filters = Model.normalizeFilters(Object.assign({}, filters, { type: button.dataset.filterType })); selectedKey = null; render();
  });
  dom.rarityFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-rarity]");
    if (!button) return;
    filters = Model.normalizeFilters(Object.assign({}, filters, { rarity: button.dataset.filterRarity })); selectedKey = null; render();
  });
  dom.contentToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-content-mode]");
    if (button) setMode(button.dataset.contentMode);
  });
  document.addEventListener("keydown", (event) => {
    if (dom.overlay.hidden) return;
    if (event.key === "Escape") {
      if (dom.screen.classList.contains("detail-open")) dom.screen.classList.remove("detail-open");
      else closeDeck();
    }
  });

  document.documentElement.dataset.contentMode = settings.mode;
  if (dom.dealerQuote && settings.mode === Content.MODES.SAFE) {
    const observer = new MutationObserver(() => {
      const safeLine = Content.dealerLine(dom.dealerQuote.textContent, settings);
      if (safeLine !== dom.dealerQuote.textContent) dom.dealerQuote.textContent = safeLine;
    });
    observer.observe(dom.dealerQuote, { childList: true, characterData: true, subtree: true });
    dom.dealerQuote.textContent = Content.dealerLine(dom.dealerQuote.textContent, settings);
  }
})();
