"use strict";
(function (root, factory) {
  const Catalog = typeof module === "object" && module.exports ? require("../data/card-catalog.js") : root.BitayaMastCardCatalog;
  const Content = typeof module === "object" && module.exports ? require("./content-settings.js") : root.BitayaMastContentSettings;
  const api = factory(Catalog, Content);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastDeckViewModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Catalog, Content) {
  if (!Catalog || !Content) throw new Error("Deck view model requires catalog and content settings.");

  const VIEWS = Object.freeze({ CURRENT: "current", STARTER: "starter", COLLECTION: "collection" });
  const SORTS = Object.freeze({ NAME: "name", COST: "cost", RARITY: "rarity", TYPE: "type" });
  const TYPE_ORDER = Object.freeze(["attack", "defense", "skill", "power", "curse"]);
  const RARITY_ORDER = Object.freeze(["common", "uncommon", "rare", "epic", "legendary", "curse"]);
  const SAVE_KEYS = Object.freeze(["bitaya-mast-stage3-battle-v2", "bitaya-mast-stage2-battle-v1"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

  function normalizeFilters(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      view: Object.values(VIEWS).includes(source.view) ? source.view : VIEWS.CURRENT,
      search: String(source.search || "").trim().toLocaleLowerCase("ru-RU"),
      type: TYPE_ORDER.includes(source.type) ? source.type : "all",
      rarity: RARITY_ORDER.includes(source.rarity) ? source.rarity : "all",
      sort: Object.values(SORTS).includes(source.sort) ? source.sort : SORTS.NAME,
      forceUpgrade: Boolean(source.forceUpgrade),
    };
  }

  function parseSave(value) {
    if (!value) return null;
    try { return typeof value === "string" ? JSON.parse(value) : clone(value); }
    catch (error) { return null; }
  }

  function readSave(storage) {
    if (!storage || typeof storage.getItem !== "function") return null;
    for (const key of SAVE_KEYS) {
      try {
        const parsed = parseSave(storage.getItem(key));
        if (parsed) return parsed;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function stateFromSave(save) {
    const parsed = parseSave(save);
    return parsed && parsed.state ? parsed.state : parsed;
  }

  function currentDeck(save) {
    const state = stateFromSave(save);
    const actor = state && state.actors && state.actors.player;
    if (!actor) return [];
    const entries = [];
    const seen = new Set();
    ["drawPile", "hand", "discardPile", "exilePile"].forEach((zone) => {
      (Array.isArray(actor[zone]) ? actor[zone] : []).forEach((card) => {
        if (!card || seen.has(card.instanceId)) return;
        seen.add(card.instanceId);
        entries.push({ id: card.definitionId, upgrade: Number(card.upgrade || 0), instanceId: card.instanceId, zone });
      });
    });
    return entries;
  }

  function starterDeck() {
    return Catalog.buildDeck("player", "bitaya-mast-starter-v1").map((id, index) => ({ id, upgrade: 0, instanceId: `starter-${index}`, zone: "starter" }));
  }

  function collectionDeck() {
    return Catalog.cards.map((card, index) => ({ id: card.id, upgrade: 0, instanceId: `collection-${index}`, zone: "collection" }));
  }

  function entriesForView(view, save) {
    if (view === VIEWS.STARTER) return starterDeck();
    if (view === VIEWS.COLLECTION) return collectionDeck();
    const active = currentDeck(save);
    return active.length ? active : starterDeck();
  }

  function searchableText(card) {
    return [
      card.name,
      card.short,
      card.lore,
      ...(card.tags || []),
      ...(card.effects || []).map((effect) => `${effect.op} ${effect.statusId || ""} ${effect.amount == null ? "" : effect.amount}`),
    ].join(" ").toLocaleLowerCase("ru-RU");
  }

  function compareCards(first, second, sort) {
    if (sort === SORTS.COST) return first.card.cost - second.card.cost || first.card.name.localeCompare(second.card.name, "ru");
    if (sort === SORTS.RARITY) return RARITY_ORDER.indexOf(first.card.rarity) - RARITY_ORDER.indexOf(second.card.rarity) || first.card.name.localeCompare(second.card.name, "ru");
    if (sort === SORTS.TYPE) return TYPE_ORDER.indexOf(first.card.type) - TYPE_ORDER.indexOf(second.card.type) || first.card.name.localeCompare(second.card.name, "ru");
    return first.card.name.localeCompare(second.card.name, "ru");
  }

  function query(options) {
    const source = options || {};
    const filters = normalizeFilters(source.filters);
    const settings = Content.normalize(source.settings);
    const entries = entriesForView(filters.view, source.save);
    return entries
      .map((entry) => {
        const base = Catalog.byId[entry.id];
        if (!base) return null;
        const upgraded = filters.forceUpgrade || entry.upgrade > 0;
        return { entry, card: Content.projectCard(base, settings, upgraded) };
      })
      .filter(Boolean)
      .filter((item) => filters.type === "all" || item.card.type === filters.type)
      .filter((item) => filters.rarity === "all" || item.card.rarity === filters.rarity)
      .filter((item) => !filters.search || searchableText(item.card).includes(filters.search))
      .sort((a, b) => compareCards(a, b, filters.sort));
  }

  function counts(items) {
    const result = { total: 0, types: {}, rarities: {} };
    (items || []).forEach((item) => {
      result.total += 1;
      result.types[item.card.type] = (result.types[item.card.type] || 0) + 1;
      result.rarities[item.card.rarity] = (result.rarities[item.card.rarity] || 0) + 1;
    });
    return result;
  }

  return Object.freeze({
    VIEWS,
    SORTS,
    TYPE_ORDER,
    RARITY_ORDER,
    SAVE_KEYS,
    normalizeFilters,
    parseSave,
    readSave,
    currentDeck,
    starterDeck,
    collectionDeck,
    entriesForView,
    query,
    counts,
  });
});
