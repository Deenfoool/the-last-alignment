"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const spec = require("../src/data/physical-card-spec.js");

const result = spec.validate();
assert.equal(result.ok, true, result.errors.join("\n"));
assert.equal(spec.CARDS.length, 10);
assert.deepEqual(spec.CANVAS, { width: 320, height: 448, safe: 16 });
assert.equal(spec.validateFaceText("Даёт 8 урона").ok, false);
assert.equal(spec.validateFaceText("ПРОСРОЧЕН 01.01.2020").ok, true);
assert.ok(spec.fanTransform(0, 10, false).angle < 0);
assert.ok(spec.fanTransform(9, 10, false).angle > 0);

const sheet = fs.readFileSync(path.join(__dirname, "../assets/cards/v2/starter-sheet.svg"), "utf8");
spec.CARDS.forEach((card) => assert.match(sheet, new RegExp(`id=["']${card.id}["']`), `Нет ассета ${card.id}`));
spec.FORBIDDEN_FACE_TERMS.forEach((term) => assert.equal(sheet.toLocaleLowerCase("ru-RU").includes(term), false, `Механический термин попал на лицо: ${term}`));
assert.match(sheet, /width="1600" height="896"/);
console.log("Physical card system: OK");