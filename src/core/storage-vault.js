"use strict";
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastStorageVault = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const VERSION = 1;
  const FORMAT = "bitaya-mast-save-bundle";
  const PREFIX = "bitaya-mast-";
  const BACKUP_SUFFIX = ".__backup_v1";
  const META_SUFFIX = ".__meta_v1";
  const QUARANTINE_PREFIX = `${PREFIX}quarantine-v1:`;
  const SNAPSHOT_KEY = `${PREFIX}system-snapshot-v1`;
  let installed = false;
  let nativeMethods = null;
  const memoryData = new Map();

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function safeString(value) { try { return String(value); } catch (error) { return ""; } }
  function hash(value) {
    const source = safeString(value);
    let result = 2166136261;
    for (let index = 0; index < source.length; index += 1) { result ^= source.charCodeAt(index); result = Math.imul(result, 16777619); }
    return (result >>> 0).toString(16).padStart(8, "0");
  }
  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  function createMemoryStorage() {
    return {
      get length() { return memoryData.size; },
      key(index) { return Array.from(memoryData.keys())[index] || null; },
      getItem(key) { key = safeString(key); return memoryData.has(key) ? memoryData.get(key) : null; },
      setItem(key, value) { memoryData.set(safeString(key), safeString(value)); },
      removeItem(key) { memoryData.delete(safeString(key)); },
      clear() { memoryData.clear(); },
    };
  }
  const memoryStorage = createMemoryStorage();

  function resolveStorage(preferred) {
    if (preferred && typeof preferred.getItem === "function") return preferred;
    try {
      if (root && root.localStorage) {
        const key = `${PREFIX}storage-test`;
        root.localStorage.setItem(key, "1");
        root.localStorage.removeItem(key);
        return root.localStorage;
      }
    } catch (error) { /* use memory storage */ }
    return memoryStorage;
  }
  function isInternalKey(key) {
    const value = safeString(key);
    return value.endsWith(BACKUP_SUFFIX) || value.endsWith(META_SUFFIX) || value.startsWith(QUARANTINE_PREFIX) || value === SNAPSHOT_KEY;
  }
  function isManagedKey(key) { const value = safeString(key); return value.startsWith(PREFIX) && !isInternalKey(value); }
  function backupKey(key) { return `${key}${BACKUP_SUFFIX}`; }
  function metaKey(key) { return `${key}${META_SUFFIX}`; }
  function metadata(raw) { return { version: VERSION, checksum: hash(raw), bytes: safeString(raw).length, writtenAt: Date.now() }; }

  function directGet(storage, key) {
    try {
      if (nativeMethods && storage && root && root.Storage && storage instanceof root.Storage) return nativeMethods.get.call(storage, key);
      return storage.getItem(key);
    } catch (error) { return memoryStorage.getItem(key); }
  }
  function directSet(storage, key, value) {
    try {
      if (nativeMethods && storage && root && root.Storage && storage instanceof root.Storage) return nativeMethods.set.call(storage, key, value);
      return storage.setItem(key, value);
    } catch (error) { return memoryStorage.setItem(key, value); }
  }
  function directRemove(storage, key) {
    try {
      if (nativeMethods && storage && root && root.Storage && storage instanceof root.Storage) return nativeMethods.remove.call(storage, key);
      return storage.removeItem(key);
    } catch (error) { return memoryStorage.removeItem(key); }
  }
  function directKeys(storage) {
    const keys = [];
    try { for (let index = 0; index < storage.length; index += 1) { const key = storage.key(index); if (key != null) keys.push(key); } }
    catch (error) { for (let index = 0; index < memoryStorage.length; index += 1) keys.push(memoryStorage.key(index)); }
    return keys;
  }

  function quarantine(key, raw, reason, storage) {
    if (raw == null) return null;
    const target = resolveStorage(storage);
    const quarantineKey = `${QUARANTINE_PREFIX}${Date.now()}:${encodeURIComponent(key)}`;
    const record = { version: VERSION, originalKey: key, reason: safeString(reason || "invalid"), capturedAt: Date.now(), raw: safeString(raw) };
    directSet(target, quarantineKey, JSON.stringify(record));
    return quarantineKey;
  }
  function setRaw(key, raw, storage, options) {
    const target = resolveStorage(storage);
    const value = safeString(raw);
    const opts = options || {};
    if (isManagedKey(key) && !opts.skipBackup) {
      const current = directGet(target, key);
      if (current != null && current !== value) directSet(target, backupKey(key), current);
    }
    directSet(target, key, value);
    if (isManagedKey(key)) directSet(target, metaKey(key), JSON.stringify(metadata(value)));
    return value;
  }
  function remove(key, storage, options) {
    const target = resolveStorage(storage);
    const opts = options || {};
    const current = directGet(target, key);
    if (current != null && isManagedKey(key) && !opts.skipBackup) directSet(target, backupKey(key), current);
    directRemove(target, key);
    directRemove(target, metaKey(key));
  }
  function getRaw(key, storage) {
    const target = resolveStorage(storage);
    let raw = directGet(target, key);
    if (raw == null || !isManagedKey(key)) return raw;
    const metaRaw = directGet(target, metaKey(key));
    if (!metaRaw) return raw;
    try {
      const meta = JSON.parse(metaRaw);
      if (meta.checksum === hash(raw)) return raw;
    } catch (error) { /* recover below */ }
    const backup = directGet(target, backupKey(key));
    quarantine(key, raw, "checksum-mismatch", target);
    if (backup != null) {
      setRaw(key, backup, target, { skipBackup: true });
      raw = backup;
    }
    return raw;
  }
  function writeJson(key, value, storage) { return setRaw(key, JSON.stringify(value), storage); }
  function readJson(key, options) {
    const opts = options || {};
    const target = resolveStorage(opts.storage);
    const raw = getRaw(key, target);
    if (raw == null) return { value: opts.fallback === undefined ? null : clone(opts.fallback), status: "missing", recovered: false, error: null };
    try {
      let value = JSON.parse(raw);
      if (typeof opts.migrate === "function") value = opts.migrate(value);
      if (typeof opts.validate === "function" && opts.validate(value) === false) throw new Error("Validation returned false.");
      return { value, status: "ok", recovered: false, error: null };
    } catch (primaryError) {
      quarantine(key, raw, primaryError.message, target);
      const backup = directGet(target, backupKey(key));
      if (backup != null) {
        try {
          let value = JSON.parse(backup);
          if (typeof opts.migrate === "function") value = opts.migrate(value);
          if (typeof opts.validate === "function" && opts.validate(value) === false) throw new Error("Backup validation returned false.");
          setRaw(key, backup, target, { skipBackup: true });
          return { value, status: "recovered", recovered: true, error: primaryError };
        } catch (backupError) { quarantine(key, backup, `backup: ${backupError.message}`, target); }
      }
      return { value: opts.fallback === undefined ? null : clone(opts.fallback), status: "corrupt", recovered: false, error: primaryError };
    }
  }
  function audit(definitions, storage) {
    const target = resolveStorage(storage);
    return (definitions || []).map((definition) => {
      const result = readJson(definition.key, { storage: target, migrate: definition.migrate, validate: definition.validate, fallback: definition.fallback });
      return { key: definition.key, label: definition.label || definition.key, status: result.status, recovered: result.recovered, error: result.error ? result.error.message : null };
    });
  }
  function listManagedKeys(storage) { return directKeys(resolveStorage(storage)).filter(isManagedKey).sort(); }
  function listQuarantine(storage) {
    const target = resolveStorage(storage);
    return directKeys(target).filter((key) => key.startsWith(QUARANTINE_PREFIX)).sort().map((key) => {
      try { return Object.assign({ key }, JSON.parse(directGet(target, key))); }
      catch (error) { return { key, reason: "unreadable-quarantine" }; }
    });
  }
  function buildBundle(storage, keys) {
    const target = resolveStorage(storage);
    const selected = (keys && keys.length ? keys : listManagedKeys(target)).filter(isManagedKey).sort();
    const entries = selected.map((key) => ({ key, raw: directGet(target, key) })).filter((entry) => entry.raw != null);
    const core = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), entries };
    return Object.assign(core, { checksum: hash(stableStringify(core)) });
  }
  function exportText(storage, keys) { return JSON.stringify(buildBundle(storage, keys), null, 2); }
  function parseBundle(input) {
    const bundle = typeof input === "string" ? JSON.parse(input) : clone(input);
    if (!bundle || bundle.format !== FORMAT || bundle.version !== VERSION || !Array.isArray(bundle.entries)) throw new Error("Файл не является сохранением «Битой масти».");
    const core = { format: bundle.format, version: bundle.version, exportedAt: bundle.exportedAt, entries: bundle.entries };
    if (bundle.checksum !== hash(stableStringify(core))) throw new Error("Контрольная сумма файла сохранения не совпала.");
    bundle.entries.forEach((entry) => {
      if (!entry || !isManagedKey(entry.key) || typeof entry.raw !== "string") throw new Error("В файле обнаружена недопустимая запись.");
      try { JSON.parse(entry.raw); } catch (error) { throw new Error(`Запись ${entry.key} содержит повреждённый JSON.`); }
    });
    return bundle;
  }
  function importBundle(input, storage) {
    const target = resolveStorage(storage);
    const bundle = parseBundle(input);
    directSet(target, SNAPSHOT_KEY, JSON.stringify(buildBundle(target)));
    bundle.entries.forEach((entry) => setRaw(entry.key, entry.raw, target));
    return { imported: bundle.entries.length, exportedAt: bundle.exportedAt };
  }
  function restoreSnapshot(storage) {
    const target = resolveStorage(storage);
    const raw = directGet(target, SNAPSHOT_KEY);
    if (!raw) return { restored: 0 };
    const result = importBundle(JSON.parse(raw), target);
    directRemove(target, SNAPSHOT_KEY);
    return { restored: result.imported };
  }
  function clearKeys(keys, storage) { const target = resolveStorage(storage); let removed = 0; (keys || []).forEach((key) => { if (directGet(target, key) != null) { remove(key, target); removed += 1; } }); return removed; }

  function install(storage) {
    if (installed || !root || !root.Storage || !root.Storage.prototype) return installed;
    const proto = root.Storage.prototype;
    try {
      nativeMethods = { get: proto.getItem, set: proto.setItem, remove: proto.removeItem };
      proto.getItem = function (key) { return getRaw(safeString(key), this); };
      proto.setItem = function (key, value) { return setRaw(safeString(key), safeString(value), this); };
      proto.removeItem = function (key) { return remove(safeString(key), this); };
      Object.defineProperty(proto, "__bitayaVaultV1", { value: true, configurable: false });
      installed = true;
    } catch (error) { installed = false; }
    return installed;
  }

  install();
  return Object.freeze({ VERSION, FORMAT, PREFIX, SNAPSHOT_KEY, createMemoryStorage, resolveStorage, isManagedKey, hash, stableStringify, install, setRaw, getRaw, remove, writeJson, readJson, audit, quarantine, listManagedKeys, listQuarantine, buildBundle, exportText, parseBundle, importBundle, restoreSnapshot, clearKeys });
});
