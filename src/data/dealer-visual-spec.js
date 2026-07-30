"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastDealerVisualSpec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STATES = Object.freeze(["idle", "hit", "shield", "win", "lose"]);
  const STAGING = Object.freeze({
    canvas: { width: 1024, height: 1024 },
    bodyBox: { x: 176, y: 76, width: 672, height: 780 },
    headCenter: { x: 512, y: 286 },
    tableLineY: 790,
    handCenters: [{ x: 390, y: 720 }, { x: 634, y: 720 }],
    cardFanCenter: { x: 512, y: 678 },
    mobileSafeBox: { x: 206, y: 66, width: 612, height: 820 },
    light: { direction: "top", temperature: "amber", keyAngleDeg: 0 },
    background: "transparent"
  });
  const DEALERS = Object.freeze([
    { id: "shuler", name: "Шулер", silhouette: "lean-asymmetric", mask: "cracked-half-mask", props: ["marked-deck", "patched-coat"], palette: ["#21110d", "#9e3d2e", "#c6a46a"] },
    { id: "collector", name: "Коллектор", silhouette: "broad-heavy", mask: "severe-metal-faceplate", props: ["chains", "receipt-tags", "heavy-gloves"], palette: ["#171414", "#b34732", "#d1a63e"] },
    { id: "sysadmin", name: "Сисадмин", silhouette: "gaunt-square", mask: "green-crt-visor", props: ["cables", "access-badge", "keyboard"], palette: ["#071712", "#2f9e61", "#76d39c"] },
    { id: "projectionist", name: "Киномеханик", silhouette: "narrow-coated", mask: "round-goggles", props: ["film-reel", "film-strip", "dust-gloves"], palette: ["#211b24", "#a45b91", "#d7b36b"] },
    { id: "archivist", name: "Архивариус", silhouette: "layered-defensive", mask: "sealed-face", props: ["folders", "wax-seals", "document-straps"], palette: ["#242018", "#8b7042", "#d8c796"] },
    { id: "mascot", name: "Забытый маскот", silhouette: "damaged-unstable", mask: "torn-smiling-mascot-head", props: ["exposed-mechanics", "mismatched-gloves"], palette: ["#24132a", "#d54c86", "#5dc5d4"] },
    { id: "house_master", name: "Хозяин стола", silhouette: "largest-symmetrical", mask: "iconic-skull-mask", props: ["bone-shoulders", "pristine-dark-deck"], palette: ["#100b09", "#b52f26", "#d2a13b"] }
  ]);
  function getDealer(id) { return DEALERS.find((dealer) => dealer.id === id) || DEALERS[0]; }
  return Object.freeze({ version: 1, STATES, STAGING, DEALERS, getDealer });
});
