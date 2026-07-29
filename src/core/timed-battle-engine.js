"use strict";

(function (root, factory) {
  const base = typeof module === "object" && module.exports
    ? require("./battle-engine.js")
    : root.BitayaMastBattle;
  const api = factory(base);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.BitayaMastBattle = api;
    root.BitayaMastTimedBattle = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Base) {
  if (!Base) throw new Error("Timed battle engine requires BitayaMastBattle.");

  const TIMEOUT_PENALTIES = Object.freeze({
    END_TURN: "end_turn",
    DISCARD_RANDOM: "discard_random",
    DAMAGE: "damage",
    DEALER_ENERGY: "dealer_energy",
  });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function integer(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }

  function assert(condition, code, message, details) {
    if (!condition) throw new Base.BattleRuleError(code, message, details);
  }

  function otherSide(side) {
    return side === Base.SIDES.PLAYER ? Base.SIDES.DEALER : Base.SIDES.PLAYER;
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

  function nextRandom(state) {
    let x = state.rngState >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state.rngState = x >>> 0;
    return (state.rngState >>> 0) / 4294967296;
  }

  function chooseRandomHandCard(state, actor) {
    if (!actor.hand.length) return null;
    const index = Math.floor(nextRandom(state) * actor.hand.length);
    return { index, card: actor.hand[index] };
  }

  function finishIfNeeded(state) {
    const playerDead = state.actors.player.hp <= 0;
    const dealerDead = state.actors.dealer.hp <= 0;
    if (!playerDead && !dealerDead) return false;
    state.phase = Base.PHASES.FINISHED;
    state.winner = playerDead && dealerDead
      ? "draw"
      : playerDead
        ? Base.SIDES.DEALER
        : Base.SIDES.PLAYER;
    emit(state, "BATTLE_FINISHED", { winner: state.winner });
    return true;
  }

  function applyDiscardPenalty(state, actorId) {
    const actor = state.actors[actorId];
    const selected = chooseRandomHandCard(state, actor);
    if (!selected) {
      emit(state, "TIMEOUT_PENALTY_SKIPPED", { actorId, penalty: TIMEOUT_PENALTIES.DISCARD_RANDOM, reason: "EMPTY_HAND" });
      return null;
    }
    const card = actor.hand.splice(selected.index, 1)[0];
    actor.discardPile.push(card);
    emit(state, "CARD_DISCARDED", {
      actorId,
      cardInstanceId: card.instanceId,
      definitionId: card.definitionId,
      reason: "timeout",
    });
    return card;
  }

  function applyDamagePenalty(state, actorId, amount) {
    const actor = state.actors[actorId];
    const damage = Math.max(1, integer(amount, 3));
    const blocked = Math.min(actor.shield, damage);
    actor.shield -= blocked;
    const hpDamage = damage - blocked;
    actor.hp = Math.max(0, actor.hp - hpDamage);
    actor.stats.damageTaken += hpDamage;
    emit(state, "DAMAGE_DEALT", {
      sourceId: actorId,
      targetId: actorId,
      amount: damage,
      blocked,
      hpDamage,
      source: "timeout",
    });
    finishIfNeeded(state);
    return hpDamage;
  }

  function expireTurn(inputState, command) {
    const state = clone(inputState);
    const actorId = command.actorId;
    const expected = state.phase === Base.PHASES.PLAYER ? Base.SIDES.PLAYER : Base.SIDES.DEALER;
    assert(state.phase !== Base.PHASES.FINISHED, "BATTLE_FINISHED", "Бой уже завершён.");
    assert(actorId === expected, "NOT_ACTOR_TURN", `Сейчас ход стороны: ${expected}.`, { actorId, expected });

    const penalty = Object.values(TIMEOUT_PENALTIES).includes(command.penalty)
      ? command.penalty
      : TIMEOUT_PENALTIES.END_TURN;
    const beforeEvents = state.eventLog.length;
    const logged = clone(command);
    logged.type = "expireTurn";
    logged.penalty = penalty;
    logged.index = state.commandLog.length;
    logged.preHash = Base.stateHash(state);

    emit(state, "TIME_EXPIRED", { actorId, penalty });

    if (penalty === TIMEOUT_PENALTIES.DISCARD_RANDOM) {
      applyDiscardPenalty(state, actorId);
    } else if (penalty === TIMEOUT_PENALTIES.DAMAGE) {
      applyDamagePenalty(state, actorId, command.amount);
    }

    let finalState = state;
    if (finalState.phase !== Base.PHASES.FINISHED) {
      const internal = Base.executeCommand(finalState, { type: "endTurn", actorId });
      finalState = internal.state;
      finalState.commandLog.pop();

      if (penalty === TIMEOUT_PENALTIES.DEALER_ENERGY) {
        const receiverId = otherSide(actorId);
        const amount = Math.max(1, integer(command.amount, 1));
        finalState.actors[receiverId].energy += amount;
        emit(finalState, "ENERGY_CHANGED", {
          actorId: receiverId,
          amount,
          energy: finalState.actors[receiverId].energy,
          source: "timeout",
        });
      }
    }

    Base.validateState(finalState);
    logged.postHash = Base.stateHash(finalState);
    finalState.commandLog.push(logged);
    return {
      state: finalState,
      events: clone(finalState.eventLog.slice(beforeEvents)),
    };
  }

  function executeCommand(inputState, command) {
    if (command && command.type === "expireTurn") return expireTurn(inputState, command);
    return Base.executeCommand(inputState, command);
  }

  function replayBattle(initialConfig, commands) {
    let state = Base.createBattle(initialConfig);
    (commands || []).forEach((command, index) => {
      const result = executeCommand(state, command);
      state = result.state;
      if (command.postHash) {
        assert(
          Base.stateHash(state) === command.postHash,
          "REPLAY_DIVERGED",
          `Повтор разошёлся на команде ${index}.`,
          { expectedHash: command.postHash, actualHash: Base.stateHash(state) }
        );
      }
    });
    return state;
  }

  return Object.freeze(Object.assign({}, Base, {
    TIMEOUT_PENALTIES,
    executeCommand,
    replayBattle,
  }));
});
