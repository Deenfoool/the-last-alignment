"use strict";
(function (root) {
  const Base = root.BitayaMastBattle;
  const Catalog = root.BitayaMastCardCatalog;
  const ContentSettings = root.BitayaMastContentSettings;
  const ActContent = root.BitayaMastAct1Content;
  if (!Base || !Catalog || !ActContent) throw new Error("Stage 7 battle runtime requires battle engine, card catalog and act content.");
  const CONTEXT_KEY = "bitaya-mast-stage7-battle-context-v1";
  const RESULT_KEY = "bitaya-mast-stage7-battle-result-v1";
  let replaying = false;
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function safeStorage() { try { return root.localStorage; } catch (error) { return null; } }
  function readStoredContext() { try { const storage = safeStorage(); const raw = storage && storage.getItem(CONTEXT_KEY); return raw ? JSON.parse(raw) : null; } catch (error) { return null; } }
  function validContext(context) { return context && context.runId && context.nodeId && context.dealerId && Array.isArray(context.deck); }
  function resolveContext(config) { const inline = config && config.actRun; return validContext(inline) ? clone(inline) : readStoredContext(); }
  function emit(state, type, payload) { state.eventLog.push({ seq: state.nextEventSeq++, type, payload: clone(payload || {}), round: state.round, turn: state.turn, phase: state.phase }); }
  function addStatus(state, actorId, statusId, stacks, duration, timing, source) {
    const actor = state.actors[actorId];
    const current = actor.statuses[statusId] || { stacks: 0, duration: duration == null ? null : 0, timing: timing || "turn_end" };
    current.stacks += Number(stacks || 0);
    current.timing = timing || current.timing;
    if (duration != null) current.duration = Math.max(Number(current.duration || 0), Number(duration));
    actor.statuses[statusId] = current;
    emit(state, "ARTIFACT_STATUS_APPLIED", { actorId, statusId, stacks: current.stacks, source });
  }
  function seededRandom(seed) { let value = Number(seed || 1) >>> 0; if (!value) value = 1; return function () { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; }; }
  function replacePlayerDeck(state, context) {
    const actor = state.actors.player;
    actor.drawPile = []; actor.hand = []; actor.discardPile = []; actor.exilePile = [];
    const instances = context.deck.map((entry) => ({ instanceId: `c${state.nextCardSeq++}`, definitionId: entry.id, owner: "player", upgrade: Math.max(0, Math.min(1, Number(entry.upgrade || 0))), costModifier: 0, brokenFor: 0, blockedFor: 0, tags: [] }));
    const random = seededRandom(Number(context.battleSeed || state.seed) ^ 0x7a11c7);
    for (let index = instances.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [instances[index], instances[target]] = [instances[target], instances[index]]; }
    actor.drawPile = instances;
    const count = Math.min(state.rules.handSize, actor.drawPile.length);
    for (let index = 0; index < count; index += 1) { const card = actor.drawPile.pop(); actor.hand.push(card); emit(state, "CARD_DRAWN", { actorId: "player", cardInstanceId: card.instanceId, definitionId: card.definitionId, source: "run_deck" }); }
    emit(state, "RUN_DECK_LOADED", { runId: context.runId, cards: context.deck.length });
  }
  function artifactIds(context) { return Array.isArray(context && context.artifacts) ? context.artifacts.filter((id) => ActContent.byArtifactId[id]) : []; }
  function prepare(input, context) {
    if (!validContext(context)) return input;
    const config = clone(input || {});
    config.battleId = context.battleId || `${context.runId}-${context.nodeId}`;
    config.seed = Number(context.battleSeed || config.seed || 1);
    config.dealerId = context.dealerId;
    config.disableCatalogDecks = true;
    config.useCatalogDecks = false;
    config.preservePlayerDeck = true;
    config.actRun = clone(context);
    config.cards = ContentSettings && typeof ContentSettings.projectEngineCards === "function"
      ? ContentSettings.projectEngineCards(Catalog.cards, ContentSettings.load())
      : Catalog.engineCards;
    config.player = Object.assign({}, config.player || {}, {
      name: "Игрок",
      hp: Math.max(1, Number(context.playerHp || 1)),
      maxHp: Math.max(1, Number(context.playerMaxHp || context.playerHp || 70)),
      maxEnergy: 3,
      deck: context.deck.map((entry) => ({ id: entry.id, upgrade: Number(entry.upgrade || 0) })),
    });
    config.rules = Object.assign({}, config.rules || {}, { runId: context.runId, runNodeId: context.nodeId, act: 1 });
    return config;
  }
  function applyArtifacts(state, context) {
    if (!validContext(context) || state.runArtifactsApplied) return;
    state.runArtifactsApplied = true;
    state.runContext = clone(context);
    const player = state.actors.player;
    artifactIds(context).forEach((id) => {
      const effect = ActContent.byArtifactId[id].effect || {};
      if (effect.startShield) player.shield += Number(effect.startShield);
      if (effect.startStrength) addStatus(state, "player", "strength", effect.startStrength, null, "turn_end", id);
      if (effect.bonusEnergy) { player.maxEnergy += Number(effect.bonusEnergy); player.energy += Number(effect.bonusEnergy); }
      if (effect.enemyVulnerable) addStatus(state, "dealer", "vulnerable", effect.enemyVulnerable, 2, "turn_end", id);
      if (effect.lowHpHeal && player.hp / player.maxHp < .5) player.hp = Math.min(player.maxHp, player.hp + Number(effect.lowHpHeal));
      emit(state, "ARTIFACT_TRIGGERED", { artifactId: id, effect: clone(effect) });
    });
  }
  function createBattle(config) {
    const context = resolveContext(config);
    const prepared = prepare(config, context);
    const state = Base.createBattle(prepared);
    if (validContext(context)) {
      state.initialConfig = prepared;
      replacePlayerDeck(state, context);
      applyArtifacts(state, context);
      Base.validateState(state);
    }
    return state;
  }
  function writeResult(state) {
    if (replaying || !state || state.phase !== Base.PHASES.FINISHED || !validContext(state.runContext)) return;
    const storage = safeStorage();
    if (!storage) return;
    const context = state.runContext;
    const result = {
      version: 1,
      runId: context.runId,
      nodeId: context.nodeId,
      dealerId: context.dealerId,
      winner: state.winner,
      playerHp: state.actors.player.hp,
      playerMaxHp: state.actors.player.maxHp,
      rounds: state.round,
      turns: state.turn,
      stateHash: Base.stateHash(state),
      stats: clone(state.actors.player.stats),
      finishedAt: Date.now(),
    };
    try { storage.setItem(RESULT_KEY, JSON.stringify(result)); } catch (error) { /* result remains recoverable from battle save */ }
  }
  function executeCommand(inputState, command) {
    const result = Base.executeCommand(inputState, command);
    if (result.state && result.state.runContext) result.state.runContext = clone(result.state.runContext);
    writeResult(result.state);
    return result;
  }
  function replayBattle(initialConfig, commands) {
    replaying = true;
    try {
      let state = createBattle(initialConfig);
      (commands || []).forEach((command, index) => {
        state = executeCommand(state, command).state;
        if (command.postHash && Base.stateHash(state) !== command.postHash) throw new Base.BattleRuleError("REPLAY_DIVERGED", `Повтор забега разошёлся на команде ${index}.`, { expectedHash: command.postHash, actualHash: Base.stateHash(state) });
      });
      return state;
    } finally { replaying = false; }
  }
  function migrateSave(rawSave) {
    const state = Base.migrateSave(rawSave);
    if (state.initialConfig && state.initialConfig.actRun && !state.runContext) state.runContext = clone(state.initialConfig.actRun);
    return state;
  }
  const wrapped = Object.freeze(Object.assign({}, Base, { createBattle, executeCommand, replayBattle, migrateSave, RUN_CONTEXT_KEY: CONTEXT_KEY, RUN_RESULT_KEY: RESULT_KEY }));
  root.BitayaMastBattle = wrapped;
  root.BitayaMastStage7Battle = wrapped;
})(typeof globalThis !== "undefined" ? globalThis : this);