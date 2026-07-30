"use strict";
const fs=require("fs");
const path=require("path");
const manifest=require("../src/data/scene-asset-manifest.js");
function ok(value,message){if(!value)throw new Error(message);}
manifest.validate();
ok(manifest.LAYERS.length===6,"Ожидалось шесть слоёв сцены");
ok(manifest.CARD_SHEET.endsWith("starter-sheet.svg"),"Не подключён лист физических карт");
["dealer","table","hand","hud","timer","intent","log","draw","discard"].forEach(id=>ok(manifest.ANCHORS[id],`Нет точки привязки ${id}`));
manifest.LAYERS.forEach(layer=>{
  const file=path.join(__dirname,"..",layer.src);
  ok(fs.existsSync(file),`Не найден ассет ${layer.src}`);
  if(layer.src.endsWith(".svg")){const text=fs.readFileSync(file,"utf8");ok(/<svg\b/.test(text),`Некорректный SVG ${layer.src}`);}
});
ok(fs.existsSync(path.join(__dirname,"..",manifest.CARD_SHEET)),"Не найден лист карт");
console.log("scene asset manifest: ok");