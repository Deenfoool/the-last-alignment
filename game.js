"use strict";

const SAVE_KEY = "the-last-alignment-save-v1";
const HAND_SIZE = 5;

const CARD_LIBRARY = {
  strike: {
    name: "Удар",
    type: "Атака",
    className: "attack",
    cost: 1,
    art: "⚔",
    description: "Наносит 6 урона.",
    effect: { attack: 6 }
  },
  guard: {
    name: "Защита",
    type: "Навык",
    className: "skill",
    cost: 1,
    art: "◈",
    description: "Даёт 5 брони.",
    effect: { block: 5 }
  },
  heavy: {
    name: "Тяжёлый выпад",
    type: "Атака",
    className: "attack",
    cost: 2,
    art: "🗡",
    description: "Наносит 11 урона.",
    effect: { attack: 11 }
  },
  quick: {
    name: "Быстрый порез",
    type: "Атака",
    className: "attack",
    cost: 0,
    art: "╱",
    description: "Наносит 3 урона. Возьмите 1 карту.",
    effect: { attack: 3, draw: 1 }
  },
  guardedStrike: {
    name: "Ответный выпад",
    type: "Атака",
    className: "attack",
    cost: 1,
    art: "⚔",
    description: "Наносит 5 урона и даёт 4 брони.",
    effect: { attack: 5, block: 4 }
  },
  fortify: {
    name: "Укрепиться",
    type: "Навык",
    className: "skill",
    cost: 1,
    art: "▣",
    description: "Даёт 9 брони.",
    effect: { block: 9 }
  },
  bloodPrice: {
    name: "Цена крови",
    type: "Атака",
    className: "attack rare",
    cost: 0,
    art: "♦",
    description: "Наносит 10 урона. Вы теряете 3 здоровья.",
    effect: { attack: 10, selfDamage: 3 }
  },
  insight: {
    name: "Предчувствие",
    type: "Навык",
    className: "skill",
    cost: 1,
    art: "◉",
    description: "Возьмите 2 карты.",
    effect: { draw: 2 }
  },
  battleTrance: {
    name: "Боевой транс",
    type: "Сила",
    className: "power rare",
    cost: 1,
    art: "✦",
    description: "Получите 2 силы до конца боя.",
    effect: { strength: 2 }
  },
  riposte: {
    name: "Возмездие",
    type: "Навык",
    className: "skill",
    cost: 1,
    art: "↯",
    description: "Даёт 5 брони. После атаки враг получит 6 урона.",
    effect: { block: 5, retaliation: 6 }
  },
  execute: {
    name: "Приговор",
    type: "Атака",
    className: "attack rare",
    cost: 2,
    art: "♠",
    description: "Наносит 12 урона. Ещё 8, если у врага не больше половины здоровья.",
    effect: { attack: 12, executeBonus: 8 }
  },
  mend: {
    name: "Перевязка",
    type: "Навык",
    className: "skill",
    cost: 1,
    art: "+",
    description: "Восстанавливает 6 здоровья.",
    effect: { heal: 6 }
  },
  doubleCut: {
    name: "Двойной разрез",
    type: "Атака",
    className: "attack",
    cost: 1,
    art: "〆",
    description: "Дважды наносит по 4 урона.",
    effect: { attack: 4, hits: 2 }
  }
};

const REWARD_POOL = [
  "quick",
  "guardedStrike",
  "fortify",
  "bloodPrice",
  "insight",
  "battleTrance",
  "riposte",
  "execute",
  "mend",
  "doubleCut"
];

const ENEMIES = [
  {
    name: "Костяной скиталец",
    rank: "Обычный противник",
    portrait: "☠",
    maxHealth: 30,
    pattern: [
      { type: "attack", value: 7 },
      { type: "guardedAttack", value: 5, block: 5 },
      { type: "attack", value: 9 }
    ]
  },
  {
    name: "Чумной зверь",
    rank: "Обычный противник",
    portrait: "♞",
    maxHealth: 42,
    pattern: [
      { type: "attack", value: 8 },
      { type: "multiAttack", value: 4, hits: 2 },
      { type: "buff", value: 2 }
    ]
  },
  {
    name: "Рыцарь пустоты",
    rank: "Усиленный противник",
    portrait: "♜",
    maxHealth: 56,
    pattern: [
      { type: "guardedAttack", value: 7, block: 8 },
      { type: "attack", value: 12 },
      { type: "buff", value: 3 },
      { type: "multiAttack", value: 5, hits: 2 }
    ]
  },
  {
    name: "Хозяин расклада",
    rank: "Босс",
    portrait: "♛",
    maxHealth: 82,
    pattern: [
      { type: "attack", value: 11 },
      { type: "guardedAttack", value: 8, block: 10 },
      { type: "multiAttack", value: 6, hits: 2 },
      { type: "buff", value: 3 },
      { type: "attack", value: 16 }
    ]
  }
];

