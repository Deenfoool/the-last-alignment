"use strict";
(function () {
  const Vault = window.BitayaMastStorageVault;
  const Pwa = window.BitayaMastPwa;
  const Run = window.BitayaMastActRun;
  const Profile = window.BitayaMastRunProfile;
  const Content = window.BitayaMastContentSettings;
  const Timer = window.BitayaMastTimerSettings;
  const Dealers = window.BitayaMastDealerCatalog;
  const Battle = window.BitayaMastBattle;
  if (!Vault || !Pwa) throw new Error("Не загружены модули устойчивости этапа 8.");

  const KEYS = Object.freeze({
    battle: "bitaya-mast-stage3-battle-v2",
    battleContext: "bitaya-mast-stage7-battle-context-v1",
    battleResult: "bitaya-mast-stage7-battle-result-v1",
    run: Run && Run.STORAGE_KEY || "bitaya-mast-stage7-run-v1",
    profile: Profile && Profile.STORAGE_KEY || "bitaya-mast-stage7-profile-v1",
    timer: Timer && Timer.STORAGE_KEY || "bitaya-mast-stage3-settings-v1",
    content: Content && Content.STORAGE_KEY || "bitaya-mast-content-settings-v1",
    dealer: Dealers && Dealers.STORAGE_KEY || "bitaya-mast-stage6-dealer-v1",
  });
  const storage = Vault.resolveStorage();
  const overlay = document.querySelector("#systemOverlay");
  const button = document.querySelector("#systemButton");
  const app = document.querySelector("#app");
  let auditResults = [];
  let latestPwaStatus = null;
  let systemToastTimer = null;

  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
  function bytesLabel(value) { const bytes = Number(value || 0); if (bytes < 1024) return `${bytes} Б`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} КБ`; return `${(bytes / 1048576).toFixed(1)} МБ`; }
  function showToast(message, kind) {
    let toast = document.querySelector("#systemToast");
    if (!toast) { toast = document.createElement("div"); toast.id = "systemToast"; toast.className = "system-toast"; document.body.append(toast); }
    toast.textContent = message;
    toast.dataset.kind = kind || "info";
    toast.classList.add("show");
    clearTimeout(systemToastTimer);
    systemToastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }
  function jsonObject(value) { return Boolean(value && typeof value === "object"); }
  function auditDefinitions() {
    return [
      { key: KEYS.run, label: "Текущий забег", migrate: Run && Run.migrate, validate: (value) => !Run || Run.validate(value) },
      { key: KEYS.profile, label: "Постоянная статистика", migrate: Profile && Profile.migrate, validate: jsonObject },
      { key: KEYS.battle, label: "Текущая дуэль", migrate: (raw) => { if (!Battle) return raw; if (raw && raw.state) return Object.assign({}, raw, { state: Battle.migrateSave(raw.state) }); return Battle.migrateSave(raw); }, validate: jsonObject },
      { key: KEYS.battleContext, label: "Связь дуэли с маршрутом", validate: jsonObject },
      { key: KEYS.battleResult, label: "Результат последней дуэли", validate: jsonObject },
      { key: KEYS.timer, label: "Настройки времени", migrate: Timer && Timer.migrate, validate: jsonObject },
      { key: KEYS.content, label: "Контентный фильтр", migrate: Content && Content.normalize, validate: jsonObject },
    ];
  }
  function auditDealer() {
    const raw = Vault.getRaw(KEYS.dealer, storage);
    if (raw == null) return { key: KEYS.dealer, label: "Выбранный дилер", status: "missing", recovered: false, error: null };
    const normalized = Dealers ? Dealers.normalizeId(raw) : raw;
    if (normalized === raw) return { key: KEYS.dealer, label: "Выбранный дилер", status: "ok", recovered: false, error: null };
    Vault.quarantine(KEYS.dealer, raw, "unknown-dealer", storage);
    Vault.setRaw(KEYS.dealer, normalized, storage);
    return { key: KEYS.dealer, label: "Выбранный дилер", status: "recovered", recovered: true, error: "Неизвестный дилер заменён на Шулера." };
  }
  function runAudit() {
    auditResults = Vault.audit(auditDefinitions(), storage);
    auditResults.push(auditDealer());
    return auditResults;
  }
  function supportRows() {
    const tests = [
      ["JavaScript-модули", typeof Promise !== "undefined" && typeof fetch === "function"],
      ["Локальное хранилище", window.__TLA_STORAGE_MODE__ !== "memory"],
      ["Service Worker", "serviceWorker" in navigator],
      ["Cache Storage", "caches" in window],
      ["Web Crypto", Boolean(window.crypto && (crypto.getRandomValues || crypto.randomUUID))],
      ["Сенсорное управление", (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window],
      ["Диалоговые окна", typeof document.createElement("dialog").showModal === "function"],
      ["Защита inert", "inert" in HTMLElement.prototype],
    ];
    return tests.map(([label, ok]) => `<div><span>${escapeHtml(label)}</span><b class="${ok ? "ok" : "warn"}">${ok ? "РАБОТАЕТ" : "FALLBACK"}</b></div>`).join("");
  }
  function saveRows() {
    return auditResults.map((item) => {
      const labels = { ok: "ЦЕЛО", missing: "НЕТ ДАННЫХ", recovered: "ВОССТАНОВЛЕНО", corrupt: "ПОВРЕЖДЕНО" };
      return `<div class="save-row" data-status="${item.status}"><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.key)}</small></span><strong>${labels[item.status] || item.status}</strong>${item.error ? `<p>${escapeHtml(item.error)}</p>` : ""}</div>`;
    }).join("");
  }
  async function storageEstimate() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      const estimate = await navigator.storage.estimate();
      return { usage: estimate.usage || 0, quota: estimate.quota || 0 };
    } catch (error) { return null; }
  }
  async function diagnosticData() {
    const estimate = await storageEstimate();
    latestPwaStatus = await Pwa.status();
    return {
      generatedAt: new Date().toISOString(),
      url: location.href,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform || "unknown",
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      screen: window.screen ? `${screen.width}×${screen.height}` : "unknown",
      devicePixelRatio: window.devicePixelRatio || 1,
      online: navigator.onLine !== false,
      storageMode: window.__TLA_STORAGE_MODE__ || "unknown",
      storageEstimate: estimate,
      pwa: latestPwaStatus,
      saves: auditResults,
      quarantine: Vault.listQuarantine(storage).map((item) => ({ originalKey: item.originalKey, reason: item.reason, capturedAt: item.capturedAt })),
      compatibilityVersion: window.__TLA_COMPATIBILITY_VERSION__ || null,
      stage8Compatibility: window.BitayaMastCompatibilityV8 && window.BitayaMastCompatibilityV8.VERSION || null,
    };
  }
  async function reportText() { return JSON.stringify(await diagnosticData(), null, 2); }
  async function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value);
    const area = document.createElement("textarea"); area.value = value; area.style.position = "fixed"; area.style.opacity = "0"; document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
  }
  function downloadText(filename, value) {
    const blob = new Blob([value], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("system-open");
    if (app && document.querySelector("#actOverlay") && document.querySelector("#actOverlay").hidden) app.inert = false;
    button && button.focus();
  }
  async function open() {
    if (!overlay) return;
    runAudit();
    const data = await diagnosticData();
    const estimate = data.storageEstimate;
    const pwa = data.pwa || {};
    const cacheNames = pwa.caches && pwa.caches.keys || [];
    overlay.innerHTML = `<section class="system-screen" role="dialog" aria-modal="true" aria-labelledby="systemTitle">
      <header><div><span>⚙</span><div><h2 id="systemTitle">СИСТЕМА И ДИАГНОСТИКА</h2><p>Сохранения, браузер, офлайн-режим и обновления.</p></div></div><button id="systemClose" type="button" aria-label="Закрыть">×</button></header>
      <main>
        <section class="system-card"><h3>СОСТОЯНИЕ УСТРОЙСТВА</h3><div class="system-status-grid">${supportRows()}</div><div class="system-summary"><span>СЕТЬ <b class="${data.online ? "ok" : "warn"}">${data.online ? "ОНЛАЙН" : "ОФЛАЙН"}</b></span><span>РЕЖИМ <b>${escapeHtml(pwa.displayMode || "browser")}</b></span><span>РАЗМЕР <b>${escapeHtml(data.viewport)}</b></span><span>ХРАНИЛИЩЕ <b>${estimate ? `${bytesLabel(estimate.usage)} / ${bytesLabel(estimate.quota)}` : "неизвестно"}</b></span></div></section>
        <section class="system-card"><h3>СОХРАНЕНИЯ</h3><div class="save-audit">${saveRows()}</div><div class="system-note">Повреждённые записи не удаляются молча: они переносятся в карантин, после чего игра пытается восстановить резервную копию.</div></section>
        <section class="system-card"><h3>PWA И ОБНОВЛЕНИЯ</h3><div class="pwa-summary"><div><span>Управление приложением</span><b>${pwa.controlled ? "АКТИВНО" : pwa.supported ? "ОЖИДАЕТ ПЕРЕЗАГРУЗКИ" : "НЕ ПОДДЕРЖИВАЕТСЯ"}</b></div><div><span>Доступно обновление</span><b>${pwa.waiting ? "ДА" : "НЕТ"}</b></div><div><span>Офлайн-кэши</span><b>${cacheNames.length}</b></div><div><span>Установка на устройство</span><b>${pwa.installAvailable ? "ДОСТУПНА" : pwa.displayMode === "standalone" ? "УСТАНОВЛЕНО" : "НЕТ ЗАПРОСА"}</b></div></div><div class="system-actions"><button id="systemCheckUpdate" type="button">ПРОВЕРИТЬ ОБНОВЛЕНИЕ</button><button id="systemApplyUpdate" class="primary" type="button" ${pwa.waiting ? "" : "disabled"}>УСТАНОВИТЬ ОБНОВЛЕНИЕ</button><button id="systemInstall" type="button" ${pwa.installAvailable ? "" : "disabled"}>УСТАНОВИТЬ ИГРУ</button><button id="systemClearCache" type="button">ПЕРЕСОБРАТЬ КЭШ</button></div></section>
        <section class="system-card"><h3>РЕЗЕРВНАЯ КОПИЯ</h3><p>Экспорт содержит текущий забег, дуэль, настройки и постоянную статистику. Перед импортом автоматически создаётся локальный снимок.</p><div class="system-actions"><button id="systemExport" class="primary" type="button">СКАЧАТЬ СОХРАНЕНИЕ</button><button id="systemImport" type="button">ИМПОРТИРОВАТЬ</button><input id="systemImportFile" type="file" accept="application/json,.json" hidden><button id="systemCopyReport" type="button">СКОПИРОВАТЬ ОТЧЁТ</button></div></section>
        <section class="system-card danger-zone"><h3>СБРОС ДАННЫХ</h3><p>Каждая кнопка удаляет только указанную часть. Резервная копия остаётся доступна для автоматического восстановления.</p><div class="system-actions"><button id="systemClearBattle" type="button">СБРОСИТЬ ДУЭЛЬ</button><button id="systemClearRun" type="button">СБРОСИТЬ ЗАБЕГ</button><button id="systemClearAll" class="danger" type="button">УДАЛИТЬ ВЕСЬ ПРОГРЕСС</button></div></section>
      </main>
      <footer><span>КАРАНТИН: ${data.quarantine.length}</span><span>ХРАНИЛИЩЕ: ${escapeHtml(data.storageMode)}</span><span>PWA v${Pwa.VERSION} · VAULT v${Vault.VERSION}</span></footer>
    </section>`;
    overlay.hidden = false;
    document.body.classList.add("system-open");
    if (app) app.inert = true;
    bind();
    document.querySelector("#systemClose").focus();
  }
  function confirmAction(message, callback) { if (window.confirm(message)) { callback(); showToast("Готово. Страница будет перезагружена.", "ok"); setTimeout(() => location.reload(), 350); } }
  function bind() {
    document.querySelector("#systemClose").addEventListener("click", close);
    document.querySelector("#systemCheckUpdate").addEventListener("click", async () => { showToast("Проверяю обновление…"); await Pwa.checkForUpdate(); await open(); });
    document.querySelector("#systemApplyUpdate").addEventListener("click", async () => { if (!(await Pwa.applyUpdate())) showToast("Ожидающего обновления нет.", "warn"); });
    document.querySelector("#systemInstall").addEventListener("click", async () => { const result = await Pwa.promptInstall(); showToast(result.outcome === "accepted" ? "Установка началась." : "Установка не выполнена.", result.outcome === "accepted" ? "ok" : "warn"); });
    document.querySelector("#systemClearCache").addEventListener("click", async () => { const removed = await Pwa.clearCaches(); showToast(`Удалено кэшей: ${removed}. Перезагружаю…`, "ok"); setTimeout(() => location.reload(), 500); });
    document.querySelector("#systemExport").addEventListener("click", () => { const date = new Date().toISOString().slice(0, 10); downloadText(`bitaya-mast-save-${date}.json`, Vault.exportText(storage)); showToast("Резервная копия скачана.", "ok"); });
    const fileInput = document.querySelector("#systemImportFile");
    document.querySelector("#systemImport").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0]; if (!file) return;
      try { const result = Vault.importBundle(await file.text(), storage); showToast(`Импортировано записей: ${result.imported}.`, "ok"); setTimeout(() => location.reload(), 600); }
      catch (error) { showToast(error.message || "Импорт не выполнен.", "error"); }
    });
    document.querySelector("#systemCopyReport").addEventListener("click", async () => { await copyText(await reportText()); showToast("Диагностический отчёт скопирован.", "ok"); });
    document.querySelector("#systemClearBattle").addEventListener("click", () => confirmAction("Сбросить только текущую дуэль? Маршрут останется.", () => Vault.clearKeys([KEYS.battle, KEYS.battleContext, KEYS.battleResult], storage)));
    document.querySelector("#systemClearRun").addEventListener("click", () => confirmAction("Сбросить текущий забег и дуэль? Постоянная статистика останется.", () => Vault.clearKeys([KEYS.battle, KEYS.battleContext, KEYS.battleResult, KEYS.run], storage)));
    document.querySelector("#systemClearAll").addEventListener("click", () => confirmAction("Удалить весь прогресс, настройки и статистику?", () => Vault.clearKeys(Vault.listManagedKeys(storage), storage)));
  }

  if (button) button.addEventListener("click", open);
  if (overlay) overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && overlay && !overlay.hidden) close(); });
  Pwa.subscribe((event) => {
    if (event.type === "update-ready") {
      showToast("Доступна новая версия игры. Открой системное меню для обновления.", "ok");
      if (button) button.classList.add("update-ready");
    }
    if (event.type === "offline") showToast("Соединение потеряно. Игра продолжит работу из кэша.", "warn");
    if (event.type === "online") showToast("Соединение восстановлено.", "ok");
  });

  runAudit();
  const damaged = auditResults.filter((item) => item.status === "corrupt" || item.status === "recovered");
  if (damaged.length) setTimeout(() => showToast(damaged.some((item) => item.status === "corrupt") ? "Обнаружено повреждённое сохранение. Открой диагностику." : "Сохранение восстановлено из резервной копии.", damaged.some((item) => item.status === "corrupt") ? "error" : "ok"), 700);
  Pwa.register("./sw.js");
  window.BitayaMastSystem = Object.freeze({ open, close, runAudit, diagnosticData, reportText, KEYS });
})();
