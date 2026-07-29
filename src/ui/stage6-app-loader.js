"use strict";
(function () {
  const Dealers = window.BitayaMastDealerCatalog;
  const AI = window.BitayaMastDealerAI;
  if (!Dealers || !AI) throw new Error("Не загружены каталог дилеров или модуль ИИ.");

  function loadSource(url) {
    const request = new XMLHttpRequest();
    request.open("GET", url, false);
    request.send(null);
    if (request.status >= 200 && request.status < 300 || request.status === 0) return request.responseText;
    throw new Error(`Не удалось загрузить интерфейс боя: ${request.status}.`);
  }

  let source = loadSource("src/ui/stage3-app.js?v=10");
  const choicePattern = /  function dealerChoice\(assumeNextTurn\) \{[\s\S]*?\n  function renderIntent\(\) \{/;
  if (!choicePattern.test(source)) throw new Error("Не удалось подключить новый ИИ: блок dealerChoice не найден.");
  source = source.replace(choicePattern, `  function activeDealerProfile() {
    return Dealers.getDealer(Engine.currentDealerId ? Engine.currentDealerId(state) : (state && state.dealerId));
  }

  function safeDealerText() {
    const module = window.BitayaMastContentSettings;
    if (!module) return false;
    try { return module.load().mode === module.MODES.SAFE; } catch (error) { return false; }
  }

  function dealerChoice(assumeNextTurn) {
    return AI.chooseCard(state, activeDealerProfile(), { assumeNextTurn: Boolean(assumeNextTurn), engine: Engine });
  }

  function renderIntent() {`);

  const intentBodyPattern = /    const choice = dealerChoice\(state\.phase !== Engine\.PHASES\.DEALER\);[\s\S]*?    dom\.intentText\.textContent = steal \? "Попробует забрать карту из твоей руки\." : damage \? `Возможный урон: \$\{damage\.amount\}\.` : shield \? `Получит до \$\{shield\.amount\} щита\.` : meta\.short;/;
  if (!intentBodyPattern.test(source)) throw new Error("Не удалось подключить намерение нового ИИ.");
  source = source.replace(intentBodyPattern, `    const intent = AI.intentFor(state, activeDealerProfile(), { engine: Engine });
    dom.intentTitle.textContent = intent.title;
    dom.intentText.textContent = intent.text;`);

  const quotePattern = /    dom\.dealerQuote\.textContent = dealer\.hp \/ dealer\.maxHp <= \.35 \? "«Рано радуешься\. Долг ещё не закрыт»" : "«В каждой игре я знаю, где у тебя слабое место»";/;
  if (!quotePattern.test(source)) throw new Error("Не удалось подключить реплики дилеров.");
  source = source.replace(quotePattern, `    const dealerProfile = activeDealerProfile();
    dom.dealerQuote.textContent = Dealers.quoteFor(dealerProfile, dealer.hp / dealer.maxHp <= .35 ? "low" : "intro", safeDealerText());`);

  source = source.replace("? `Шулер проиграл. Осталось здоровья: ${state.actors.player.hp}. Режим: ${TimerSettings.describe(settings)}.`", "? `${activeDealerProfile().name} проиграл. Осталось здоровья: ${state.actors.player.hp}. Режим: ${TimerSettings.describe(settings)}.`");
  source += "\n//# sourceURL=stage6-patched-duel-app.js";
  (0, eval)(source);
  window.dispatchEvent(new CustomEvent("bitaya:app-ready", { detail: { stage: 6 } }));
})();
