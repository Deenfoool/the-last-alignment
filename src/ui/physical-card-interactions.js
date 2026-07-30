"use strict";
(function () {
  const HAND_SELECTOR = "#hand";
  const CARD_SELECTOR = ".game-card";
  let selectedId = null;
  let tooltip = null;
  let activeCard = null;

  function ensureVisualStyles() {
    if (document.querySelector('link[data-diegetic-ui="v1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "styles/diegetic-ui.css?v=14";
    link.dataset.diegeticUi = "v1";
    document.head.append(link);
    document.documentElement.dataset.diegeticUi = "ready";
  }

  function coarsePointer() {
    return Boolean(window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches);
  }

  function ensureTooltip() {
    if (tooltip && tooltip.isConnected) return tooltip;
    tooltip = document.createElement("aside");
    tooltip.id = "physicalCardTooltip";
    tooltip.className = "physical-card-tooltip";
    tooltip.hidden = true;
    tooltip.setAttribute("role", "tooltip");
    tooltip.innerHTML = "<header><strong data-card-title></strong><span data-card-cost></span></header><div class=\"physical-card-tooltip__meta\"><span data-card-rarity></span><span data-card-type></span></div><p data-card-effect></p><small data-card-lore></small><b class=\"physical-card-tooltip__hint\" data-card-hint></b>";
    document.body.append(tooltip);
    return tooltip;
  }

  function textFrom(card, selector) {
    const node = card.querySelector(selector);
    return node ? node.textContent.trim() : "";
  }

  function splitBody(card) {
    const body = card.querySelector(".card-body");
    if (!body) return { effect: "", lore: "" };
    const clone = body.cloneNode(true);
    const small = clone.querySelector("small");
    const lore = small ? small.textContent.trim() : "";
    if (small) small.remove();
    return { effect: clone.textContent.trim(), lore };
  }

  function positionTooltip(card) {
    const tip = ensureTooltip();
    const rect = card.getBoundingClientRect();
    const width = Math.min(360, Math.max(260, window.innerWidth - 24));
    tip.style.width = `${width}px`;
    tip.hidden = false;
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(12, Math.min(window.innerWidth - tipRect.width - 12, left));
    let top = rect.top - tipRect.height - 14;
    if (top < 12) top = Math.min(window.innerHeight - tipRect.height - 12, rect.bottom + 14);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  function show(card, reason) {
    if (!card || card.disabled) return;
    const tip = ensureTooltip();
    const body = splitBody(card);
    tip.querySelector("[data-card-title]").textContent = textFrom(card, ".card-name") || card.getAttribute("aria-label") || "Карта";
    tip.querySelector("[data-card-cost]").textContent = `Стоимость: ${textFrom(card, ".card-cost") || "0"}`;
    tip.querySelector("[data-card-rarity]").textContent = textFrom(card, ".card-rarity");
    tip.querySelector("[data-card-type]").textContent = card.dataset.type || "";
    tip.querySelector("[data-card-effect]").textContent = body.effect;
    tip.querySelector("[data-card-lore]").textContent = body.lore;
    tip.querySelector("[data-card-hint]").textContent = reason === "touch" ? "Нажми ещё раз, чтобы разыграть" : "Клик или Enter — разыграть";
    activeCard = card;
    card.setAttribute("aria-describedby", tip.id);
    document.querySelectorAll(`${CARD_SELECTOR}.physical-preview`).forEach((node) => { if (node !== card) node.classList.remove("physical-preview"); });
    card.classList.add("physical-preview");
    positionTooltip(card);
  }

  function hide(options) {
    const keepSelection = Boolean(options && options.keepSelection);
    if (tooltip) tooltip.hidden = true;
    if (activeCard) activeCard.removeAttribute("aria-describedby");
    activeCard = null;
    document.querySelectorAll(`${CARD_SELECTOR}.physical-preview`).forEach((node) => node.classList.remove("physical-preview"));
    if (!keepSelection) {
      selectedId = null;
      document.querySelectorAll(`${CARD_SELECTOR}.physical-touch-selected`).forEach((node) => node.classList.remove("physical-touch-selected"));
    }
  }

  function selectTouch(card) {
    selectedId = card.dataset.instanceId || "";
    document.querySelectorAll(`${CARD_SELECTOR}.physical-touch-selected`).forEach((node) => node.classList.remove("physical-touch-selected"));
    card.classList.add("physical-touch-selected");
    show(card, "touch");
  }

  function attach() {
    ensureVisualStyles();
    const hand = document.querySelector(HAND_SELECTOR);
    if (!hand || hand.dataset.physicalInteractions === "ready") return;
    hand.dataset.physicalInteractions = "ready";

    hand.addEventListener("pointerover", (event) => {
      if (coarsePointer()) return;
      const card = event.target.closest(CARD_SELECTOR);
      if (card && hand.contains(card)) show(card, "hover");
    });
    hand.addEventListener("pointerout", (event) => {
      if (coarsePointer()) return;
      const card = event.target.closest(CARD_SELECTOR);
      if (!card) return;
      const next = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(CARD_SELECTOR) : null;
      if (next !== card) hide({ keepSelection: true });
    });
    hand.addEventListener("focusin", (event) => {
      const card = event.target.closest(CARD_SELECTOR);
      if (card) show(card, "keyboard");
    });
    hand.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (!next || !hand.contains(next)) hide({ keepSelection: coarsePointer() });
    });
    hand.addEventListener("click", (event) => {
      const card = event.target.closest(CARD_SELECTOR);
      if (!card || !hand.contains(card) || card.disabled) return;
      if (!coarsePointer() || event.detail === 0) {
        hide();
        return;
      }
      const id = card.dataset.instanceId || "";
      if (selectedId !== id) {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectTouch(card);
        return;
      }
      hide();
    }, true);

    const observer = new MutationObserver(() => {
      if (!selectedId) return;
      const card = Array.from(hand.querySelectorAll(CARD_SELECTOR)).find((node) => node.dataset.instanceId === selectedId);
      if (card) {
        card.classList.add("physical-touch-selected");
        show(card, "touch");
      } else hide();
    });
    observer.observe(hand, { childList: true });
  }

  document.addEventListener("pointerdown", (event) => {
    if (!coarsePointer() || !selectedId) return;
    if (!event.target.closest(`${HAND_SELECTOR} ${CARD_SELECTOR}`) && !event.target.closest("#physicalCardTooltip")) hide();
  }, true);
  window.addEventListener("resize", () => { if (activeCard) positionTooltip(activeCard); });
  window.addEventListener("scroll", () => { if (activeCard) positionTooltip(activeCard); }, true);
  window.addEventListener("bitaya:app-ready", attach);
  ensureVisualStyles();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach); else attach();
})();