"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const loaderPath = path.join(__dirname, "..", "src", "ui", "stage6-app-loader.js");
const source = fs.readFileSync(loaderPath, "utf8");

assert.match(source, /\(0, eval\)\(source\)/, "Загрузчик по-прежнему выполняет собранный интерфейс в глобальной области.");
assert.match(source, /window\.BitayaMastDealerCatalog/, "Каталог дилеров должен передаваться в патч через window.");
assert.match(source, /window\.BitayaMastDealerAI/, "ИИ дилера должен передаваться в патч через window.");
assert.doesNotMatch(source, /return Dealers\.getDealer/, "Код внутри глобального eval не должен ссылаться на локальную переменную Dealers.");
assert.doesNotMatch(source, /return AI\.chooseCard/, "Код внутри глобального eval не должен ссылаться на локальную переменную AI.");
assert.doesNotMatch(source, /const intent = AI\.intentFor/, "Расчёт намерения не должен ссылаться на локальную переменную AI.");

console.log("Stage 6 patched loader scope test passed");
