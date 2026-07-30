"use strict";
const fs=require("fs");
const assert=require("assert");
function read(path){return fs.readFileSync(path,"utf8");}
const guard=read("src/ui/stage3-initial-save-guard.js");
const assembler=read("src/ui/scene-asset-assembler.js");
const sw=read("sw.js");
const required=[
  "styles/diegetic-ui.css",
  "styles/physical-card-interactions.css",
  "styles/scene-asset-assembly.css",
  "styles/visual-v2-integration.css",
  "src/data/scene-asset-manifest.js",
  "src/ui/scene-asset-assembler.js",
  "src/ui/physical-card-interactions.js",
  "assets/scene/v2/background.svg",
  "assets/scene/v2/table.svg",
  "assets/scene/v2/ambient.svg",
  "assets/scene/v2/dust.svg",
  "assets/scene/v2/vignette.svg",
  "assets/dealers/v2/dealer-atlas.svg",
  "assets/cards/v2/starter-sheet.svg"
];
required.forEach((path)=>assert(fs.existsSync(path),`Отсутствует ${path}`));
required.forEach((path)=>assert(guard.includes(path)||sw.includes(`./${path}`),`Ассет не подключён: ${path}`));
assert(guard.includes("visual-v2-ready"),"Нет флага готовой сцены");
assert(guard.includes("visual-v2-fallback"),"Нет безопасного fallback");
assert(assembler.includes("bitaya:dealer-changed"),"Нет синхронизации дилера");
assert(sw.includes('SW_VERSION = "14"'),"Service Worker не обновлён до v14");
console.log("Visual v2 integration: OK");