const elements = {
  battlefield: document.querySelector("#battlefield"),
  heroPanel: document.querySelector("#heroPanel"),
  enemyPanel: document.querySelector("#enemyPanel"),
  heroHealthBar: document.querySelector("#heroHealthBar"),
  heroHealthText: document.querySelector("#heroHealthText"),
  heroBlock: document.querySelector("#heroBlock"),
  energyValue: document.querySelector("#energyValue"),
  enemyName: document.querySelector("#enemyName"),
  enemyRank: document.querySelector("#enemyRank"),
  enemyPortrait: document.querySelector("#enemyPortrait"),
  enemyHealthBar: document.querySelector("#enemyHealthBar"),
  enemyHealthText: document.querySelector("#enemyHealthText"),
  enemyBlock: document.querySelector("#enemyBlock"),
  enemyEffect: document.querySelector("#enemyEffect"),
  intentIcon: document.querySelector("#intentIcon"),
  intentText: document.querySelector("#intentText"),
  intentCard: document.querySelector("#intentCard"),
  turnLabel: document.querySelector("#turnLabel"),
  endTurnButton: document.querySelector("#endTurnButton"),
  restartButton: document.querySelector("#restartButton"),
  floorValue: document.querySelector("#floorValue"),
  winsValue: document.querySelector("#winsValue"),
  messageStrip: document.querySelector("#messageStrip"),
  hand: document.querySelector("#hand"),
  drawCount: document.querySelector("#drawCount"),
  discardCount: document.querySelector("#discardCount"),
  cardTemplate: document.querySelector("#cardTemplate"),
  rewardModal: document.querySelector("#rewardModal"),
  rewardGrid: document.querySelector("#rewardGrid"),
  skipRewardButton: document.querySelector("#skipRewardButton"),
  resultModal: document.querySelector("#resultModal"),
  resultEyebrow: document.querySelector("#resultEyebrow"),
  resultTitle: document.querySelector("#resultTitle"),
  resultText: document.querySelector("#resultText"),
  resultRestartButton: document.querySelector("#resultRestartButton")
};

let state = null;
let enemyTurnTimer = null;
let nextTurnTimer = null;

function createInitialState() {
  return {
    version: 1,
    phase: "battle",
    floor: 0,
    wins: 0,
    playerTurn: true,
    message: "Разыграйте карту или завершите ход.",
    hero: {
      maxHealth: 50,
      health: 50,
      block: 0,
      maxEnergy: 3,
      energy: 3,
      strength: 0,
      retaliation: 0
    },
    deck: [
      "strike", "strike", "strike", "strike", "strike",
      "guard", "guard", "guard", "guard",
      "heavy"
    ],
    hand: [],
    drawPile: [],
    discardPile: [],
    enemy: null,
    rewardChoices: []
  };
}

function cloneEnemy(index) {
  const source = ENEMIES[index];
  return {
    ...source,
    pattern: source.pattern.map((action) => ({ ...action })),
    health: source.maxHealth,
    block: 0,
    strength: 0,
    turn: 0
  };
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function startNewRun() {
  clearTimers();
  state = createInitialState();
  startCombat(0);
  closeAllModals();
  saveGame();
  render();
}

function startCombat(enemyIndex) {
  state.phase = "battle";
  state.floor = enemyIndex;
  state.playerTurn = true;
  state.hero.block = 0;
  state.hero.energy = state.hero.maxEnergy;
  state.hero.strength = 0;
  state.hero.retaliation = 0;
  state.enemy = cloneEnemy(enemyIndex);
  state.drawPile = shuffled(state.deck);
  state.discardPile = [];
  state.hand = [];
  state.rewardChoices = [];
  drawCards(HAND_SIZE);
  state.message = `${state.enemy.name} преграждает путь.`;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Не удалось сохранить игру", error);
  }
}

function loadGame() {
  try {
    const rawSave = localStorage.getItem(SAVE_KEY);
    if (!rawSave) return false;

    const parsed = JSON.parse(rawSave);
    if (!isValidSave(parsed)) return false;

    state = parsed;
    return true;
  } catch (error) {
    console.warn("Сохранение повреждено", error);
    return false;
  }
}

