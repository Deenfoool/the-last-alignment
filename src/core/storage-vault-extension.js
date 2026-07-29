"use strict";
(function (root) {
  const Base = root.BitayaMastStorageVault;
  if (!Base) throw new Error("Storage vault extension requires storage vault.");
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function parseBundle(input) {
    const bundle = typeof input === "string" ? JSON.parse(input) : clone(input);
    if (!bundle || bundle.format !== Base.FORMAT || bundle.version !== Base.VERSION || !Array.isArray(bundle.entries)) throw new Error("Файл не является сохранением «Битой масти».");
    const core = { format: bundle.format, version: bundle.version, exportedAt: bundle.exportedAt, entries: bundle.entries };
    if (bundle.checksum !== Base.hash(Base.stableStringify(core))) throw new Error("Контрольная сумма файла сохранения не совпала.");
    const seen = new Set();
    bundle.entries.forEach((entry) => {
      if (!entry || !Base.isManagedKey(entry.key) || typeof entry.raw !== "string") throw new Error("В файле обнаружена недопустимая запись.");
      if (seen.has(entry.key)) throw new Error(`Запись ${entry.key} повторяется в файле.`);
      if (entry.raw.length > 8 * 1024 * 1024) throw new Error(`Запись ${entry.key} слишком велика.`);
      seen.add(entry.key);
    });
    return bundle;
  }
  function importBundle(input, storage) {
    const target = Base.resolveStorage(storage);
    const bundle = parseBundle(input);
    target.setItem(Base.SNAPSHOT_KEY, JSON.stringify(Base.buildBundle(target)));
    bundle.entries.forEach((entry) => Base.setRaw(entry.key, entry.raw, target));
    return { imported: bundle.entries.length, exportedAt: bundle.exportedAt };
  }
  root.BitayaMastStorageVault = Object.freeze(Object.assign({}, Base, { parseBundle, importBundle }));
})(typeof globalThis !== "undefined" ? globalThis : this);
