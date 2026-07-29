"use strict";
(function () {
  const Engine = window.BitayaMastBattle;
  const TimerSettings = window.BitayaMastTimerSettings;
  const CARDS = window.BitayaMastCards;
  const ASSETS = window.BitayaMastAssets || {};
  if (!Engine || !TimerSettings || !CARDS) throw new Error("Не загружены модули боя, таймера или карты.");
  if (ASSETS.dealer) document.documentElement.style.setProperty("--dealer-scene", `url("${ASSETS.dealer}")`);

  const SAVE_KEY = "bitaya-mast-stage3-battle-v2";
  const LEGACY_SAVE_KEY = "bitaya-mast-stage2-battle-v1";
  const SETTINGS_KEY = "bitaya-mast-stage3-settings-v1";
  const ENVELOPE_VERSION = 2;
  const cardMeta = Object.fromEntries(CARDS.map((card) => [card.id, card]));
  const statusNames = { strength: "Сила", vulnerable: "Уязвимость", weak: "Слабость", discount: "Скидка", burn: "Ожог", regeneration: "Регенерация", thorns: "Шипы" };
  const memoryStore = new Map();
  const storage = {
    get(key) {
      try { return localStorage.getItem(key); } catch (error) { return memoryStore.get(key) || null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (error) { memoryStore.set(key, value); }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (error) { memoryStore.delete(key); }
    },
  };

  let state = null;
  let settings = TimerSettings.migrate(readJson(SETTINGS_KEY));
  let busy = false;
  let endingTurn = false;
  let timerLeft = settings.seconds;
  let timerTurn = null;
  let timerId = null;
  let lastEventSeq = 0;
  let selectedCardId = null;
  let setupHasActiveBattle = false;

  const $ = (selector) => document.querySelector(selector);
  const dom = {
    app: $("#app"), scene: $("#scene"), hand: $("#hand"), dealerHand: $("#dealerHand"), playerHud: $("#playerHud"), dealerHud: $("#dealerHud"),
    playerHp: $("#playerHp"), playerShield: $("#playerShield"), playerEnergy: $("#playerEnergy"), playerHpBar: $("#playerHpBar"), playerShieldBar: $("#playerShieldBar"), playerEnergyPips: $("#playerEnergyPips"), playerStatuses: $("#playerStatuses"),
    dealerHp: $("#dealerHp"), dealerShield: $("#dealerShield"), dealerEnergy: $("#dealerEnergy"), dealerHpBar: $("#dealerHpBar"), dealerShieldBar: $("#dealerShieldBar"), dealerEnergyPips: $("#dealerEnergyPips"), dealerStatuses: $("#dealerStatuses"),
    round: $("#roundValue"), turn: $("#turnValue"), draw: $("#drawCount"), discard: $("#discardCount"), dealerQuote: $("#dealerQuote"), intentTitle: $("#intentTitle"), intentText: $("#intentText"),
    timer: $("#timerValue"), timerBox: $("#timerBox"), timerProgress: $("#timerProgress"), timerMode: $("#timerMode"), timerPenalty: $("#timerPenalty"), endTurn: $("#endTurnButton"), log: $("#battleLog"), float: $("#floatingMessage"),
    overlay: $("#resultOverlay"), resultTitle: $("#resultTitle"), resultText: $("#resultText"), setup: $("#setupOverlay"), setupPanel: $("#setupPanel"), setupCancel: $("#setupCancel"), setupStart: $("#setupStart"),
    customSeconds: $("#customSeconds"), customSecondsNumber: $("#customSecondsNumber"), customRow: $("#customTimerRow"), penaltyFieldset: $("#penaltyFieldset"), setupSummary: $("#setupSummary"),
  };

  function readJson(key) {
    const raw = storage.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (error) { return null; }
  }

  function seed() {
    const values = new Uint32Array(1);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(values);
    else values[0] = Date.now() >>> 0;
    return values[0] || 1337;
  }

  function battleConfig() {
    const playerDeck = ["ace_clubs", "ace_clubs", "cleaning_card", "cleaning_card", "bank_card", "troika_pass", "brick", "red_pill", "loyalty_card", "empty_discount"];
    const dealerDeck = ["headshot", "ace_clubs", "brick", "brick", "bank_card", "cleaning_card", "marked_card", "loyalty_card", "empty_discount", "red_pill"];
    const battleSeed = seed();
    return {
      battleId: `slice-${battleSeed}`,
      seed: battleSeed,
      cards: CARDS,
      rules: { handSize: 5, maxHandSize: 10, shieldResetsEachTurn: true },
      player: { name: "Игрок", maxHp: 50, maxEnergy: 3, deck: playerDeck },
      dealer: { name: "Шулер", maxHp: 48, maxEnergy: 3, deck: dealerDeck },
    };
  }

  function saveSettings() {
    storage.set(SETTINGS_KEY, JSON.stringify(settings));
  }

  function saveBattle() {
    if (!state) return;
    const envelope = {
      envelopeVersion: ENVELOPE_VERSION,
      state,
      settings,
      timer: {
        left: timerLeft,
        turn: timerTurn,
      },
      lastEventSeq,
      savedAt: Date.now(),
    };
    storage.set(SAVE_KEY, JSON.stringify(envelope));
  }

  function loadBattle() {
    const current = readJson(SAVE_KEY);
    if (current && current.state) {
      try {
        state = Engine.migrateSave(current.state);
        settings = TimerSettings.migrate(current.settings || settings);
        lastEventSeq = Math.max(0, Number(current.lastEventSeq || 0));
        timerTurn = current.timer && Number.isFinite(Number(current.timer.turn)) ? Number(current.timer.turn) : state.turn;
        timerLeft = current.timer && Number.isFinite(Number(current.timer.left))
          ? Math.max(0, Math.min(settings.seconds || 0, Number(current.timer.left)))
          : settings.seconds;
        saveSettings();
        return true;
      } catch (error) {
        console.warn("Текущее сохранение боя повреждено", error);
        storage.remove(SAVE_KEY);
      }
    }

    const legacy = readJson(LEGACY_SAVE_KEY);
    if (legacy) {
      try {
        state = Engine.migrateSave(legacy.state || legacy);
        settings = TimerSettings.normalize({ mode: TimerSettings.MODES.CUSTOM, seconds: 45, penalty: TimerSettings.PENALTIES.END_TURN });
        timerLeft = settings.seconds;
        timerTurn = state.turn;
        lastEventSeq = Math.max(0, Number(legacy.lastEventSeq || 0));
        saveSettings();
        saveBattle();
        storage.remove(LEGACY_SAVE_KEY);
        announce("СОХРАНЕНИЕ ОБНОВЛЕНО");
        return true;
      } catch (error) {
        console.warn("Старое сохранение не удалось перенести", error);
        storage.remove(LEGACY_SAVE_KEY);
      }
    }
    return false;
  }

  function createBattle() {
    stopTimer();
    state = Engine.createBattle(battleConfig());
    timerLeft = settings.seconds;
    timerTurn = state.turn;
    lastEventSeq = 0;
    busy = false;
    endingTurn = false;
    selectedCardId = null;
    dom.overlay.hidden = true;
    saveSettings();
    saveBattle();
    render(true);
    startTimer(true);
    announce("НОВАЯ СДАЧА");
  }

  function execute(command) {
    const result = Engine.executeCommand(state, command);
    state = result.state;
    animateEvents(result.events);
    saveBattle();
    return result.events;
  }

  function createSegments(container, ratio, count) {
    container.replaceChildren();
    const active = Math.ceil(Math.max(0, Math.min(1, ratio)) * count);
    for (let index = 0; index < count; index += 1) {
      const segment = document.createElement("i");
      if (index < active) segment.className = "on";
      container.append(segment);
    }
  }

  function createEnergy(container, current, maximum) {
    container.replaceChildren();
    for (let index = 0; index < Math.max(3, maximum); index += 1) {
      const pip = document.createElement("i");
      if (index < current) pip.className = "on";
      container.append(pip);
    }
  }

  function renderStatuses(container, statuses) {
    container.replaceChildren();
    Object.entries(statuses || {}).forEach(([id, status]) => {
      const chip = document.createElement("span");
      chip.className = "status-chip";
      chip.textContent = `${statusNames[id] || id}: ${status.stacks}`;
      container.append(chip);
    });
  }

  function renderActor(actor, prefix) {
    dom[`${prefix}Hp`].textContent = `${actor.hp} / ${actor.maxHp}`;
    dom[`${prefix}Shield`].textContent = String(actor.shield);
    dom[`${prefix}Energy`].textContent = `${actor.energy} / ${actor.maxEnergy}`;
    createSegments(dom[`${prefix}HpBar`], actor.hp / actor.maxHp, 10);
    createSegments(dom[`${prefix}ShieldBar`], Math.min(1, actor.shield / 20), 10);
    createEnergy(dom[`${prefix}EnergyPips`], actor.energy, actor.maxEnergy);
    renderStatuses(dom[`${prefix}Statuses`], actor.statuses);
  }

  function cardDescription(card) {
    const meta = cardMeta[card.definitionId];
    const definition = state.cardCatalog[card.definitionId];
    return { meta, definition, cost: Engine.effectiveCost(state, card.owner, card) };
  }

  function renderHand(initial) {
    const player = state.actors.player;
    const previous = new Map(Array.from(dom.hand.children).map((node) => [node.dataset.instanceId, node]));
    const fragment = document.createDocumentFragment();
    const count = player.hand.length;
    player.hand.forEach((card, index) => {
      const info = cardDescription(card);
      let button = previous.get(card.instanceId);
      if (!button) button = document.createElement("button");
      button.type = "button";
      button.className = "game-card";
      if (card.brokenFor > 0) button.classList.add("broken");
      if (card.blockedFor > 0) button.classList.add("blocked");
      if (selectedCardId === card.instanceId) button.classList.add("selected");
      button.dataset.instanceId = card.instanceId;
      button.dataset.type = info.definition.type;
      button.style.setProperty("--angle", `${(index - (count - 1) / 2) * 4.2}deg`);
      button.style.setProperty("--lift", `${Math.abs(index - (count - 1) / 2) * 4}px`);
      button.style.zIndex = String(index + 1);
      button.disabled = busy || endingTurn || state.phase !== Engine.PHASES.PLAYER || card.blockedFor > 0 || player.energy < info.cost;
      button.setAttribute("aria-label", `${info.meta.name}. Стоимость ${info.cost}. ${info.meta.short}`);
      button.innerHTML = `<span class="card-header"><b class="card-cost">${info.cost}</b><strong class="card-name">${escapeHtml(info.meta.name)}</strong></span><span class="card-art" style="background-image:url('${ASSETS[info.meta.art] || ""}')"><i class="card-stat">${escapeHtml(info.meta.stat)}</i></span><span class="card-body">${escapeHtml(info.meta.short)}<br><small>${escapeHtml(info.meta.lore)}</small></span><span class="card-rarity">${rarityName(info.definition.rarity)}</span>`;
      button.onclick = (event) => onCardClick(card.instanceId, event.currentTarget);
      fragment.append(button);
      if (initial && !previous.has(card.instanceId)) {
        button.animate(
          [{ opacity: 0, transform: "translateY(130px) rotate(12deg)" }, { opacity: 1 }],
          { duration: 420 + index * 55, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }
        );
      }
    });
    dom.hand.replaceChildren(fragment);
  }

  function renderDealerHand() {
    dom.dealerHand.replaceChildren();
    const count = state.actors.dealer.hand.length;
    for (let index = 0; index < Math.min(7, count); index += 1) {
      const back = document.createElement("i");
      back.className = "dealer-card-back";
      back.style.transform = `translateX(-50%) rotate(${(index - (count - 1) / 2) * 11}deg) translateY(${Math.abs(index - (count - 1) / 2) * 3}px)`;
      back.style.zIndex = String(index);
      dom.dealerHand.append(back);
    }
  }

  function rarityName(value) {
    return ({ common: "обычная", uncommon: "необычная", rare: "редкая", epic: "эпическая", legendary: "легендарная", curse: "проклятие" })[value] || value;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function dealerChoice(assumeNextTurn) {
    const dealer = state.actors.dealer;
    const availableEnergy = assumeNextTurn ? dealer.maxEnergy : dealer.energy;
    const affordable = dealer.hand.filter((card) => card.blockedFor <= 0 && Engine.effectiveCost(state, "dealer", card) <= availableEnergy);
    if (!affordable.length) return null;
    return affordable.sort((first, second) => scoreCard(second, dealer) - scoreCard(first, dealer))[0];
  }

  function scoreCard(card, actor) {
    const definition = state.cardCatalog[card.definitionId];
    let score = 0;
    definition.effects.forEach((effect) => {
      if (effect.op === "damage") score += effect.amount * 4;
      if (effect.op === "shield") score += effect.amount * (actor.hp < actor.maxHp * .55 ? 2.4 : .8);
      if (effect.op === "heal") score += effect.amount * (actor.hp < actor.maxHp * .55 ? 3 : .4);
      if (["steal", "burn", "break", "block"].includes(effect.op)) score += 15;
      if (effect.op === "status") score += 8;
      if (effect.op === "noop") score -= 50;
    });
    score -= Engine.effectiveCost(state, "dealer", card) * 1.5;
    return score;
  }

  function renderIntent() {
    if (state.phase === Engine.PHASES.FINISHED) {
      dom.intentTitle.textContent = "БОЙ ОКОНЧЕН";
      dom.intentText.textContent = "Долги пересчитаны.";
      return;
    }
    const choice = dealerChoice(state.phase !== Engine.PHASES.DEALER);
    if (!choice) {
      dom.intentTitle.textContent = "ПАСУЕТ";
      dom.intentText.textContent = "У дилера нет доступных карт.";
      return;
    }
    const meta = cardMeta[choice.definitionId];
    const effects = state.cardCatalog[choice.definitionId].effects;
    const damage = effects.find((item) => item.op === "damage");
    const steal = effects.some((item) => item.op === "steal");
    const shield = effects.find((item) => item.op === "shield");
    dom.intentTitle.textContent = steal ? "КРАДЁТ КАРТУ" : damage ? "АТАКУЕТ" : shield ? "ЗАЩИЩАЕТСЯ" : "ГОТОВИТ ПРИЁМ";
    dom.intentText.textContent = steal ? "Попробует забрать карту из твоей руки." : damage ? `Возможный урон: ${damage.amount}.` : shield ? `Получит до ${shield.amount} щита.` : meta.short;
  }

  function renderTimer() {
    const penalty = TimerSettings.PENALTY_DETAILS[settings.penalty];
    dom.timerMode.textContent = TimerSettings.PRESETS[settings.mode].title.toUpperCase();
    dom.timerPenalty.textContent = settings.timerEnabled ? penalty.title : "Время не ограничено";
    dom.timerBox.classList.toggle("no-timer", !settings.timerEnabled);
    if (!settings.timerEnabled) {
      dom.timer.textContent = "∞";
      dom.timerProgress.style.transform = "scaleX(0)";
      dom.timerBox.classList.remove("warning", "critical");
      dom.app.classList.remove("time-critical");
      return;
    }
    dom.timer.textContent = TimerSettings.formatClock(timerLeft);
    dom.timerProgress.style.transform = `scaleX(${Math.max(0, timerLeft / settings.seconds)})`;
    dom.timerBox.classList.toggle("warning", timerLeft <= 10);
    dom.timerBox.classList.toggle("critical", timerLeft <= 5);
    dom.app.classList.toggle("time-critical", timerLeft <= 5 && state.phase === Engine.PHASES.PLAYER);
  }

  function render(initial) {
    if (!state) return;
    const player = state.actors.player;
    const dealer = state.actors.dealer;
    renderActor(player, "player");
    renderActor(dealer, "dealer");
    dom.playerHud.classList.toggle("player-low", player.hp / player.maxHp <= .3);
    dom.scene.classList.toggle("dealer-low", dealer.hp / dealer.maxHp <= .35 && !state.winner);
    dom.dealerQuote.textContent = dealer.hp / dealer.maxHp <= .35 ? "«Рано радуешься. Долг ещё не закрыт»" : "«В каждой игре я знаю, где у тебя слабое место»";
    dom.round.textContent = state.round;
    dom.turn.textContent = state.phase === Engine.PHASES.PLAYER ? "ИГРОКА" : state.phase === Engine.PHASES.DEALER ? "ДИЛЕРА" : "КОНЕЦ";
    dom.turn.style.color = state.phase === Engine.PHASES.PLAYER ? "var(--green)" : "var(--red)";
    dom.draw.textContent = player.drawPile.length;
    dom.discard.textContent = player.discardPile.length;
    dom.endTurn.disabled = busy || endingTurn || state.phase !== Engine.PHASES.PLAYER;
    renderHand(initial);
    renderDealerHand();
    renderIntent();
    renderTimer();
    renderLog();
    if (state.phase === Engine.PHASES.FINISHED) showResult();
  }

  async function onCardClick(instanceId, element) {
    if (busy || endingTurn || state.phase !== Engine.PHASES.PLAYER) return;
    selectedCardId = instanceId;
    renderHand(false);
    busy = true;
    stopTimer();
    try {
      await cardFlight(element, "50vw", "38vh");
      execute({ type: "playCard", actorId: "player", cardInstanceId: instanceId });
      selectedCardId = null;
      render(false);
    } catch (error) {
      announce(error.message || "КАРТА НЕ СЫГРАЛА");
    } finally {
      busy = false;
      render(false);
      if (state.phase === Engine.PHASES.PLAYER && !state.winner) startTimer(false);
    }
  }

  function cardFlight(element, targetX, targetY) {
    return new Promise((resolve) => {
      const rect = element.getBoundingClientRect();
      const ghost = element.cloneNode(true);
      ghost.className = `${element.className} card-ghost`;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      document.body.append(ghost);
      requestAnimationFrame(() => {
        ghost.style.transform = `translate(calc(${targetX} - ${rect.left + rect.width / 2}px), calc(${targetY} - ${rect.top + rect.height / 2}px)) rotate(0deg) scale(.72)`;
        ghost.style.opacity = ".1";
      });
      setTimeout(() => { ghost.remove(); resolve(); }, 350);
    });
  }

  async function endPlayerTurn(options) {
    const timedOut = Boolean(options && options.timedOut);
    const capturedTurn = options && options.turn;
    if (busy || endingTurn || !state || state.phase !== Engine.PHASES.PLAYER) return;
    if (timedOut && capturedTurn !== state.turn) return;

    endingTurn = true;
    busy = true;
    stopTimer();
    try {
      if (timedOut) {
        const detail = TimerSettings.PENALTY_DETAILS[settings.penalty];
        execute({
          type: "expireTurn",
          actorId: "player",
          penalty: settings.penalty,
          amount: detail.amount,
        });
        announce(detail.announcement);
      } else {
        execute({ type: "endTurn", actorId: "player" });
        announce("ХОД ДИЛЕРА");
      }
      render(false);
      if (state.phase === Engine.PHASES.FINISHED) return;
      await sleep(650);
      await dealerTurn();
    } catch (error) {
      console.error(error);
      announce(error.message || "ХОД НЕ ЗАВЕРШЁН");
    } finally {
      busy = false;
      endingTurn = false;
      render(false);
      if (state.phase === Engine.PHASES.PLAYER && !state.winner) {
        announce("ТВОЙ ХОД");
        startTimer(true);
      }
    }
  }

  async function dealerTurn() {
    let safety = 0;
    while (state.phase === Engine.PHASES.DEALER && !state.winner && safety < 8) {
      const card = dealerChoice(false);
      if (!card) break;
      dom.dealerHand.classList.add("playing");
      await sleep(320);
      const meta = cardMeta[card.definitionId];
      announce(meta.name.toUpperCase());
      try {
        execute({ type: "playCard", actorId: "dealer", cardInstanceId: card.instanceId });
      } catch (error) {
        console.error(error);
        break;
      }
      render(false);
      dom.dealerHand.classList.remove("playing");
      await sleep(520);
      safety += 1;
    }
    if (state.phase === Engine.PHASES.DEALER && !state.winner) execute({ type: "endTurn", actorId: "dealer" });
  }

  function animateEvents(events) {
    events.forEach((event) => {
      lastEventSeq = Math.max(lastEventSeq, event.seq || 0);
      const payload = event.payload || {};
      if (event.type === "TIME_EXPIRED") {
        dom.app.classList.remove("timeout-flash");
        void dom.app.offsetWidth;
        dom.app.classList.add("timeout-flash");
      }
      if (event.type === "DAMAGE_DEALT") {
        const target = payload.targetId === "player" ? dom.playerHud : dom.dealerHud;
        target.classList.remove("hit");
        void target.offsetWidth;
        target.classList.add("hit");
        if (payload.targetId === "dealer") {
          dom.scene.classList.remove("hit");
          void dom.scene.offsetWidth;
          dom.scene.classList.add("hit");
        }
        announce(`−${payload.hpDamage || payload.amount}`);
      }
      if (event.type === "SHIELD_GAINED") {
        const target = payload.actorId === "player" ? dom.playerHud : dom.dealerHud;
        target.classList.remove("shield-flash");
        void target.offsetWidth;
        target.classList.add("shield-flash");
        announce(`ЩИТ +${payload.amount}`);
      }
      if (event.type === "HEALED" && payload.amount > 0) announce(`ЛЕЧЕНИЕ +${payload.amount}`);
      if (event.type === "CARD_STOLEN") announce("КАРТА УКРАДЕНА");
      if (event.type === "CARD_BROKEN") announce("КАРТА СЛОМАНА");
      if (event.type === "CARD_BURNED") announce("КАРТА СГОРЕЛА");
      if (event.type === "CARD_DISCARDED" && payload.reason === "timeout") announce("СЛУЧАЙНЫЙ СБРОС");
      if (event.type === "ENERGY_CHANGED" && payload.source === "timeout") announce(`ДИЛЕРУ +${payload.amount} ЭНЕРГИЯ`);
    });
  }

  function renderLog() {
    const events = state.eventLog.slice(-8).reverse();
    dom.log.replaceChildren(...events.map((event) => {
      const line = document.createElement("div");
      line.className = "log-line";
      const text = ({
        CARD_PLAYED: "сыграна карта",
        DAMAGE_DEALT: "нанесён урон",
        SHIELD_GAINED: "получен щит",
        HEALED: "восстановлено здоровье",
        CARD_STOLEN: "украдена карта",
        CARD_BROKEN: "сломана карта",
        CARD_DISCARDED: "карта сброшена",
        ENERGY_CHANGED: "изменена энергия",
        TIME_EXPIRED: "истекло время",
        TURN_STARTED: "начался ход",
        BATTLE_FINISHED: "бой окончен",
      })[event.type] || event.type.toLowerCase().replaceAll("_", " ");
      line.innerHTML = `<b>${event.seq}</b> ${escapeHtml(text)}`;
      return line;
    }));
  }

  function announce(text) {
    if (!dom.float) return;
    dom.float.textContent = text;
    dom.float.classList.remove("show");
    void dom.float.offsetWidth;
    dom.float.classList.add("show");
  }

  function showResult() {
    stopTimer();
    const won = state.winner === "player";
    dom.resultTitle.textContent = won ? "ПОБЕДА" : state.winner === "draw" ? "НИЧЬЯ" : "ДОЛГ ВЗЫСКАН";
    dom.resultText.textContent = won
      ? `Шулер проиграл. Осталось здоровья: ${state.actors.player.hp}. Режим: ${TimerSettings.describe(settings)}.`
      : `Забег окончен. Режим: ${TimerSettings.describe(settings)}.`;
    dom.overlay.hidden = false;
  }

  function startTimer(reset) {
    stopTimer();
    if (!state || state.phase !== Engine.PHASES.PLAYER || state.winner) return;
    if (!settings.timerEnabled) {
      timerLeft = 0;
      timerTurn = state.turn;
      renderTimer();
      saveBattle();
      return;
    }
    if (reset || timerTurn !== state.turn || timerLeft <= 0 || timerLeft > settings.seconds) {
      timerLeft = settings.seconds;
      timerTurn = state.turn;
    }
    renderTimer();
    saveBattle();
    const capturedTurn = state.turn;
    timerId = window.setInterval(() => {
      if (document.hidden || busy || endingTurn || state.phase !== Engine.PHASES.PLAYER || state.turn !== capturedTurn) return;
      timerLeft -= 1;
      renderTimer();
      saveBattle();
      if (timerLeft <= 0) {
        stopTimer();
        endPlayerTurn({ timedOut: true, turn: capturedTurn });
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
    if (state) saveBattle();
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function selectedSetupSettings() {
    const modeInput = document.querySelector('input[name="timerMode"]:checked');
    const penaltyInput = document.querySelector('input[name="timerPenalty"]:checked');
    const mode = modeInput ? modeInput.value : TimerSettings.MODES.CLASSIC;
    const seconds = Number(dom.customSecondsNumber.value || dom.customSeconds.value || 45);
    return TimerSettings.normalize({ mode, seconds, penalty: penaltyInput ? penaltyInput.value : TimerSettings.PENALTIES.END_TURN });
  }

  function syncSetupControls(nextSettings) {
    const normalized = TimerSettings.normalize(nextSettings);
    const modeInput = document.querySelector(`input[name="timerMode"][value="${normalized.mode}"]`);
    const penaltyInput = document.querySelector(`input[name="timerPenalty"][value="${normalized.penalty}"]`);
    if (modeInput) modeInput.checked = true;
    if (penaltyInput) penaltyInput.checked = true;
    dom.customSeconds.value = normalized.seconds || 45;
    dom.customSecondsNumber.value = normalized.seconds || 45;
    dom.customRow.hidden = normalized.mode !== TimerSettings.MODES.CUSTOM;
    dom.penaltyFieldset.disabled = normalized.mode === TimerSettings.MODES.CLASSIC;
    dom.setupSummary.textContent = TimerSettings.describe(normalized);
    dom.setupStart.textContent = setupHasActiveBattle ? "НАЧАТЬ НОВУЮ СДАЧУ" : "СЕСТЬ ЗА СТОЛ";
  }

  function openSetup(canCancel) {
    stopTimer();
    setupHasActiveBattle = Boolean(canCancel && state && state.phase !== Engine.PHASES.FINISHED);
    dom.setupCancel.hidden = !setupHasActiveBattle;
    syncSetupControls(settings);
    dom.setup.hidden = false;
    dom.setupPanel.focus();
  }

  function closeSetup() {
    dom.setup.hidden = true;
    if (state && state.phase === Engine.PHASES.PLAYER && !state.winner) startTimer(false);
  }

  function startFromSetup() {
    settings = selectedSetupSettings();
    saveSettings();
    dom.setup.hidden = true;
    storage.remove(SAVE_KEY);
    createBattle();
  }

  function bindSetup() {
    document.querySelectorAll('input[name="timerMode"]').forEach((input) => {
      input.addEventListener("change", () => syncSetupControls(selectedSetupSettings()));
    });
    document.querySelectorAll('input[name="timerPenalty"]').forEach((input) => {
      input.addEventListener("change", () => syncSetupControls(selectedSetupSettings()));
    });
    dom.customSeconds.addEventListener("input", () => {
      dom.customSecondsNumber.value = dom.customSeconds.value;
      syncSetupControls(selectedSetupSettings());
    });
    dom.customSecondsNumber.addEventListener("input", () => {
      const value = Math.max(TimerSettings.MIN_SECONDS, Math.min(TimerSettings.MAX_SECONDS, Number(dom.customSecondsNumber.value || 45)));
      dom.customSeconds.value = value;
      syncSetupControls(selectedSetupSettings());
    });
    dom.setupStart.addEventListener("click", startFromSetup);
    dom.setupCancel.addEventListener("click", closeSetup);
  }

  dom.endTurn.addEventListener("click", () => endPlayerTurn({ timedOut: false }));
  $("#restartButton").addEventListener("click", () => openSetup(true));
  $("#settingsButton").addEventListener("click", () => openSetup(true));
  $("#resultRestart").addEventListener("click", () => { dom.overlay.hidden = true; createBattle(); });
  $("#resultSettings").addEventListener("click", () => { dom.overlay.hidden = true; openSetup(false); });
  $("#helpButton").addEventListener("click", () => $("#helpDialog").showModal());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.repeat && !$("#helpDialog").open && dom.setup.hidden) {
      event.preventDefault();
      endPlayerTurn({ timedOut: false });
    }
    if (/^Digit[1-9]$/.test(event.code) && state && state.phase === Engine.PHASES.PLAYER && dom.setup.hidden) {
      const index = Number(event.code.slice(-1)) - 1;
      const card = state.actors.player.hand[index];
      const element = dom.hand.children[index];
      if (card && element && !element.disabled) onCardClick(card.instanceId, element);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopTimer();
    else if (state && state.phase === Engine.PHASES.PLAYER && dom.setup.hidden) startTimer(false);
  });
  window.addEventListener("beforeunload", saveBattle);
  bindSetup();

  const restored = loadBattle();
  if (restored) {
    render(true);
    if (state.phase === Engine.PHASES.DEALER && !state.winner) {
      busy = true;
      dealerTurn().finally(() => {
        busy = false;
        render(false);
        if (state.phase === Engine.PHASES.PLAYER) startTimer(true);
      });
    } else if (state.phase === Engine.PHASES.PLAYER) {
      startTimer(false);
    }
  } else {
    state = Engine.createBattle(battleConfig());
    render(true);
    openSetup(false);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
  }
})();
