"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastDealerCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DATA_VERSION = 1;
  const STORAGE_KEY = "bitaya-mast-stage6-dealer-v1";
  const TIERS = Object.freeze({ COMMON: "common", ELITE: "elite", BOSS: "boss" });
  const ARCHETYPES = Object.freeze({ TRICKSTER: "trickster", AGGRESSOR: "aggressor", CONTROLLER: "controller", COMBO: "combo", DEFENDER: "defender", CHAOS: "chaos", BOSS: "boss" });

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(deepFreeze); return value; }
  function hash(value) { const source = String(value); let result = 2166136261; for (let index = 0; index < source.length; index += 1) { result ^= source.charCodeAt(index); result = Math.imul(result, 16777619); } return result >>> 0; }
  function randomFrom(value) { let state = hash(value) || 1; return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; }
  function quote(adult, safe) { return Object.freeze({ adult, safe }); }

  const DEALERS = deepFreeze([
    {
      id: "shuler", order: 1, tier: TIERS.COMMON, name: "Шулер", title: "Меченая колода", archetype: ARCHETYPES.TRICKSTER,
      difficulty: 1, mistakeRate: .22, maxHp: 48, maxEnergy: 3, symbol: "♠", palette: ["#21110d", "#9e3d2e", "#c6a46a"],
      preferredTags: ["trick", "steal", "cards", "break", "discount", "control"], typeBias: { skill: 5, attack: 2, defense: 1 }, curseLimit: 1,
      ability: { id: "marked_deck", name: "Меченая колода", description: "Первый приём каждого боя стоит Шулеру на 1 энергию меньше." },
      quotes: { intro: quote("«Я не жульничаю. Я просто знаю карты лично.»", "«Я очень хорошо знаю свою колоду.»"), low: quote("«Рано радуешься. Козырь ещё в рукаве.»", "«Игра ещё не закончена.»"), win: quote("«Сдача была честной. Почти.»", "«Сегодня удача была на моей стороне.»"), lose: quote("«Колода подвела. Такое бывает раз в жизни.»", "«В этот раз твоя стратегия оказалась сильнее.»") }
    },
    {
      id: "collector", order: 2, tier: TIERS.COMMON, name: "Коллектор", title: "Сложный процент", archetype: ARCHETYPES.AGGRESSOR,
      difficulty: 2, mistakeRate: .14, maxHp: 56, maxEnergy: 3, symbol: "₽", palette: ["#171414", "#b34732", "#d1a63e"],
      preferredTags: ["finance", "damage", "weapon", "vulnerable", "finisher", "risk"], typeBias: { attack: 6, power: 2, skill: 1 }, curseLimit: 0,
      ability: { id: "compound_interest", name: "Сложный процент", description: "Каждый второй раунд получает 1 силу до конца своего следующего хода." },
      quotes: { intro: quote("«Проценты капают, даже когда ты думаешь.»", "«Каждый раунд делает долг немного больше.»"), low: quote("«Здоровье можно списать. Долг нельзя.»", "«Я всё ещё могу вернуться в игру.»"), win: quote("«Оплата прошла успешно.»", "«Счёт закрыт в мою пользу.»"), lose: quote("«Это временная реструктуризация поражения.»", "«Сегодня договор оказался выгоднее для тебя.»") }
    },
    {
      id: "sysadmin", order: 3, tier: TIERS.COMMON, name: "Сисадмин", title: "Корпоративный firewall", archetype: ARCHETYPES.CONTROLLER,
      difficulty: 2, mistakeRate: .11, maxHp: 52, maxEnergy: 3, symbol: ">_", palette: ["#071712", "#2f9e61", "#76d39c"],
      preferredTags: ["tech", "control", "block", "weak", "break", "service"], typeBias: { skill: 6, defense: 2, attack: 1 }, curseLimit: 1,
      ability: { id: "firewall", name: "Корпоративный firewall", description: "Начинает бой с 8 щита и раз в три раунда блокирует случайную карту игрока." },
      quotes: { intro: quote("«Проблема на твоей стороне. Я проверял.»", "«Давай найдём ошибку в твоей стратегии.»"), low: quote("«Перезагрузка не поможет. Наверное.»", "«Система работает нестабильно, но ещё работает.»"), win: quote("«Тикет закрыт без решения.»", "«Заявка завершена.»"), lose: quote("«У тебя просто кэш очистился удачно.»", "«Похоже, обновление действительно помогло.»") }
    },
    {
      id: "projectionist", order: 4, tier: TIERS.COMMON, name: "Киномеханик", title: "Двойной сеанс", archetype: ARCHETYPES.COMBO,
      difficulty: 2, mistakeRate: .10, maxHp: 50, maxEnergy: 4, symbol: "▶", palette: ["#211b24", "#a45b91", "#d7b36b"],
      preferredTags: ["retro", "recursion", "draw", "energy", "discount", "tempo"], typeBias: { skill: 5, power: 3, attack: 1 }, curseLimit: 0,
      ability: { id: "double_feature", name: "Двойной сеанс", description: "После второй сыгранной карты за ход получает 1 дополнительную энергию один раз за ход." },
      quotes: { intro: quote("«Фильм уже начался. Финал тебе не понравится.»", "«Сеанс начинается. Посмотрим, чем всё закончится.»"), low: quote("«Плёнка рвётся только перед лучшей сценой.»", "«Самая важная сцена ещё впереди.»"), win: quote("«Титры. Свет включать не будем.»", "«Сеанс окончен.»"), lose: quote("«Это была режиссёрская версия поражения.»", "«У этой истории оказался другой финал.»") }
    },
    {
      id: "archivist", order: 5, tier: TIERS.ELITE, name: "Архивариус", title: "Неприкосновенный фонд", archetype: ARCHETYPES.DEFENDER,
      difficulty: 3, mistakeRate: .05, maxHp: 72, maxEnergy: 4, symbol: "▤", palette: ["#242018", "#8b7042", "#d8c796"],
      preferredTags: ["shield", "heal", "regeneration", "power", "memory", "cleanse"], typeBias: { defense: 6, power: 5, skill: 2 }, curseLimit: 0,
      ability: { id: "sealed_archive", name: "Неприкосновенный фонд", description: "Один раз при падении ниже половины здоровья получает 14 щита и лечится на 5." },
      quotes: { intro: quote("«На каждую твою ошибку у меня уже заведена папка.»", "«Все ходы аккуратно записываются.»"), low: quote("«Архив горел и раньше. Документы выживали.»", "«Запас прочности ещё не исчерпан.»"), win: quote("«Дело подшито. Обжалованию не подлежит.»", "«Партия отправлена в архив.»"), lose: quote("«Папку придётся пометить как утрачено.»", "«Эту запись придётся пересмотреть.»") }
    },
    {
      id: "mascot", order: 6, tier: TIERS.ELITE, name: "Забытый маскот", title: "Сломанный сценарий", archetype: ARCHETYPES.CHAOS,
      difficulty: 3, mistakeRate: .17, maxHp: 66, maxEnergy: 4, symbol: ":)", palette: ["#24132a", "#d54c86", "#5dc5d4"],
      preferredTags: ["curse", "risk", "junk", "food", "tech", "noop"], typeBias: { curse: 5, skill: 3, attack: 2 }, curseLimit: 2,
      ability: { id: "broken_script", name: "Сломанный сценарий", description: "В начале своего хода случайно получает 5 щита, 1 силу или 1 энергию." },
      quotes: { intro: quote("«Улыбайся. Камеры давно выключены.»", "«Добро пожаловать на весёлую игру.»"), low: quote("«НЕ УХОДИ. ШОУ ТОЛЬКО НАЧАЛОСЬ.»", "«Пожалуйста, останься до конца представления.»"), win: quote("«УДАЧИ! УДАЧИ! УДАЧИ!»", "«Спасибо за участие в шоу.»"), lose: quote("«СЦЕНАРИЙ НЕ НАЙДЕН. ОШИБКА. ОШИБКА.»", "«Кажется, представление пошло не по плану.»") }
    },
    {
      id: "house_master", order: 7, tier: TIERS.BOSS, name: "Хозяин стола", title: "Правила дома", archetype: ARCHETYPES.BOSS,
      difficulty: 4, mistakeRate: 0, maxHp: 95, maxEnergy: 4, symbol: "☠", palette: ["#100b09", "#b52f26", "#d2a13b"],
      preferredTags: ["damage", "control", "shield", "strength", "finisher", "steal", "vulnerable"], typeBias: { attack: 4, skill: 4, defense: 3, power: 3 }, curseLimit: 0,
      ability: { id: "house_rules", name: "Правила дома", description: "На половине здоровья переходит во вторую фазу: лечится на 10, получает 2 силы и увеличивает максимум энергии до 5." },
      quotes: { intro: quote("«За этим столом случайностей не бывает.»", "«За этим столом действуют особые правила.»"), low: quote("«Теперь играем по настоящим правилам.»", "«Начинается вторая часть партии.»"), win: quote("«Дом всегда забирает своё.»", "«Правила дома снова сработали.»"), lose: quote("«Стол запомнил твоё имя.»", "«Ты победил. Но стол тебя запомнил.»") }
    }
  ]);

  const byId = Object.freeze(Object.fromEntries(DEALERS.map((dealer) => [dealer.id, dealer])));

  function getDealer(id) { return byId[id] || byId.shuler; }
  function normalizeId(id) { return getDealer(id).id; }
  function readSelection(storage) { try { return normalizeId(storage && storage.getItem(STORAGE_KEY)); } catch (error) { return "shuler"; } }
  function saveSelection(id, storage) { const normalized = normalizeId(id); try { if (storage) storage.setItem(STORAGE_KEY, normalized); } catch (error) { /* memory-only environments keep the selected value in UI */ } return normalized; }
  function quoteFor(dealer, key, safe) { const profile = typeof dealer === "string" ? getDealer(dealer) : dealer; const entry = profile.quotes[key] || profile.quotes.intro; return entry[safe ? "safe" : "adult"]; }

  function cardScore(card, profile, seed) {
    const tags = Array.isArray(card.tags) ? card.tags : [];
    let score = Number(profile.typeBias[card.type] || 0) * 7;
    profile.preferredTags.forEach((tag, index) => { if (tags.includes(tag)) score += 18 - Math.min(index, 8); });
    if (card.rarity === "legendary") score += profile.difficulty * 2;
    if (card.type === "curse") score += profile.archetype === ARCHETYPES.CHAOS ? 18 : -30;
    score += randomFrom(`${seed}:${profile.id}:${card.id}`)() * 5;
    return score;
  }

  function buildDealerDeck(catalog, dealerId, seed) {
    const profile = getDealer(dealerId);
    const cards = (catalog && Array.isArray(catalog.cards) ? catalog.cards : []).slice();
    if (!cards.length) return [];
    const ranked = cards.sort((first, second) => cardScore(second, profile, seed) - cardScore(first, profile, seed));
    const selected = [];
    let curses = 0;
    ranked.forEach((card) => {
      if (selected.length >= 10) return;
      if (card.type === "curse" && curses >= profile.curseLimit) return;
      selected.push(card.id);
      if (card.type === "curse") curses += 1;
    });
    return selected.slice(0, 10);
  }

  function decorateBattleConfig(input, catalog, dealerId) {
    const config = clone(input || {});
    const profile = getDealer(dealerId || config.dealerId);
    const battleSeed = config.seed == null ? 1 : config.seed;
    config.dealerId = profile.id;
    config.disableCatalogDecks = true;
    config.useCatalogDecks = false;
    if (catalog) {
      config.cards = catalog.engineCards || config.cards;
      if (typeof catalog.buildDeck === "function") config.player = Object.assign({}, config.player || {}, { deck: catalog.buildDeck("player", battleSeed) });
    }
    config.dealer = Object.assign({}, config.dealer || {}, {
      name: profile.name,
      maxHp: profile.maxHp,
      hp: profile.maxHp,
      maxEnergy: profile.maxEnergy,
      deck: buildDealerDeck(catalog, profile.id, `${battleSeed}:dealer:${profile.id}`)
    });
    config.rules = Object.assign({}, config.rules || {}, { dealerId: profile.id, dealerCatalogVersion: DATA_VERSION });
    return config;
  }

  function portraitDataUri(dealer) {
    const profile = typeof dealer === "string" ? getDealer(dealer) : dealer;
    const [background, accent, detail] = profile.palette;
    const symbol = String(profile.symbol).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420" shape-rendering="crispEdges"><rect width="320" height="420" fill="${background}"/><rect x="34" y="38" width="252" height="344" fill="#070606" opacity=".48"/><rect x="92" y="54" width="136" height="126" fill="${detail}" opacity=".25"/><rect x="76" y="82" width="168" height="122" fill="#160f0c"/><rect x="98" y="112" width="34" height="26" fill="${accent}"/><rect x="188" y="112" width="34" height="26" fill="${accent}"/><rect x="128" y="164" width="64" height="12" fill="${detail}" opacity=".65"/><rect x="54" y="202" width="212" height="154" fill="#110c0a"/><rect x="42" y="248" width="236" height="82" fill="${accent}" opacity=".13"/><text x="160" y="310" text-anchor="middle" font-family="monospace" font-size="72" font-weight="900" fill="${accent}" stroke="#050404" stroke-width="6" paint-order="stroke">${symbol}</text><rect x="18" y="18" width="284" height="384" fill="none" stroke="${accent}" stroke-width="6" opacity=".55"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  return Object.freeze({ DATA_VERSION, STORAGE_KEY, TIERS, ARCHETYPES, dealers: DEALERS, byId, getDealer, normalizeId, readSelection, saveSelection, quoteFor, buildDealerDeck, decorateBattleConfig, portraitDataUri });
});