function isValidSave(save) {
  return Boolean(
    save &&
    save.version === 1 &&
    save.hero &&
    Array.isArray(save.deck) &&
    Array.isArray(save.hand) &&
    Array.isArray(save.drawPile) &&
    Array.isArray(save.discardPile) &&
    Number.isInteger(save.floor) &&
    save.floor >= 0 &&
    save.floor < ENEMIES.length
  );
}

function drawCards(amount) {
  for (let count = 0; count < amount; count += 1) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      state.drawPile = shuffled(state.discardPile);
      state.discardPile = [];
      state.message = "Сброс перемешан и снова стал колодой.";
    }

    const cardId = state.drawPile.pop();
    if (cardId) state.hand.push(cardId);
  }
}

function playCard(handIndex, cardElement) {
  if (state.phase !== "battle" || !state.playerTurn) return;

  const cardId = state.hand[handIndex];
  const card = CARD_LIBRARY[cardId];
  if (!card || card.cost > state.hero.energy) {
    setMessage("Недостаточно энергии.");
    return;
  }

  state.hero.energy -= card.cost;
  state.hand.splice(handIndex, 1);
  resolveCard(card);
  state.discardPile.push(cardId);

  if (cardElement) {
    cardElement.classList.add("card-played");
  }

  if (state.hero.health <= 0) {
    finishRun(false);
    return;
  }

  if (state.enemy.health <= 0) {
    state.enemy.health = 0;
    state.playerTurn = false;
    state.message = `${state.enemy.name} повержен.`;
    saveGame();
    render();
    window.setTimeout(finishCombat, 420);
    return;
  }

  saveGame();
  render();
}

function resolveCard(card) {
  const effect = card.effect;
  const hits = effect.hits || 1;

  if (effect.attack) {
    let attackValue = effect.attack + state.hero.strength;
    if (effect.executeBonus && state.enemy.health <= state.enemy.maxHealth / 2) {
      attackValue += effect.executeBonus;
    }

    for (let hit = 0; hit < hits; hit += 1) {
      dealDamage(state.enemy, attackValue);
      if (state.enemy.health <= 0) break;
    }
    animate(elements.enemyPanel, "hit");
  }

  if (effect.block) {
    state.hero.block += effect.block;
  }

  if (effect.heal) {
    const before = state.hero.health;
    state.hero.health = Math.min(state.hero.maxHealth, state.hero.health + effect.heal);
    const restored = state.hero.health - before;
    state.message = restored > 0 ? `Восстановлено здоровья: ${restored}.` : "Здоровье уже заполнено.";
    animate(elements.heroPanel, "heal");
  }

  if (effect.selfDamage) {
    state.hero.health = Math.max(0, state.hero.health - effect.selfDamage);
    animate(elements.heroPanel, "hit");
  }

  if (effect.strength) {
    state.hero.strength += effect.strength;
  }

  if (effect.retaliation) {
    state.hero.retaliation = Math.max(state.hero.retaliation, effect.retaliation);
  }

  if (effect.draw) {
    drawCards(effect.draw);
  }

  if (!effect.heal) {
    state.message = `Сыграна карта «${card.name}».`;
  }
}

function dealDamage(target, rawDamage) {
  const damage = Math.max(0, Math.floor(rawDamage));
  const absorbed = Math.min(target.block, damage);
  target.block -= absorbed;
  target.health = Math.max(0, target.health - (damage - absorbed));
  return damage - absorbed;
}

function endPlayerTurn() {
  if (state.phase !== "battle" || !state.playerTurn) return;

  state.playerTurn = false;
  state.discardPile.push(...state.hand);
  state.hand = [];
  state.message = `${state.enemy.name} готовится действовать.`;
  saveGame();
  render();

  enemyTurnTimer = window.setTimeout(resolveEnemyTurn, 520);
}

