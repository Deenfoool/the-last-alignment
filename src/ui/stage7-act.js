"use strict";
(function () {
  const Run = window.BitayaMastActRun;
  const Profile = window.BitayaMastRunProfile;
  const Act = window.BitayaMastAct1Content;
  const Catalog = window.BitayaMastCardCatalog;
  const Content = window.BitayaMastContentSettings;
  const Timer = window.BitayaMastTimerSettings;
  const Dealers = window.BitayaMastDealerCatalog;
  const Assets = window.BitayaMastAssets || {};
  if (!Run || !Profile || !Act || !Catalog || !Content || !Timer || !Dealers) throw new Error("Не загружены модули первого акта.");

  const BATTLE_SAVE_KEY = "bitaya-mast-stage3-battle-v2";
  const BATTLE_CONTEXT_KEY = "bitaya-mast-stage7-battle-context-v1";
  const BATTLE_RESULT_KEY = "bitaya-mast-stage7-battle-result-v1";
  const TIMER_SETTINGS_KEY = "bitaya-mast-stage3-settings-v1";
  const overlay = document.querySelector("#actOverlay");
  const app = document.querySelector("#app");
  const setup = document.querySelector("#setupOverlay");
  const resultOverlay = document.querySelector("#resultOverlay");
  const runButton = document.querySelector("#runButton");
  let storage = safeStorage();
  let run = loadRun();
  let profile = Profile.load(storage);
  let toastTimer = null;

  function safeStorage() { try { return window.localStorage; } catch (error) { return null; } }
  function readJson(key) { try { const raw = storage && storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (error) { return null; } }
  function writeJson(key, value) { try { if (storage) storage.setItem(key, JSON.stringify(value)); } catch (error) { /* private browser mode */ } }
  function removeKey(key) { try { if (storage) storage.removeItem(key); } catch (error) { /* private browser mode */ } }
  function loadRun() { const raw = readJson(Run.STORAGE_KEY); if (!raw) return null; try { return Run.migrate(raw); } catch (error) { removeKey(Run.STORAGE_KEY); return null; } }
  function saveRun() { if (run) writeJson(Run.STORAGE_KEY, run); }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
  function safeMode() { return Content.isSafe(Content.load(storage)); }
  function text(entry) { return Act.projectText(entry, safeMode()); }
  function cardView(entry) { const base = Catalog.byId[entry.id]; return Content.projectCard(base, Content.load(storage), entry.upgrade > 0); }
  function cardArt(card) { return Assets[card.art] || (typeof Catalog.artDataUri === "function" ? Catalog.artDataUri(card.id) : ""); }
  function artifact(id) { return Act.byArtifactId[id]; }
  function timerSettings() { return Timer.migrate(readJson(TIMER_SETTINGS_KEY)); }
  function saveTimerSettings(next) { const normalized = Timer.normalize(next); writeJson(TIMER_SETTINGS_KEY, normalized); return normalized; }
  function formatGold(value) { return `${Math.max(0, Number(value || 0))} ₽`; }
  function profileRecord() {
    if (!run || run.profileRecorded || ![Run.STATUS.VICTORY, Run.STATUS.DEFEAT].includes(run.status)) return;
    profile = Profile.recordFinishedRun(profile, run);
    profile = Profile.save(profile, storage);
    run.profileRecorded = true;
    saveRun();
  }
  function showToast(message) {
    let toast = document.querySelector("#actToast");
    if (!toast) { toast = document.createElement("div"); toast.id = "actToast"; toast.className = "act-toast"; document.body.append(toast); }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }
  function action(callback) {
    try { run = callback(); saveRun(); render(); }
    catch (error) { console.warn(error); showToast(error.message || "Действие не выполнено"); }
  }
  function iconFor(type) { return Act.NODE_DETAILS[type] ? Act.NODE_DETAILS[type].symbol : "?"; }
  function showOverlay() {
    overlay.hidden = false;
    app.inert = true;
    document.body.classList.add("act-open");
    if (setup) setup.hidden = true;
  }
  function hideOverlay() {
    overlay.hidden = true;
    app.inert = false;
    document.body.classList.remove("act-open");
  }
  function shell(content, options) {
    const opts = options || {};
    const artifacts = run ? run.artifacts.map((id) => `<span title="${escapeHtml(text(artifact(id).description))}">${escapeHtml(artifact(id).symbol)}</span>`).join("") : "";
    return `<section class="act-shell">
      <header class="act-topbar">
        <div class="act-brand"><span>☠</span><div><strong>БИТАЯ МАСТЬ</strong><small>АКТ I · ПОДВАЛ ПРОСРОЧЕННЫХ ДОЛГОВ</small></div></div>
        ${run ? `<div class="act-run-stats"><b class="hp">♥ ${run.hp}/${run.maxHp}</b><b class="gold">${formatGold(run.gold)}</b><b>▥ ${run.deck.length}</b><div class="act-mini-artifacts">${artifacts || "<i>нет артефактов</i>"}</div></div>` : ""}
        <div class="act-top-actions"><button id="actContentToggle" type="button">${safeMode() ? "БЕЗОПАСНЫЙ" : "ВЗРОСЛЫЙ"}</button>${opts.allowAbandon ? '<button id="actAbandon" class="danger" type="button">ЗАВЕРШИТЬ ЗАБЕГ</button>' : ""}</div>
      </header>
      <main class="act-main">${content}</main>
    </section>`;
  }
  function bindShell() {
    const toggle = document.querySelector("#actContentToggle");
    if (toggle) toggle.addEventListener("click", () => { Content.save({ mode: safeMode() ? Content.MODES.ADULT : Content.MODES.SAFE }, storage); render(); });
    const abandon = document.querySelector("#actAbandon");
    if (abandon) abandon.addEventListener("click", () => { if (confirm("Завершить текущий забег? Прогресс акта будет потерян.")) action(() => Run.abandon(run)); });
  }
  function renderLanding() {
    const settings = timerSettings();
    const content = `<section class="act-landing">
      <div class="act-landing-copy"><span class="eyebrow">ПЕРВАЯ ПОЛНАЯ ВЫЛАЗКА</span><h1>ПОДВАЛ<br>ПРОСРОЧЕННЫХ ДОЛГОВ</h1><p>Пройди восемь слоёв, собери колоду, переживи элитных дилеров и выбей Хозяина стола из собственного заведения.</p><div class="act-profile-strip"><div><small>ЗАБЕГОВ</small><b>${profile.runs}</b></div><div><small>ПОБЕД</small><b>${profile.victories}</b></div><div><small>ЛУЧШИЙ СЧЁТ</small><b>${profile.bestRun ? profile.bestRun.score : 0}</b></div><div><small>ОТКРЫТО АРТЕФАКТОВ</small><b>${profile.unlockedArtifacts.length}/${Act.artifacts.length}</b></div></div></div>
      <aside class="act-start-panel"><h2>ПРАВИЛА ЗАБЕГА</h2><label>ТАЙМЕР ХОДА<select id="actTimerMode"><option value="classic">Классика · без таймера</option><option value="relaxed">60 секунд</option><option value="hardcore">30 секунд</option><option value="custom">Свой таймер</option></select></label><div id="actCustomTimer" class="act-inline-control"><input id="actTimerSeconds" type="number" min="10" max="180" step="5" value="${settings.seconds || 45}"><span>секунд</span></div><label>ШТРАФ ЗА ВРЕМЯ<select id="actTimerPenalty"><option value="end_turn">Завершить ход</option><option value="discard_random">Сбросить карту</option><option value="damage">Получить 3 урона</option><option value="dealer_energy">Дать дилеру энергию</option></select></label><button id="actNewRun" class="primary" type="button">НАЧАТЬ НОВЫЙ ЗАБЕГ</button><small>Маршрут и награды создаются из seed. Забег автоматически сохраняется после каждого действия.</small></aside>
    </section>`;
    overlay.innerHTML = shell(content);
    bindShell();
    const mode = document.querySelector("#actTimerMode");
    const seconds = document.querySelector("#actTimerSeconds");
    const penalty = document.querySelector("#actTimerPenalty");
    mode.value = settings.mode;
    penalty.value = settings.penalty;
    const syncCustom = () => { document.querySelector("#actCustomTimer").hidden = mode.value !== Timer.MODES.CUSTOM; };
    mode.addEventListener("change", syncCustom); syncCustom();
    document.querySelector("#actNewRun").addEventListener("click", () => {
      saveTimerSettings(Timer.normalize({ mode: mode.value, seconds: Number(seconds.value || 45), penalty: penalty.value }));
      const seedArray = new Uint32Array(1); if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(seedArray); else seedArray[0] = Date.now();
      const seed = seedArray[0] || Date.now();
      run = Run.createRun({ seed, deck: Catalog.buildDeck("player", seed), unlockedArtifacts: profile.unlockedArtifacts });
      removeKey(BATTLE_SAVE_KEY); removeKey(BATTLE_CONTEXT_KEY); removeKey(BATTLE_RESULT_KEY);
      saveRun(); render();
    });
  }
  function renderMap() {
    const layers = run.map.layers.map((nodes, layerIndex) => `<section class="act-map-layer"><header><span>${layerIndex + 1}</span><small>${layerIndex === run.map.layers.length - 1 ? "ФИНАЛ" : `СЛОЙ ${layerIndex + 1}`}</small></header><div>${nodes.map((node) => {
      const visited = run.visitedNodeIds.includes(node.id); const available = run.availableNodeIds.includes(node.id); const locked = !visited && !available;
      const dealer = node.dealerId ? Dealers.getDealer(node.dealerId) : null;
      return `<button class="act-node ${visited ? "visited" : ""} ${available ? "available" : ""}" data-node-id="${node.id}" data-node-type="${node.type}" ${locked || visited ? "disabled" : ""} style="--node-accent:${dealer ? dealer.palette[1] : "#8c7658"}"><span>${iconFor(node.type)}</span><strong>${Act.NODE_DETAILS[node.type].title}</strong><small>${dealer ? escapeHtml(dealer.name) : escapeHtml(Act.NODE_DETAILS[node.type].description)}</small></button>`;
    }).join("")}</div></section>`).join("");
    const recent = run.history.slice(-6).reverse().map((entry) => `<li><b>${escapeHtml(entry.type.replaceAll("_", " "))}</b><span>${escapeHtml(JSON.stringify(entry.payload).slice(0, 80))}</span></li>`).join("");
    const artifactList = run.artifacts.map((id) => `<article><i>${escapeHtml(artifact(id).symbol)}</i><div><b>${escapeHtml(artifact(id).name)}</b><p>${escapeHtml(text(artifact(id).description))}</p></div></article>`).join("") || '<p class="act-empty">Артефактов пока нет.</p>';
    const content = `<section class="act-map-screen"><div class="act-map-heading"><div><span class="eyebrow">ВЫБЕРИ СЛЕДУЮЩИЙ УЗЕЛ</span><h1>МАРШРУТ АКТА</h1><p>После выбора дороги назад не будет. Доступные узлы подсвечены.</p></div><div class="act-seed">SEED <b>${run.seed}</b></div></div><div class="act-map-layout"><div id="actMapScroll" class="act-map-scroll"><svg id="actRouteLines" aria-hidden="true"></svg><div class="act-map-grid">${layers}</div></div><aside class="act-map-sidebar"><section><h3>АРТЕФАКТЫ</h3><div class="act-artifact-list">${artifactList}</div></section><section><h3>ПОСЛЕДНИЕ СОБЫТИЯ</h3><ol class="act-history">${recent}</ol></section><section class="act-route-help"><b>УСЛОВИЯ</b><p>Поражение завершает забег. Здоровье, колода, деньги и артефакты сохраняются между узлами.</p></section></aside></div></section>`;
    overlay.innerHTML = shell(content, { allowAbandon: true }); bindShell();
    document.querySelectorAll("[data-node-id]").forEach((button) => button.addEventListener("click", () => action(() => Run.enterNode(run, button.dataset.nodeId, Catalog))));
    requestAnimationFrame(drawRouteLines);
  }
  function drawRouteLines() {
    const svg = document.querySelector("#actRouteLines"); const scroll = document.querySelector("#actMapScroll"); if (!svg || !scroll) return;
    const box = scroll.getBoundingClientRect(); const width = scroll.scrollWidth; const height = scroll.scrollHeight; svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("width", width); svg.setAttribute("height", height); svg.replaceChildren();
    run.map.nodes.forEach((node) => {
      const from = document.querySelector(`[data-node-id="${node.id}"]`); if (!from) return;
      const fromBox = from.getBoundingClientRect();
      node.next.forEach((targetId) => {
        const to = document.querySelector(`[data-node-id="${targetId}"]`); if (!to) return;
        const toBox = to.getBoundingClientRect();
        const x1 = fromBox.right - box.left + scroll.scrollLeft; const y1 = fromBox.top + fromBox.height / 2 - box.top + scroll.scrollTop;
        const x2 = toBox.left - box.left + scroll.scrollLeft; const y2 = toBox.top + toBox.height / 2 - box.top + scroll.scrollTop;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); const mid = (x1 + x2) / 2;
        path.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
        path.classList.add(run.visitedNodeIds.includes(node.id) ? "travelled" : run.availableNodeIds.includes(targetId) ? "available" : "locked"); svg.append(path);
      });
    });
  }
  function renderEvent() {
    const event = Act.byEventId[run.pending.eventId];
    const choices = event.choices.map((choice) => `<button data-event-choice="${choice.id}" ${choice.cost && run.gold < choice.cost ? "disabled" : ""}><strong>${escapeHtml(text(choice.title))}</strong><p>${escapeHtml(text(choice.description))}</p>${choice.cost ? `<small>Нужно ${choice.cost} ₽</small>` : ""}</button>`).join("");
    overlay.innerHTML = shell(`<section class="act-node-screen event"><div class="act-node-symbol">?</div><span class="eyebrow">СОБЫТИЕ</span><h1>${escapeHtml(event.title)}</h1><p class="act-story">${escapeHtml(text(event.body))}</p><div class="act-choice-grid">${choices}</div></section>`, { allowAbandon: true }); bindShell();
    document.querySelectorAll("[data-event-choice]").forEach((button) => button.addEventListener("click", () => action(() => Run.resolveEvent(run, button.dataset.eventChoice, Catalog))));
  }
  function miniCard(offer, actionName, disabled) {
    const card = cardView({ id: offer.cardId, upgrade: offer.upgrade });
    return `<button class="act-card-offer" data-${actionName}="${offer.offerId}" ${disabled ? "disabled" : ""} data-rarity="${card.rarity}"><span class="act-card-price">${offer.price != null ? `${offer.price} ₽` : "ВЗЯТЬ"}</span><i style="background-image:url('${cardArt(card)}')"></i><strong>${escapeHtml(card.name)}</strong><p>${escapeHtml(card.short)}</p><small>${card.cost}⚡ · ${escapeHtml(card.stat)}</small></button>`;
  }
  function renderReward() {
    const cards = run.pending.cards.map((offer) => miniCard(offer, "reward", false)).join("");
    overlay.innerHTML = shell(`<section class="act-node-screen reward"><span class="eyebrow">ПОБЕДА В ДУЭЛИ</span><h1>ЗАБЕРИ НАГРАДУ</h1><p>Получено ${formatGold(run.pending.gold)}${run.pending.healed ? ` · восстановлено ${run.pending.healed} здоровья` : ""}. Выбери одну карту или уйди без неё.</p><div class="act-card-offers">${cards}</div><button id="actSkipReward" class="act-secondary" type="button">НЕ БРАТЬ КАРТУ</button></section>`, { allowAbandon: true }); bindShell();
    document.querySelectorAll("[data-reward]").forEach((button) => button.addEventListener("click", () => action(() => Run.chooseReward(run, button.dataset.reward, Catalog))));
    document.querySelector("#actSkipReward").addEventListener("click", () => action(() => Run.chooseReward(run, null, Catalog)));
  }
  function deckRows(mode) {
    return run.deck.map((entry) => { const card = cardView(entry); return `<button class="act-deck-row" data-${mode}="${entry.uid}" ${mode === "upgrade" && entry.upgrade ? "disabled" : ""}><i style="background-image:url('${cardArt(card)}')"></i><span><b>${escapeHtml(card.name)}</b><small>${card.cost}⚡ · ${escapeHtml(card.short)}</small></span>${entry.upgrade ? "<em>+</em>" : ""}</button>`; }).join("");
  }
  function renderShop() {
    const shop = run.pending;
    const cards = shop.cards.map((offer) => miniCard(offer, "shop-card", offer.sold || run.gold < offer.price)).join("");
    const artifactOffer = shop.artifact && !shop.artifactBought ? artifact(shop.artifact.artifactId) : null;
    overlay.innerHTML = shell(`<section class="act-shop-screen"><header><span class="eyebrow">ТОРГОВЕЦ</span><h1>ЛАРЁК «ПОСЛЕДНИЙ ШАНС»</h1><p>Возврата нет. Гарантии тоже. Ценники хотя бы честные.</p></header><div class="act-shop-layout"><main><h2>КАРТЫ</h2><div class="act-card-offers shop">${cards}</div><h2>АРТЕФАКТ</h2>${artifactOffer ? `<button class="act-artifact-offer" id="actBuyArtifact" ${run.gold < shop.artifact.price ? "disabled" : ""}><i>${escapeHtml(artifactOffer.symbol)}</i><span><b>${escapeHtml(artifactOffer.name)}</b><p>${escapeHtml(text(artifactOffer.description))}</p><strong>${shop.artifact.price} ₽</strong></span></button>` : '<p class="act-empty">Продано.</p>'}</main><aside><h2>УСЛУГИ</h2><button id="actBuyHeal" class="act-service" ${shop.healUsed || run.hp >= run.maxHp || run.gold < shop.healPrice ? "disabled" : ""}><b>ПОДЛАТАТЬСЯ</b><span>+${shop.healAmount} здоровья</span><strong>${shop.healPrice} ₽</strong></button><section class="act-remove-service"><h3>УДАЛИТЬ КАРТУ · ${shop.removePrice} ₽</h3><div>${deckRows("remove")}</div></section><button id="actLeaveShop" class="act-secondary">ПОКИНУТЬ ТОРГОВЦА</button></aside></div></section>`, { allowAbandon: true }); bindShell();
    document.querySelectorAll("[data-shop-card]").forEach((button) => button.addEventListener("click", () => action(() => Run.buyShopCard(run, button.dataset.shopCard, Catalog))));
    if (document.querySelector("#actBuyArtifact")) document.querySelector("#actBuyArtifact").addEventListener("click", () => action(() => Run.buyShopArtifact(run, shop.artifact.offerId)));
    document.querySelector("#actBuyHeal").addEventListener("click", () => action(() => Run.buyShopHeal(run)));
    document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => action(() => Run.removeShopCard(run, button.dataset.remove))));
    document.querySelector("#actLeaveShop").addEventListener("click", () => action(() => Run.leaveShop(run)));
  }
  function renderRest() {
    overlay.innerHTML = shell(`<section class="act-node-screen rest"><div class="act-node-symbol">⌂</div><span class="eyebrow">КОМНАТА ОТДЫХА</span><h1>ДВЕРЬ ЗАПИРАЕТСЯ ИЗНУТРИ</h1><p class="act-story">Можно восстановить ${run.pending.healAmount} здоровья или навсегда улучшить одну карту.</p><div class="act-rest-layout"><button id="actRestHeal" class="act-rest-choice" ${run.hp >= run.maxHp ? "disabled" : ""}><span>♥</span><b>ПЕРЕВЯЗАТЬ РАНЫ</b><p>Восстановить ${run.pending.healAmount} здоровья.</p></button><section class="act-upgrade-choice"><h2>УЛУЧШИТЬ КАРТУ</h2><div>${deckRows("upgrade")}</div></section></div></section>`, { allowAbandon: true }); bindShell();
    document.querySelector("#actRestHeal").addEventListener("click", () => action(() => Run.restHeal(run)));
    document.querySelectorAll("[data-upgrade]").forEach((button) => button.addEventListener("click", () => action(() => Run.restUpgrade(run, button.dataset.upgrade))));
  }
  function renderTreasure() {
    const offers = run.pending.artifacts.map((offer) => { const item = artifact(offer.artifactId); return `<button class="act-artifact-choice" data-treasure="${offer.offerId}" data-rarity="${item.rarity}"><i>${escapeHtml(item.symbol)}</i><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(text(item.description))}</p></button>`; }).join("");
    overlay.innerHTML = shell(`<section class="act-node-screen treasure"><span class="eyebrow">ТАЙНИК</span><h1>ВЫБЕРИ ОДИН АРТЕФАКТ</h1><p class="act-story">Остальные исчезнут вместе с коробкой. Не спрашивай, как она это делает.</p><div class="act-artifact-choices">${offers || '<div><p class="act-empty">Все доступные артефакты уже собраны.</p><button id="actClaimEmptyTreasure" class="primary">ЗАБРАТЬ 40 ₽</button></div>'}</div></section>`, { allowAbandon: true }); bindShell();
    document.querySelectorAll("[data-treasure]").forEach((button) => button.addEventListener("click", () => action(() => Run.takeTreasure(run, button.dataset.treasure))));
    const emptyClaim = document.querySelector("#actClaimEmptyTreasure"); if (emptyClaim) emptyClaim.addEventListener("click", () => action(() => Run.claimEmptyTreasure(run)));
  }
  function renderEnd() {
    profileRecord();
    const victory = run.status === Run.STATUS.VICTORY;
    const abandoned = run.status === Run.STATUS.ABANDONED;
    const title = victory ? "ХОЗЯИН СТОЛА ПОВЕРЖЕН" : abandoned ? "ЗАБЕГ ЗАВЕРШЁН" : "ДОЛГ ВЗЫСКАН";
    const body = victory ? "Первый акт пройден. Стол опустел, но дверь в следующий зал уже открылась." : abandoned ? "Ты вышел из подвала добровольно. Редкая привилегия." : "Карты вернулись в рукав. Постоянные открытия и статистика сохранены.";
    overlay.innerHTML = shell(`<section class="act-end-screen ${victory ? "victory" : "defeat"}"><span class="act-end-symbol">${victory ? "♛" : "☠"}</span><span class="eyebrow">${victory ? "АКТ I ЗАВЕРШЁН" : "ЗАБЕГ ОКОНЧЕН"}</span><h1>${title}</h1><p>${body}</p><div class="act-end-stats"><div><small>СЧЁТ</small><b>${run.stats.score}</b></div><div><small>УЗЛОВ</small><b>${run.stats.nodesVisited}</b></div><div><small>ПОБЕД</small><b>${run.stats.battlesWon}</b></div><div><small>АРТЕФАКТОВ</small><b>${run.artifacts.length}</b></div><div><small>КАРТ В КОЛОДЕ</small><b>${run.deck.length}</b></div><div><small>ДЕНЕГ</small><b>${formatGold(run.gold)}</b></div></div><button id="actReturnLanding" class="primary">НОВЫЙ ЗАБЕГ</button></section>`);
    bindShell();
    document.querySelector("#actReturnLanding").addEventListener("click", () => { run = null; removeKey(Run.STORAGE_KEY); removeKey(BATTLE_SAVE_KEY); removeKey(BATTLE_CONTEXT_KEY); removeKey(BATTLE_RESULT_KEY); render(); });
  }
  function launchBattle() {
    if (!run || run.status !== Run.STATUS.BATTLE || !run.battleContext) return;
    writeJson(BATTLE_CONTEXT_KEY, run.battleContext);
    Dealers.saveSelection(run.battleContext.dealerId, storage);
    removeKey(BATTLE_RESULT_KEY);
    const battleSave = readJson(BATTLE_SAVE_KEY);
    if (battleSave && battleSave.state && battleSave.state.runContext && battleSave.state.runContext.runId === run.runId && battleSave.state.phase !== "finished") { hideOverlay(); return; }
    removeKey(BATTLE_SAVE_KEY);
    hideOverlay();
    document.body.classList.add("act-launching");
    const settingsButton = document.querySelector("#settingsButton");
    if (settingsButton) settingsButton.click();
    window.setTimeout(() => {
      const start = document.querySelector("#setupStart");
      if (start) start.click();
      window.setTimeout(() => document.body.classList.remove("act-launching"), 300);
    }, 40);
  }
  function recoverBattleResult() {
    const direct = readJson(BATTLE_RESULT_KEY); if (direct) return direct;
    const envelope = readJson(BATTLE_SAVE_KEY); const state = envelope && envelope.state;
    if (!state || state.phase !== "finished" || !state.runContext) return null;
    return { version: 1, runId: state.runContext.runId, nodeId: state.runContext.nodeId, dealerId: state.runContext.dealerId, winner: state.winner, playerHp: state.actors.player.hp, playerMaxHp: state.actors.player.maxHp, rounds: state.round, turns: state.turn };
  }
  function checkBattleResult() {
    if (!run || run.status !== Run.STATUS.BATTLE) return;
    const result = recoverBattleResult();
    if (!result || result.runId !== run.runId || result.nodeId !== run.battleContext.nodeId) return;
    try {
      run = Run.completeBattle(run, result, Catalog); saveRun(); removeKey(BATTLE_RESULT_KEY); removeKey(BATTLE_CONTEXT_KEY); removeKey(BATTLE_SAVE_KEY);
      if (resultOverlay) resultOverlay.hidden = true;
      showOverlay(); render();
    } catch (error) { console.error(error); showToast("Не удалось принять результат боя"); }
  }
  function render() {
    if (!overlay) return;
    if (!run) { showOverlay(); renderLanding(); return; }
    profileRecord();
    if (run.status === Run.STATUS.BATTLE) { launchBattle(); return; }
    showOverlay();
    if (run.status === Run.STATUS.ACTIVE) renderMap();
    else if (run.status === Run.STATUS.REWARD) renderReward();
    else if (run.status === Run.STATUS.NODE && run.pending.type === "event") renderEvent();
    else if (run.status === Run.STATUS.NODE && run.pending.type === "shop") renderShop();
    else if (run.status === Run.STATUS.NODE && run.pending.type === "rest") renderRest();
    else if (run.status === Run.STATUS.NODE && run.pending.type === "treasure") renderTreasure();
    else if ([Run.STATUS.VICTORY, Run.STATUS.DEFEAT, Run.STATUS.ABANDONED].includes(run.status)) renderEnd();
  }

  if (runButton) runButton.addEventListener("click", () => {
    if (run && run.status === Run.STATUS.BATTLE) { showToast("Маршрут откроется после завершения дуэли"); return; }
    showOverlay(); render();
  });
  window.addEventListener("resize", () => { if (!overlay.hidden && run && run.status === Run.STATUS.ACTIVE) drawRouteLines(); });
  window.addEventListener("storage", (event) => { if ([BATTLE_RESULT_KEY, Run.STORAGE_KEY].includes(event.key)) { run = loadRun() || run; checkBattleResult(); } });
  window.setInterval(checkBattleResult, 250);
  window.setTimeout(() => { if (setup) setup.hidden = true; render(); }, 0);
})();