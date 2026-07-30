"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const runtime = fs.readFileSync("src/ui/stage4-runtime.js", "utf8");
const css = fs.readFileSync("styles/visual-stage3-cards.css", "utf8");

assert.match(runtime, /physical-card-tooltip/);
assert.match(runtime, /physical-card-face/);
assert.match(runtime, /touchArmed/);
assert.match(runtime, /event\.stopImmediatePropagation\(\)/);
assert.match(runtime, /aria-disabled/);
assert.match(runtime, /pointerenter/);
assert.match(runtime, /first|physical-selected|showTooltip/);
assert.match(css, /\.game-card\.physical-selected/);
assert.match(css, /@media \(pointer: coarse\)/);
assert.match(css, /\.physical-card-tooltip\[data-open="true"\]/);
assert.doesNotMatch(css, /\.card-body\s*\{[^}]*display\s*:\s*block/s);

console.log("Visual stage 3 physical-card checks passed");