function resolveEnemyTurn() {
  if (state.phase !== "battle" || !state.enemy || state.enemy.health <= 0) return;

  state.enemy.block = 0;
  const action = getEnemyIntent();
  const attackStrength = state.enemy.strength;
  let attacked = false;

  if (action.type === "attack") {
    const damage = action.value + attackStrength;
    const dealt = dealDamage(state.hero, damage);
    state.message = `${state.enemy.name} атакует на ${damage}. Получено урона: ${dealt}.`;
    attacked = true;
  }

  if (action.type === "multiAttack") {
    let totalDamage = 0;
    for (let hit = 0; hit < action.hits; hit += 1) {
      totalDamage += dealDamage(state.hero, action.value + attackStrength);
    }
    state.message = `${state.enemy.name} наносит ${action.hits} удара. Получено урона: ${totalDamage}.`;
    attacked = true;
  }

  if (action.type === "guardedAttack") {
    state.enemy.block += action.block;
    const damage = action.value + attackStrength;
    const dealt = dealDamage(state.hero, damage);
    state.message = `${state.enemy.name} получает ${action.block} брони и атакует. Получено урона: ${dealt}.`;
    attacked = true;
  }

  if (action.type === "buff") {
    state.enemy.strength += action.value;
    state.message = `${state.enemy.name} усиливается. Сила увеличена на ${action.value}.`;
  }

  if (attacked) {
    animate(elements.heroPanel, "hit");
    if (state.hero.retaliation > 0 && state.enemy.health > 0) {
      dealDamage(state.enemy, state.hero.retaliation);
      state.message += ` Возмездие наносит ${state.hero.retaliation} урона.`;
      animate(elements.enemyPanel, "hit");
    }
  }

  state.enemy.turn += 1;
  saveGame();
  render();

  if (state.enemy.health <= 0) {
    nextTurnTimer = window.setTimeout(finishCombat, 420);
    return;
  }

  if (state.hero.health <= 0) {
    nextTurnTimer = window.setTimeout(() => finishRun(false), 420);
    return;
  }

  nextTurnTimer = window.setTimeout(beginPlayerTurn, 620);
}

function beginPlayerTurn() {
  if (state.phase !== "battle") return;

  state.hero.block = 0;
  state.hero.retaliation = 0;
  state.hero.energy = state.hero.maxEnergy;
  state.playerTurn = true;
  drawCards(HAND_SIZE);
  state.message = "Ваш ход.";
  saveGame();
  render();
}

function getEnemyIntent() {
  const patternIndex = state.enemy.turn % state.enemy.pattern.length;
  return state.enemy.pattern[patternIndex];
}

function describeIntent(action) {
  const bonus = state.enemy.strength;

  switch (action.type) {
    case "attack":
      return { icon: "⚔", text: `Атака: ${action.value + bonus}` };
    case "multiAttack":
      return { icon: "〆", text: `${action.hits} × ${action.value + bonus} урона` };
    case "guardedAttack":
      return { icon: "◈", text: `Броня ${action.block}, атака ${action.value + bonus}` };
    case "buff":
      return { icon: "✦", text: `Усиление: +${action.value} силы` };
    default:
      return { icon: "?", text: "Неизвестное действие" };
  }
}

function finishCombat() {
  if (state.phase !== "battle") return;

  state.wins += 1;
  if (state.floor >= ENEMIES.length - 1) {
    finishRun(true);
    return;
  }

  state.phase = "reward";
  state.rewardChoices = createRewardChoices();
  state.message = "Выберите новую карту для колоды.";
  saveGame();
  render();
  openRewardModal();
}

function createRewardChoices() {
  return shuffled(REWARD_POOL).slice(0, 3);
}

function selectReward(cardId) {
  if (state.phase !== "reward" || !CARD_LIBRARY[cardId]) return;

  state.deck.push(cardId);
  advanceToNextCombat(`Карта «${CARD_LIBRARY[cardId].name}» добавлена в колоду.`);
}

function skipReward() {
  if (state.phase !== "reward") return;
  advanceToNextCombat("Награда пропущена.");
}

function advanceToNextCombat(message) {
  const nextFloor = state.floor + 1;
  state.hero.health = Math.min(state.hero.maxHealth, state.hero.health + 6);
  closeAllModals();
  startCombat(nextFloor);
  state.message = `${message} Перед новым боем восстановлено 6 здоровья.`;
  saveGame();
  render();
}

function finishRun(victory) {
  clearTimers();
  state.phase = "result";
  state.playerTurn = false;
  state.message = victory ? "Башня пройдена." : "Забег завершён.";
  saveGame();
  render();

  elements.resultEyebrow.textContent = victory ? "Победа" : "Забег завершён";
  elements.resultTitle.textContent = victory ? "Расклад покорён" : "Вы пали";
  elements.resultText.textContent = victory
    ? `Побеждено противников: ${state.wins}. Собрано карт: ${state.deck.length}.`
    : `Побеждено противников: ${state.wins}. Попробуйте изменить порядок розыгрыша карт.`;
  elements.resultModal.classList.remove("hidden");
}

