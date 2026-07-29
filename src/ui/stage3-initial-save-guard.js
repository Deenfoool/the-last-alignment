"use strict";
(function () {
  const setup = document.querySelector("#setupOverlay");
  if (!setup || setup.hidden) return;
  try {
    localStorage.removeItem("bitaya-mast-stage3-battle-v2");
  } catch (error) {
    console.warn("Не удалось очистить предварительное сохранение", error);
  }
})();
