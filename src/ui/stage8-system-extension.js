"use strict";
(function () {
  const Vault = window.BitayaMastStorageVault;
  const overlay = document.querySelector("#systemOverlay");
  if (!Vault || !overlay || !window.MutationObserver) return;
  const storage = Vault.resolveStorage();

  function installRollbackButton() {
    if (overlay.hidden || document.querySelector("#systemRollbackImport") || !storage.getItem(Vault.SNAPSHOT_KEY)) return;
    const importButton = document.querySelector("#systemImport");
    if (!importButton || !importButton.parentElement) return;
    const button = document.createElement("button");
    button.id = "systemRollbackImport";
    button.type = "button";
    button.textContent = "ОТКАТИТЬ ПОСЛЕДНИЙ ИМПОРТ";
    button.addEventListener("click", () => {
      if (!window.confirm("Вернуть сохранения, которые были до последнего импорта?")) return;
      try {
        const result = Vault.restoreSnapshot(storage);
        if (!result.restored) throw new Error("Снимок до импорта не найден.");
        window.location.reload();
      } catch (error) {
        if (window.BitayaMastSystem && window.BitayaMastSystem.reportText) window.alert(error.message || "Не удалось выполнить откат.");
      }
    });
    importButton.parentElement.append(button);
  }

  const observer = new MutationObserver(installRollbackButton);
  observer.observe(overlay, { childList: true, subtree: true });
  installRollbackButton();
})();
