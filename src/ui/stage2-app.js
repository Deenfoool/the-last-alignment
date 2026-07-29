"use strict";
(function () {
  const Engine = window.BitayaMastBattle;
  const CARDS = window.BitayaMastCards;
  const ASSETS = window.BitayaMastAssets || {};
  if (ASSETS.dealer) document.documentElement.style.setProperty("--dealer-scene", `url("${ASSETS.dealer}")`);
  const SAVE_KEY = "bitaya-mast-stage2-battle-v1";
  const TIMER_SECONDS = 45;
  const cardMeta = Object.fromEntries(CARDS.map((card) => [card.id, card]));
  const statusNames = { strength: "Сила", vulnerable: "Уязвимость", weak: "Слабость", discount: "Скидка", burn: "Ожог", regeneration: "Регенерация", thorns: "Шипы" };
  let state;
  let busy = false;
  let timerLeft = TIMER_SECONDS;
  let timerId = null;
  let lastEventSeq = 0;
  let selectedCardId = null;

  const $ = (selector) => document.querySelector(selector);
  const dom = {
    scene: $("#scene"), hand: $("#hand"), dealerHand: $("#dealerHand"), playerHud: $("#playerHud"), dealerHud: $("#dealerHud"),
    playerHp: $("#playerHp"), playerShield: $("#playerShield"), playerEnergy: $("#playerEnergy"), playerHpBar: $("#playerHpBar"), playerShieldBar: $("#playerShieldBar"), playerEnergyPips: $("#playerEnergyPips"), playerStatuses: $("#playerStatuses"),
    dealerHp: $("#dealerHp"), dealerShield: $("#dealerShield"), dealerEnergy: $("#dealerEnergy"), dealerHpBar: $("#dealerHpBar"), dealerShieldBar: $("#dealerShieldBar"), dealerEnergyPips: $("#dealerEnergyPips"), dealerStatuses: $("#dealerStatuses"),
    round: $("#roundValue"), turn: $("#turnValue"), draw: $("#drawCount"), discard: $("#discardCount"), dealerQuote: $("#dealerQuote"), intentTitle: $("#intentTitle"), intentText: $("#intentText"), timer: $("#timerValue"), timerBox: $("#timerBox"), timerProgress: $("#timerProgress"), endTurn: $("#endTurnButton"), log: $("#battleLog"), float: $("#floatingMessage"), overlay: $("#resultOverlay"), resultTitle: $("#resultTitle"), resultText: $("#resultText")
  };

  function seed() {
    const values = new Uint32Array(1);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(values);
    else values[0] = Date.now() >>> 0;
    return values[0] || 1337;
  }

  function battleConfig() {
    const playerDeck = ["ace_clubs", "ace_clubs", "cleaning_card", "cleaning_card", "bank_card", "troika_pass", "brick", "red_pill", "loyalty_card", "empty_discount"];
    const dealerDeck = ["headshot", "ace_clubs", "brick", "brick", "bank_card", "cleaning_card", "marked_card", "loyalty_card", "empty_discount", "red_pill"];
    return {
      battleId: `slice-${seed()}`, seed: seed(), cards: CARDS,
      rules: { handSize: 5, maxHandSize: 10, shieldResetsEachTurn: true },
      player: { name: "Игрок", maxHp: 50, maxEnergy: 3, deck: playerDeck },
      dealer: { name: "Шулер", maxHp: 48, maxEnergy: 3, deck: dealerDeck }
    };
  }

  function newBattle() {
    stopTimer();
    localStorage.removeItem(SAVE_KEY);
    state = Engine.createBattle(battleConfig());
    lastEventSeq = 0; busy = false; selectedCardId = null;
    dom.overlay.hidden = true;
    save(); render(true); startTimer();
    announce("НОВАЯ СДАЧА");
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      state = Engine.migrateSave(parsed.state || parsed);
      lastEventSeq = Math.max(0, Number(parsed.lastEventSeq || 0));
      return true;
    } catch (error) {
      console.warn("Сохранение боя сброшено", error);
      localStorage.removeItem(SAVE_KEY);
      return false;
    }
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, lastEventSeq, savedAt: Date.now() })); }
    catch (error) { console.warn("Не удалось сохранить бой", error); }
  }

  function execute(command) {
    const result = Engine.executeCommand(state, command);
    state = result.state;
    save();
    animateEvents(result.events);
    return result.events;
  }

  function createSegments(container, ratio, count) {
    container.replaceChildren();
    const active = Math.ceil(Math.max(0, Math.min(1, ratio)) * count);
    for (let i = 0; i < count; i += 1) {
      const segment = document.createElement("i");
      if (i < active) segment.className = "on";
      container.append(segment);
    }
  }

  function createEnergy(container, current, maximum) {
    container.replaceChildren();
    for (let i = 0; i < Math.max(3, maximum); i += 1) {
      const pip = document.createElement("i");
      if (i < current) pip.className = "on";
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
      button.disabled = busy || state.phase !== Engine.PHASES.PLAYER || card.blockedFor > 0 || player.energy < info.cost;
      button.setAttribute("aria-label", `${info.meta.name}. Стоимость ${info.cost}. ${info.meta.short}`);
      button.innerHTML = `<span class="card-header"><b class="card-cost">${info.cost}</b><strong class="card-name">${escapeHtml(info.meta.name)}</strong></span><span class="card-art" style="background-image:url('${ASSETS[info.meta.art] || ""}')"><i class="card-stat">${escapeHtml(info.meta.stat)}</i></span><span class="card-body">${escapeHtml(info.meta.short)}<br><small>${escapeHtml(info.meta.lore)}</small></span><span class="card-rarity">${rarityName(info.definition.rarity)}</span>`;
      button.onclick = (event) => onCardClick(card.instanceId, event.currentTarget);
      fragment.append(button);
      if (initial && !previous.has(card.instanceId)) button.animate([{ opacity: 0, transform: "translateY(130px) rotate(12deg)" }, { opacity: 1 }], { duration: 420 + index * 55, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" });
    });
    dom.hand.replaceChildren(fragment);
  }

  function renderDealerHand() {
    dom.dealerHand.replaceChildren();
    const count = state.actors.dealer.hand.length;
    for (let i = 0; i < Math.min(7, count); i += 1) {
      const back = document.createElement("i");
      back.className = "dealer-card-back";
      back.style.transform = `translateX(-50%) rotate(${(i - (count - 1) / 2) * 11}deg) translateY(${Math.abs(i - (count - 1) / 2) * 3}px)`;
      back.style.zIndex = String(i);
      dom.dealerHand.append(back);
    }
  }

  function rarityName(value) {
    return ({ common: "обычная", uncommon: "необычная", rare: "редкая", epic: "эпическая", legendary: "легендарная", curse: "проклятие" })[value] || value;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function dealerChoice(assumeNextTurn = false) {
    const dealer = state.actors.dealer;
    const availableEnergy = assumeNextTurn ? dealer.maxEnergy : dealer.energy;
    const affordable = dealer.hand.filter((card) => card.blockedFor <= 0 && Engine.effectiveCost(state, "dealer", card) <= availableEnergy);
    if (!affordable.length) return null;
    return affordable.sort((a, b) => scoreCard(b, dealer) - scoreCard(a, dealer))[0];
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
    if (state.phase === Engine.PHASES.FINISHED) { dom.intentTitle.textContent = "БОЙ ОКОНЧЕН"; dom.intentText.textContent = "Долги пересчитаны."; return; }
    const choice = dealerChoice(state.phase !== Engine.PHASES.DEALER);
    if (!choice) { dom.intentTitle.textContent = "ПАСУЕТ"; dom.intentText.textContent = "У дилера нет доступных карт."; return; }
    const meta = cardMeta[choice.definitionId];
    const effects = state.cardCatalog[choice.definitionId].effects;
    const damage = effects.find((item) => item.op === "damage");
    const steal = effects.some((item) => item.op === "steal");
    const shield = effects.find((item) => item.op === "shield");
    dom.intentTitle.textContent = steal ? "КРАДЁТ КАРТУ" : damage ? "АТАКУЕТ" : shield ? "ЗАЩИЩАЕТСЯ" : "ГОТОВИТ ПРИЁМ";
    dom.intentText.textContent = steal ? "Попробует забрать карту из твоей руки." : damage ? `Возможный урон: ${damage.amount}.` : shield ? `Получит до ${shield.amount} щита.` : meta.short;
  }

  function render(initial) {
    const player = state.actors.player, dealer = state.actors.dealer;
    renderActor(player, "player"); renderActor(dealer, "dealer");
    dom.playerHud.classList.toggle("player-low", player.hp / player.maxHp <= .3);
    dom.scene.classList.toggle("dealer-low", dealer.hp / dealer.maxHp <= .35 && !state.winner);
    dom.dealerQuote.textContent = dealer.hp / dealer.maxHp <= .35 ? "«Рано радуешься. Долг ещё не закрыт»" : "«В каждой игре я знаю, где у тебя слабое место»";
    dom.round.textContent = state.round;
    dom.turn.textContent = state.phase === Engine.PHASES.PLAYER ? "ИГРОКА" : state.phase === Engine.PHASES.DEALER ? "ДИЛЕРА" : "КОНЕЦ";
    dom.turn.style.color = state.phase === Engine.PHASES.PLAYER ? "var(--green)" : "var(--red)";
    dom.draw.textContent = player.drawPile.length;
    dom.discard.textContent = player.discardPile.length;
    dom.endTurn.disabled = busy || state.phase !== Engine.PHASES.PLAYER;
    renderHand(initial); renderDealerHand(); renderIntent(); renderLog();
    if (state.phase === Engine.PHASES.FINISHED) showResult();
  }

  async function onCardClick(instanceId, element) {
    if (busy || state.phase !== Engine.PHASES.PLAYER) return;
    selectedCardId = instanceId; renderHand(false);
    busy = true; stopTimer();
    try {
      await cardFlight(element, "50vw", "38vh");
      execute({ type: "playCard", actorId: "player", cardInstanceId: instanceId });
      selectedCardId = null; render(false);
      if (state.phase === Engine.PHASES.PLAYER && state.winner == null) startTimer(false);
    } catch (error) { announce(error.message || "КАРТА НЕ СЫГРАЛА"); }
    finally { busy = false; render(false); }
  }

  function cardFlight(element, targetX, targetY) {
    return new Promise((resolve) => {
      const rect = element.getBoundingClientRect();
      const ghost = element.cloneNode(true);
      ghost.className = `${element.className} card-ghost`;
      ghost.style.left = `${rect.left}px`; ghost.style.top = `${rect.top}px`; ghost.style.width = `${rect.width}px`; ghost.style.height = `${rect.height}px`;
      document.body.append(ghost);
      requestAnimationFrame(() => { ghost.style.transform = `translate(calc(${targetX} - ${rect.left + rect.width / 2}px), calc(${targetY} - ${rect.top + rect.height / 2}px)) rotate(0deg) scale(.72)`; ghost.style.opacity = ".1"; });
      setTimeout(() => { ghost.remove(); resolve(); }, 350);
    });
  }

  async function endPlayerTurn() {
    if (busy || state.phase !== Engine.PHASES.PLAYER) return;
    busy = true; stopTimer();
    execute({ type: "endTurn", actorId: "player" }); render(false);
    announce("ХОД ДИЛЕРА");
    await sleep(650);
    await dealerTurn();
    busy = false; render(false);
    if (state.phase === Engine.PHASES.PLAYER) { announce("ТВОЙ ХОД"); startTimer(); }
  }

  async function dealerTurn() {
    let safety = 0;
    while (state.phase === Engine.PHASES.DEALER && !state.winner && safety < 6) {
      const card = dealerChoice();
      if (!card) break;
      dom.dealerHand.classList.add("playing");
      await sleep(320);
      const meta = cardMeta[card.definitionId];
      announce(meta.name.toUpperCase());
      try { execute({ type: "playCard", actorId: "dealer", cardInstanceId: card.instanceId }); }
      catch (error) { console.error(error); break; }
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
      if (event.type === "DAMAGE_DEALT") {
        const target = payload.targetId === "player" ? dom.playerHud : dom.dealerHud;
        target.classList.remove("hit"); void target.offsetWidth; target.classList.add("hit");
        if (payload.targetId === "dealer") { dom.scene.classList.remove("hit"); void dom.scene.offsetWidth; dom.scene.classList.add("hit"); }
        announce(`−${payload.hpDamage || payload.amount}`);
      }
      if (event.type === "SHIELD_GAINED") {
        const target = payload.actorId === "player" ? dom.playerHud : dom.dealerHud;
        target.classList.remove("shield-flash"); void target.offsetWidth; target.classList.add("shield-flash"); announce(`ЩИТ +${payload.amount}`);
      }
      if (event.type === "HEALED" && payload.amount > 0) announce(`ЛЕЧЕНИЕ +${payload.amount}`);
      if (event.type === "CARD_STOLEN") announce("КАРТА УКРАДЕНА");
      if (event.type === "CARD_BROKEN") announce("КАРТА СЛОМАНА");
      if (event.type === "CARD_BURNED") announce("КАРТА СГОРЕЛА");
    });
  }

  function renderLog() {
    const events = state.eventLog.slice(-8).reverse();
    dom.log.replaceChildren(...events.map((event) => {
      const line = document.createElement("div"); line.className = "log-line";
      const text = ({ CARD_PLAYED: "сыграна карта", DAMAGE_DEALT: "нанесён урон", SHIELD_GAINED: "получен щит", HEALED: "восстановлено здоровье", CARD_STOLEN: "украдена карта", CARD_BROKEN: "сломана карта", TURN_STARTED: "начался ход", BATTLE_FINISHED: "бой окончен" })[event.type] || event.type.toLowerCase().replaceAll("_", " ");
      line.innerHTML = `<b>${event.seq}</b> ${escapeHtml(text)}`; return line;
    }));
  }

  function announce(text) {
    dom.float.textContent = text;
    dom.float.classList.remove("show"); void dom.float.offsetWidth; dom.float.classList.add("show");
  }

  function showResult() {
    stopTimer();
    const won = state.winner === "player";
    dom.resultTitle.textContent = won ? "ПОБЕДА" : state.winner === "draw" ? "НИЧЬЯ" : "ДОЛГ ВЗЫСКАН";
    dom.resultText.textContent = won ? `Шулер проиграл. Осталось здоровья: ${state.actors.player.hp}.` : "Забег окончен. Карты возвращаются в рукав, а долг остаётся.";
    dom.overlay.hidden = false;
  }

  function startTimer(reset = true) {
    stopTimer();
    if (state.phase !== Engine.PHASES.PLAYER || state.winner) return;
    if (reset) timerLeft = TIMER_SECONDS;
    updateTimer();
    timerId = window.setInterval(() => {
      timerLeft -= 1; updateTimer();
      if (timerLeft <= 0) { stopTimer(); endPlayerTurn(); }
    }, 1000);
  }

  function updateTimer() {
    dom.timer.textContent = `00:${String(Math.max(0, timerLeft)).padStart(2, "0")}`;
    dom.timerProgress.style.transform = `scaleX(${Math.max(0, timerLeft / TIMER_SECONDS)})`;
    dom.timerBox.classList.toggle("warning", timerLeft <= 10);
  }

  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  dom.endTurn.addEventListener("click", endPlayerTurn);
  $("#restartButton").addEventListener("click", () => { if (confirm("Начать новый бой?")) newBattle(); });
  $("#resultRestart").addEventListener("click", newBattle);
  $("#helpButton").addEventListener("click", () => $("#helpDialog").showModal());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.repeat && !$("#helpDialog").open) { event.preventDefault(); endPlayerTurn(); }
    if (/^Digit[1-9]$/.test(event.code) && state.phase === Engine.PHASES.PLAYER) {
      const index = Number(event.code.slice(-1)) - 1;
      const card = state.actors.player.hand[index];
      const element = dom.hand.children[index];
      if (card && element && !element.disabled) onCardClick(card.instanceId, element);
    }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopTimer(); else if (state && state.phase === Engine.PHASES.PLAYER) startTimer(false); });
  window.addEventListener("beforeunload", save);

  if (!Engine || !CARDS) throw new Error("Не загружено боевое ядро или карты вертикального среза.");
  if (!load()) state = Engine.createBattle(battleConfig());
  render(true);
  if (state.phase === Engine.PHASES.DEALER && !state.winner) { busy = true; dealerTurn().finally(() => { busy = false; render(false); if (state.phase === Engine.PHASES.PLAYER) startTimer(); }); }
  else if (state.phase === Engine.PHASES.PLAYER) startTimer();
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
})();
