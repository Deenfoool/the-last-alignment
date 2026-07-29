"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastCardCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DATA_VERSION = 1;
  const TYPES = Object.freeze(["attack", "defense", "skill", "power", "curse"]);
  const RARITIES = Object.freeze(["common", "uncommon", "rare", "epic", "legendary", "curse"]);
  const NEGATIVE_STATUSES = Object.freeze(["weak", "vulnerable", "burn"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }
  function text(adultShort, adultLore, safeShort, safeLore) {
    return { adult: { short: adultShort, lore: adultLore }, safe: { short: safeShort, lore: safeLore } };
  }
  function upgrade(cost, stat, effects, adultShort, safeShort, extra) {
    return Object.assign({ cost, stat, effects, text: { adult: { short: adultShort }, safe: { short: safeShort } } }, extra || {});
  }
  function art(key, symbol, background, accent, detail) {
    return { key, symbol, palette: { background, accent, detail: detail || "#d8c6a2" } };
  }

  const RAW_CARDS = [
    { id: "troika_pass", name: "Тройка", type: "skill", rarity: "uncommon", cost: 1, target: "self", art: art("troika", "М", "#102a3a", "#65b6dc"), icon: "⚡", stat: "+1", text: text("+1 энергия и 1 карта.", "Поезд ушёл, а ход остался.", "+1 молния и ещё одна карточка.", "Волшебный билет помогает успеть на следующий ход."), effects: [{ op: "energy", amount: 1, target: "self" }, { op: "draw", amount: 1, target: "self" }], tags: ["transport", "tempo", "energy", "draw"], upgrade: upgrade(0, "+1", [{ op: "energy", amount: 1, target: "self" }, { op: "draw", amount: 1, target: "self" }], "+1 энергия и 1 карта. Стоит 0.", "+1 молния и карточка бесплатно.") },
    { id: "cleaning_card", name: "Визитка клининга", type: "skill", rarity: "common", cost: 1, target: "self", art: art("cleaning", "✚", "#d2c6a8", "#315f72"), icon: "✚", stat: "4", text: text("4 щита и 2 лечения.", "Отмоют всё. Вопросы задавать не будут.", "4 защиты и 2 здоровья.", "Добрые уборщики аккуратно приводят всё в порядок."), effects: [{ op: "shield", amount: 4, target: "self" }, { op: "heal", amount: 2, target: "self" }], tags: ["service", "shield", "heal"], upgrade: upgrade(1, "7", [{ op: "shield", amount: 7, target: "self" }, { op: "heal", amount: 3, target: "self" }], "7 щита и 3 лечения.", "7 защиты и 3 здоровья.") },
    { id: "bank_card", name: "Банковская карта", type: "defense", rarity: "uncommon", cost: 2, target: "self", art: art("bank-card", "₽", "#161719", "#c0b18b"), icon: "🛡", stat: "7", text: text("7 щита. Возьми карту.", "Лимит доверия закончился вчера.", "7 защиты и ещё одна карточка.", "Надёжная карточка помогает пережить трудный момент."), effects: [{ op: "shield", amount: 7, target: "self" }, { op: "draw", amount: 1, target: "self" }], tags: ["finance", "shield", "draw"], upgrade: upgrade(1, "9", [{ op: "shield", amount: 9, target: "self" }, { op: "draw", amount: 1, target: "self" }], "9 щита и 1 карта. Стоит 1.", "9 защиты и карточка за 1 энергию.") },
    { id: "ace_clubs", name: "Туз крести", type: "attack", rarity: "common", cost: 1, target: "opponent", art: art("ace", "♣", "#d2c4a7", "#20201e"), icon: "⚔", stat: "8", text: text("Наносит 8 урона.", "Козырь не спрашивает разрешения.", "Наносит 8 очков урона.", "Сильная игральная карта уверенно идёт вперёд."), effects: [{ op: "damage", amount: 8, target: "opponent" }], tags: ["cards", "damage", "basic"], upgrade: upgrade(1, "11", [{ op: "damage", amount: 11, target: "opponent" }], "Наносит 11 урона.", "Наносит 11 очков урона.") },
    { id: "empty_discount", name: "Пустая скидочная", type: "curse", rarity: "curse", cost: 1, target: "none", art: art("discount", "0%", "#3b203a", "#a95988"), icon: "∅", stat: "0", text: text("Ничего не происходит.", "Срок действия истёк ещё до того, как эту дрянь выдали.", "Карта отдыхает и ничего не делает.", "Иногда карточка просто лежит и ждёт нового дня."), effects: [{ op: "noop" }], tags: ["curse", "noop", "finance"], upgrade: upgrade(0, "0", [{ op: "noop" }], "Ничего не происходит, зато бесплатно.", "Ничего не происходит, но энергия не тратится.") },
    { id: "brick", name: "Кирпич", type: "attack", rarity: "common", cost: 1, target: "opponent", art: art("brick", "▦", "#5b2c1d", "#b65e36"), icon: "⚒", stat: "6", text: text("6 урона. Ломает карту.", "Аргумент весом примерно три килограмма.", "6 урона и одна карта соперника становится дороже.", "Тяжёлый кирпич мешает сопернику быстро разыграть карту."), effects: [{ op: "damage", amount: 6, target: "opponent" }, { op: "break", amount: 1, duration: 2, target: "opponent" }], tags: ["junk", "damage", "break"], upgrade: upgrade(1, "8", [{ op: "damage", amount: 8, target: "opponent" }, { op: "break", amount: 2, duration: 2, target: "opponent" }], "8 урона. Ломает карту на +2 стоимости.", "8 урона и сильнее замедляет карту соперника.") },
    { id: "red_pill", name: "Красная таблетка", type: "power", rarity: "rare", cost: 2, target: "self", art: art("red-pill", "●", "#301516", "#d53e35"), icon: "✦", stat: "+1", text: text("Лечит 5. Даёт силу.", "Обратной дороги в меню уже нет.", "Лечит 5 и усиливает следующие атаки.", "Смелая таблетка помогает стать сильнее."), effects: [{ op: "heal", amount: 5, target: "self" }, { op: "status", statusId: "strength", stacks: 1, duration: 3, timing: "turn_end", target: "self" }], tags: ["medicine", "heal", "strength", "power"], upgrade: upgrade(2, "+2", [{ op: "heal", amount: 7, target: "self" }, { op: "status", statusId: "strength", stacks: 2, duration: 3, timing: "turn_end", target: "self" }], "Лечит 7. Даёт 2 силы.", "Лечит 7 и даёт двойное усиление.") },
    { id: "headshot", name: "Удар в голову", type: "attack", rarity: "rare", cost: 2, target: "opponent", art: art("gun", "▰", "#2d2119", "#b04436"), icon: "☠", stat: "10", text: text("10 урона. Уязвимость.", "Предупредительный выстрел. Последний.", "10 урона и соперник получает больше урона дальше.", "Точный удар открывает слабое место соперника."), effects: [{ op: "damage", amount: 10, target: "opponent" }, { op: "status", statusId: "vulnerable", stacks: 1, duration: 2, timing: "turn_end", target: "opponent" }], tags: ["weapon", "damage", "vulnerable"], upgrade: upgrade(2, "13", [{ op: "damage", amount: 13, target: "opponent" }, { op: "status", statusId: "vulnerable", stacks: 1, duration: 3, timing: "turn_end", target: "opponent" }], "13 урона. Уязвимость на 3 хода.", "13 урона и длинное ослабление защиты.") },
    { id: "loyalty_card", name: "Карта лояльности", type: "skill", rarity: "uncommon", cost: 1, target: "self", art: art("loyalty", "%", "#163c26", "#dbd1a5"), icon: "%", stat: "−1", text: text("Карты дешевле на 1.", "Магазин помнит тебя. Даже когда ты не хочешь.", "Карты стоят на 1 энергию меньше.", "Любимому покупателю дают приятную скидку."), effects: [{ op: "status", statusId: "discount", stacks: 1, duration: 2, timing: "turn_end", target: "self" }], tags: ["finance", "discount", "tempo"], upgrade: upgrade(0, "−1", [{ op: "status", statusId: "discount", stacks: 1, duration: 3, timing: "turn_end", target: "self" }], "Скидка на 3 хода. Стоит 0.", "Бесплатная скидка действует 3 хода.") },
    { id: "marked_card", name: "Меченая карта", type: "skill", rarity: "epic", cost: 2, target: "opponent", art: art("playing-card", "♠", "#4a221c", "#c9a267"), icon: "♠", stat: "1", text: text("Крадёт карту из руки.", "Чужая карта всегда лежит удобнее.", "Забирает одну карту соперника до конца боя.", "Хитрая метка помогает найти чужую карточку."), effects: [{ op: "steal", target: "opponent", zones: ["hand"] }], tags: ["cards", "trick", "steal"], upgrade: upgrade(1, "2", [{ op: "steal", target: "opponent", zones: ["hand"] }, { op: "steal", target: "opponent", zones: ["hand"] }], "Крадёт 2 карты. Стоит 1.", "Забирает две карты соперника за 1 энергию.") },
    { id: "expired_pass", name: "Просроченный пропуск", type: "curse", rarity: "curse", cost: 1, target: "self", art: art("expired-pass", "X", "#1c3342", "#7697a7"), icon: "⌛", stat: "+1", text: text("Блокирует твою карту.", "Турникет сказал нет. Охранник сказал ещё хуже.", "Одна твоя карта временно засыпает.", "Старый пропуск больше не открывает дверь."), effects: [{ op: "block", duration: 1, target: "self", zones: ["hand"] }], tags: ["transport", "curse", "block"], upgrade: upgrade(0, "+1", [{ op: "block", duration: 1, target: "self", zones: ["hand"] }], "Блокирует карту, но стоит 0.", "Усыпляет карту бесплатно.") },
    { id: "coffee_3in1", name: "Кофе 3 в 1", type: "skill", rarity: "common", cost: 1, target: "self", art: art("coffee", "3", "#3a2317", "#d08a43"), icon: "☕", stat: "+1", text: text("Лечит 3. Даёт 1 энергию.", "На вкус как бессонница с сахаром.", "Лечит 3 и даёт 1 энергию.", "Тёплый напиток помогает собраться."), effects: [{ op: "heal", amount: 3, target: "self" }, { op: "energy", amount: 1, target: "self" }], tags: ["food", "heal", "energy"], upgrade: upgrade(0, "+1", [{ op: "heal", amount: 5, target: "self" }, { op: "energy", amount: 1, target: "self" }], "Лечит 5, даёт энергию и стоит 0.", "Лечит 5 и бесплатно даёт энергию.") },
    { id: "cardboard_pickup", name: "Самовывоз", type: "skill", rarity: "common", cost: 1, target: "self", art: art("cardboard", "□", "#5a4025", "#c58e4e"), icon: "▣", stat: "2", text: text("Возьми 2, сбрось случайную.", "Коробка приехала. Что внутри — уже твоя проблема.", "Возьми две карты и одну случайно убери.", "Большая коробка приносит две карточки, но одна не помещается."), effects: [{ op: "draw", amount: 2, target: "self" }, { op: "discard_random", target: "self", zones: ["hand"] }], tags: ["junk", "draw", "discard"], upgrade: upgrade(1, "3", [{ op: "draw", amount: 3, target: "self" }, { op: "discard_random", target: "self", zones: ["hand"] }], "Возьми 3, сбрось одну.", "Возьми три карты и убери одну случайную.") },
    { id: "tax_audit", name: "Налоговая проверка", type: "attack", rarity: "epic", cost: 3, target: "opponent", art: art("tax-audit", "₽", "#1e2b39", "#d19b37"), icon: "⚖", stat: "12", text: text("12 урона. Сбрасывает карту.", "Долги нашли тебя раньше, чем ты нашёл оправдание.", "12 урона и соперник теряет одну карту из руки.", "Строгая проверка заставляет соперника убрать карточку."), effects: [{ op: "damage", amount: 12, target: "opponent" }, { op: "discard_random", target: "opponent", zones: ["hand"] }], tags: ["finance", "damage", "discard", "control"], upgrade: upgrade(2, "15", [{ op: "damage", amount: 15, target: "opponent" }, { op: "discard_random", target: "opponent", zones: ["hand"] }, { op: "break", amount: 1, duration: 2, target: "opponent" }], "15 урона, сброс и поломка. Стоит 2.", "15 урона, одна карта уходит, другая замедляется.") },
    { id: "antidepressants", name: "Антидепрессанты", type: "skill", rarity: "uncommon", cost: 1, target: "self", art: art("antidepressants", "+", "#b9b5a7", "#718b9f"), icon: "✚", stat: "3", text: text("Снимает негатив. Лечит 3.", "Побочные эффекты перечислены мелким шрифтом на другой стороне реальности.", "Убирает неприятный эффект и лечит 3.", "Лекарство помогает успокоиться и восстановить силы."), effects: [{ op: "cleanse", amount: 1, statuses: NEGATIVE_STATUSES, target: "self" }, { op: "heal", amount: 3, target: "self" }], tags: ["medicine", "cleanse", "heal"], upgrade: upgrade(1, "5", [{ op: "cleanse", amount: 3, statuses: NEGATIVE_STATUSES, target: "self" }, { op: "heal", amount: 5, target: "self" }], "Снимает до 3 негативов. Лечит 5.", "Убирает до трёх неприятностей и лечит 5.") },
    { id: "pc_virus", name: "Вирус в ПК", type: "skill", rarity: "rare", cost: 2, target: "opponent", art: art("pc-virus", "!", "#13251d", "#4db36b"), icon: "⌁", stat: "2", text: text("Блокирует карту. Даёт слабость.", "Антивирус был бесплатный. Результат тоже.", "Одна карта соперника спит 2 хода, а атаки слабеют.", "Забавный компьютерный вирус временно мешает сопернику."), effects: [{ op: "block", duration: 2, target: "opponent", zones: ["hand"] }, { op: "status", statusId: "weak", stacks: 1, duration: 2, timing: "turn_end", target: "opponent" }], tags: ["tech", "control", "block", "weak"], upgrade: upgrade(1, "2", [{ op: "block", duration: 2, target: "opponent", zones: ["hand"] }, { op: "block", duration: 2, target: "opponent", zones: ["hand"] }, { op: "status", statusId: "weak", stacks: 1, duration: 2, timing: "turn_end", target: "opponent" }], "Блокирует 2 карты и ослабляет. Стоит 1.", "Усыпляет две карты и ослабляет соперника.") },
    { id: "instant_noodles", name: "Бомж-пакет", type: "curse", rarity: "curse", cost: 0, target: "self", art: art("instant-noodles", "≈", "#4c2a1a", "#d77b2e"), icon: "≈", stat: "+2", text: text("Лечит 2. Даёт уязвимость.", "Дёшево, сердито и желудок подал заявление на увольнение.", "Лечит 2, но защита становится слабее.", "Быстрая лапша немного лечит, но после неё хочется отдохнуть."), effects: [{ op: "heal", amount: 2, target: "self" }, { op: "status", statusId: "vulnerable", stacks: 1, duration: 1, timing: "turn_end", target: "self" }], tags: ["food", "curse", "heal", "vulnerable"], upgrade: upgrade(0, "+4", [{ op: "heal", amount: 4, target: "self" }], "Лечит 4 без побочки.", "Лечит 4 и больше не ослабляет защиту.") },
    { id: "revolver", name: "Револьвер", type: "attack", rarity: "legendary", cost: 3, target: "opponent", exhaust: true, art: art("revolver", "✦", "#211812", "#d5a23b"), icon: "☠", stat: "16", text: text("16 урона. Изгоняется.", "Шесть аргументов, но хватит одного.", "Наносит 16 урона и покидает бой.", "Редкая сильная карта делает один очень мощный ход."), effects: [{ op: "damage", amount: 16, target: "opponent" }], tags: ["weapon", "damage", "finisher", "exhaust"], upgrade: upgrade(2, "21", [{ op: "damage", amount: 21, target: "opponent" }], "21 урона. Стоит 2 и изгоняется.", "21 урона за 2 энергии, затем карта отдыхает.") },
    { id: "blue_pill", name: "Синяя таблетка", type: "defense", rarity: "common", cost: 1, target: "self", art: art("blue-pill", "●", "#12243f", "#4f82cf"), icon: "⬟", stat: "8", text: text("8 щита. Получи слабость.", "Спокойствие есть. Желание драться временно отсутствует.", "8 защиты, но следующая атака слабее.", "Синяя таблетка хорошо защищает, но немного усыпляет."), effects: [{ op: "shield", amount: 8, target: "self" }, { op: "status", statusId: "weak", stacks: 1, duration: 1, timing: "turn_end", target: "self" }], tags: ["medicine", "shield", "weak"], upgrade: upgrade(1, "10", [{ op: "shield", amount: 10, target: "self" }], "10 щита без слабости.", "10 защиты без неприятного эффекта.") },
    { id: "rewind_tape", name: "Кассета перемотки", type: "skill", rarity: "rare", cost: 1, target: "self", exhaust: true, art: art("rewind-tape", "◀", "#2e2533", "#b176c0"), icon: "↶", stat: "1", text: text("Верни карту из сброса.", "Назад в прошлое. Но только на одну ошибку.", "Возвращает одну карту из сброса в руку.", "Кассета перематывает одну сыгранную карточку обратно."), effects: [{ op: "return_from_discard", amount: 1, target: "self" }], tags: ["retro", "recursion", "discard", "exhaust"], upgrade: upgrade(0, "2", [{ op: "return_from_discard", amount: 2, target: "self" }], "Верни 2 карты бесплатно. Изгоняется.", "Бесплатно возвращает две карты и затем отдыхает.") },
    { id: "memory_card", name: "Карта памяти 8 МБ", type: "power", rarity: "uncommon", cost: 1, target: "self", art: art("memory-card", "8", "#282728", "#9fa184"), icon: "▤", stat: "+2", text: text("Регенерация 2 на 3 хода.", "Вмещает два сохранения и одну детскую травму.", "Три хода восстанавливает по 2 здоровья.", "Маленькая карта хранит запас здоровья на несколько ходов."), effects: [{ op: "status", statusId: "regeneration", stacks: 2, duration: 3, timing: "turn_start", target: "self" }], tags: ["tech", "memory", "regeneration", "power"], upgrade: upgrade(1, "+3", [{ op: "status", statusId: "regeneration", stacks: 3, duration: 3, timing: "turn_start", target: "self" }], "Регенерация 3 на 3 хода.", "Три хода восстанавливает по 3 здоровья.") },
    { id: "shawarma_coupon", name: "Купон на шаурму", type: "skill", rarity: "common", cost: 1, target: "self", art: art("shawarma", "▰", "#4b2f18", "#d5a339"), icon: "✚", stat: "6", text: text("Лечит 6.", "Соус скрывает всё, включая происхождение мяса.", "Восстанавливает 6 здоровья.", "Вкусная еда помогает быстро восстановить силы."), effects: [{ op: "heal", amount: 6, target: "self" }], tags: ["food", "heal", "basic"], upgrade: upgrade(1, "8", [{ op: "heal", amount: 8, target: "self" }, { op: "shield", amount: 3, target: "self" }], "Лечит 8 и даёт 3 щита.", "Восстанавливает 8 здоровья и даёт 3 защиты.") },
    { id: "pirate_disc", name: "Пиратский диск", type: "power", rarity: "epic", cost: 2, target: "self", art: art("pirate-disc", "☠", "#1e1e20", "#b69c50"), icon: "✦", stat: "+2", text: text("2 силы. Сжигает карту из колоды.", "Кряк работает. Гарантия умерла при установке.", "Даёт 2 силы, но одна карта покидает колоду до конца боя.", "Очень мощный диск усиливает атаки, но просит одну карточку взамен."), effects: [{ op: "status", statusId: "strength", stacks: 2, duration: 4, timing: "turn_end", target: "self" }, { op: "burn", target: "self", zones: ["drawPile"] }], tags: ["tech", "strength", "risk", "power", "burn"], upgrade: upgrade(2, "+3", [{ op: "status", statusId: "strength", stacks: 3, duration: 4, timing: "turn_end", target: "self" }], "3 силы без потери карты.", "Даёт 3 силы и ничего не забирает.") },
    { id: "service_badge", name: "Служебный пропуск", type: "skill", rarity: "uncommon", cost: 1, target: "opponent", art: art("service-badge", "ID", "#273641", "#73a1bb"), icon: "▣", stat: "1", text: text("Крадёт карту из колоды.", "Лицо уверенное — значит, сотрудник.", "Забирает случайную карту из колоды соперника.", "Служебный бейдж помогает пройти туда, где лежат чужие карты."), effects: [{ op: "steal", target: "opponent", zones: ["drawPile"] }], tags: ["service", "transport", "steal", "trick"], upgrade: upgrade(1, "1", [{ op: "steal", target: "opponent", zones: ["hand"] }], "Крадёт карту прямо из руки.", "Забирает случайную карту из руки соперника.") },
    { id: "red_button", name: "Красная кнопка", type: "attack", rarity: "legendary", cost: 3, target: "opponent", exhaust: true, art: art("red-button", "●", "#381411", "#e13d2e"), icon: "☢", stat: "20", text: text("20 урона. Ты получаешь 6.", "Не нажимать. Поэтому ты, конечно, нажал.", "20 урона сопернику и 6 урона тебе.", "Очень большая кнопка наносит сильный урон обеим сторонам."), effects: [{ op: "damage", amount: 20, target: "opponent" }, { op: "damage", amount: 6, target: "self" }], tags: ["tech", "damage", "risk", "finisher", "exhaust"], upgrade: upgrade(2, "24", [{ op: "damage", amount: 24, target: "opponent" }, { op: "damage", amount: 4, target: "self" }], "24 урона сопернику, 4 тебе. Стоит 2.", "24 урона сопернику и только 4 тебе за 2 энергии.") },
    { id: "blue_screen", name: "Синий экран", type: "skill", rarity: "rare", cost: 2, target: "opponent", art: art("blue-screen", ":(", "#0c2c69", "#d5e7ff"), icon: "▧", stat: "2", text: text("Блокирует карту на 2 хода. Слабость.", "Ошибка найдена между стулом и колодой.", "Одна карта соперника спит 2 хода, а атаки слабеют.", "Синий экран временно останавливает карточку соперника."), effects: [{ op: "block", duration: 2, target: "opponent", zones: ["hand"] }, { op: "status", statusId: "weak", stacks: 1, duration: 2, timing: "turn_end", target: "opponent" }], tags: ["tech", "control", "block", "weak"], upgrade: upgrade(2, "2", [{ op: "block", duration: 2, target: "opponent", zones: ["hand"] }, { op: "block", duration: 2, target: "opponent", zones: ["hand"] }, { op: "status", statusId: "weak", stacks: 1, duration: 3, timing: "turn_end", target: "opponent" }], "Блокирует 2 карты и слабость на 3 хода.", "Усыпляет две карты и надолго ослабляет атаки.") },
    { id: "fine_print", name: "Договор мелким шрифтом", type: "skill", rarity: "epic", cost: 2, target: "opponent", art: art("fine-print", "§", "#d0c4a7", "#34302a"), icon: "§", stat: "2", text: text("Крадёт карту и ломает другую.", "Ты согласился, поставив галочку, которую никто не видел.", "Забирает одну карту и делает другую дороже.", "Хитрый договор меняет две карточки соперника."), effects: [{ op: "steal", target: "opponent", zones: ["hand"] }, { op: "break", amount: 1, duration: 2, target: "opponent", zones: ["hand"] }], tags: ["finance", "control", "steal", "break"], upgrade: upgrade(1, "3", [{ op: "steal", target: "opponent", zones: ["hand"] }, { op: "steal", target: "opponent", zones: ["hand"] }, { op: "break", amount: 1, duration: 2, target: "opponent", zones: ["hand"] }], "Крадёт 2 карты и ломает третью. Стоит 1.", "Забирает две карты и замедляет ещё одну.") },
    { id: "zero_receipt", name: "Чек на 0 рублей", type: "skill", rarity: "common", cost: 0, target: "self", art: art("zero-receipt", "0", "#c9bea2", "#494239"), icon: "▤", stat: "1", text: text("Возьми 1 карту.", "Покупка совершена. Смысла не обнаружено.", "Бесплатно возьми одну карту.", "Маленький чек помогает найти следующую карточку."), effects: [{ op: "draw", amount: 1, target: "self" }], tags: ["finance", "draw", "tempo"], upgrade: upgrade(0, "2", [{ op: "draw", amount: 2, target: "self" }], "Бесплатно возьми 2 карты.", "Бесплатно возьми две карточки.") },
    { id: "fire_extinguisher", name: "Огнетушитель", type: "defense", rarity: "uncommon", cost: 1, target: "self", art: art("extinguisher", "!", "#441817", "#d64034"), icon: "⬟", stat: "7", text: text("7 щита. Снимает ожог.", "Инструкция: выдернуть чеку, направить на последствия своих решений.", "7 защиты и убирает ожог.", "Огнетушитель защищает и тушит неприятный огонь."), effects: [{ op: "shield", amount: 7, target: "self" }, { op: "cleanse", amount: 1, statuses: ["burn"], target: "self" }], tags: ["service", "shield", "cleanse", "junk"], upgrade: upgrade(1, "10", [{ op: "shield", amount: 10, target: "self" }, { op: "cleanse", amount: 3, statuses: NEGATIVE_STATUSES, target: "self" }], "10 щита. Снимает до 3 негативов.", "10 защиты и убирает до трёх неприятностей.") },
    { id: "insurance_policy", name: "Страховка", type: "power", rarity: "rare", cost: 2, target: "self", art: art("insurance", "+", "#1d3040", "#69a2c4"), icon: "✚", stat: "6", text: text("6 щита. Регенерация 1 на 5 ходов.", "Покрывает всё, кроме именно твоего случая.", "6 защиты и по 1 лечению пять ходов.", "Полис помогает защищаться и понемногу восстанавливаться."), effects: [{ op: "shield", amount: 6, target: "self" }, { op: "status", statusId: "regeneration", stacks: 1, duration: 5, timing: "turn_start", target: "self" }], tags: ["finance", "shield", "regeneration", "power"], upgrade: upgrade(1, "8", [{ op: "shield", amount: 8, target: "self" }, { op: "status", statusId: "regeneration", stacks: 2, duration: 5, timing: "turn_start", target: "self" }], "8 щита. Регенерация 2 на 5 ходов. Стоит 1.", "8 защиты и по 2 лечения пять ходов за 1 энергию.") }
  ];

  function normalizeCard(raw) {
    const card = clone(raw);
    card.short = card.text.adult.short;
    card.lore = card.text.adult.lore;
    card.artKey = card.art.key;
    if (card.upgrade) {
      card.upgrade.target = card.upgrade.target || card.target;
      card.upgrade.exhaust = card.upgrade.exhaust == null ? Boolean(card.exhaust) : Boolean(card.upgrade.exhaust);
      card.upgrade.tags = card.upgrade.tags || card.tags;
    }
    return deepFreeze(card);
  }
  const cards = deepFreeze(RAW_CARDS.map(normalizeCard));
  const byId = Object.freeze(Object.fromEntries(cards.map((card) => [card.id, card])));
  function engineCard(card) {
    return deepFreeze({ id: card.id, name: card.name, type: card.type, rarity: card.rarity, cost: card.cost, target: card.target, exhaust: Boolean(card.exhaust), effects: clone(card.effects), tags: clone(card.tags), upgrade: clone(card.upgrade), art: card.art.key, stat: card.stat, short: card.text.adult.short, lore: card.text.adult.lore, text: clone(card.text) });
  }
  const engineCards = deepFreeze(cards.map(engineCard));

  function getCard(id, options) {
    const base = byId[id];
    if (!base) return null;
    const safe = Boolean(options && options.safe);
    const upgraded = Number(options && options.upgrade) > 0 && base.upgrade;
    const mode = safe ? "safe" : "adult";
    const view = clone(base);
    view.short = base.text[mode].short;
    view.lore = base.text[mode].lore;
    if (upgraded) {
      const patch = base.upgrade;
      view.name = `${base.name}+`;
      view.cost = patch.cost == null ? base.cost : patch.cost;
      view.stat = patch.stat == null ? base.stat : patch.stat;
      view.effects = clone(patch.effects || base.effects);
      view.target = patch.target || base.target;
      view.exhaust = patch.exhaust == null ? Boolean(base.exhaust) : Boolean(patch.exhaust);
      view.tags = clone(patch.tags || base.tags);
      view.short = patch.text && patch.text[mode] && patch.text[mode].short ? patch.text[mode].short : view.short;
    }
    return view;
  }

  function hashSeed(value) {
    const source = String(value == null ? 1 : value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return hash >>> 0 || 1;
  }
  function rng(seed) {
    let value = hashSeed(seed);
    return function () { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
  }
  function shuffled(list, seed) {
    const output = list.slice();
    const random = rng(seed);
    for (let index = output.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [output[index], output[target]] = [output[target], output[index]]; }
    return output;
  }
  function take(pool, amount, seed, selected) {
    return shuffled(pool.filter((card) => !selected.has(card.id)), seed).slice(0, amount).map((card) => { selected.add(card.id); return card.id; });
  }
  function buildDeck(side, seed) {
    const selected = new Set();
    const nonCurse = cards.filter((card) => card.type !== "curse");
    const groups = { attack: nonCurse.filter((card) => card.type === "attack"), defense: nonCurse.filter((card) => card.type === "defense"), skill: nonCurse.filter((card) => card.type === "skill"), power: nonCurse.filter((card) => card.type === "power"), curse: cards.filter((card) => card.type === "curse") };
    const plan = side === "dealer" ? [["attack", 4], ["defense", 1], ["skill", 3], ["power", 1], ["curse", 1]] : [["attack", 3], ["defense", 2], ["skill", 3], ["power", 1], ["curse", 1]];
    const result = [];
    plan.forEach(([type, amount], index) => result.push(...take(groups[type], amount, `${seed}:${side}:${type}:${index}`, selected)));
    if (result.length < 10) result.push(...take(cards, 10 - result.length, `${seed}:${side}:fill`, selected));
    return shuffled(result, `${seed}:${side}:final`).slice(0, 10);
  }
  function decorateBattleConfig(input) {
    const config = clone(input || {});
    const battleSeed = config.seed == null ? 1 : config.seed;
    config.cards = engineCards;
    config.player = Object.assign({}, config.player || {}, { deck: buildDeck("player", battleSeed) });
    config.dealer = Object.assign({}, config.dealer || {}, { deck: buildDeck("dealer", `${battleSeed}:dealer`) });
    config.rules = Object.assign({}, config.rules || {}, { catalogVersion: DATA_VERSION });
    return config;
  }
  function escapeXml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]); }
  function artDataUri(cardOrId) {
    const card = typeof cardOrId === "string" ? byId[cardOrId] : cardOrId;
    if (!card) return "";
    const palette = card.art.palette;
    const random = rng(card.id);
    const pixels = [];
    for (let index = 0; index < 32; index += 1) {
      const x = Math.floor(random() * 15) * 16;
      const y = Math.floor(random() * 11) * 16;
      const size = random() > .72 ? 16 : 8;
      pixels.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${index % 3 === 0 ? palette.accent : palette.detail}" opacity="${(.08 + random() * .18).toFixed(2)}"/>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="176" viewBox="0 0 240 176" shape-rendering="crispEdges"><rect width="240" height="176" fill="${palette.background}"/><rect x="8" y="8" width="224" height="160" fill="none" stroke="${palette.accent}" stroke-width="4" opacity=".55"/>${pixels.join("")}<rect x="56" y="34" width="128" height="108" fill="#080706" opacity=".45"/><text x="120" y="108" text-anchor="middle" font-family="monospace" font-size="58" font-weight="900" fill="${palette.accent}" stroke="#080706" stroke-width="3" paint-order="stroke">${escapeXml(card.art.symbol)}</text><rect x="16" y="148" width="208" height="8" fill="${palette.accent}" opacity=".55"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function validateCatalog(input) {
    const list = input || cards;
    const errors = [];
    const ids = new Set();
    if (!Array.isArray(list)) errors.push("Каталог должен быть массивом.");
    if (Array.isArray(list) && list.length !== 30) errors.push(`Ожидалось 30 карт, получено ${list.length}.`);
    (Array.isArray(list) ? list : []).forEach((card, index) => {
      const label = card && card.id ? card.id : `#${index}`;
      if (!card || !card.id) errors.push(`${label}: отсутствует id.`); else if (ids.has(card.id)) errors.push(`${label}: повторяющийся id.`); else ids.add(card.id);
      if (!TYPES.includes(card.type)) errors.push(`${label}: неизвестный тип ${card.type}.`);
      if (!RARITIES.includes(card.rarity)) errors.push(`${label}: неизвестная редкость ${card.rarity}.`);
      if (!Number.isInteger(card.cost) || card.cost < 0) errors.push(`${label}: некорректная стоимость.`);
      if (!card.text || !card.text.adult || !card.text.safe || !card.text.adult.short || !card.text.safe.short || !card.text.adult.lore || !card.text.safe.lore) errors.push(`${label}: нет взрослого или безопасного текста.`);
      if (!Array.isArray(card.effects) || !card.effects.length) errors.push(`${label}: нет эффектов.`);
      if (!Array.isArray(card.tags) || card.tags.length < 2) errors.push(`${label}: нужны теги синергий.`);
      if (!card.upgrade || !Array.isArray(card.upgrade.effects) || !card.upgrade.effects.length) errors.push(`${label}: нет улучшенной версии.`);
      if (!card.art || !card.art.key || !card.art.symbol || !card.art.palette) errors.push(`${label}: нет иллюстрации.`);
    });
    ["common", "uncommon", "rare", "epic", "legendary"].forEach((rarity) => { if (!(Array.isArray(list) && list.some((card) => card.rarity === rarity))) errors.push(`Нет карт редкости ${rarity}.`); });
    return { ok: errors.length === 0, errors };
  }
  const validation = validateCatalog(cards);
  if (!validation.ok) throw new Error(`Некорректный каталог карт:\n${validation.errors.join("\n")}`);
  return Object.freeze({ DATA_VERSION, TYPES, RARITIES, NEGATIVE_STATUSES, cards, byId, engineCards, getCard, buildDeck, decorateBattleConfig, artDataUri, validateCatalog });
});
