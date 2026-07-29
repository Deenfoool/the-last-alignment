"use strict";
(function () {
  const Dealers = window.BitayaMastDealerCatalog;
  const Content = window.BitayaMastContentSettings;
  if (!Dealers) throw new Error("Каталог дилеров не загружен.");

  const SAVE_KEY = "bitaya-mast-stage3-battle-v2";
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const tierNames = { common: "ОБЫЧНЫЙ", elite: "ЭЛИТНЫЙ", boss: "БОСС" };
  let selectedId = Dealers.readSelection(safeStorage());
  let lastDealerId = null;
  let lastAbilityEvent = 0;
  let scheduled = false;

  function safeStorage() { try { return window.localStorage; } catch (error) { return null; } }
  function readEnvelope() { try { const storage = safeStorage(); const raw = storage && storage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (error) { return null; } }
  function safeMode() { try { return Content && Content.load().mode === Content.MODES.SAFE; } catch (error) { return false; } }
  function activeDealerId() { const envelope = readEnvelope(); const state = envelope && envelope.state; return Dealers.normalizeId(state && (state.dealerId || state.rules && state.rules.dealerId) || selectedId); }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
  function setText(node, value) { const next = String(value); if (node && node.textContent !== next) node.textContent = next; }

  function injectSelector() {
    const panel = $("#setupPanel");
    if (!panel || $("#dealerFieldset")) return;
    const heading = $(".setup-heading", panel);
    const fieldset = document.createElement("fieldset");
    fieldset.id = "dealerFieldset";
    fieldset.className = "setup-fieldset dealer-fieldset";
    fieldset.innerHTML = `<legend>ВЫБЕРИ ДИЛЕРА</legend><div class="dealer-tier-legend"><span>4 обычных</span><span>2 элитных</span><span>1 босс</span></div><div class="dealer-select-grid">${Dealers.dealers.map((dealer) => `<label class="dealer-option" data-tier="${dealer.tier}" style="--dealer-accent:${dealer.palette[1]};--dealer-detail:${dealer.palette[2]}"><input type="radio" name="dealerId" value="${dealer.id}"><span class="dealer-option-face"><i class="dealer-option-portrait" style="background-image:url('${Dealers.portraitDataUri(dealer)}')"></i><span class="dealer-option-copy"><small>${tierNames[dealer.tier]} · СЛОЖНОСТЬ ${dealer.difficulty}</small><strong>${escapeHtml(dealer.name)}</strong><b>${escapeHtml(dealer.title)}</b><em>${escapeHtml(dealer.ability.description)}</em></span></span></label>`).join("")}</div><p id="dealerSetupPreview" class="dealer-setup-preview"></p>`;
    if (heading && heading.nextSibling) panel.insertBefore(fieldset, heading.nextSibling); else panel.prepend(fieldset);
    $$('input[name="dealerId"]', fieldset).forEach((input) => input.addEventListener("change", () => { selectedId = Dealers.saveSelection(input.value, safeStorage()); syncSelector(); }));
    syncSelector();
  }

  function syncSelector() {
    const profile = Dealers.getDealer(selectedId);
    $$('input[name="dealerId"]').forEach((input) => { input.checked = input.value === selectedId; });
    const preview = $("#dealerSetupPreview");
    const html = `<b>${escapeHtml(profile.name)}</b> · ${escapeHtml(profile.archetype)} · ${profile.maxHp} здоровья · ${profile.maxEnergy} энергии<br>${escapeHtml(profile.ability.name)}: ${escapeHtml(profile.ability.description)}`;
    if (preview && preview.innerHTML !== html) preview.innerHTML = html;
    const setupText = $(".setup-heading p");
    if (setupText && !$("#setupOverlay").hidden) setText(setupText, `Выбери противника, время хода и цену промедления. Сейчас за столом: ${profile.name}.`);
  }

  function injectSceneElements() {
    const scene = $("#scene");
    if (!scene) return;
    if (!$("#dealerPortrait")) {
      const portrait = document.createElement("div"); portrait.id = "dealerPortrait"; portrait.className = "dealer-portrait"; portrait.setAttribute("aria-hidden", "true"); scene.insertBefore(portrait, $("#dealerHand"));
    }
    if (!$("#dealerAbilityPlate")) {
      const plate = document.createElement("section"); plate.id = "dealerAbilityPlate"; plate.className = "dealer-ability-plate"; plate.innerHTML = '<span>СПОСОБНОСТЬ</span><strong></strong><p></p>'; scene.append(plate);
    }
  }

  function applyProfile() {
    injectSelector();
    injectSceneElements();
    const dealerId = activeDealerId();
    const profile = Dealers.getDealer(dealerId);
    const safe = safeMode();
    document.documentElement.dataset.dealer = profile.id;
    document.documentElement.dataset.dealerTier = profile.tier;
    document.documentElement.style.setProperty("--dealer-primary", profile.palette[0]);
    document.documentElement.style.setProperty("--dealer-accent", profile.palette[1]);
    document.documentElement.style.setProperty("--dealer-detail", profile.palette[2]);
    const portrait = $("#dealerPortrait");
    const portraitValue = `url("${Dealers.portraitDataUri(profile)}")`;
    if (portrait && portrait.style.backgroundImage !== portraitValue) portrait.style.backgroundImage = portraitValue;
    setText($(".dealer-nameplate strong"), profile.name.toUpperCase());
    const envelope = readEnvelope();
    const dealer = envelope && envelope.state && envelope.state.actors && envelope.state.actors.dealer;
    const quoteKey = dealer && dealer.hp / dealer.maxHp <= .35 ? "low" : "intro";
    setText($("#dealerQuote"), Dealers.quoteFor(profile, quoteKey, safe));
    const ability = $("#dealerAbilityPlate");
    if (ability) { setText($("strong", ability), profile.ability.name); setText($("p", ability), profile.ability.description); ability.dataset.tier = profile.tier; }
    setText($("#dealerHud h2"), `ДИЛЕР · ${tierNames[profile.tier]}`);
    setText($("#catalogBadge"), `${profile.name.toUpperCase()} · ИИ ${profile.difficulty}`);
    if (lastDealerId !== dealerId) {
      lastDealerId = dealerId;
      document.body.classList.remove("dealer-arrival"); void document.body.offsetWidth; document.body.classList.add("dealer-arrival");
    }
    showAbilityEvents(profile, safe);
  }

  function showAbilityEvents(profile, safe) {
    const envelope = readEnvelope();
    const events = envelope && envelope.state && Array.isArray(envelope.state.eventLog) ? envelope.state.eventLog : [];
    const event = events.slice().reverse().find((entry) => entry.seq > lastAbilityEvent && ["DEALER_ABILITY_TRIGGERED", "DEALER_PHASE_CHANGED"].includes(entry.type));
    if (!event) return;
    lastAbilityEvent = event.seq;
    const float = $("#floatingMessage");
    if (!float) return;
    setText(float, event.type === "DEALER_PHASE_CHANGED" ? (safe ? "ВТОРАЯ ФАЗА" : "ПРАВИЛА ИЗМЕНИЛИСЬ") : profile.ability.name.toUpperCase());
    float.classList.remove("show"); void float.offsetWidth; float.classList.add("show");
    const plate = $("#dealerAbilityPlate");
    if (plate) { plate.classList.remove("triggered"); void plate.offsetWidth; plate.classList.add("triggered"); }
  }

  function scheduleApply() { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; applyProfile(); }); }

  window.addEventListener("bitaya:app-ready", scheduleApply);
  window.addEventListener("storage", scheduleApply);
  document.addEventListener("change", (event) => { if (event.target && event.target.matches('[data-content-mode], input[name="dealerId"]')) scheduleApply(); });
  new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden", "class"] });
  window.setInterval(scheduleApply, 700);
  scheduleApply();
})();
