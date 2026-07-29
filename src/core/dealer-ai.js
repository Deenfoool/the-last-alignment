"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastDealerAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function hash(value) { const source = String(value); let result = 2166136261; for (let index = 0; index < source.length; index += 1) { result ^= source.charCodeAt(index); result = Math.imul(result, 16777619); } return result >>> 0; }
  function unit(value) { return hash(value) / 4294967296; }
  function statusStacks(actor, id) { return actor && actor.statuses && actor.statuses[id] ? Number(actor.statuses[id].stacks || 0) : 0; }
  function definitionFor(state, card) {
    const base = state.cardCatalog[card.definitionId];
    if (!base) return null;
    if (!(card.upgrade > 0 && base.upgrade)) return base;
    return Object.assign({}, base, base.upgrade, { id: base.id, tags: base.upgrade.tags || base.tags, effects: base.upgrade.effects || base.effects });
  }
  function effectiveCost(state, card, engine, energyOverride) {
    if (engine && typeof engine.effectiveCost === "function") {
      const value = engine.effectiveCost(state, "dealer", card);
      return Math.max(0, Number(value || 0));
    }
    const definition = definitionFor(state, card);
    return Math.max(0, Number(definition ? definition.cost : 0) + Number(card.costModifier || 0) - statusStacks(state.actors.dealer, "discount"));
  }
  function currentTurnTags(state) {
    const tags = [];
    (state.eventLog || []).forEach((event) => {
      if (event.type !== "CARD_PLAYED" || event.turn !== state.turn || !event.payload || event.payload.actorId !== "dealer") return;
      const card = state.cardCatalog[event.payload.definitionId];
      if (card && Array.isArray(card.tags)) tags.push(...card.tags);
    });
    return tags;
  }
  function publicSnapshot(state) {
    const player = state.actors.player;
    const dealer = state.actors.dealer;
    return {
      round: state.round,
      turn: state.turn,
      phase: state.phase,
      player: { hp: player.hp, maxHp: player.maxHp, shield: player.shield, statuses: player.statuses, drawCount: player.drawPile.length, discardCount: player.discardPile.length, handCount: player.hand.length },
      dealer: { hp: dealer.hp, maxHp: dealer.maxHp, shield: dealer.shield, energy: dealer.energy, maxEnergy: dealer.maxEnergy, statuses: dealer.statuses, drawCount: dealer.drawPile.length, discardCount: dealer.discardPile.length, hand: dealer.hand.map((card) => ({ instanceId: card.instanceId, definitionId: card.definitionId, upgrade: card.upgrade, blockedFor: card.blockedFor, brokenFor: card.brokenFor, costModifier: card.costModifier })) }
    };
  }

  function baseEffectScore(effect, context) {
    const actor = context.dealer;
    const opponent = context.player;
    const low = actor.hp / actor.maxHp < .45;
    const opponentLow = opponent.hp / opponent.maxHp < .35;
    switch (effect.op) {
      case "damage": return Number(effect.amount || 0) * (opponentLow ? 5.6 : 4.1);
      case "shield": return Number(effect.amount || 0) * (low ? 3.1 : 1.05);
      case "heal": return Number(effect.amount || 0) * (low ? 4 : .55);
      case "energy": return Number(effect.amount || 0) * 7;
      case "draw": return Number(effect.amount || 0) * 6;
      case "steal": return 18;
      case "break": return 14 + Number(effect.amount || 1) * 3;
      case "block": return 16 + Number(effect.duration || 1) * 2;
      case "burn": return 17;
      case "discard_random": return 13;
      case "return_from_discard": return 11;
      case "repair": return 7;
      case "cleanse": return Object.keys(actor.statuses || {}).length ? 13 : 2;
      case "status": {
        if (effect.statusId === "strength") return 15 + Number(effect.stacks || 1) * 5;
        if (effect.statusId === "vulnerable") return 14;
        if (effect.statusId === "weak") return 12;
        if (effect.statusId === "regeneration") return low ? 18 : 10;
        if (effect.statusId === "discount") return 13;
        if (effect.statusId === "burn") return 12;
        return 8;
      }
      case "noop": return -60;
      default: return 0;
    }
  }

  const ARCHETYPE_BONUS = Object.freeze({
    trickster: { steal: 20, break: 12, block: 8, discard_random: 9, status: 4 },
    aggressor: { damage: 18, status: 7, shield: -3, heal: -2 },
    controller: { block: 22, break: 18, discard_random: 14, steal: 10, status: 9 },
    combo: { energy: 20, draw: 17, return_from_discard: 18, status: 8 },
    defender: { shield: 22, heal: 20, cleanse: 13, status: 11, damage: -4 },
    chaos: { damage: 5, shield: 5, heal: 5, steal: 5, burn: 5, noop: 6 },
    boss: { damage: 11, shield: 9, heal: 8, steal: 10, block: 10, break: 10, status: 10 }
  });

  function scoreCard(state, card, dealer, options) {
    const definition = definitionFor(state, card);
    if (!definition || card.blockedFor > 0) return -Infinity;
    const context = publicSnapshot(state);
    const bonuses = ARCHETYPE_BONUS[dealer.archetype] || {};
    let score = 0;
    (definition.effects || []).forEach((effect) => { score += baseEffectScore(effect, context) + Number(bonuses[effect.op] || 0); });
    const tags = definition.tags || [];
    dealer.preferredTags.forEach((tag, index) => { if (tags.includes(tag)) score += Math.max(2, 10 - index); });
    if (dealer.archetype === "combo") {
      const playedTags = currentTurnTags(state);
      const overlap = tags.filter((tag) => playedTags.includes(tag)).length;
      score += overlap * 11;
      if (playedTags.length && tags.includes("draw")) score += 6;
    }
    if (dealer.archetype === "aggressor" && context.player.shield > 8 && tags.includes("vulnerable")) score += 12;
    if (dealer.archetype === "defender" && context.dealer.hp / context.dealer.maxHp > .8 && definition.type === "attack") score += 8;
    if (dealer.archetype === "boss" && context.dealer.hp / context.dealer.maxHp <= .5 && tags.includes("finisher")) score += 18;
    const cost = effectiveCost(state, card, options && options.engine);
    score -= cost * 2.2;
    score += unit(`${state.seed}:${state.turn}:${dealer.id}:${card.instanceId}:jitter`) * (dealer.archetype === "chaos" ? 22 : 2.5);
    return score;
  }

  function chooseCard(state, dealer, options) {
    if (!state || !dealer || !state.actors || !state.actors.dealer) return null;
    const actor = state.actors.dealer;
    const energy = options && options.assumeNextTurn ? actor.maxEnergy : actor.energy;
    const candidates = actor.hand.filter((card) => card.blockedFor <= 0 && effectiveCost(state, card, options && options.engine) <= energy);
    if (!candidates.length) return null;
    const ranked = candidates.map((card) => ({ card, score: scoreCard(state, card, dealer, options) })).sort((first, second) => second.score - first.score || first.card.instanceId.localeCompare(second.card.instanceId));
    const roll = unit(`${state.seed}:${state.turn}:${dealer.id}:${ranked.map((entry) => entry.card.instanceId).join(",")}:mistake`);
    if (dealer.mistakeRate > 0 && roll < dealer.mistakeRate && ranked.length > 1) {
      const depth = Math.min(ranked.length - 1, dealer.difficulty <= 1 ? 2 : 1);
      return ranked[depth].card;
    }
    return ranked[0].card;
  }

  function intentFor(state, dealer, options) {
    const card = chooseCard(state, dealer, Object.assign({}, options, { assumeNextTurn: true }));
    if (!card) return { card: null, title: "ПАСУЕТ", text: "У дилера нет доступных карт." };
    const definition = definitionFor(state, card);
    const effects = definition.effects || [];
    const damage = effects.find((effect) => effect.op === "damage" && effect.target !== "self");
    const shield = effects.find((effect) => effect.op === "shield");
    const heal = effects.find((effect) => effect.op === "heal");
    const steal = effects.some((effect) => effect.op === "steal");
    const control = effects.some((effect) => ["block", "break", "discard_random", "burn"].includes(effect.op));
    if (steal) return { card, title: "КРАДЁТ КАРТУ", text: "Попробует забрать одну из твоих карт." };
    if (damage) return { card, title: "АТАКУЕТ", text: `Ожидаемый базовый урон: ${damage.amount}.` };
    if (control) return { card, title: "МЕШАЕТ ИГРАТЬ", text: "Готовит блокировку, поломку или сброс карты." };
    if (shield || heal) return { card, title: "УКРЕПЛЯЕТСЯ", text: shield ? `Может получить ${shield.amount} щита.` : `Может восстановить ${heal.amount} здоровья.` };
    return { card, title: "ГОТОВИТ КОМБИНАЦИЮ", text: definition.name };
  }

  return Object.freeze({ publicSnapshot, definitionFor, effectiveCost, scoreCard, chooseCard, intentFor });
});
