"use strict";

(function () {
  const BRAND = Object.freeze({
    name: "Битая масть",
    shortName: "Масть",
    slug: "bitaya-mast",
    legacyNames: ["Последний расклад", "The Last Alignment"]
  });

  function replaceText(value) {
    let result = String(value || "");
    BRAND.legacyNames.forEach((legacy) => {
      result = result.split(legacy).join(BRAND.name);
    });
    return result;
  }

  function updateHead() {
    document.title = replaceText(document.title || BRAND.name);
    if (!document.title.includes(BRAND.name)) document.title = BRAND.name;

    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = "Битая масть — мрачный карточный roguelike с дуэлями против дилеров.";

    const applicationName = document.querySelector('meta[name="application-name"]') || document.createElement("meta");
    applicationName.name = "application-name";
    applicationName.content = BRAND.name;
    if (!applicationName.parentNode) document.head.appendChild(applicationName);
  }

  function updateTextNodes(root) {
    if (!root || !document.createTreeWalker) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const next = replaceText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function applyBrand(root) {
    updateHead();
    updateTextNodes(root || document.body);
    document.documentElement.dataset.brand = BRAND.slug;
  }

  function start() {
    applyBrand(document.documentElement);
    if (!window.MutationObserver) return;
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const next = replaceText(node.nodeValue);
            if (next !== node.nodeValue) node.nodeValue = next;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            updateTextNodes(node);
          }
        });
      });
      updateHead();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  window.BitayaMastBrand = BRAND;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
