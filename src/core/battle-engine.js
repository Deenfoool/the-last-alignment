"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastBattle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SAVE_VERSION = 1;
  const SIDES = Object.freeze({ PLAYER: "player", DEALER: "dealer" });
  const PHASES = Object.freeze({ PLAYER: "player_turn", DEALER: "dealer_turn", FINISHED: "finished" });
  const ZONES = Object.freeze({ DRAW: "drawPile", HAND: "hand", DISCARD: "discardPile", EXILE: "exilePile" });

  class BattleRuleError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = "BattleRuleError";
      this.code = code;
      this.details = details || null;
    }
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function assert(condition, code, message, details) {
    if (!condition) throw new BattleRuleError(code, message, details);
  }

  function integer(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizeSeed(seed) {
    let value = integer(seed, 0x6d2b79f5) >>> 0;
    if (value === 0) value = 0x6d2b79f5;
    return value;
  }

  function nextRandom(state) {
    let x = state.rngState >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state.rngState = x >>> 0;
    return (state.rngState >>> 0) / 4294967296;
  }

  function randomIndex(state, length) {
    assert(length > 0, "EMPTY_RANDOM_SOURCE", "Нельзя выбрать случайный элемент из пустого списка.");
    return Math.floor(nextRandom(state) * length);
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function stateHash(state) {
    const snapshot = clone(state);
    delete snapshot.eventLog;
    delete snapshot.commandLog;
    delete snapshot.lastError;
    return hashText(stableStringify(snapshot));
  }

  function emit(state, type, payload) {
    const event = {
      seq: state.nextEventSeq,
      type,
      payload: clone(payload || {}),
      round: state.round,
      phase: state.phase,
    };
    state.nextEventSeq += 1;
    state.eventLog.push(event);
    return event;
  }

  function otherSide(side) {
    return side === SIDES.PLAYER ? SIDES.DEALER : SIDES.PLAYER;
  }

  function createCardInstance(state, definitionId, owner) {
    assert(state.cardCatalog[definitionId], "UNKNOWN_CARD", `Неизвестная карта: ${definitionId}.`);
    const instance = {
      instanceId: `c${state.nextCardSeq}`,
      definitionId,
      owner,
      upgrade: 0,
      costModifier: 0,
      brokenFor: 0,
      blockedFor: 0,
      tags: [],
    };
    state.nextCardSeq += 1;
    return instance;
  }

  function shuffle(state, list) {
    for (let index = list.length - 1; index > 0; index -= 1) {
      const target = randomIndex(state, index + 1);
      const temporary = list[index];
      list[index] = list[target];
      list[target] = temporary;
    }
  }

  function createActor(state, side, input) {
    const maxHp = Math.max(1, integer(input.maxHp, 30));
    const actor = {
      id: side,
      name: input.name || (side === SIDES.PLAYER ? "Игрок" : "Дилер"),
      hp: clamp(integer(input.hp, maxHp), 0, maxHp),
      maxHp,
      shield: Math.max(0, integer(input.shield, 0)),
      energy: 0,
      maxEnergy: Math.max(0, integer(input.maxEnergy, 3)),
      drawPile: [],
      hand: [],
      discardPile: [],
      exilePile: [],
      statuses: {},
      stats: { cardsPlayed: 0, damageDealt: 0, damageTaken: 0, cardsStolen: 0, cardsBurned: 0 },
    };
    const deck = Array.isArray(input.deck) ? input.deck : [];
    deck.forEach((definitionId) => actor.drawPile.push(createCardInstance(state, definitionId, side)));
    shuffle(state, actor.drawPile);
    return actor;
  }

  function normalizeCatalog(cards) {
    const catalog = {};
    (Array.isArray(cards) ? cards : Object.values(cards || {})).forEach((card) => {
      assert(card && typeof card.id === "string" && card.id, "INVALID_CARD", "Каждой карте нужен уникальный id.", card);
      assert(!catalog[card.id], "DUPLICATE_CARD", `Повторяющийся id карты: ${card.id}.`);
      catalog[card.id] = {
        id: card.id,
        name: card.name || card.id,
        type: card.type || "skill",
        rarity: card.rarity || "common",
        cost: Math.max(0, integer(card.cost, 0)),
        target: card.target || "opponent",
        exhaust: Boolean(card.exhaust),
        effects: clone(Array.isArray(card.effects) ? card.effects : []),
        tags: clone(Array.isArray(card.tags) ? card.tags : []),
      };
    });
    return catalog;
  }

  function createBattle(config) {
    const safeConfig = clone(config || {});
    const state = {
      saveVersion: SAVE_VERSION,
      engineVersion: "1.0.0-stage1",
      battleId: safeConfig.battleId || `battle-${Date.now()}`,
      seed: normalizeSeed(safeConfig.seed),
      rngState: normalizeSeed(safeConfig.seed),
      round: 1,
      turn: 1,
      phase: PHASES.PLAYER,
      winner: null,
      nextCardSeq: 1,
      nextEventSeq: 1,
      cardCatalog: normalizeCatalog(safeConfig.cards),
      actors: {},
      pendingChoice: null,
      eventLog: [],
      commandLog: [],
      initialConfig: safeConfig,
      rules: {
        handSize: Math.max(1, integer(safeConfig.rules && safeConfig.rules.handSize, 5)),
        maxHandSize: Math.max(1, integer(safeConfig.rules && safeConfig.rules.maxHandSize, 10)),
        shieldResetsEachTurn: safeConfig.rules && safeConfig.rules.shieldResetsEachTurn === false ? false : true,
      },
    };

    state.actors.player = createActor(state, SIDES.PLAYER, safeConfig.player || {});
    state.actors.dealer = createActor(state, SIDES.DEALER, safeConfig.dealer || {});

    emit(state, "BATTLE_STARTED", { battleId: state.battleId, seed: state.seed });
    drawCards(state, SIDES.DEALER, state.rules.handSize);
    beginTurn(state, SIDES.PLAYER, true);
    validateState(state);
    return state;
  }

  function reshuffleIfNeeded(state, actor) {
    if (actor.drawPile.length || !actor.discardPile.length) return;
    actor.drawPile = actor.discardPile.splice(0);
    shuffle(state, actor.drawPile);
    emit(state, "PILE_SHUFFLED", { actorId: actor.id, count: actor.drawPile.length });
  }

  function drawCards(state, actorId, amount) {
    const actor = state.actors[actorId];
    let drawn = 0;
    for (let index = 0; index < amount; index += 1) {
      if (actor.hand.length >= state.rules.maxHandSize) {
        emit(state, "DRAW_BLOCKED", { actorId, reason: "HAND_FULL" });
        break;
      }
      reshuffleIfNeeded(state, actor);
      if (!actor.drawPile.length) break;
      const card = actor.drawPile.pop();
      actor.hand.push(card);
      drawn += 1;
      emit(state, "CARD_DRAWN", { actorId, cardInstanceId: card.instanceId });
    }
    return drawn;
  }

  function tickCardLocks(actor) {
    [actor.drawPile, actor.hand, actor.discardPile].forEach((zone) => zone.forEach((card) => {
      if (card.brokenFor > 0) {
        card.brokenFor -= 1;
        if (card.brokenFor === 0) card.costModifier = 0;
      }
      if (card.blockedFor > 0) card.blockedFor -= 1;
    }));
  }

  function tickStatuses(state, actor, timing) {
    Object.keys(actor.statuses).forEach((statusId) => {
      const status = actor.statuses[statusId];
      if (status.timing !== timing) return;
      if (statusId === "burn" && timing === "turn_start") dealDamage(state, otherSide(actor.id), actor.id, status.stacks, { source: "status:burn", ignoreModifiers: true });
      if (statusId === "regeneration" && timing === "turn_start") heal(state, actor.id, status.stacks, { source: "status:regeneration" });
      if (status.duration !== null && status.duration !== undefined) {
        status.duration -= 1;
        if (status.duration <= 0) {
          delete actor.statuses[statusId];
          emit(state, "STATUS_EXPIRED", { actorId: actor.id, statusId });
        }
      }
    });
  }

  function beginTurn(state, actorId, initial) {
    const actor = state.actors[actorId];
    state.phase = actorId === SIDES.PLAYER ? PHASES.PLAYER : PHASES.DEALER;
    if (!initial) state.turn += 1;
    if (state.rules.shieldResetsEachTurn) actor.shield = 0;
    actor.energy = actor.maxEnergy;
    tickCardLocks(actor);
    tickStatuses(state, actor, "turn_start");
    drawCards(state, actorId, Math.max(0, state.rules.handSize - actor.hand.length));
    emit(state, "TURN_STARTED", { actorId, energy: actor.energy, round: state.round });
    checkFinished(state);
  }

  function endTurnInternal(state, actorId) {
    const actor = state.actors[actorId];
    tickStatuses(state, actor, "turn_end");
    emit(state, "TURN_ENDED", { actorId, unusedEnergy: actor.energy });
    actor.energy = 0;
    const next = otherSide(actorId);
    if (next === SIDES.PLAYER) state.round += 1;
    beginTurn(state, next, false);
  }

  function locateCard(actor, instanceId) {
    for (const zoneName of Object.values(ZONES)) {
      const index = actor[zoneName].findIndex((card) => card.instanceId === instanceId);
      if (index !== -1) return { zoneName, index, card: actor[zoneName][index] };
    }
    return null;
  }

  function removeCardFromZone(actor, zoneName, index) {
    return actor[zoneName].splice(index, 1)[0];
  }

  function effectiveCost(state, actorId, card) {
    const definition = state.cardCatalog[card.definitionId];
    const discount = actorStatusStacks(state.actors[actorId], "discount");
    return Math.max(0, definition.cost + integer(card.costModifier, 0) - discount);
  }

  function actorStatusStacks(actor, statusId) {
    return actor.statuses[statusId] ? Math.max(0, integer(actor.statuses[statusId].stacks, 0)) : 0;
  }

  function resolveTargetActor(state, sourceId, targetRule, explicitTargetId) {
    if (targetRule === "self") return sourceId;
    if (targetRule === "opponent") return otherSide(sourceId);
    if (targetRule === "any") {
      assert(explicitTargetId === SIDES.PLAYER || explicitTargetId === SIDES.DEALER, "TARGET_REQUIRED", "Нужно выбрать цель карты.");
      return explicitTargetId;
    }
    if (targetRule === "none") return null;
    return explicitTargetId || otherSide(sourceId);
  }

  function damageMultiplier(actor) {
    return actorStatusStacks(actor, "weak") > 0 ? 0.75 : 1;
  }

  function incomingMultiplier(actor) {
    return actorStatusStacks(actor, "vulnerable") > 0 ? 1.5 : 1;
  }

  function dealDamage(state, sourceId, targetId, baseAmount, meta) {
    const source = state.actors[sourceId];
    const target = state.actors[targetId];
    let amount = Math.max(0, integer(baseAmount, 0));
    if (!(meta && meta.ignoreModifiers)) {
      amount = Math.floor(amount * damageMultiplier(source) * incomingMultiplier(target));
      amount += actorStatusStacks(source, "strength");
    }
    amount = Math.max(0, amount);
    const blocked = Math.min(target.shield, amount);
    target.shield -= blocked;
    const hpDamage = amount - blocked;
    target.hp = clamp(target.hp - hpDamage, 0, target.maxHp);
    source.stats.damageDealt += hpDamage;
    target.stats.damageTaken += hpDamage;
    emit(state, "DAMAGE_DEALT", { sourceId, targetId, amount, blocked, hpDamage, source: meta && meta.source });
    if (hpDamage > 0 && actorStatusStacks(target, "thorns") > 0 && sourceId !== targetId) {
      dealDamage(state, targetId, sourceId, actorStatusStacks(target, "thorns"), { source: "status:thorns", ignoreModifiers: true });
    }
    checkFinished(state);
    return hpDamage;
  }

  function addShield(state, actorId, amount, meta) {
    const actor = state.actors[actorId];
    const gained = Math.max(0, integer(amount, 0));
    actor.shield += gained;
    emit(state, "SHIELD_GAINED", { actorId, amount: gained, source: meta && meta.source });
    return gained;
  }

  function heal(state, actorId, amount, meta) {
    const actor = state.actors[actorId];
    const before = actor.hp;
    actor.hp = clamp(actor.hp + Math.max(0, integer(amount, 0)), 0, actor.maxHp);
    const restored = actor.hp - before;
    emit(state, "HEALED", { actorId, amount: restored, source: meta && meta.source });
    return restored;
  }

  function applyStatus(state, actorId, statusId, stacks, duration, timing) {
    const actor = state.actors[actorId];
    const current = actor.statuses[statusId] || { stacks: 0, duration: duration == null ? null : 0, timing: timing || "turn_end" };
    current.stacks = Math.max(0, current.stacks + integer(stacks, 0));
    current.timing = timing || current.timing;
    if (duration != null) current.duration = Math.max(current.duration || 0, integer(duration, 1));
    actor.statuses[statusId] = current;
    emit(state, "STATUS_APPLIED", { actorId, statusId, stacks: current.stacks, duration: current.duration });
  }

  function selectRandomCard(state, actor, allowedZones) {
    const candidates = [];
    allowedZones.forEach((zoneName) => actor[zoneName].forEach((card, index) => candidates.push({ zoneName, index, card })));
    if (!candidates.length) return null;
    return candidates[randomIndex(state, candidates.length)];
  }

  function stealRandomCard(state, sourceId, targetId, zones) {
    const source = state.actors[sourceId];
    const target = state.actors[targetId];
    const selected = selectRandomCard(state, target, zones || [ZONES.HAND]);
    if (!selected) {
      emit(state, "CARD_STEAL_FAILED", { sourceId, targetId, reason: "NO_CARD" });
      return null;
    }
    const card = removeCardFromZone(target, selected.zoneName, selected.index);
    card.owner = sourceId;
    source.hand.push(card);
    source.stats.cardsStolen += 1;
    emit(state, "CARD_STOLEN", { sourceId, targetId, cardInstanceId: card.instanceId, from: selected.zoneName });
    return card;
  }

  function modifyRandomCard(state, targetId, mode, amount, duration, zones) {
    const target = state.actors[targetId];
    const selected = selectRandomCard(state, target, zones || [ZONES.HAND]);
    if (!selected) {
      emit(state, "CARD_MODIFY_FAILED", { targetId, mode, reason: "NO_CARD" });
      return null;
    }
    const card = selected.card;
    if (mode === "break") {
      card.costModifier += Math.max(1, integer(amount, 1));
      card.brokenFor = Math.max(card.brokenFor, Math.max(1, integer(duration, 1)));
      emit(state, "CARD_BROKEN", { targetId, cardInstanceId: card.instanceId, amount: card.costModifier, duration: card.brokenFor });
    } else if (mode === "block") {
      card.blockedFor = Math.max(card.blockedFor, Math.max(1, integer(duration, 1)));
      emit(state, "CARD_BLOCKED", { targetId, cardInstanceId: card.instanceId, duration: card.blockedFor });
    } else if (mode === "burn") {
      removeCardFromZone(target, selected.zoneName, selected.index);
      target.exilePile.push(card);
      target.stats.cardsBurned += 1;
      emit(state, "CARD_BURNED", { targetId, cardInstanceId: card.instanceId, from: selected.zoneName });
    }
    return card;
  }

  function applyEffect(state, sourceId, defaultTargetId, effect, card) {
    const targetId = effect.target === "self" ? sourceId : effect.target === "opponent" ? otherSide(sourceId) : (effect.targetId || defaultTargetId);
    switch (effect.op) {
      case "damage": return dealDamage(state, sourceId, targetId, effect.amount, { source: card.instanceId });
      case "shield": return addShield(state, targetId, effect.amount, { source: card.instanceId });
      case "heal": return heal(state, targetId, effect.amount, { source: card.instanceId });
      case "draw": return drawCards(state, targetId, Math.max(0, integer(effect.amount, 1)));
      case "energy": {
        const actor = state.actors[targetId];
        actor.energy = Math.max(0, actor.energy + integer(effect.amount, 0));
        emit(state, "ENERGY_CHANGED", { actorId: targetId, amount: integer(effect.amount, 0), energy: actor.energy });
        return actor.energy;
      }
      case "status": return applyStatus(state, targetId, effect.statusId, effect.stacks || 1, effect.duration, effect.timing);
      case "steal": return stealRandomCard(state, sourceId, targetId, effect.zones);
      case "break": return modifyRandomCard(state, targetId, "break", effect.amount, effect.duration, effect.zones);
      case "block": return modifyRandomCard(state, targetId, "block", effect.amount, effect.duration, effect.zones);
      case "burn": return modifyRandomCard(state, targetId, "burn", effect.amount, effect.duration, effect.zones);
      case "discard_random": {
        const target = state.actors[targetId];
        const selected = selectRandomCard(state, target, effect.zones || [ZONES.HAND]);
        if (!selected) return null;
        const discarded = removeCardFromZone(target, selected.zoneName, selected.index);
        target.discardPile.push(discarded);
        emit(state, "CARD_DISCARDED", { actorId: targetId, cardInstanceId: discarded.instanceId, reason: "effect" });
        return discarded;
      }
      case "noop": emit(state, "NO_EFFECT", { sourceId, cardInstanceId: card.instanceId }); return null;
      default: throw new BattleRuleError("UNKNOWN_EFFECT", `Неизвестная операция эффекта: ${effect.op}.`, effect);
    }
  }

  function ensureActiveActor(state, actorId) {
    assert(state.phase !== PHASES.FINISHED, "BATTLE_FINISHED", "Бой уже завершён.");
    const expected = state.phase === PHASES.PLAYER ? SIDES.PLAYER : SIDES.DEALER;
    assert(actorId === expected, "NOT_ACTOR_TURN", `Сейчас ход стороны: ${expected}.`, { actorId, expected });
  }

  function playCard(state, command) {
    const actorId = command.actorId;
    ensureActiveActor(state, actorId);
    const actor = state.actors[actorId];
    const location = locateCard(actor, command.cardInstanceId);
    assert(location && location.zoneName === ZONES.HAND, "CARD_NOT_IN_HAND", "Карта должна находиться в руке.", command);
    const card = location.card;
    const definition = state.cardCatalog[card.definitionId];
    assert(card.blockedFor <= 0, "CARD_BLOCKED", "Эта карта временно заблокирована.", { cardInstanceId: card.instanceId, blockedFor: card.blockedFor });
    const cost = effectiveCost(state, actorId, card);
    assert(actor.energy >= cost, "NOT_ENOUGH_ENERGY", "Недостаточно энергии для розыгрыша карты.", { energy: actor.energy, cost });
    const targetId = resolveTargetActor(state, actorId, definition.target, command.targetId);

    actor.energy -= cost;
    actor.stats.cardsPlayed += 1;
    removeCardFromZone(actor, ZONES.HAND, location.index);
    emit(state, "CARD_PLAYED", { actorId, cardInstanceId: card.instanceId, definitionId: card.definitionId, targetId, cost });
    definition.effects.forEach((effect) => {
      if (state.phase !== PHASES.FINISHED) applyEffect(state, actorId, targetId, effect, card);
    });
    const destination = definition.exhaust ? ZONES.EXILE : ZONES.DISCARD;
    actor[destination].push(card);
    emit(state, definition.exhaust ? "CARD_EXILED" : "CARD_MOVED_TO_DISCARD", { actorId, cardInstanceId: card.instanceId });
  }

  function discardCard(state, command) {
    ensureActiveActor(state, command.actorId);
    const actor = state.actors[command.actorId];
    const location = locateCard(actor, command.cardInstanceId);
    assert(location && location.zoneName === ZONES.HAND, "CARD_NOT_IN_HAND", "Сбросить можно только карту из руки.");
    const card = removeCardFromZone(actor, ZONES.HAND, location.index);
    actor.discardPile.push(card);
    emit(state, "CARD_DISCARDED", { actorId: command.actorId, cardInstanceId: card.instanceId, reason: command.reason || "command" });
  }

  function chooseTarget(state, command) {
    assert(state.pendingChoice, "NO_PENDING_CHOICE", "Сейчас нет действия, требующего выбора цели.");
    assert(state.pendingChoice.actorId === command.actorId, "WRONG_CHOICE_ACTOR", "Эту цель должен выбрать другой участник.");
    assert(state.pendingChoice.allowedTargets.includes(command.targetId), "INVALID_TARGET", "Недопустимая цель.");
    const choice = state.pendingChoice;
    state.pendingChoice = null;
    emit(state, "TARGET_CHOSEN", { actorId: command.actorId, targetId: command.targetId, choiceId: choice.choiceId });
  }

  function checkFinished(state) {
    if (state.phase === PHASES.FINISHED) return state.winner;
    const playerDead = state.actors.player.hp <= 0;
    const dealerDead = state.actors.dealer.hp <= 0;
    if (!playerDead && !dealerDead) return null;
    state.phase = PHASES.FINISHED;
    state.winner = playerDead && dealerDead ? "draw" : playerDead ? SIDES.DEALER : SIDES.PLAYER;
    emit(state, "BATTLE_FINISHED", { winner: state.winner });
    return state.winner;
  }

  function executeCommand(inputState, command) {
    const state = clone(inputState);
    assert(command && typeof command.type === "string", "INVALID_COMMAND", "Команда должна иметь тип.");
    const beforeEvents = state.eventLog.length;
    const logged = clone(command);
    logged.index = state.commandLog.length;
    logged.preHash = stateHash(state);

    switch (command.type) {
      case "playCard": playCard(state, command); break;
      case "endTurn": ensureActiveActor(state, command.actorId); endTurnInternal(state, command.actorId); break;
      case "discardCard": discardCard(state, command); break;
      case "chooseTarget": chooseTarget(state, command); break;
      default: throw new BattleRuleError("UNKNOWN_COMMAND", `Неизвестная команда: ${command.type}.`, command);
    }

    checkFinished(state);
    validateState(state);
    logged.postHash = stateHash(state);
    state.commandLog.push(logged);
    return { state, events: clone(state.eventLog.slice(beforeEvents)) };
  }

  function validateActor(state, actor) {
    assert(actor && actor.id, "INVALID_ACTOR", "Состояние участника отсутствует.");
    assert(actor.hp >= 0 && actor.hp <= actor.maxHp, "INVALID_HP", "Здоровье вышло за допустимые пределы.", actor);
    assert(actor.shield >= 0, "INVALID_SHIELD", "Щит не может быть отрицательным.", actor);
    assert(actor.energy >= 0, "INVALID_ENERGY", "Энергия не может быть отрицательной.", actor);
    const ids = new Set();
    Object.values(ZONES).forEach((zoneName) => {
      assert(Array.isArray(actor[zoneName]), "INVALID_ZONE", `Зона ${zoneName} должна быть массивом.`);
      actor[zoneName].forEach((card) => {
        assert(!ids.has(card.instanceId), "DUPLICATE_CARD_INSTANCE", `Карта ${card.instanceId} одновременно находится в нескольких зонах.`);
        ids.add(card.instanceId);
        assert(state.cardCatalog[card.definitionId], "UNKNOWN_CARD_INSTANCE", `Экземпляр ссылается на неизвестную карту ${card.definitionId}.`);
      });
    });
  }

  function validateState(state) {
    assert(state.saveVersion === SAVE_VERSION, "UNSUPPORTED_SAVE", `Неподдерживаемая версия сохранения: ${state.saveVersion}.`);
    assert(state.actors && state.actors.player && state.actors.dealer, "MISSING_ACTORS", "В бою должны быть игрок и дилер.");
    validateActor(state, state.actors.player);
    validateActor(state, state.actors.dealer);
    assert(Object.values(PHASES).includes(state.phase), "INVALID_PHASE", `Неизвестная фаза: ${state.phase}.`);
    if (state.phase === PHASES.FINISHED) assert(state.winner, "MISSING_WINNER", "Завершённый бой должен иметь победителя.");
    if (state.phase !== PHASES.FINISHED) assert(!state.winner, "EARLY_WINNER", "Победитель указан до завершения боя.");
    return true;
  }

  function replayBattle(initialConfig, commands) {
    let state = createBattle(initialConfig);
    (commands || []).forEach((command, index) => {
      const result = executeCommand(state, command);
      state = result.state;
      const expectedHash = command.postHash;
      if (expectedHash) assert(stateHash(state) === expectedHash, "REPLAY_DIVERGED", `Повтор разошёлся на команде ${index}.`, { expectedHash, actualHash: stateHash(state) });
    });
    return state;
  }

  function migrateSave(rawSave) {
    const save = clone(rawSave);
    if (!save || typeof save !== "object") throw new BattleRuleError("INVALID_SAVE", "Сохранение повреждено или пусто.");
    if (save.saveVersion === SAVE_VERSION) {
      validateState(save);
      return save;
    }
    if (save.saveVersion == null || save.saveVersion === 0) {
      save.saveVersion = SAVE_VERSION;
      save.engineVersion = save.engineVersion || "migrated-legacy";
      save.pendingChoice = save.pendingChoice || null;
      save.eventLog = Array.isArray(save.eventLog) ? save.eventLog : [];
      save.commandLog = Array.isArray(save.commandLog) ? save.commandLog : [];
      save.nextEventSeq = Math.max(1, integer(save.nextEventSeq, save.eventLog.length + 1));
      validateState(save);
      return save;
    }
    throw new BattleRuleError("UNSUPPORTED_SAVE", `Нельзя мигрировать сохранение версии ${save.saveVersion}.`);
  }

  return Object.freeze({
    SAVE_VERSION,
    SIDES,
    PHASES,
    ZONES,
    BattleRuleError,
    createBattle,
    executeCommand,
    replayBattle,
    validateState,
    migrateSave,
    stateHash,
    effectiveCost,
  });
});
