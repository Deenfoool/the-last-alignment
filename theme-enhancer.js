"use strict";
(() => {
  const healthByElement = new WeakMap();
  let scheduled = false;

  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const textOf = (element) => normalize(element?.textContent);
  const isVisible = (element) => Boolean(element && element.getClientRects().length);

  function cardKind(element) {
    const text = textOf(element);
    if (text.includes("проклят")) return "curse";
    if (text.includes("навык")) return "skill";
    if (text.includes("сила")) return "power";
    if (text.includes("атака")) return "attack";
    return "";
  }

  function enhanceCards() {
    document.querySelectorAll('button, [role="button"], .game-card, [class*="card"]').forEach((element) => {
      if (!isVisible(element)) return;
      const kind = cardKind(element);
      if (!kind) return;
      const box = element.getBoundingClientRect();
      const probableCard = element.matches('button, [role="button"], .game-card') || (box.height > box.width * 1.08 && box.width < 360 && box.height < 520);
      if (!probableCard) return;
      element.classList.add("tw-card");
      element.dataset.cardKind = kind;
      if (!element.dataset.twDealt) {
        element.dataset.twDealt = "1";
        element.classList.add("tw-deal-in");
        window.setTimeout(() => element.classList.remove("tw-deal-in"), 520);
      }
    });
  }

  function enhancePiles() {
    document.querySelectorAll('aside, button, div, article').forEach((element) => {
      if (!isVisible(element)) return;
      const text = textOf(element);
      if (!(text.startsWith("колода") || text.startsWith("сброс"))) return;
      const box = element.getBoundingClientRect();
      if (box.width > 230 || box.height > 320 || box.height < 60) return;
      element.classList.add("tw-card-pile");
      element.dataset.twPile = text.startsWith("колода") ? "draw" : "discard";
    });
  }

  function nodeKind(text) {
    if (text.includes("событие")) return "event";
    if (text.includes("привал")) return "rest";
    if (text.includes("элита")) return "elite";
    if (text.includes("босс")) return "boss";
    if (text.includes("торговец") || text.includes("магазин")) return "shop";
    if (text.includes("сокровищ")) return "treasure";
    if (/(^|\s)бой(\s|$)/.test(text)) return "battle";
    return "";
  }

  function enhanceRouteNodes() {
    document.querySelectorAll('button, [role="button"], [class*="node"]').forEach((element) => {
      if (!isVisible(element)) return;
      const text = textOf(element);
      const kind = nodeKind(text);
      if (!kind || text.length > 100) return;
      const box = element.getBoundingClientRect();
      if (box.width > 520 || box.height > 190 || box.width < 90 || box.height < 45) return;
      element.classList.add("tw-route-node");
      element.dataset.nodeKind = kind;
    });
  }

  function enhancePortraits() {
    const portraits = [...document.querySelectorAll('.portrait, [class*="portrait"]')].filter(isVisible);
    portraits.forEach((element) => {
      element.classList.add("tw-portrait");
      const context = textOf(element.closest('article, section, div'));
      element.classList.toggle("tw-portrait-hero", context.includes("странник") || context.includes("последний игрок"));
      element.classList.toggle("tw-portrait-enemy", !(context.includes("странник") || context.includes("последний игрок")));
    });
    if (portraits.length === 2) {
      portraits[0].classList.add("tw-portrait-hero");
      portraits[0].classList.remove("tw-portrait-enemy");
      portraits[1].classList.add("tw-portrait-enemy");
      portraits[1].classList.remove("tw-portrait-hero");
    }
  }

  function enhanceButtons() {
    document.querySelectorAll('button').forEach((button) => {
      const text = textOf(button);
      if (text.includes("завершить ход")) button.classList.add("tw-end-turn");
    });
  }

  function enhanceHealth() {
    document.querySelectorAll('article, section, div').forEach((element) => {
      if (!isVisible(element)) return;
      const match = textOf(element).match(/(^|\s)(\d+)\s*\/\s*(\d+)(\s|$)/);
      if (!match) return;
      const current = Number(match[2]);
      const maximum = Math.max(1, Number(match[3]));
      const box = element.getBoundingClientRect();
      if (box.width > 720 || box.height > 360) return;
      element.classList.toggle("tw-low-health", current / maximum <= .35);
      const previous = healthByElement.get(element);
      if (previous !== undefined && current < previous) {
        element.classList.add("tw-hit");
        window.setTimeout(() => element.classList.remove("tw-hit"), 460);
      }
      healthByElement.set(element, current);
    });
  }

  function enhance() {
    scheduled = false;
    document.body.classList.add("tw-theme-ready");
    enhanceCards();
    enhancePiles();
    enhanceRouteNodes();
    enhancePortraits();
    enhanceButtons();
    enhanceHealth();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest(".tw-card");
    if (!card) return;
    card.classList.remove("tw-cast");
    void card.offsetWidth;
    card.classList.add("tw-cast");
    window.setTimeout(() => card.classList.remove("tw-cast"), 430);
  }, true);

  const start = () => {
    enhance();
    new MutationObserver(scheduleEnhance).observe(document.body, { childList: true, subtree: true, characterData: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
