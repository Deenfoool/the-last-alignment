"use strict";
(function () {
  const setup = document.querySelector("#setupOverlay");
  if (setup && !setup.hidden) {
    try { localStorage.removeItem("bitaya-mast-stage3-battle-v2"); }
    catch (error) { console.warn("Не удалось очистить предварительное сохранение", error); }
  }

  const VERSION = "15";
  const styles = [
    "styles/diegetic-ui.css",
    "styles/physical-card-interactions.css",
    "styles/scene-asset-assembly.css",
    "styles/visual-v2-integration.css",
    "styles/visual-v2-polish.css"
  ];
  const scripts = [
    "src/data/scene-asset-manifest.js",
    "src/ui/scene-asset-assembler.js",
    "src/ui/physical-card-interactions.js",
    "src/ui/visual-v2-polish.js"
  ];

  function loadStyle(path) {
    if (document.querySelector(`link[data-visual-v2=\"${path}\"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${path}?v=${VERSION}`;
    link.dataset.visualV2 = path;
    document.head.append(link);
  }

  function loadScript(path) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-visual-v2=\"${path}\"]`)) { resolve(); return; }
      const script = document.createElement("script");
      script.src = `${path}?v=${VERSION}`;
      script.dataset.visualV2 = path;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Не удалось загрузить ${path}`));
      document.body.append(script);
    });
  }

  function probe(path) {
    return fetch(`${path}?v=${VERSION}`, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return true;
    });
  }

  async function activateVisualV2() {
    styles.forEach(loadStyle);
    try {
      await scripts.reduce((chain, path) => chain.then(() => loadScript(path)), Promise.resolve());
      const manifest = window.BitayaMastSceneAssets;
      if (!manifest || !manifest.validate()) throw new Error("Манифест сцены v2 недоступен");
      await Promise.all(manifest.LAYERS.filter((layer) => layer.required).map((layer) => probe(layer.src)));
      document.documentElement.classList.remove("visual-v2-fallback");
      document.documentElement.classList.add("visual-v2-ready");
      window.dispatchEvent(new CustomEvent("bitaya:visual-v2-ready", { detail: { version: VERSION } }));
    } catch (error) {
      document.documentElement.classList.remove("visual-v2-ready");
      document.documentElement.classList.add("visual-v2-fallback");
      console.error("Новая сцена не загрузилась, включён старый визуальный fallback", error);
    }
  }

  activateVisualV2();
})();