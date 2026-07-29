"use strict";
(function (root, factory) {
  const Content = root && root.BitayaMastAct1Content || (typeof module === "object" && module.exports ? require("../data/act1-content.js") : null);
  const api = factory(Content);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastActRun = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Content) {
  if (!Content) throw new Error("Act run engine requires act content.");
  const SAVE_VERSION = 1;
  const STORAGE_KEY = "bitaya-mast-stage7-run-v1";
  const STATUS = Object.freeze({ ACTIVE: "active", NODE: "node", BATTLE: "battle", REWARD: "reward", VICTORY: "victory", DEFEAT: "defeat", ABANDONED: "abandoned" });
  class RunRuleError extends Error { constructor(code, message, details) { super(message); this.name = "RunRuleError"; this.code = code; this.details = details || null; } }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function assert(condition, code, message, details) { if (!condition) throw new RunRuleError(code, message, details); }
  function integer(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback; }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
  function hash(value) { const source = String(value); let result = 2166136261; for (let index = 0; index < source.length; index += 1) { result ^= source.charCodeAt(index); result = Math.imul(result, 16777619); } return result >>> 0; }
  function rng(seed) { let state = hash(seed) || 1; return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; }
  function pick(list, seed) { if (!list.length) return null; return list[Math.floor(rng(seed)() * list.length)]; }
  function shuffled(list, seed) { const result = list.slice(); const random = rng(seed); for (let index = result.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [result[index], result[target]] = [result[target], result[index]]; } return result; }
  function stableStringify(value) { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`; }
  function stateHash(state) { return hash(stableStringify(state)).toString(16).padStart(8, "0"); }
  function pushHistory(state, type, payload) { state.history.push({ index: state.history.length, type, payload: clone(payload || {}), layer: currentLayer(state) }); }
  function cardList(catalog) { return catalog && Array.isArray(catalog.cards) ? catalog.cards : []; }
  function cardById(catalog, id) { return cardList(catalog).find((card) => card.id === id) || null; }
  function artifactValue(state, key) { return (state.artifacts || []).reduce((sum, id) => sum + Number(Content.byArtifactId[id] && Content.byArtifactId[id].effect[key] || 0), 0); }
  function availableArtifacts(state) { const unlocked = new Set(state.unlockedArtifacts || []); const owned = new Set(state.artifacts || []); return Content.artifacts.filter((item) => unlocked.has(item.id) && !owned.has(item.id)); }
  function createDeck(entries) { return (entries || []).map((entry, index) => ({ uid: `r${index + 1}`, id: typeof entry === "string" ? entry : entry.id, upgrade: clamp(integer(entry && entry.upgrade, 0), 0, 1) })); }
  function nextUid(state) { state.nextCardUid += 1; return `r${state.nextCardUid}`; }
  function generateMap(seed) {
    const layers = [];
    Content.ROUTE_LAYERS.forEach((template, layerIndex) => {
      const types = layerIndex === Content.ROUTE_LAYERS.length - 1 ? template.slice() : shuffled(template, `${seed}:types:${layerIndex}`);
      const nodes = types.map((type, nodeIndex) => {
        const id = `l${layerIndex}n${nodeIndex}`;
        let dealerId = null;
        if (type === Content.NODE_TYPES.BATTLE) dealerId = pick(Content.COMMON_DEALERS, `${seed}:${id}:dealer`);
        if (type === Content.NODE_TYPES.ELITE) dealerId = pick(Content.ELITE_DEALERS, `${seed}:${id}:dealer`);
        if (type === Content.NODE_TYPES.BOSS) dealerId = Content.BOSS_DEALER;
        const eventId = type === Content.NODE_TYPES.EVENT ? Content.events[hash(`${seed}:${id}:event`) % Content.events.length].id : null;
        return { id, layer: layerIndex, index: nodeIndex, type, dealerId, eventId, next: [] };
      });
      layers.push(nodes);
    });
    for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
      const current = layers[layerIndex];
      const next = layers[layerIndex + 1];
      current.forEach((node) => {
        if (next.length === 1) node.next = [next[0].id];
        else {
          const primary = Math.min(node.index, next.length - 1);
          const direction = hash(`${seed}:${node.id}:edge`) % 2 === 0 ? -1 : 1;
          const secondary = clamp(primary + direction, 0, next.length - 1);
          node.next = Array.from(new Set([next[primary].id, next[secondary].id]));
        }
      });
      next.forEach((target) => {
        if (!current.some((node) => node.next.includes(target.id))) {
          const source = current[Math.min(target.index, current.length - 1)];
          source.next.push(target.id);
        }
      });
    }
    return { act: 1, title: "Подвал просроченных долгов", layers, nodes: layers.flat() };
  }
  function createRun(options) {
    const input = options || {};
    const seed = integer(input.seed, Date.now()) >>> 0;
    const baseMaxHp = Math.max(1, integer(input.maxHp, 70));
    const unlockedArtifacts = Array.from(new Set(Array.isArray(input.unlockedArtifacts) ? input.unlockedArtifacts : Content.artifacts.filter((item) => item.unlock === "base").map((item) => item.id)));
    const state = {
      saveVersion: SAVE_VERSION,
      dataVersion: Content.DATA_VERSION,
      runId: `act1-${seed.toString(16)}-${hash(`${seed}:run`).toString(16)}`,
      seed,
      status: STATUS.ACTIVE,
      act: 1,
      map: generateMap(seed),
      currentNodeId: null,
      availableNodeIds: [],
      visitedNodeIds: [],
      hp: baseMaxHp,
      maxHp: baseMaxHp,
      gold: Math.max(0, integer(input.gold, 80)),
      deck: createDeck(input.deck || ["ace_clubs", "cleaning_card", "bank_card", "troika_pass", "brick", "red_pill", "loyalty_card", "coffee_3in1", "blue_pill", "shawarma_coupon"]),
      nextCardUid: (input.deck || []).length || 10,
      artifacts: [],
      unlockedArtifacts,
      pending: null,
      battleContext: null,
      history: [],
      profileRecorded: false,
      stats: { nodesVisited: 0, battlesWon: 0, elitesDefeated: 0, eventsResolved: 0, shopsVisited: 0, restsUsed: 0, treasuresOpened: 0, cardsAdded: 0, cardsRemoved: 0, cardsUpgraded: 0, goldEarned: 0, goldSpent: 0, highestLayer: 0, score: 0 },
    };
    state.availableNodeIds = state.map.layers[0].map((node) => node.id);
    pushHistory(state, "RUN_STARTED", { seed, deckSize: state.deck.length });
    validate(state);
    return state;
  }
  function nodeById(state, nodeId) { return state.map.nodes.find((node) => node.id === nodeId) || null; }
  function currentNode(state) { return nodeById(state, state.currentNodeId); }
  function currentLayer(state) { const node = currentNode(state); return node ? node.layer : Math.max(-1, ...state.visitedNodeIds.map((id) => nodeById(state, id)).filter(Boolean).map((item) => item.layer)); }
  function offerCards(state, catalog, seedKey, count, filters) {
    let pool = cardList(catalog).filter((card) => card.type !== "curse");
    const options = filters || {};
    if (options.rarity) pool = pool.filter((card) => card.rarity === options.rarity);
    if (options.type) pool = pool.filter((card) => card.type === options.type);
    const ownedCounts = state.deck.reduce((map, entry) => { map[entry.id] = (map[entry.id] || 0) + 1; return map; }, {});
    pool = pool.sort((first, second) => (ownedCounts[first.id] || 0) - (ownedCounts[second.id] || 0) || hash(`${state.seed}:${seedKey}:${first.id}`) - hash(`${state.seed}:${seedKey}:${second.id}`));
    return shuffled(pool, `${state.seed}:${seedKey}:cards`).slice(0, Math.min(count, pool.length)).map((card, index) => ({ offerId: `${seedKey}-c${index}`, cardId: card.id, upgrade: 0 }));
  }
  function offerArtifacts(state, seedKey, count) { return shuffled(availableArtifacts(state), `${state.seed}:${seedKey}:artifacts`).slice(0, count).map((item, index) => ({ offerId: `${seedKey}-a${index}`, artifactId: item.id })); }
  function discounted(state, price) { return Math.max(1, Math.round(price * (1 - artifactValue(state, "shopDiscount")))); }
  function battleRewardGold(state, node) { return (node.type === "elite" ? 70 : 38) + artifactValue(state, "battleGold"); }
  function makeBattleContext(state, node) {
    return {
      version: 1,
      runId: state.runId,
      nodeId: node.id,
      nodeType: node.type,
      dealerId: node.dealerId,
      battleId: `${state.runId}-${node.id}`,
      battleSeed: hash(`${state.seed}:${node.id}:battle`),
      playerHp: state.hp,
      playerMaxHp: state.maxHp,
      deck: clone(state.deck),
      artifacts: state.artifacts.slice(),
    };
  }
  function enterNode(inputState, nodeId, catalog) {
    const state = clone(inputState);
    assert(state.status === STATUS.ACTIVE, "RUN_NOT_ON_MAP", "Сейчас нельзя выбирать узел.");
    assert(state.availableNodeIds.includes(nodeId), "NODE_LOCKED", "Этот узел пока недоступен.", { nodeId });
    const node = nodeById(state, nodeId);
    assert(node, "UNKNOWN_NODE", "Узел маршрута не найден.", { nodeId });
    state.currentNodeId = node.id;
    state.stats.highestLayer = Math.max(state.stats.highestLayer, node.layer + 1);
    pushHistory(state, "NODE_ENTERED", { nodeId, type: node.type });
    if (["battle", "elite", "boss"].includes(node.type)) {
      state.status = STATUS.BATTLE;
      state.battleContext = makeBattleContext(state, node);
      state.pending = { type: "battle", nodeId: node.id, dealerId: node.dealerId };
    } else if (node.type === "event") {
      state.status = STATUS.NODE;
      state.pending = { type: "event", eventId: node.eventId };
    } else if (node.type === "shop") {
      state.status = STATUS.NODE;
      state.stats.shopsVisited += 1;
      state.pending = {
        type: "shop",
        cards: offerCards(state, catalog, `${node.id}:shop`, 4).map((offer, index) => Object.assign(offer, { price: discounted(state, [45, 55, 70, 85][index]) })),
        artifact: offerArtifacts(state, `${node.id}:shop`, 1).map((offer) => Object.assign(offer, { price: discounted(state, 125) }))[0] || null,
        healPrice: discounted(state, 35),
        healAmount: 15,
        removePrice: discounted(state, 60),
        healUsed: false,
        artifactBought: false,
      };
    } else if (node.type === "rest") {
      state.status = STATUS.NODE;
      state.pending = { type: "rest", healAmount: Math.max(12, Math.ceil(state.maxHp * .3)) };
    } else if (node.type === "treasure") {
      state.status = STATUS.NODE;
      state.pending = { type: "treasure", artifacts: offerArtifacts(state, `${node.id}:treasure`, 3) };
    }
    validate(state);
    return state;
  }
  function addCard(state, cardId, upgrade, catalog, source) {
    assert(cardById(catalog, cardId), "UNKNOWN_CARD", "Карта награды не найдена.", { cardId });
    state.deck.push({ uid: nextUid(state), id: cardId, upgrade: clamp(integer(upgrade, 0), 0, 1) });
    state.stats.cardsAdded += 1;
    pushHistory(state, "CARD_ADDED", { cardId, upgrade: clamp(integer(upgrade, 0), 0, 1), source });
  }
  function addArtifact(state, artifactId, source) {
    assert(Content.byArtifactId[artifactId], "UNKNOWN_ARTIFACT", "Артефакт не найден.", { artifactId });
    if (state.artifacts.includes(artifactId)) return false;
    state.artifacts.push(artifactId);
    const bonusMaxHp = Number(Content.byArtifactId[artifactId].effect.maxHp || 0);
    if (bonusMaxHp) { state.maxHp = Math.max(1, state.maxHp + bonusMaxHp); state.hp += bonusMaxHp; }
    pushHistory(state, "ARTIFACT_GAINED", { artifactId, source });
    return true;
  }
  function finishNode(state) {
    const node = currentNode(state);
    assert(node, "NO_CURRENT_NODE", "Текущий узел не найден.");
    if (!state.visitedNodeIds.includes(node.id)) {
      state.visitedNodeIds.push(node.id);
      state.stats.nodesVisited += 1;
    }
    state.availableNodeIds = node.next.slice();
    state.currentNodeId = null;
    state.pending = null;
    state.battleContext = null;
    if (state.status !== STATUS.VICTORY && state.status !== STATUS.DEFEAT) state.status = STATUS.ACTIVE;
    state.stats.score = state.stats.nodesVisited * 100 + state.stats.battlesWon * 80 + state.stats.elitesDefeated * 180 + state.gold + state.artifacts.length * 75 + (state.status === STATUS.VICTORY ? 1000 : 0);
    pushHistory(state, "NODE_COMPLETED", { nodeId: node.id, next: state.availableNodeIds });
  }
  function completeBattle(inputState, result, catalog) {
    const state = clone(inputState);
    assert(state.status === STATUS.BATTLE && state.pending && state.pending.type === "battle", "NO_PENDING_BATTLE", "Нет ожидающего результата боя.");
    const node = currentNode(state);
    assert(result && result.runId === state.runId && result.nodeId === node.id, "BATTLE_RESULT_MISMATCH", "Результат относится к другому забегу.");
    state.hp = clamp(integer(result.playerHp, state.hp), 0, state.maxHp);
    if (result.winner !== "player") {
      state.status = STATUS.DEFEAT;
      state.pending = { type: "run_end", result: "defeat", nodeId: node.id, dealerId: node.dealerId };
      state.availableNodeIds = [];
      if (!state.visitedNodeIds.includes(node.id)) { state.visitedNodeIds.push(node.id); state.stats.nodesVisited += 1; }
      pushHistory(state, "RUN_DEFEATED", { nodeId: node.id, dealerId: node.dealerId });
      state.stats.score = state.stats.nodesVisited * 100 + state.stats.battlesWon * 80 + state.stats.elitesDefeated * 180 + state.gold + state.artifacts.length * 75;
      return state;
    }
    state.stats.battlesWon += 1;
    if (node.type === "elite") state.stats.elitesDefeated += 1;
    const healed = Math.min(artifactValue(state, "postBattleHeal"), state.maxHp - state.hp);
    state.hp += healed;
    const gold = node.type === "boss" ? 0 : battleRewardGold(state, node);
    state.gold += gold;
    state.stats.goldEarned += gold;
    pushHistory(state, "BATTLE_WON", { nodeId: node.id, dealerId: node.dealerId, gold, healed });
    if (node.type === "boss") {
      if (!state.visitedNodeIds.includes(node.id)) { state.visitedNodeIds.push(node.id); state.stats.nodesVisited += 1; }
      state.status = STATUS.VICTORY;
      state.pending = { type: "run_end", result: "victory", nodeId: node.id };
      state.availableNodeIds = [];
      state.stats.score = state.stats.nodesVisited * 100 + state.stats.battlesWon * 80 + state.stats.elitesDefeated * 180 + state.gold + state.artifacts.length * 75 + 1000;
      pushHistory(state, "ACT_COMPLETED", { nodeId: node.id, score: state.stats.score });
      return state;
    }
    const offerCount = 3 + artifactValue(state, "rewardExtraCard");
    state.status = STATUS.REWARD;
    state.pending = { type: "reward", gold, healed, cards: offerCards(state, catalog, `${node.id}:reward`, offerCount), canSkip: true };
    validate(state);
    return state;
  }
  function chooseReward(inputState, offerId, catalog) {
    const state = clone(inputState);
    assert(state.status === STATUS.REWARD && state.pending && state.pending.type === "reward", "NO_REWARD", "Сейчас нет награды за бой.");
    if (offerId) {
      const offer = state.pending.cards.find((item) => item.offerId === offerId);
      assert(offer, "UNKNOWN_REWARD", "Карта награды не найдена.");
      addCard(state, offer.cardId, offer.upgrade, catalog, "battle_reward");
    } else pushHistory(state, "REWARD_SKIPPED", {});
    finishNode(state);
    validate(state);
    return state;
  }
  function applyEffect(state, effect, catalog, eventKey) {
    switch (effect.op) {
      case "gold": {
        const before = state.gold;
        state.gold = Math.max(0, state.gold + integer(effect.amount, 0));
        const delta = state.gold - before;
        if (delta > 0) state.stats.goldEarned += delta; else state.stats.goldSpent += -delta;
        break;
      }
      case "hp": state.hp = clamp(state.hp + integer(effect.amount, 0), 0, state.maxHp); break;
      case "max_hp": { const amount = integer(effect.amount, 0); state.maxHp = Math.max(1, state.maxHp + amount); state.hp = clamp(state.hp + amount, 1, state.maxHp); break; }
      case "add_specific": addCard(state, effect.cardId, effect.upgrade, catalog, "event"); break;
      case "add_card": { const offer = offerCards(state, catalog, `${eventKey}:add`, 1, effect.pool === "common" ? { rarity: "common" } : null)[0]; if (offer) addCard(state, offer.cardId, offer.upgrade, catalog, "event"); break; }
      case "add_curse": { const curses = cardList(catalog).filter((card) => card.type === "curse"); const card = pick(curses, `${state.seed}:${eventKey}:curse`); if (card) addCard(state, card.id, 0, catalog, "event_curse"); break; }
      case "upgrade_random": {
        const candidates = state.deck.filter((entry) => entry.upgrade === 0);
        const target = pick(candidates, `${state.seed}:${eventKey}:upgrade`);
        if (target) { target.upgrade = 1; state.stats.cardsUpgraded += 1; pushHistory(state, "CARD_UPGRADED", { uid: target.uid, cardId: target.id, source: "event" }); }
        break;
      }
      case "remove_curse_or_random": {
        const curses = state.deck.filter((entry) => cardById(catalog, entry.id) && cardById(catalog, entry.id).type === "curse");
        const target = pick(curses.length ? curses : state.deck, `${state.seed}:${eventKey}:remove`);
        if (target && state.deck.length > 1) { state.deck.splice(state.deck.findIndex((entry) => entry.uid === target.uid), 1); state.stats.cardsRemoved += 1; pushHistory(state, "CARD_REMOVED", { uid: target.uid, cardId: target.id, source: "event" }); }
        break;
      }
      case "artifact_random": { const target = pick(availableArtifacts(state), `${state.seed}:${eventKey}:artifact`); if (target) addArtifact(state, target.id, "event"); else state.gold += 40; break; }
      case "gamble": {
        const roll = hash(`${state.seed}:${eventKey}:gamble`) % 3;
        if (roll === 0) applyEffect(state, { op: "gold", amount: 80 }, catalog, `${eventKey}:win`);
        if (roll === 1) applyEffect(state, { op: "add_card", pool: "common" }, catalog, `${eventKey}:card`);
        if (roll === 2) applyEffect(state, { op: "hp", amount: -7 }, catalog, `${eventKey}:hurt`);
        pushHistory(state, "GAMBLE_RESOLVED", { roll });
        break;
      }
      default: throw new RunRuleError("UNKNOWN_RUN_EFFECT", `Неизвестный эффект события: ${effect.op}.`, effect);
    }
  }
  function resolveEvent(inputState, choiceId, catalog) {
    const state = clone(inputState);
    assert(state.status === STATUS.NODE && state.pending && state.pending.type === "event", "NO_EVENT", "Сейчас нет активного события.");
    const event = Content.byEventId[state.pending.eventId];
    const choice = event && event.choices.find((item) => item.id === choiceId);
    assert(choice, "UNKNOWN_EVENT_CHOICE", "Вариант события не найден.");
    const required = Math.max(0, integer(choice.cost, 0));
    assert(state.gold >= required, "NOT_ENOUGH_GOLD", "Недостаточно денег для этого выбора.", { required, gold: state.gold });
    choice.effects.forEach((effect, index) => applyEffect(state, effect, catalog, `${event.id}:${choice.id}:${index}`));
    state.stats.eventsResolved += 1;
    pushHistory(state, "EVENT_RESOLVED", { eventId: event.id, choiceId });
    if (state.hp <= 0) {
      state.status = STATUS.DEFEAT;
      state.pending = { type: "run_end", result: "defeat", reason: "event", eventId: event.id };
      state.availableNodeIds = [];
      return state;
    }
    finishNode(state);
    validate(state);
    return state;
  }
  function buyShopCard(inputState, offerId, catalog) {
    const state = clone(inputState);
    assert(state.status === STATUS.NODE && state.pending && state.pending.type === "shop", "NO_SHOP", "Торговец уже закрыл кассу.");
    const offer = state.pending.cards.find((item) => item.offerId === offerId && !item.sold);
    assert(offer, "SHOP_ITEM_MISSING", "Эта карта уже продана.");
    assert(state.gold >= offer.price, "NOT_ENOUGH_GOLD", "Недостаточно денег.");
    state.gold -= offer.price; state.stats.goldSpent += offer.price; offer.sold = true; addCard(state, offer.cardId, offer.upgrade, catalog, "shop");
    return state;
  }
  function buyShopHeal(inputState) {
    const state = clone(inputState);
    assert(state.status === STATUS.NODE && state.pending && state.pending.type === "shop", "NO_SHOP", "Торговец уже закрыл кассу.");
    assert(!state.pending.healUsed, "SERVICE_USED", "Лечение уже куплено.");
    assert(state.hp < state.maxHp, "FULL_HP", "Здоровье уже полное.");
    assert(state.gold >= state.pending.healPrice, "NOT_ENOUGH_GOLD", "Недостаточно денег.");
    state.gold -= state.pending.healPrice; state.stats.goldSpent += state.pending.healPrice; state.hp = Math.min(state.maxHp, state.hp + state.pending.healAmount); state.pending.healUsed = true; pushHistory(state, "SHOP_HEAL", { amount: state.pending.healAmount });
    return state;
  }
  function buyShopArtifact(inputState, offerId) {
    const state = clone(inputState);
    assert(state.status === STATUS.NODE && state.pending && state.pending.type === "shop", "NO_SHOP", "Торговец уже закрыл кассу.");
    const offer = state.pending.artifact;
    assert(offer && offer.offerId === offerId && !state.pending.artifactBought, "SHOP_ITEM_MISSING", "Артефакт уже продан.");
    assert(state.gold >= offer.price, "NOT_ENOUGH_GOLD", "Недостаточно денег.");
    state.gold -= offer.price; state.stats.goldSpent += offer.price; state.pending.artifactBought = true; addArtifact(state, offer.artifactId, "shop");
    return state;
  }
  function removeShopCard(inputState, uid) {
    const state = clone(inputState);
    assert(state.status === STATUS.NODE && state.pending && state.pending.type === "shop", "NO_SHOP", "Торговец уже закрыл кассу.");
    assert(!state.pending.removeUsed, "SERVICE_USED", "Удаление карты уже использовано.");
    assert(state.deck.length > 5, "DECK_TOO_SMALL", "В колоде должно остаться минимум пять карт.");
    const index = state.deck.findIndex((entry) => entry.uid === uid);
    assert(index !== -1, "CARD_NOT_FOUND", "Карта для удаления не найдена.");
    assert(state.gold >= state.pending.removePrice, "NOT_ENOUGH_GOLD", "Недостаточно денег.");
    const removed = state.deck.splice(index, 1)[0]; state.gold -= state.pending.removePrice; state.stats.goldSpent += state.pending.removePrice; state.stats.cardsRemoved += 1; state.pending.removeUsed = true; pushHistory(state, "CARD_REMOVED", { uid, cardId: removed.id, source: "shop" });
    return state;
  }
  function leaveShop(inputState) { const state = clone(inputState); assert(state.pending && state.pending.type === "shop", "NO_SHOP", "Сейчас нет торговца."); finishNode(state); validate(state); return state; }
  function restHeal(inputState) { const state = clone(inputState); assert(state.pending && state.pending.type === "rest", "NO_REST", "Сейчас нельзя отдыхать."); state.hp = Math.min(state.maxHp, state.hp + state.pending.healAmount); state.stats.restsUsed += 1; pushHistory(state, "REST_HEAL", { amount: state.pending.healAmount }); finishNode(state); return state; }
  function restUpgrade(inputState, uid) { const state = clone(inputState); assert(state.pending && state.pending.type === "rest", "NO_REST", "Сейчас нельзя улучшать карту."); const card = state.deck.find((entry) => entry.uid === uid); assert(card, "CARD_NOT_FOUND", "Карта не найдена."); assert(card.upgrade === 0, "CARD_ALREADY_UPGRADED", "Карта уже улучшена."); card.upgrade = 1; state.stats.cardsUpgraded += 1; state.stats.restsUsed += 1; pushHistory(state, "CARD_UPGRADED", { uid, cardId: card.id, source: "rest" }); finishNode(state); return state; }
  function takeTreasure(inputState, offerId) { const state = clone(inputState); assert(state.pending && state.pending.type === "treasure", "NO_TREASURE", "Тайник уже закрыт."); const offer = state.pending.artifacts.find((item) => item.offerId === offerId); assert(offer, "ARTIFACT_OFFER_MISSING", "Артефакт не найден."); addArtifact(state, offer.artifactId, "treasure"); state.stats.treasuresOpened += 1; finishNode(state); return state; }
  function claimEmptyTreasure(inputState) { const state = clone(inputState); assert(state.pending && state.pending.type === "treasure" && state.pending.artifacts.length === 0, "TREASURE_NOT_EMPTY", "В тайнике ещё есть артефакты."); state.gold += 40; state.stats.goldEarned += 40; state.stats.treasuresOpened += 1; pushHistory(state, "EMPTY_TREASURE_CLAIMED", { gold: 40 }); finishNode(state); return state; }
  function abandon(inputState) { const state = clone(inputState); if ([STATUS.VICTORY, STATUS.DEFEAT].includes(state.status)) return state; state.status = STATUS.ABANDONED; state.availableNodeIds = []; state.pending = { type: "run_end", result: "abandoned" }; pushHistory(state, "RUN_ABANDONED", {}); return state; }
  function migrate(raw) {
    const state = clone(raw);
    assert(state && typeof state === "object", "INVALID_RUN_SAVE", "Сохранение забега повреждено.");
    assert(state.saveVersion === SAVE_VERSION, "UNSUPPORTED_RUN_SAVE", `Неподдерживаемая версия забега: ${state.saveVersion}.`);
    state.profileRecorded = Boolean(state.profileRecorded);
    state.unlockedArtifacts = Array.from(new Set(state.unlockedArtifacts || []));
    state.artifacts = Array.from(new Set(state.artifacts || []));
    state.history = Array.isArray(state.history) ? state.history : [];
    validate(state);
    return state;
  }
  function validate(state) {
    assert(state.saveVersion === SAVE_VERSION, "UNSUPPORTED_RUN_SAVE", "Неверная версия забега.");
    assert(state.map && Array.isArray(state.map.nodes), "INVALID_MAP", "Маршрут отсутствует.");
    assert(state.hp >= 0 && state.hp <= state.maxHp && state.maxHp > 0, "INVALID_RUN_HP", "Здоровье забега вышло за пределы.");
    assert(state.gold >= 0, "INVALID_GOLD", "Деньги не могут быть отрицательными.");
    assert(Array.isArray(state.deck) && state.deck.length > 0, "EMPTY_RUN_DECK", "Колода забега пуста.");
    const uids = new Set(); state.deck.forEach((entry) => { assert(entry.id && entry.uid, "INVALID_RUN_CARD", "Карта забега повреждена."); assert(!uids.has(entry.uid), "DUPLICATE_RUN_CARD", "В колоде повторяется uid."); uids.add(entry.uid); });
    assert(Object.values(STATUS).includes(state.status), "INVALID_RUN_STATUS", "Неизвестный статус забега.");
    return true;
  }
  return Object.freeze({ SAVE_VERSION, STORAGE_KEY, STATUS, RunRuleError, createRun, generateMap, enterNode, completeBattle, chooseReward, resolveEvent, buyShopCard, buyShopHeal, buyShopArtifact, removeShopCard, leaveShop, restHeal, restUpgrade, takeTreasure, claimEmptyTreasure, abandon, migrate, validate, stateHash, nodeById, currentNode, artifactValue });
});