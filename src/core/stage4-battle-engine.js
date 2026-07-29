"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.BitayaMastBattle = api; root.BitayaMastStage4Battle = api; }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SAVE_VERSION = 2;
  const ENGINE_VERSION = "2.0.0-stage4";
  const SIDES = Object.freeze({ PLAYER: "player", DEALER: "dealer" });
  const PHASES = Object.freeze({ PLAYER: "player_turn", DEALER: "dealer_turn", FINISHED: "finished" });
  const ZONES = Object.freeze({ DRAW: "drawPile", HAND: "hand", DISCARD: "discardPile", EXILE: "exilePile" });
  const TIMEOUT_PENALTIES = Object.freeze({ END_TURN: "end_turn", DISCARD_RANDOM: "discard_random", DAMAGE: "damage", DEALER_ENERGY: "dealer_energy" });

  class BattleRuleError extends Error {
    constructor(code, message, details) { super(message); this.name = "BattleRuleError"; this.code = code; this.details = details || null; }
  }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function assert(condition, code, message, details) { if (!condition) throw new BattleRuleError(code, message, details); }
  function integer(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback; }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
  function normalizeSeed(seed) { let value = integer(seed, 0x6d2b79f5) >>> 0; if (value === 0) value = 0x6d2b79f5; return value; }
  function nextRandom(state) { let value = state.rngState >>> 0; value ^= value << 13; value ^= value >>> 17; value ^= value << 5; state.rngState = value >>> 0; return state.rngState / 4294967296; }
  function randomIndex(state, length) { assert(length > 0, "EMPTY_RANDOM_SOURCE", "Нельзя выбрать случайный элемент из пустого списка."); return Math.floor(nextRandom(state) * length); }
  function stableStringify(value) { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`; }
  function hashText(text) { let hash = 2166136261; for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, "0"); }
  function stateHash(state) { const snapshot = clone(state); delete snapshot.eventLog; delete snapshot.commandLog; delete snapshot.lastError; return hashText(stableStringify(snapshot)); }
  function emit(state, type, payload) { const event = { seq: state.nextEventSeq, type, payload: clone(payload || {}), round: state.round, phase: state.phase }; state.nextEventSeq += 1; state.eventLog.push(event); return event; }
  function otherSide(side) { return side === SIDES.PLAYER ? SIDES.DEALER : SIDES.PLAYER; }

  function normalizeUpgrade(raw, base) {
    if (!raw || typeof raw !== "object") return null;
    return { cost: raw.cost == null ? base.cost : Math.max(0, integer(raw.cost, base.cost)), target: raw.target || base.target, exhaust: raw.exhaust == null ? Boolean(base.exhaust) : Boolean(raw.exhaust), effects: clone(Array.isArray(raw.effects) ? raw.effects : base.effects), tags: clone(Array.isArray(raw.tags) ? raw.tags : base.tags) };
  }
  function normalizeCatalog(cards) {
    const catalog = {};
    (Array.isArray(cards) ? cards : Object.values(cards || {})).forEach((raw) => {
      assert(raw && typeof raw.id === "string" && raw.id, "INVALID_CARD", "Каждой карте нужен уникальный id.", raw);
      assert(!catalog[raw.id], "DUPLICATE_CARD", `Повторяющийся id карты: ${raw.id}.`);
      const definition = { id: raw.id, name: raw.name || raw.id, type: raw.type || "skill", rarity: raw.rarity || "common", cost: Math.max(0, integer(raw.cost, 0)), target: raw.target || "opponent", exhaust: Boolean(raw.exhaust), effects: clone(Array.isArray(raw.effects) ? raw.effects : []), tags: clone(Array.isArray(raw.tags) ? raw.tags : []), upgrade: null };
      definition.upgrade = normalizeUpgrade(raw.upgrade, definition);
      catalog[raw.id] = definition;
    });
    return catalog;
  }
  function createCardInstance(state, deckEntry, owner) {
    const definitionId = typeof deckEntry === "string" ? deckEntry : (deckEntry && (deckEntry.id || deckEntry.definitionId));
    assert(state.cardCatalog[definitionId], "UNKNOWN_CARD", `Неизвестная карта: ${definitionId}.`);
    const instance = { instanceId: `c${state.nextCardSeq}`, definitionId, owner, upgrade: clamp(integer(deckEntry && deckEntry.upgrade, 0), 0, 1), costModifier: 0, brokenFor: 0, blockedFor: 0, tags: [] };
    state.nextCardSeq += 1;
    return instance;
  }
  function shuffle(state, list) { for (let index = list.length - 1; index > 0; index -= 1) { const target = randomIndex(state, index + 1); [list[index], list[target]] = [list[target], list[index]]; } }
  function createActor(state, side, input) {
    const maxHp = Math.max(1, integer(input.maxHp, 30));
    const actor = { id: side, name: input.name || (side === SIDES.PLAYER ? "Игрок" : "Дилер"), hp: clamp(integer(input.hp, maxHp), 0, maxHp), maxHp, shield: Math.max(0, integer(input.shield, 0)), energy: 0, maxEnergy: Math.max(0, integer(input.maxEnergy, 3)), drawPile: [], hand: [], discardPile: [], exilePile: [], statuses: {}, stats: { cardsPlayed: 0, damageDealt: 0, damageTaken: 0, cardsStolen: 0, cardsBurned: 0, cardsRepaired: 0, cardsUpgraded: 0 } };
    (Array.isArray(input.deck) ? input.deck : []).forEach((entry) => actor.drawPile.push(createCardInstance(state, entry, side)));
    shuffle(state, actor.drawPile);
    return actor;
  }
  function createBattle(config) {
    const safeConfig = clone(config || {});
    const state = { saveVersion: SAVE_VERSION, engineVersion: ENGINE_VERSION, battleId: safeConfig.battleId || `battle-${normalizeSeed(safeConfig.seed)}`, seed: normalizeSeed(safeConfig.seed), rngState: normalizeSeed(safeConfig.seed), round: 1, turn: 1, phase: PHASES.PLAYER, winner: null, nextCardSeq: 1, nextEventSeq: 1, cardCatalog: normalizeCatalog(safeConfig.cards), actors: {}, pendingChoice: null, eventLog: [], commandLog: [], initialConfig: safeConfig, rules: { handSize: Math.max(1, integer(safeConfig.rules && safeConfig.rules.handSize, 5)), maxHandSize: Math.max(1, integer(safeConfig.rules && safeConfig.rules.maxHandSize, 10)), shieldResetsEachTurn: safeConfig.rules && safeConfig.rules.shieldResetsEachTurn === false ? false : true, catalogVersion: Math.max(0, integer(safeConfig.rules && safeConfig.rules.catalogVersion, 0)) } };
    state.actors.player = createActor(state, SIDES.PLAYER, safeConfig.player || {});
    state.actors.dealer = createActor(state, SIDES.DEALER, safeConfig.dealer || {});
    emit(state, "BATTLE_STARTED", { battleId: state.battleId, seed: state.seed, catalogVersion: state.rules.catalogVersion });
    drawCards(state, SIDES.DEALER, state.rules.handSize);
    beginTurn(state, SIDES.PLAYER, true);
    validateState(state);
    return state;
  }
  function resolveCardDefinition(state, card) {
    const base = state.cardCatalog[card.definitionId];
    assert(base, "UNKNOWN_CARD_INSTANCE", `Экземпляр ссылается на неизвестную карту ${card.definitionId}.`);
    if (!(card.upgrade > 0 && base.upgrade)) return base;
    return Object.assign({}, base, clone(base.upgrade), { id: base.id, name: `${base.name}+`, upgrade: base.upgrade });
  }
  function actorStatusStacks(actor, statusId) { return actor.statuses[statusId] ? Math.max(0, integer(actor.statuses[statusId].stacks, 0)) : 0; }
  function effectiveCost(state, actorId, card) { const definition = resolveCardDefinition(state, card); return Math.max(0, definition.cost + integer(card.costModifier, 0) - actorStatusStacks(state.actors[actorId], "discount")); }
  function reshuffleIfNeeded(state, actor) { if (actor.drawPile.length || !actor.discardPile.length) return; actor.drawPile = actor.discardPile.splice(0); shuffle(state, actor.drawPile); emit(state, "PILE_SHUFFLED", { actorId: actor.id, count: actor.drawPile.length }); }
  function drawCards(state, actorId, amount) {
    const actor = state.actors[actorId]; let drawn = 0;
    for (let index = 0; index < Math.max(0, integer(amount, 0)); index += 1) {
      if (actor.hand.length >= state.rules.maxHandSize) { emit(state, "DRAW_BLOCKED", { actorId, reason: "HAND_FULL" }); break; }
      reshuffleIfNeeded(state, actor); if (!actor.drawPile.length) break;
      const card = actor.drawPile.pop(); actor.hand.push(card); drawn += 1; emit(state, "CARD_DRAWN", { actorId, cardInstanceId: card.instanceId, definitionId: card.definitionId });
    }
    return drawn;
  }
  function tickCardLocks(actor) { [actor.drawPile, actor.hand, actor.discardPile].forEach((zone) => zone.forEach((card) => { if (card.brokenFor > 0) { card.brokenFor -= 1; if (card.brokenFor === 0) card.costModifier = 0; } if (card.blockedFor > 0) card.blockedFor -= 1; })); }
  function tickStatuses(state, actor, timing) {
    Object.keys(actor.statuses).forEach((statusId) => {
      const status = actor.statuses[statusId]; if (status.timing !== timing) return;
      if (statusId === "burn" && timing === "turn_start") dealDamage(state, otherSide(actor.id), actor.id, status.stacks, { source: "status:burn", ignoreModifiers: true });
      if (statusId === "regeneration" && timing === "turn_start") heal(state, actor.id, status.stacks, { source: "status:regeneration" });
      if (status.duration !== null && status.duration !== undefined) { status.duration -= 1; if (status.duration <= 0) { delete actor.statuses[statusId]; emit(state, "STATUS_EXPIRED", { actorId: actor.id, statusId }); } }
    });
  }
  function beginTurn(state, actorId, initial) {
    const actor = state.actors[actorId]; state.phase = actorId === SIDES.PLAYER ? PHASES.PLAYER : PHASES.DEALER; if (!initial) state.turn += 1; if (state.rules.shieldResetsEachTurn) actor.shield = 0; actor.energy = actor.maxEnergy; tickCardLocks(actor); tickStatuses(state, actor, "turn_start"); drawCards(state, actorId, Math.max(0, state.rules.handSize - actor.hand.length)); emit(state, "TURN_STARTED", { actorId, energy: actor.energy, round: state.round, turn: state.turn }); checkFinished(state);
  }
  function endTurnInternal(state, actorId) { const actor = state.actors[actorId]; tickStatuses(state, actor, "turn_end"); emit(state, "TURN_ENDED", { actorId, unusedEnergy: actor.energy }); actor.energy = 0; const next = otherSide(actorId); if (next === SIDES.PLAYER) state.round += 1; beginTurn(state, next, false); }
  function locateCard(actor, instanceId) { for (const zoneName of Object.values(ZONES)) { const index = actor[zoneName].findIndex((card) => card.instanceId === instanceId); if (index !== -1) return { zoneName, index, card: actor[zoneName][index] }; } return null; }
  function removeCardFromZone(actor, zoneName, index) { return actor[zoneName].splice(index, 1)[0]; }
  function normalizedZones(zones) { const source = Array.isArray(zones) && zones.length ? zones : [ZONES.HAND]; return source.filter((zone) => Object.values(ZONES).includes(zone)); }
  function selectRandomCard(state, actor, zones, predicate) { const candidates = []; normalizedZones(zones).forEach((zoneName) => actor[zoneName].forEach((card, index) => { if (!predicate || predicate(card, zoneName)) candidates.push({ zoneName, index, card }); })); if (!candidates.length) return null; return candidates[randomIndex(state, candidates.length)]; }
  function resolveTargetActor(sourceId, targetRule, explicitTargetId) { if (targetRule === "self") return sourceId; if (targetRule === "opponent") return otherSide(sourceId); if (targetRule === "any") { assert(explicitTargetId === SIDES.PLAYER || explicitTargetId === SIDES.DEALER, "TARGET_REQUIRED", "Нужно выбрать цель карты."); return explicitTargetId; } if (targetRule === "none") return null; return explicitTargetId || otherSide(sourceId); }
  function damageMultiplier(actor) { return actorStatusStacks(actor, "weak") > 0 ? .75 : 1; }
  function incomingMultiplier(actor) { return actorStatusStacks(actor, "vulnerable") > 0 ? 1.5 : 1; }
  function dealDamage(state, sourceId, targetId, baseAmount, meta) {
    const source = state.actors[sourceId]; const target = state.actors[targetId]; let amount = Math.max(0, integer(baseAmount, 0));
    if (!(meta && meta.ignoreModifiers)) { amount = Math.floor(amount * damageMultiplier(source) * incomingMultiplier(target)); amount += actorStatusStacks(source, "strength"); }
    amount = Math.max(0, amount); const blocked = Math.min(target.shield, amount); target.shield -= blocked; const hpDamage = amount - blocked; target.hp = clamp(target.hp - hpDamage, 0, target.maxHp); source.stats.damageDealt += hpDamage; target.stats.damageTaken += hpDamage; emit(state, "DAMAGE_DEALT", { sourceId, targetId, amount, blocked, hpDamage, source: meta && meta.source });
    if (hpDamage > 0 && actorStatusStacks(target, "thorns") > 0 && sourceId !== targetId) dealDamage(state, targetId, sourceId, actorStatusStacks(target, "thorns"), { source: "status:thorns", ignoreModifiers: true });
    checkFinished(state); return hpDamage;
  }
  function addShield(state, actorId, amount, meta) { const gained = Math.max(0, integer(amount, 0)); state.actors[actorId].shield += gained; emit(state, "SHIELD_GAINED", { actorId, amount: gained, source: meta && meta.source }); return gained; }
  function heal(state, actorId, amount, meta) { const actor = state.actors[actorId]; const before = actor.hp; actor.hp = clamp(actor.hp + Math.max(0, integer(amount, 0)), 0, actor.maxHp); const restored = actor.hp - before; emit(state, "HEALED", { actorId, amount: restored, source: meta && meta.source }); return restored; }
  function applyStatus(state, actorId, statusId, stacks, duration, timing) { const actor = state.actors[actorId]; const current = actor.statuses[statusId] || { stacks: 0, duration: duration == null ? null : 0, timing: timing || "turn_end" }; current.stacks = Math.max(0, current.stacks + integer(stacks, 0)); current.timing = timing || current.timing; if (duration != null) current.duration = Math.max(current.duration || 0, integer(duration, 1)); actor.statuses[statusId] = current; emit(state, "STATUS_APPLIED", { actorId, statusId, stacks: current.stacks, duration: current.duration }); return current; }
  function cleanseStatuses(state, actorId, statuses, amount) { const actor = state.actors[actorId]; const allowed = Array.isArray(statuses) && statuses.length ? statuses : Object.keys(actor.statuses); const existing = allowed.filter((statusId) => actor.statuses[statusId]); const limit = Math.max(1, integer(amount, existing.length || 1)); const removed = existing.slice(0, limit); removed.forEach((statusId) => { delete actor.statuses[statusId]; emit(state, "STATUS_CLEANSED", { actorId, statusId }); }); if (!removed.length) emit(state, "CLEANSE_SKIPPED", { actorId, reason: "NO_STATUS" }); return removed; }
  function stealRandomCard(state, sourceId, targetId, zones) {
    const source = state.actors[sourceId]; const target = state.actors[targetId];
    if (source.hand.length >= state.rules.maxHandSize) { emit(state, "CARD_STEAL_FAILED", { sourceId, targetId, reason: "HAND_FULL" }); return null; }
    const selected = selectRandomCard(state, target, zones || [ZONES.HAND]); if (!selected) { emit(state, "CARD_STEAL_FAILED", { sourceId, targetId, reason: "NO_CARD" }); return null; }
    const card = removeCardFromZone(target, selected.zoneName, selected.index); card.owner = sourceId; source.hand.push(card); source.stats.cardsStolen += 1; emit(state, "CARD_STOLEN", { sourceId, targetId, cardInstanceId: card.instanceId, definitionId: card.definitionId, from: selected.zoneName }); return card;
  }
  function modifyRandomCard(state, targetId, mode, amount, duration, zones) {
    const target = state.actors[targetId]; const selected = selectRandomCard(state, target, zones || [ZONES.HAND]); if (!selected) { emit(state, "CARD_MODIFY_FAILED", { targetId, mode, reason: "NO_CARD" }); return null; }
    const card = selected.card;
    if (mode === "break") { card.costModifier += Math.max(1, integer(amount, 1)); card.brokenFor = Math.max(card.brokenFor, Math.max(1, integer(duration, 1))); emit(state, "CARD_BROKEN", { targetId, cardInstanceId: card.instanceId, amount: card.costModifier, duration: card.brokenFor }); }
    else if (mode === "block") { card.blockedFor = Math.max(card.blockedFor, Math.max(1, integer(duration, 1))); emit(state, "CARD_BLOCKED", { targetId, cardInstanceId: card.instanceId, duration: card.blockedFor }); }
    else if (mode === "burn") { removeCardFromZone(target, selected.zoneName, selected.index); target.exilePile.push(card); target.stats.cardsBurned += 1; emit(state, "CARD_BURNED", { targetId, cardInstanceId: card.instanceId, definitionId: card.definitionId, from: selected.zoneName }); }
    return card;
  }
  function repairRandomCard(state, actorId, amount, zones) { const actor = state.actors[actorId]; const repaired = []; for (let count = 0; count < Math.max(1, integer(amount, 1)); count += 1) { const selected = selectRandomCard(state, actor, zones || [ZONES.HAND, ZONES.DRAW, ZONES.DISCARD], (card) => card.brokenFor > 0 || card.blockedFor > 0 || card.costModifier > 0); if (!selected) break; selected.card.brokenFor = 0; selected.card.blockedFor = 0; selected.card.costModifier = 0; actor.stats.cardsRepaired += 1; repaired.push(selected.card.instanceId); emit(state, "CARD_REPAIRED", { actorId, cardInstanceId: selected.card.instanceId, definitionId: selected.card.definitionId }); } if (!repaired.length) emit(state, "REPAIR_SKIPPED", { actorId, reason: "NO_DAMAGED_CARD" }); return repaired; }
  function returnFromDiscard(state, actorId, amount) { const actor = state.actors[actorId]; const returned = []; for (let count = 0; count < Math.max(1, integer(amount, 1)); count += 1) { if (actor.hand.length >= state.rules.maxHandSize || !actor.discardPile.length) break; const index = randomIndex(state, actor.discardPile.length); const card = actor.discardPile.splice(index, 1)[0]; actor.hand.push(card); returned.push(card.instanceId); emit(state, "CARD_RETURNED", { actorId, cardInstanceId: card.instanceId, definitionId: card.definitionId, from: ZONES.DISCARD }); } if (!returned.length) emit(state, "RETURN_SKIPPED", { actorId, reason: actor.hand.length >= state.rules.maxHandSize ? "HAND_FULL" : "EMPTY_DISCARD" }); return returned; }
  function discardRandom(state, actorId, zones, reason) { const actor = state.actors[actorId]; const selected = selectRandomCard(state, actor, zones || [ZONES.HAND]); if (!selected) return null; const discarded = removeCardFromZone(actor, selected.zoneName, selected.index); actor.discardPile.push(discarded); emit(state, "CARD_DISCARDED", { actorId, cardInstanceId: discarded.instanceId, definitionId: discarded.definitionId, reason: reason || "effect" }); return discarded; }
  function applyEffect(state, sourceId, defaultTargetId, effect, card) {
    const targetId = effect.target === "self" ? sourceId : effect.target === "opponent" ? otherSide(sourceId) : (effect.targetId || defaultTargetId);
    switch (effect.op) {
      case "damage": return dealDamage(state, sourceId, targetId, effect.amount, { source: card.instanceId });
      case "shield": return addShield(state, targetId, effect.amount, { source: card.instanceId });
      case "heal": return heal(state, targetId, effect.amount, { source: card.instanceId });
      case "draw": return drawCards(state, targetId, effect.amount);
      case "energy": { const actor = state.actors[targetId]; const amount = integer(effect.amount, 0); actor.energy = Math.max(0, actor.energy + amount); emit(state, "ENERGY_CHANGED", { actorId: targetId, amount, energy: actor.energy, source: card.instanceId }); return actor.energy; }
      case "status": return applyStatus(state, targetId, effect.statusId, effect.stacks || 1, effect.duration, effect.timing);
      case "cleanse": return cleanseStatuses(state, targetId, effect.statuses, effect.amount);
      case "steal": return stealRandomCard(state, sourceId, targetId, effect.zones);
      case "break": return modifyRandomCard(state, targetId, "break", effect.amount, effect.duration, effect.zones);
      case "block": return modifyRandomCard(state, targetId, "block", effect.amount, effect.duration, effect.zones);
      case "burn": return modifyRandomCard(state, targetId, "burn", effect.amount, effect.duration, effect.zones);
      case "repair": return repairRandomCard(state, targetId, effect.amount, effect.zones);
      case "return_from_discard": return returnFromDiscard(state, targetId, effect.amount);
      case "discard_random": return discardRandom(state, targetId, effect.zones, "effect");
      case "noop": emit(state, "NO_EFFECT", { sourceId, cardInstanceId: card.instanceId }); return null;
      default: throw new BattleRuleError("UNKNOWN_EFFECT", `Неизвестная операция эффекта: ${effect.op}.`, effect);
    }
  }
  function ensureActiveActor(state, actorId) { assert(state.phase !== PHASES.FINISHED, "BATTLE_FINISHED", "Бой уже завершён."); const expected = state.phase === PHASES.PLAYER ? SIDES.PLAYER : SIDES.DEALER; assert(actorId === expected, "NOT_ACTOR_TURN", `Сейчас ход стороны: ${expected}.`, { actorId, expected }); }
  function playCard(state, command) {
    const actorId = command.actorId; ensureActiveActor(state, actorId); const actor = state.actors[actorId]; const location = locateCard(actor, command.cardInstanceId); assert(location && location.zoneName === ZONES.HAND, "CARD_NOT_IN_HAND", "Карта должна находиться в руке.", command); const card = location.card; const definition = resolveCardDefinition(state, card); assert(card.blockedFor <= 0, "CARD_BLOCKED", "Эта карта временно заблокирована.", { cardInstanceId: card.instanceId, blockedFor: card.blockedFor }); const cost = effectiveCost(state, actorId, card); assert(actor.energy >= cost, "NOT_ENOUGH_ENERGY", "Недостаточно энергии для розыгрыша карты.", { energy: actor.energy, cost }); const targetId = resolveTargetActor(actorId, definition.target, command.targetId); actor.energy -= cost; actor.stats.cardsPlayed += 1; removeCardFromZone(actor, ZONES.HAND, location.index); emit(state, "CARD_PLAYED", { actorId, cardInstanceId: card.instanceId, definitionId: card.definitionId, targetId, cost, upgrade: card.upgrade }); definition.effects.forEach((effect) => { if (state.phase !== PHASES.FINISHED) applyEffect(state, actorId, targetId, effect, card); }); const destination = definition.exhaust ? ZONES.EXILE : ZONES.DISCARD; actor[destination].push(card); emit(state, definition.exhaust ? "CARD_EXILED" : "CARD_MOVED_TO_DISCARD", { actorId, cardInstanceId: card.instanceId });
  }
  function discardCard(state, command) { ensureActiveActor(state, command.actorId); const actor = state.actors[command.actorId]; const location = locateCard(actor, command.cardInstanceId); assert(location && location.zoneName === ZONES.HAND, "CARD_NOT_IN_HAND", "Сбросить можно только карту из руки."); const card = removeCardFromZone(actor, ZONES.HAND, location.index); actor.discardPile.push(card); emit(state, "CARD_DISCARDED", { actorId: command.actorId, cardInstanceId: card.instanceId, definitionId: card.definitionId, reason: command.reason || "command" }); }
  function upgradeCard(state, command) { const actor = state.actors[command.actorId]; assert(actor, "INVALID_ACTOR", "Неизвестный владелец карты."); const location = locateCard(actor, command.cardInstanceId); assert(location, "CARD_NOT_FOUND", "Карта для улучшения не найдена."); assert(state.cardCatalog[location.card.definitionId].upgrade, "CARD_HAS_NO_UPGRADE", "У этой карты нет улучшения."); assert(location.card.upgrade < 1, "CARD_ALREADY_UPGRADED", "Карта уже улучшена."); location.card.upgrade = 1; actor.stats.cardsUpgraded += 1; emit(state, "CARD_UPGRADED", { actorId: actor.id, cardInstanceId: location.card.instanceId, definitionId: location.card.definitionId, zone: location.zoneName }); }
  function chooseTarget(state, command) { assert(state.pendingChoice, "NO_PENDING_CHOICE", "Сейчас нет действия, требующего выбора цели."); assert(state.pendingChoice.actorId === command.actorId, "WRONG_CHOICE_ACTOR", "Эту цель должен выбрать другой участник."); assert(state.pendingChoice.allowedTargets.includes(command.targetId), "INVALID_TARGET", "Недопустимая цель."); const choice = state.pendingChoice; state.pendingChoice = null; emit(state, "TARGET_CHOSEN", { actorId: command.actorId, targetId: command.targetId, choiceId: choice.choiceId }); }
  function checkFinished(state) { if (state.phase === PHASES.FINISHED) return state.winner; const playerDead = state.actors.player.hp <= 0; const dealerDead = state.actors.dealer.hp <= 0; if (!playerDead && !dealerDead) return null; state.phase = PHASES.FINISHED; state.winner = playerDead && dealerDead ? "draw" : playerDead ? SIDES.DEALER : SIDES.PLAYER; emit(state, "BATTLE_FINISHED", { winner: state.winner }); return state.winner; }
  function expireTurn(state, command) { const actorId = command.actorId; ensureActiveActor(state, actorId); const penalty = Object.values(TIMEOUT_PENALTIES).includes(command.penalty) ? command.penalty : TIMEOUT_PENALTIES.END_TURN; emit(state, "TIME_EXPIRED", { actorId, penalty }); if (penalty === TIMEOUT_PENALTIES.DISCARD_RANDOM) { const discarded = discardRandom(state, actorId, [ZONES.HAND], "timeout"); if (!discarded) emit(state, "TIMEOUT_PENALTY_SKIPPED", { actorId, penalty, reason: "EMPTY_HAND" }); } else if (penalty === TIMEOUT_PENALTIES.DAMAGE) dealDamage(state, actorId, actorId, Math.max(1, integer(command.amount, 3)), { source: "timeout", ignoreModifiers: true }); if (state.phase !== PHASES.FINISHED) { endTurnInternal(state, actorId); if (penalty === TIMEOUT_PENALTIES.DEALER_ENERGY) { const receiverId = otherSide(actorId); const amount = Math.max(1, integer(command.amount, 1)); state.actors[receiverId].energy += amount; emit(state, "ENERGY_CHANGED", { actorId: receiverId, amount, energy: state.actors[receiverId].energy, source: "timeout" }); } } }
  function executeCommand(inputState, command) {
    const state = clone(inputState); assert(command && typeof command.type === "string", "INVALID_COMMAND", "Команда должна иметь тип."); const beforeEvents = state.eventLog.length; const logged = clone(command); logged.index = state.commandLog.length; logged.preHash = stateHash(state);
    switch (command.type) { case "playCard": playCard(state, command); break; case "endTurn": ensureActiveActor(state, command.actorId); endTurnInternal(state, command.actorId); break; case "expireTurn": expireTurn(state, command); break; case "discardCard": discardCard(state, command); break; case "upgradeCard": upgradeCard(state, command); break; case "chooseTarget": chooseTarget(state, command); break; default: throw new BattleRuleError("UNKNOWN_COMMAND", `Неизвестная команда: ${command.type}.`, command); }
    checkFinished(state); validateState(state); logged.postHash = stateHash(state); state.commandLog.push(logged); return { state, events: clone(state.eventLog.slice(beforeEvents)) };
  }
  function validateActor(state, actor) { assert(actor && actor.id, "INVALID_ACTOR", "Состояние участника отсутствует."); assert(actor.hp >= 0 && actor.hp <= actor.maxHp, "INVALID_HP", "Здоровье вышло за допустимые пределы.", actor); assert(actor.shield >= 0, "INVALID_SHIELD", "Щит не может быть отрицательным.", actor); assert(actor.energy >= 0, "INVALID_ENERGY", "Энергия не может быть отрицательной.", actor); const ids = new Set(); Object.values(ZONES).forEach((zoneName) => { assert(Array.isArray(actor[zoneName]), "INVALID_ZONE", `Зона ${zoneName} должна быть массивом.`); actor[zoneName].forEach((card) => { assert(!ids.has(card.instanceId), "DUPLICATE_CARD_INSTANCE", `Карта ${card.instanceId} одновременно находится в нескольких зонах.`); ids.add(card.instanceId); assert(state.cardCatalog[card.definitionId], "UNKNOWN_CARD_INSTANCE", `Экземпляр ссылается на неизвестную карту ${card.definitionId}.`); assert(card.upgrade === 0 || card.upgrade === 1, "INVALID_UPGRADE", "Уровень улучшения карты должен быть 0 или 1."); }); }); }
  function validateState(state) { assert(state.saveVersion === SAVE_VERSION, "UNSUPPORTED_SAVE", `Неподдерживаемая версия сохранения: ${state.saveVersion}.`); assert(state.actors && state.actors.player && state.actors.dealer, "MISSING_ACTORS", "В бою должны быть игрок и дилер."); validateActor(state, state.actors.player); validateActor(state, state.actors.dealer); assert(Object.values(PHASES).includes(state.phase), "INVALID_PHASE", `Неизвестная фаза: ${state.phase}.`); if (state.phase === PHASES.FINISHED) assert(state.winner, "MISSING_WINNER", "Завершённый бой должен иметь победителя."); if (state.phase !== PHASES.FINISHED) assert(!state.winner, "EARLY_WINNER", "Победитель указан до завершения боя."); return true; }
  function migrateActor(actor) { actor.statuses = actor.statuses || {}; actor.stats = Object.assign({ cardsPlayed: 0, damageDealt: 0, damageTaken: 0, cardsStolen: 0, cardsBurned: 0, cardsRepaired: 0, cardsUpgraded: 0 }, actor.stats || {}); Object.values(ZONES).forEach((zoneName) => { actor[zoneName] = Array.isArray(actor[zoneName]) ? actor[zoneName] : []; actor[zoneName].forEach((card) => { card.upgrade = clamp(integer(card.upgrade, 0), 0, 1); card.costModifier = integer(card.costModifier, 0); card.brokenFor = Math.max(0, integer(card.brokenFor, 0)); card.blockedFor = Math.max(0, integer(card.blockedFor, 0)); card.tags = Array.isArray(card.tags) ? card.tags : []; }); }); }
  function migrateSave(rawSave) { const save = clone(rawSave); if (!save || typeof save !== "object") throw new BattleRuleError("INVALID_SAVE", "Сохранение повреждено или пусто."); if (save.saveVersion === 1 || save.saveVersion == null || save.saveVersion === 0) { save.saveVersion = SAVE_VERSION; save.engineVersion = ENGINE_VERSION; save.rules = Object.assign({ handSize: 5, maxHandSize: 10, shieldResetsEachTurn: true, catalogVersion: 0 }, save.rules || {}); save.pendingChoice = save.pendingChoice || null; save.eventLog = Array.isArray(save.eventLog) ? save.eventLog : []; save.commandLog = Array.isArray(save.commandLog) ? save.commandLog : []; save.nextEventSeq = Math.max(1, integer(save.nextEventSeq, save.eventLog.length + 1)); Object.values(save.cardCatalog || {}).forEach((definition) => { definition.upgrade = definition.upgrade || null; definition.tags = Array.isArray(definition.tags) ? definition.tags : []; }); migrateActor(save.actors.player); migrateActor(save.actors.dealer); } assert(save.saveVersion === SAVE_VERSION, "UNSUPPORTED_SAVE", `Нельзя мигрировать сохранение версии ${save.saveVersion}.`); validateState(save); return save; }
  function replayBattle(initialConfig, commands) { let state = createBattle(initialConfig); (commands || []).forEach((command, index) => { state = executeCommand(state, command).state; if (command.postHash) assert(stateHash(state) === command.postHash, "REPLAY_DIVERGED", `Повтор разошёлся на команде ${index}.`, { expectedHash: command.postHash, actualHash: stateHash(state) }); }); return state; }

  return Object.freeze({ SAVE_VERSION, ENGINE_VERSION, SIDES, PHASES, ZONES, TIMEOUT_PENALTIES, BattleRuleError, createBattle, executeCommand, replayBattle, validateState, migrateSave, stateHash, effectiveCost, resolveCardDefinition });
});
