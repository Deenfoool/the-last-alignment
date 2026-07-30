"use strict";
const fs=require("fs");
const assert=require("assert");
const css=fs.readFileSync("styles/visual-v2-polish.css","utf8");
const js=fs.readFileSync("src/ui/visual-v2-polish.js","utf8");
const guard=fs.readFileSync("src/ui/stage3-initial-save-guard.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
[
  ".scene-asset-layer--dealer",
  ".hand .game-card.physical-preview",
  ".visual-dealer-hit",
  ".visual-dealer-shield",
  ".visual-dealer-win",
  ".visual-dealer-lose",
  "@media(max-width:760px)"
].forEach(token=>assert(css.includes(token),`Нет правила ${token}`));
assert(js.includes("MutationObserver"),"Нет реакций на изменение боя");
assert(js.includes("visualDebug"),"Нет режима визуальной диагностики");
assert(guard.includes("styles/visual-v2-polish.css"),"Полировка не подключена");
assert(guard.includes("src/ui/visual-v2-polish.js"),"Скрипт полировки не подключён");
assert(sw.includes('SW_VERSION = "15"'),"Service Worker не обновлён");
assert(sw.includes("visual-v2-polish.css")&&sw.includes("visual-v2-polish.js"),"Файлы не попали в PWA-кэш");
console.log("Visual v2 polish: OK");