"use strict";
(function (root, factory) {
  const Content = root && root.BitayaMastAct1Content || (typeof module === "object" && module.exports ? require("../data/act1-content.js") : null);
  const api = factory(Content);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastRunProfile = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Content) {
  if (!Content) throw new Error("Run profile requires act content.");
  const PROFILE_VERSION = 1;
  const STORAGE_KEY = "bitaya-mast-stage7-profile-v1";
  const BASE_ARTIFACTS = Object.freeze(Content.artifacts.filter((item) => item.unlock === "base").map((item) => item.id));
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function create() {
    return {
      profileVersion: PROFILE_VERSION,
      runs: 0,
      victories: 0,
      defeats: 0,
      bossKills: 0,
      elitesDefeated: 0,
      nodesVisited: 0,
      totalGoldEarned: 0,
      cardsAdded: 0,
      cardsRemoved: 0,
      cardsUpgraded: 0,
      highestLayer: 0,
      discoveredCards: [],
      discoveredArtifacts: [],
      unlockedArtifacts: BASE_ARTIFACTS.slice(),
      bestRun: null,
      lastRunAt: null,
    };
  }
  function migrate(raw) {
    const profile = Object.assign(create(), clone(raw || {}));
    profile.profileVersion = PROFILE_VERSION;
    ["discoveredCards", "discoveredArtifacts", "unlockedArtifacts"].forEach((key) => { profile[key] = Array.from(new Set(Array.isArray(profile[key]) ? profile[key] : [])); });
    BASE_ARTIFACTS.forEach((id) => { if (!profile.unlockedArtifacts.includes(id)) profile.unlockedArtifacts.push(id); });
    unlockByProgress(profile);
    return profile;
  }
  function load(storage) {
    try { const raw = storage && storage.getItem(STORAGE_KEY); return migrate(raw ? JSON.parse(raw) : null); }
    catch (error) { return create(); }
  }
  function save(profile, storage) {
    const normalized = migrate(profile);
    try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (error) { /* storage may be unavailable */ }
    return normalized;
  }
  function unlock(profile, id) { if (Content.byArtifactId[id] && !profile.unlockedArtifacts.includes(id)) profile.unlockedArtifacts.push(id); }
  function unlockByProgress(profile) {
    if (profile.runs >= 2) unlock(profile, "first_aid_tape");
    if (profile.elitesDefeated >= 1) unlock(profile, "pocket_mirror");
    if (profile.nodesVisited >= 12) { unlock(profile, "lucky_chip"); unlock(profile, "black_ledger"); }
    if (profile.victories >= 1) { unlock(profile, "spare_battery"); unlock(profile, "house_key"); }
    return profile;
  }
  function recordFinishedRun(inputProfile, run) {
    const profile = migrate(inputProfile);
    if (!run || !["victory", "defeat"].includes(run.status)) return profile;
    profile.runs += 1;
    if (run.status === "victory") { profile.victories += 1; profile.bossKills += 1; }
    else profile.defeats += 1;
    profile.elitesDefeated += Number(run.stats && run.stats.elitesDefeated || 0);
    profile.nodesVisited += Number(run.stats && run.stats.nodesVisited || 0);
    profile.totalGoldEarned += Number(run.stats && run.stats.goldEarned || 0);
    profile.cardsAdded += Number(run.stats && run.stats.cardsAdded || 0);
    profile.cardsRemoved += Number(run.stats && run.stats.cardsRemoved || 0);
    profile.cardsUpgraded += Number(run.stats && run.stats.cardsUpgraded || 0);
    profile.highestLayer = Math.max(profile.highestLayer, Number(run.stats && run.stats.highestLayer || 0));
    (run.deck || []).forEach((entry) => { if (!profile.discoveredCards.includes(entry.id)) profile.discoveredCards.push(entry.id); });
    (run.artifacts || []).forEach((id) => { if (!profile.discoveredArtifacts.includes(id)) profile.discoveredArtifacts.push(id); });
    const score = Number(run.stats && run.stats.score || 0);
    if (!profile.bestRun || score > Number(profile.bestRun.score || 0)) profile.bestRun = { score, seed: run.seed, status: run.status, nodes: run.stats.nodesVisited, gold: run.gold };
    profile.lastRunAt = Date.now();
    unlockByProgress(profile);
    return profile;
  }
  return Object.freeze({ PROFILE_VERSION, STORAGE_KEY, BASE_ARTIFACTS, create, migrate, load, save, recordFinishedRun, unlockByProgress });
});