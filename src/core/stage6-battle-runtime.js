"use strict";
(function (root) {
  const Base = root.BitayaMastBattle;
  const Catalog = root.BitayaMastCardCatalog;
  const Dealers = root.BitayaMastDealerCatalog;
  if (!Base || !Catalog || !Dealers) throw new Error("Stage 6 runtime requires battle engine, card catalog and dealer catalog.");

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function hash(value) { const source = String(value); let result = 2166136261; for (let index = 0; index < source.length; index += 1) { result ^= source.charCodeAt(index); result = Math.imul(result, 16777619); } return result >>> 0; }
  function emit(state, type, payload) { const event = { seq: state.nextEventSeq, type, payload: clone(payload || {}), round: state.round, turn: state.turn, phase: state.phase }; state.nextEventSeq += 1; state.eventLog.push(event); return event; }
  function selectedDealerId() { try { return Dealers.readSelection(root.localStorage); } catch (error) { return "shuler"; } }
  function currentDealerId(state) { return Dealers.normalizeId(state && (state.dealerId || (state.rules && state.rules.dealerId) || (state.initialConfig && state.initialConfig.dealerId))); }
  function profileFor(state) { return Dealers.getDealer(currentDealerId(state)); }
  function ensureAbilityState(state) {
    const profile = profileFor(state);
    state.dealerId = profile.id;
    state.rules = Object.assign({}, state.rules || {}, { dealerId: profile.id, dealerCatalogVersion: Dealers.DATA_VERSION });
    state.dealerAbility = Object.assign({ id: profile.ability.id, phase: 1, triggered: {}, lastDealerTurn: 0 }, state.dealerAbility || {});
    return state.dealerAbility;
  }
  function addStatus(state, actorId, statusId, stacks, duration, timing, source) {
    const actor = state.actors[actorId];
    const current = actor.statuses[statusId] || { stacks: 0, duration: duration == null ? null : 0, timing: timing || "turn_end" };
    current.stacks = Math.max(0, Number(current.stacks || 0) + Number(stacks || 0));
    current.timing = timing || current.timing;
    if (duration != null) current.duration = Math.max(Number(current.duration || 0), Number(duration));
    actor.statuses[statusId] = current;
    emit(state, "DEALER_ABILITY_STATUS", { dealerId: currentDealerId(state), actorId, statusId, stacks: current.stacks, duration: current.duration, source });
  }
  function modifyCard(state, actorId, mode, seedKey) {
    const actor = state.actors[actorId];
    const candidates = actor.hand.filter((card) => mode !== "block" || card.blockedFor <= 0);
    if (!candidates.length) return null;
    const card = candidates[hash(`${state.seed}:${state.turn}:${seedKey}`) % candidates.length];
    if (mode === "block") card.blockedFor = Math.max(card.blockedFor, 2);
    if (mode === "break") { card.brokenFor = Math.max(card.brokenFor, 2); card.costModifier += 1; }
    emit(state, mode === "block" ? "DEALER_ABILITY_BLOCK" : "DEALER_ABILITY_BREAK", { dealerId: currentDealerId(state), actorId, cardInstanceId: card.instanceId, definitionId: card.definitionId, duration: 2 });
    return card;
  }
  function applyStartAbility(state) {
    const profile = profileFor(state);
    const ability = ensureAbilityState(state);
    if (ability.triggered.start) return;
    ability.triggered.start = true;
    if (profile.id === "sysadmin") {
      state.actors.dealer.shield += 8;
      emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, shield: 8 });
    }
    if (profile.id === "house_master") {
      state.actors.dealer.shield += 10;
      emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, shield: 10 });
    }
  }
  function playedDealerCardsThisTurn(state) {
    return state.eventLog.filter((event) => event.type === "CARD_PLAYED" && event.turn === state.turn && event.payload && event.payload.actorId === "dealer").length;
  }
  function applyAfterCommand(state, command) {
    const profile = profileFor(state);
    const ability = ensureAbilityState(state);
    const dealer = state.actors.dealer;
    if (state.phase === Base.PHASES.FINISHED) return;

    if (profile.id === "shuler" && command.type === "playCard" && command.actorId === "dealer" && !ability.triggered.markedDeck) {
      const played = state.eventLog.slice().reverse().find((event) => event.type === "CARD_PLAYED" && event.payload && event.payload.actorId === "dealer" && event.payload.cardInstanceId === command.cardInstanceId);
      const definition = played && state.cardCatalog[played.payload.definitionId];
      if (definition && definition.type === "skill") {
        ability.triggered.markedDeck = true;
        dealer.energy += 1;
        emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, energy: 1 });
      }
    }

    if (command.actorId === "player" && ["endTurn", "expireTurn"].includes(command.type) && state.phase === Base.PHASES.DEALER) {
      if (profile.id === "collector" && state.round % 2 === 0) {
        addStatus(state, "dealer", "strength", 1, 1, "turn_end", ability.id);
        emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, round: state.round });
      }
      if (profile.id === "sysadmin" && state.round % 3 === 0 && ability.triggered.firewallRound !== state.round) {
        ability.triggered.firewallRound = state.round;
        modifyCard(state, "player", "block", `firewall:${state.round}`);
        emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, round: state.round });
      }
      if (profile.id === "mascot" && ability.triggered.glitchRound !== state.round) {
        ability.triggered.glitchRound = state.round;
        const roll = hash(`${state.seed}:${state.round}:mascot-glitch`) % 3;
        if (roll === 0) { dealer.shield += 5; emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, bonus: "shield", amount: 5 }); }
        if (roll === 1) { addStatus(state, "dealer", "strength", 1, 1, "turn_end", ability.id); emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, bonus: "strength", amount: 1 }); }
        if (roll === 2) { dealer.energy += 1; emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, bonus: "energy", amount: 1 }); }
      }
    }

    if (profile.id === "projectionist" && command.type === "playCard" && command.actorId === "dealer" && playedDealerCardsThisTurn(state) === 2 && ability.triggered.doubleFeatureTurn !== state.turn) {
      ability.triggered.doubleFeatureTurn = state.turn;
      dealer.energy += 1;
      emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, energy: 1, turn: state.turn });
    }

    if (profile.id === "archivist" && dealer.hp <= Math.floor(dealer.maxHp / 2) && !ability.triggered.sealedArchive) {
      ability.triggered.sealedArchive = true;
      dealer.shield += 14;
      const before = dealer.hp;
      dealer.hp = Math.min(dealer.maxHp, dealer.hp + 5);
      emit(state, "DEALER_ABILITY_TRIGGERED", { dealerId: profile.id, abilityId: ability.id, shield: 14, healed: dealer.hp - before });
    }

    if (profile.id === "house_master" && dealer.hp <= Math.floor(dealer.maxHp / 2) && ability.phase === 1) {
      ability.phase = 2;
      dealer.maxEnergy = 5;
      dealer.energy = Math.max(dealer.energy, 5);
      const before = dealer.hp;
      dealer.hp = Math.min(dealer.maxHp, dealer.hp + 10);
      addStatus(state, "dealer", "strength", 2, null, "turn_end", ability.id);
      emit(state, "DEALER_PHASE_CHANGED", { dealerId: profile.id, abilityId: ability.id, phase: 2, healed: dealer.hp - before, maxEnergy: 5, strength: 2 });
    }
  }

  function createBattle(config) {
    const dealerId = Dealers.normalizeId((config && config.dealerId) || selectedDealerId());
    const prepared = Dealers.decorateBattleConfig(config, Catalog, dealerId);
    const state = Base.createBattle(prepared);
    state.initialConfig = prepared;
    state.dealerId = dealerId;
    ensureAbilityState(state);
    applyStartAbility(state);
    Base.validateState(state);
    return state;
  }
  function executeCommand(inputState, command) {
    const beforeEvents = inputState.eventLog.length;
    const result = Base.executeCommand(inputState, command);
    const state = result.state;
    ensureAbilityState(state);
    applyAfterCommand(state, command);
    Base.validateState(state);
    if (state.commandLog.length) state.commandLog[state.commandLog.length - 1].postHash = Base.stateHash(state);
    return { state, events: clone(state.eventLog.slice(beforeEvents)) };
  }
  function replayBattle(initialConfig, commands) {
    let state = createBattle(initialConfig);
    (commands || []).forEach((command, index) => {
      state = executeCommand(state, command).state;
      if (command.postHash && Base.stateHash(state) !== command.postHash) throw new Base.BattleRuleError("REPLAY_DIVERGED", `Повтор дилера разошёлся на команде ${index}.`, { expectedHash: command.postHash, actualHash: Base.stateHash(state) });
    });
    return state;
  }
  function migrateSave(rawSave) {
    const state = Base.migrateSave(rawSave);
    state.dealerId = Dealers.normalizeId(state.dealerId || (state.rules && state.rules.dealerId) || (state.initialConfig && state.initialConfig.dealerId));
    ensureAbilityState(state);
    return state;
  }

  const wrapped = Object.freeze(Object.assign({}, Base, { createBattle, executeCommand, replayBattle, migrateSave, currentDealerId, profileFor }));
  root.BitayaMastBattle = wrapped;
  root.BitayaMastStage6Battle = wrapped;
})(typeof globalThis !== "undefined" ? globalThis : this);
