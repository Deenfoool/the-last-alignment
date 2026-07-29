"use strict";
const assert = require("node:assert/strict");
const BaseVault = require("../src/core/storage-vault.js");
globalThis.BitayaMastStorageVault = BaseVault;
require("../src/core/storage-vault-extension.js");
const Vault = globalThis.BitayaMastStorageVault;

function freshStorage() {
  const storage = Vault.createMemoryStorage();
  storage.clear();
  return storage;
}

const storage = freshStorage();
const runKey = "bitaya-mast-test-run-v1";
const settingsKey = "bitaya-mast-stage6-dealer-v1";

Vault.writeJson(runKey, { version: 1, hp: 70 }, storage);
Vault.writeJson(runKey, { version: 1, hp: 61 }, storage);
Vault.writeJson(runKey, { version: 1, hp: 52 }, storage);
assert.equal(Vault.readJson(runKey, { storage }).value.hp, 52);

storage.setItem(runKey, "{broken-json");
const recovered = Vault.readJson(runKey, {
  storage,
  validate(value) { return value && value.version === 1 && value.hp > 0; },
});
assert.equal(recovered.status, "recovered");
assert.equal(recovered.value.hp, 61, "Должна вернуться предыдущая целая запись");
assert.ok(Vault.listQuarantine(storage).length >= 1, "Повреждённая запись должна попасть в карантин");

Vault.setRaw(settingsKey, "archivist", storage);
const exported = Vault.exportText(storage);
const parsed = Vault.parseBundle(exported);
assert.ok(parsed.entries.some((entry) => entry.key === settingsKey && entry.raw === "archivist"), "Экспорт должен поддерживать строковые настройки");

const secondStorage = freshStorage();
const imported = Vault.importBundle(exported, secondStorage);
assert.equal(imported.imported, parsed.entries.length);
assert.equal(Vault.getRaw(settingsKey, secondStorage), "archivist");
assert.equal(Vault.readJson(runKey, { storage: secondStorage }).value.hp, 61);

const tampered = JSON.parse(exported);
tampered.entries[0].raw += " ";
assert.throws(() => Vault.parseBundle(JSON.stringify(tampered)), /Контрольная сумма/);

Vault.writeJson(runKey, { version: 1, hp: 10 }, secondStorage);
Vault.importBundle(exported, secondStorage);
assert.ok(secondStorage.getItem(Vault.SNAPSHOT_KEY), "Перед импортом должен создаваться снимок");
assert.equal(Vault.readJson(runKey, { storage: secondStorage }).value.hp, 61);
const restoredSnapshot = Vault.restoreSnapshot(secondStorage);
assert.ok(restoredSnapshot.restored > 0);
assert.equal(Vault.readJson(runKey, { storage: secondStorage }).value.hp, 10, "Откат должен возвращать состояние до импорта");

const audit = Vault.audit([
  { key: runKey, label: "Забег", validate: (value) => value && value.hp > 0 },
  { key: "bitaya-mast-missing", label: "Нет" },
], secondStorage);
assert.equal(audit[0].status, "ok");
assert.equal(audit[1].status, "missing");

const removed = Vault.clearKeys([runKey, settingsKey], secondStorage);
assert.equal(removed, 2);
assert.equal(Vault.getRaw(runKey, secondStorage), null);

console.log("Stage 8 resilience tests passed", {
  quarantine: Vault.listQuarantine(storage).length,
  bundleEntries: parsed.entries.length,
  restored: restoredSnapshot.restored,
});
