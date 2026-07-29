"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastAct1Content = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DATA_VERSION = 1;
  const NODE_TYPES = Object.freeze({ BATTLE: "battle", ELITE: "elite", EVENT: "event", SHOP: "shop", REST: "rest", TREASURE: "treasure", BOSS: "boss" });
  const NODE_DETAILS = Object.freeze({
    battle: { title: "ДУЭЛЬ", symbol: "♠", description: "Обычный дилер. Победа приносит деньги и карту." },
    elite: { title: "ЭЛИТА", symbol: "☠", description: "Опасный противник с усиленной наградой." },
    event: { title: "СОБЫТИЕ", symbol: "?", description: "Выбор с последствиями." },
    shop: { title: "ТОРГОВЕЦ", symbol: "₽", description: "Карты, лечение, артефакт и удаление карт." },
    rest: { title: "ОТДЫХ", symbol: "⌂", description: "Восстановить здоровье или улучшить карту." },
    treasure: { title: "ТАЙНИК", symbol: "✦", description: "Выбрать один артефакт." },
    boss: { title: "БОСС", symbol: "♛", description: "Хозяин стола ждёт в конце акта." },
  });
  const COMMON_DEALERS = Object.freeze(["shuler", "collector", "sysadmin", "projectionist"]);
  const ELITE_DEALERS = Object.freeze(["archivist", "mascot"]);
  const BOSS_DEALER = "house_master";
  const ROUTE_LAYERS = Object.freeze([
    ["battle", "event", "battle"],
    ["shop", "battle", "rest"],
    ["battle", "event", "battle"],
    ["elite", "rest", "elite"],
    ["event", "shop", "treasure"],
    ["battle", "rest", "battle"],
    ["treasure", "elite", "event"],
    ["boss"],
  ]);

  function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(deepFreeze); return value; }
  function text(adult, safe) { return deepFreeze({ adult, safe }); }

  const ARTIFACTS = deepFreeze([
    { id: "reinforced_sleeve", name: "Армированный рукав", symbol: "▥", rarity: "common", description: text("В начале боя получаешь 6 щита. Карты теперь пахнут металлом и тревогой.", "В начале боя получаешь 6 защиты."), effect: { startShield: 6 }, unlock: "base" },
    { id: "brass_knuckles", name: "Кастет крупье", symbol: "✊", rarity: "uncommon", description: text("Каждый бой начинаешь с 1 силой. Дипломатия закончилась ещё у входа.", "Каждый бой начинаешь с 1 силой."), effect: { startStrength: 1 }, unlock: "base" },
    { id: "metro_token", name: "Жетон последнего поезда", symbol: "М", rarity: "rare", description: text("+1 к максимальной энергии в каждом бою. Турникет делает вид, что не заметил.", "+1 к максимальной энергии в каждом бою."), effect: { bonusEnergy: 1 }, unlock: "base" },
    { id: "cashback_card", name: "Карта с кэшбэком", symbol: "%", rarity: "common", description: text("После каждой победы получаешь ещё 12 ₽. Банк верит в насилие над бюджетом.", "После каждой победы получаешь ещё 12 ₽."), effect: { battleGold: 12 }, unlock: "base" },
    { id: "first_aid_tape", name: "Изолента первой помощи", symbol: "+", rarity: "uncommon", description: text("После победы лечит 4 здоровья. Держит всё, кроме семейных отношений.", "После победы восстанавливает 4 здоровья."), effect: { postBattleHeal: 4 }, unlock: "runs2" },
    { id: "pocket_mirror", name: "Карманное зеркало", symbol: "◈", rarity: "rare", description: text("Дилер начинает бой с уязвимостью. Впервые увидел себя без фильтров.", "Дилер начинает бой с уязвимостью."), effect: { enemyVulnerable: 1 }, unlock: "elite1" },
    { id: "lucky_chip", name: "Фишка с трещиной", symbol: "●", rarity: "epic", description: text("После боя предлагается на одну карту больше. Трещина считается дополнительной гранью удачи.", "После боя предлагается на одну карту больше."), effect: { rewardExtraCard: 1 }, unlock: "nodes12" },
    { id: "black_ledger", name: "Чёрная бухгалтерия", symbol: "▤", rarity: "epic", description: text("Цены торговца ниже на 20%. Налоговая считает это художественной литературой.", "Цены торговца ниже на 20%."), effect: { shopDiscount: 0.2 }, unlock: "nodes12" },
    { id: "spare_battery", name: "Запасная батарейка", symbol: "ϟ", rarity: "rare", description: text("Если входишь в бой ниже половины здоровья, лечишься на 6. Полярность определяется паникой.", "Перед тяжёлым боем восстанавливает 6 здоровья, если осталось меньше половины."), effect: { lowHpHeal: 6 }, unlock: "victory1" },
    { id: "house_key", name: "Ключ от стола", symbol: "⚿", rarity: "legendary", description: text("Максимальное здоровье увеличено на 8. Ключ ни к чему не подходит, поэтому подходит ко всему.", "Максимальное здоровье увеличено на 8."), effect: { maxHp: 8 }, unlock: "victory1" },
  ]);

  const EVENTS = deepFreeze([
    { id: "broken_atm", title: "СЛОМАННЫЙ БАНКОМАТ", body: text("Банкомат выплёвывает деньги и искры. Камера смотрит в стену, как хороший свидетель.", "Банкомат сломался и выдаёт лишние деньги."), choices: [
      { id: "pry", title: text("ПОМОЧЬ ЕМУ ЛОМОМ", "ОТКРЫТЬ ПАНЕЛЬ"), description: text("Получить 70 ₽ и потерять 8 здоровья.", "Получить 70 ₽ и потерять 8 здоровья."), effects: [{ op: "gold", amount: 70 }, { op: "hp", amount: -8 }] },
      { id: "report", title: text("ПОЗВОНИТЬ В БАНК", "СООБЩИТЬ О ПОЛОМКЕ"), description: text("Получить 20 ₽ за найденную уязвимость.", "Получить 20 ₽ в благодарность."), effects: [{ op: "gold", amount: 20 }] },
    ] },
    { id: "vending_machine", title: "АВТОМАТ С ЕДОЙ", body: text("Автомат принимает только мятые купюры и угрозы. Внутри лежит что-то, пережившее три ремонта.", "В автомате осталась еда и несколько полезных вещей."), choices: [
      { id: "pay", title: text("ЗАПЛАТИТЬ 30 ₽", "КУПИТЬ ЕДУ ЗА 30 ₽"), description: text("Восстановить 15 здоровья.", "Восстановить 15 здоровья."), cost: 30, effects: [{ op: "gold", amount: -30 }, { op: "hp", amount: 15 }] },
      { id: "kick", title: text("УДАРИТЬ ПО КОРПУСУ", "ПОТРЯСТИ АВТОМАТ"), description: text("Получить случайную карту и потерять 5 здоровья.", "Получить случайную карту и потерять 5 здоровья."), effects: [{ op: "add_card", pool: "common" }, { op: "hp", amount: -5 }] },
    ] },
    { id: "lost_wallet", title: "ЧУЖОЙ КОШЕЛЁК", body: text("Документов нет. Только деньги, скидочные карты и фотография человека, который уже всё понял.", "На полу лежит потерянный кошелёк без документов."), choices: [
      { id: "keep", title: text("ЗАБРАТЬ", "ОСТАВИТЬ СЕБЕ"), description: text("Получить 60 ₽ и добавить проклятие.", "Получить 60 ₽ и добавить неудобную карту."), effects: [{ op: "gold", amount: 60 }, { op: "add_curse" }] },
      { id: "return", title: text("ОТНЕСТИ ОХРАНЕ", "ВЕРНУТЬ"), description: text("Получить случайный открытый артефакт.", "Получить случайный артефакт в благодарность."), effects: [{ op: "artifact_random" }] },
    ] },
    { id: "service_elevator", title: "СЛУЖЕБНЫЙ ЛИФТ", body: text("Кнопка этажа подписана маркером: «НЕ НАЖИМАТЬ». Под ней свежая царапина от ногтя.", "Старый лифт предлагает короткий путь наверх."), choices: [
      { id: "ride", title: text("НАЖАТЬ", "ПОЕХАТЬ"), description: text("Улучшить случайную карту и потерять 6 здоровья.", "Улучшить случайную карту и потерять 6 здоровья."), effects: [{ op: "upgrade_random" }, { op: "hp", amount: -6 }] },
      { id: "stairs", title: text("ПОЙТИ ПО ЛЕСТНИЦЕ", "ВЫБРАТЬ ЛЕСТНИЦУ"), description: text("Увеличить максимум здоровья на 4 и восстановить 4.", "Увеличить максимум здоровья на 4 и восстановить 4."), effects: [{ op: "max_hp", amount: 4 }] },
    ] },
    { id: "strange_disc", title: "ДИСК БЕЗ ПОДПИСИ", body: text("На диске маркером написано: FINAL_FINAL_2_REAL. Компьютер рядом уже дымится.", "Рядом с компьютером лежит неизвестный диск."), choices: [
      { id: "install", title: text("УСТАНОВИТЬ", "ПРОВЕРИТЬ ДИСК"), description: text("Получить улучшенный «Вирус в ПК», но потерять 4 максимального здоровья.", "Получить улучшенную техническую карту, но потерять 4 максимального здоровья."), effects: [{ op: "add_specific", cardId: "pc_virus", upgrade: 1 }, { op: "max_hp", amount: -4 }] },
      { id: "sell", title: text("ПРОДАТЬ КАК РЕДКИЙ СОФТ", "ПРОДАТЬ КОЛЛЕКЦИОНЕРУ"), description: text("Получить 45 ₽.", "Получить 45 ₽."), effects: [{ op: "gold", amount: 45 }] },
    ] },
    { id: "night_bus", title: "ПОСЛЕДНИЙ АВТОБУС", body: text("Водитель не смотрит в зеркало. На табло вместо маршрута написано «ДО КОНЦА».", "Последний автобус может довезти до следующей остановки."), choices: [
      { id: "ride", title: text("СЕСТЬ", "ПОЕХАТЬ"), description: text("Восстановить 12 здоровья и добавить просроченный пропуск.", "Восстановить 12 здоровья и добавить старый пропуск."), effects: [{ op: "hp", amount: 12 }, { op: "add_specific", cardId: "expired_pass", upgrade: 0 }] },
      { id: "walk", title: text("ИДТИ ПЕШКОМ", "ПРОЙТИ ПЕШКОМ"), description: text("Улучшить случайную карту.", "Улучшить случайную карту."), effects: [{ op: "upgrade_random" }] },
    ] },
    { id: "cleaning_shift", title: "НОЧНАЯ УБОРКА", body: text("Бригадир предлагает подработку. Пятна на стенах в договор не входят.", "Бригада уборщиков предлагает помочь или взять подработку."), choices: [
      { id: "work", title: text("ВЗЯТЬ СМЕНУ", "ПОМОЧЬ С УБОРКОЙ"), description: text("Получить 35 ₽ и восстановить 5 здоровья.", "Получить 35 ₽ и восстановить 5 здоровья."), effects: [{ op: "gold", amount: 35 }, { op: "hp", amount: 5 }] },
      { id: "hire", title: text("НАНЯТЬ БРИГАДУ ЗА 25 ₽", "ЗАКАЗАТЬ УБОРКУ ЗА 25 ₽"), description: text("Удалить случайное проклятие. Если проклятий нет, удалить случайную карту.", "Убрать одну неудобную карту."), cost: 25, effects: [{ op: "gold", amount: -25 }, { op: "remove_curse_or_random" }] },
    ] },
    { id: "slot_machine", title: "АВТОМАТ «ТРИ ДОЛГА»", body: text("На барабанах: кредит, штраф и коммуналка. Джекпот выглядит как уведомление из суда.", "Старый игровой автомат всё ещё принимает монеты."), choices: [
      { id: "play", title: text("ВСТАВИТЬ 25 ₽", "СЫГРАТЬ ЗА 25 ₽"), description: text("Результат определяется seed: выигрыш 80 ₽, карта или потеря 7 здоровья.", "Можно выиграть деньги, карту или потерять 7 здоровья."), cost: 25, effects: [{ op: "gold", amount: -25 }, { op: "gamble" }] },
      { id: "leave", title: text("НЕ КОРМИТЬ АВТОМАТ", "УЙТИ"), description: text("Ничего не происходит. Редкая финансовая победа.", "Ничего не происходит."), effects: [] },
    ] },
  ]);

  const byArtifactId = Object.freeze(Object.fromEntries(ARTIFACTS.map((item) => [item.id, item])));
  const byEventId = Object.freeze(Object.fromEntries(EVENTS.map((item) => [item.id, item])));
  function projectText(entry, safe) { if (!entry) return ""; return entry[safe ? "safe" : "adult"] || entry.adult || ""; }
  return Object.freeze({ DATA_VERSION, NODE_TYPES, NODE_DETAILS, COMMON_DEALERS, ELITE_DEALERS, BOSS_DEALER, ROUTE_LAYERS, artifacts: ARTIFACTS, byArtifactId, events: EVENTS, byEventId, projectText });
});