function render() {
  if (!state || !state.enemy) return;

  const heroHealthPercent = (state.hero.health / state.hero.maxHealth) * 100;
  const enemyHealthPercent = (state.enemy.health / state.enemy.maxHealth) * 100;
  const intent = describeIntent(getEnemyIntent());

  elements.heroHealthBar.style.width = `${heroHealthPercent}%`;
  elements.heroHealthText.textContent = `${state.hero.health} / ${state.hero.maxHealth}`;
  elements.heroBlock.textContent = state.hero.block;
  elements.energyValue.textContent = `${state.hero.energy} / ${state.hero.maxEnergy}`;

  elements.enemyName.textContent = state.enemy.name;
  elements.enemyRank.textContent = state.enemy.rank;
  elements.enemyPortrait.textContent = state.enemy.portrait;
  elements.enemyHealthBar.style.width = `${enemyHealthPercent}%`;
  elements.enemyHealthText.textContent = `${state.enemy.health} / ${state.enemy.maxHealth}`;
  elements.enemyBlock.textContent = state.enemy.block;
  elements.enemyEffect.textContent = state.enemy.strength > 0
    ? `Сила +${state.enemy.strength}`
    : "Без эффектов";

  elements.intentIcon.textContent = intent.icon;
  elements.intentText.textContent = intent.text;
  elements.turnLabel.textContent = state.playerTurn ? "Ваш ход" : "Ход врага";
  elements.endTurnButton.disabled = !state.playerTurn || state.phase !== "battle";
  elements.floorValue.textContent = `${state.floor + 1} / ${ENEMIES.length}`;
  elements.winsValue.textContent = state.wins;
  elements.messageStrip.textContent = state.message;
  elements.drawCount.textContent = state.drawPile.length;
  elements.discardCount.textContent = state.discardPile.length;

  renderHand();

  if (state.phase === "reward") {
    openRewardModal();
  }

  if (state.phase === "result") {
    const victory = state.hero.health > 0 && state.floor === ENEMIES.length - 1;
    elements.resultEyebrow.textContent = victory ? "Победа" : "Забег завершён";
    elements.resultTitle.textContent = victory ? "Расклад покорён" : "Вы пали";
    elements.resultText.textContent = victory
      ? `Побеждено противников: ${state.wins}. Собрано карт: ${state.deck.length}.`
      : `Побеждено противников: ${state.wins}. Попробуйте изменить порядок розыгрыша карт.`;
    elements.resultModal.classList.remove("hidden");
  }
}

function renderHand() {
  elements.hand.replaceChildren();

  state.hand.forEach((cardId, handIndex) => {
    const cardElement = createCardElement(cardId);
    const card = CARD_LIBRARY[cardId];
    cardElement.disabled = !state.playerTurn || state.phase !== "battle" || card.cost > state.hero.energy;
    cardElement.addEventListener("click", () => playCard(handIndex, cardElement));
    elements.hand.append(cardElement);
  });
}

function createCardElement(cardId, rewardMode = false) {
  const card = CARD_LIBRARY[cardId];
  const fragment = elements.cardTemplate.content.cloneNode(true);
  const button = fragment.querySelector(".game-card");

  button.className = `game-card ${card.className}`;
  button.querySelector(".card-cost").textContent = card.cost;
  button.querySelector(".card-type").textContent = card.type;
  button.querySelector(".card-name").textContent = card.name;
  button.querySelector(".card-art").textContent = card.art;
  button.querySelector(".card-description").textContent = card.description;
  button.setAttribute("aria-label", `${card.name}. Стоимость ${card.cost}. ${card.description}`);

  if (rewardMode) {
    button.addEventListener("click", () => selectReward(cardId));
  }

  return button;
}

function openRewardModal() {
  elements.rewardGrid.replaceChildren();
  state.rewardChoices.forEach((cardId) => {
    elements.rewardGrid.append(createCardElement(cardId, true));
  });
  elements.rewardModal.classList.remove("hidden");
}

function closeAllModals() {
  elements.rewardModal.classList.add("hidden");
  elements.resultModal.classList.add("hidden");
}

function setMessage(message) {
  state.message = message;
  elements.messageStrip.textContent = message;
}

function animate(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), 500);
}

function clearTimers() {
  if (enemyTurnTimer) window.clearTimeout(enemyTurnTimer);
  if (nextTurnTimer) window.clearTimeout(nextTurnTimer);
  enemyTurnTimer = null;
  nextTurnTimer = null;
}

elements.endTurnButton.addEventListener("click", endPlayerTurn);
elements.restartButton.addEventListener("click", startNewRun);
elements.resultRestartButton.addEventListener("click", startNewRun);
elements.skipRewardButton.addEventListener("click", skipReward);

if (!loadGame()) {
  state = createInitialState();
  startCombat(0);
  saveGame();
}

render();
