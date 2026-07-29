"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastAchievements = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = 1;
  const STORAGE_KEY = "bitaya-mast-release-achievements-v1";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const DEFINITIONS = Object.freeze([
    { id: "first_deal", symbol: "♠", name: "Первая сдача", description: "Начать первый забег.", test: ({ profile, run }) => Boolean(run) || Number(profile.runs || 0) > 0 },
    { id: "first_blood", symbol: "⚔", name: "Первый долг", description: "Победить хотя бы одного дилера.", test: ({ profile, run }) => Number(profile.victories || 0) > 0 || Number(run && run.stats && run.stats.battlesWon || 0) > 0 },
    { id: "elite_hunter", symbol: "☠", name: "Не по рангу", description: "Победить элитного дилера.", test: ({ profile, run }) => Number(profile.elitesDefeated || 0) > 0 || Number(run && run.stats && run.stats.elitesDefeated || 0) > 0 },
    { id: "house_broken", symbol: "♛", name: "Дом проиграл", description: "Победить Хозяина стола.", test: ({ profile, run }) => Number(profile.bossKills || 0) > 0 || Boolean(run && run.status === "victory") },
    { id: "deck_builder", symbol: "▥", name: "Собиратель карт", description: "Добавить 10 карт за все забеги.", test: ({ profile, run }) => Number(profile.cardsAdded || 0) + Number(run && run.stats && run.stats.cardsAdded || 0) >= 10 },
    { id: "upgrade_shop", symbol: "+", name: "Тюнинг колоды", description: "Улучшить 8 карт.", test: ({ profile, run }) => Number(profile.cardsUpgraded || 0) + Number(run && run.stats && run.stats.cardsUpgraded || 0) >= 8 },
    { id: "clean_deck", symbol: "−", name: "Ничего лишнего", description: "Удалить 5 карт.", test: ({ profile, run }) => Number(profile.cardsRemoved || 0) + Number(run && run.stats && run.stats.cardsRemoved || 0) >= 5 },
    { id: "golden_hand", symbol: "₽", name: "Золотая рука", description: "Заработать 500 ₽ суммарно.", test: ({ profile, run }) => Number(profile.totalGoldEarned || 0) + Number(run && run.stats && run.stats.goldEarned || 0) >= 500 },
    { id: "collector", symbol: "✦", name: "Витрина подвального музея", description: "Открыть все 10 артефактов.", test: ({ profile }) => new Set(profile.discoveredArtifacts || []).size >= 10 },
    { id: "full_catalog", symbol: "30", name: "Полная масть", description: "Открыть все 30 карт.", test: ({ profile }) => new Set(profile.discoveredCards || []).size >= 30 },
    { id: "veteran", symbol: "III", name: "Постоянный клиент", description: "Завершить 3 забега.", test: ({ profile }) => Number(profile.runs || 0) >= 3 },
    { id: "perfect_act", symbol: "♥", name: "Без просрочек", description: "Завершить акт с 50 или более здоровья.", test: ({ run }) => Boolean(run && run.status === "victory" && Number(run.hp || 0) >= 50) }
  ]);
  function create() { return { version: VERSION, unlocked: {}, counters: {}, lastEvaluatedAt: null }; }
  function migrate(raw) { const state = Object.assign(create(), clone(raw || {})); state.version = VERSION; state.unlocked = Object.assign({}, state.unlocked || {}); state.counters = Object.assign({}, state.counters || {}); return state; }
  function load(storage) { try { const raw = storage && storage.getItem(STORAGE_KEY); return migrate(raw ? JSON.parse(raw) : null); } catch (error) { return create(); } }
  function save(state, storage) { const normalized = migrate(state); try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (error) {} return normalized; }
  function evaluate(inputState, context) {
    const state = migrate(inputState); const payload = context || {}; const unlockedNow = [];
    DEFINITIONS.forEach((achievement) => {
      let passed = false; try { passed = achievement.test(payload); } catch (error) { passed = false; }
      if (passed && !state.unlocked[achievement.id]) { state.unlocked[achievement.id] = { at: Date.now(), runId: payload.run && payload.run.runId || null }; unlockedNow.push(achievement.id); }
    });
    state.counters = {
      runs: Number(payload.profile && payload.profile.runs || 0), victories: Number(payload.profile && payload.profile.victories || 0), bossKills: Number(payload.profile && payload.profile.bossKills || 0),
      nodes: Number(payload.profile && payload.profile.nodesVisited || 0) + Number(payload.run && payload.run.stats && payload.run.stats.nodesVisited || 0),
      gold: Number(payload.profile && payload.profile.totalGoldEarned || 0) + Number(payload.run && payload.run.stats && payload.run.stats.goldEarned || 0)
    };
    state.lastEvaluatedAt = Date.now(); return { state, unlockedNow };
  }
  function progress(state) { const normalized = migrate(state); return { unlocked: Object.keys(normalized.unlocked).length, total: DEFINITIONS.length, percent: Math.round(Object.keys(normalized.unlocked).length / DEFINITIONS.length * 100) }; }
  function definition(id) { return DEFINITIONS.find((entry) => entry.id === id) || null; }
  return Object.freeze({ VERSION, STORAGE_KEY, DEFINITIONS, create, migrate, load, save, evaluate, progress, definition });
});