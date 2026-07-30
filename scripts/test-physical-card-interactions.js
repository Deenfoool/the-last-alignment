"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/ui/physical-card-interactions.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles/physical-card-interactions.css"), "utf8");
const loader = fs.readFileSync(path.join(root, "src/ui/stage6-app-loader.js"), "utf8");

assert.match(source, /pointerover/);
assert.match(source, /focusin/);
assert.match(source, /event\.detail === 0/);
assert.match(source, /stopImmediatePropagation/);
assert.match(source, /Нажми ещё раз, чтобы разыграть/);
assert.match(source, /Стоимость:/);
assert.match(source, /MutationObserver/);
assert.doesNotMatch(source, /stopTimer\s*\(/, "Обычный preview не должен останавливать таймер");
assert.match(css, /physical-card-tooltip/);
assert.match(css, /physical-touch-selected/);
assert.match(css, /prefers-reduced-motion/);
assert.match(loader, /physical-card-interactions\.js\?v=14/);
assert.match(loader, /physical-card-interactions\.css\?v=14/);
console.log("physical-card-interactions: ok");
