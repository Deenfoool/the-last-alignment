"use strict";
(function () {
  var VERSION = "4";
  var mutationSerial = 0;
  var memoryData = Object.create(null);
  var memoryKeys = [];

  function safeString(value) {
    try { return String(value); } catch (error) { return ""; }
  }

  function makeMemoryStorage() {
    return {
      get length() { return memoryKeys.length; },
      key: function (index) { return memoryKeys[index] || null; },
      getItem: function (key) {
        key = safeString(key);
        return Object.prototype.hasOwnProperty.call(memoryData, key) ? memoryData[key] : null;
      },
      setItem: function (key, value) {
        key = safeString(key);
        if (!Object.prototype.hasOwnProperty.call(memoryData, key)) memoryKeys.push(key);
        memoryData[key] = safeString(value);
      },
      removeItem: function (key) {
        key = safeString(key);
        if (!Object.prototype.hasOwnProperty.call(memoryData, key)) return;
        delete memoryData[key];
        memoryKeys = memoryKeys.filter(function (item) { return item !== key; });
      },
      clear: function () {
        memoryData = Object.create(null);
        memoryKeys = [];
      }
    };
  }

  function installStorageSafety() {
    var fallback = makeMemoryStorage();
    var storage = null;
    var storageWorks = false;
    var testKey = "__tla_storage_test__";

    try {
      storage = window.localStorage;
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      storageWorks = true;
    } catch (error) {
      storageWorks = false;
    }

    if (!storageWorks) {
      try {
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          enumerable: true,
          value: fallback
        });
        storage = fallback;
      } catch (error) {
        window.__TLA_MEMORY_STORAGE__ = fallback;
      }
    }

    if (storage && window.Storage && window.Storage.prototype) {
      var proto = window.Storage.prototype;
      var nativeGet = proto.getItem;
      var nativeSet = proto.setItem;
      var nativeRemove = proto.removeItem;
      var nativeClear = proto.clear;

      if (!proto.__tlaSafeStorage) {
        try {
          proto.getItem = function (key) {
            try { return nativeGet.call(this, key); }
            catch (error) { return fallback.getItem(key); }
          };
          proto.setItem = function (key, value) {
            try { return nativeSet.call(this, key, value); }
            catch (error) { return fallback.setItem(key, value); }
          };
          proto.removeItem = function (key) {
            try { return nativeRemove.call(this, key); }
            catch (error) { return fallback.removeItem(key); }
          };
          proto.clear = function () {
            try { return nativeClear.call(this); }
            catch (error) { return fallback.clear(); }
          };
          Object.defineProperty(proto, "__tlaSafeStorage", { value: true });
        } catch (error) {
          /* Some WebViews expose a non-writable Storage prototype. */
        }
      }
    }

    window.__TLA_STORAGE_MODE__ = storageWorks ? "persistent" : "memory";
  }

  function installPolyfills() {
    if (!Object.hasOwn) {
      Object.hasOwn = function (object, property) {
        return Object.prototype.hasOwnProperty.call(Object(object), property);
      };
    }

    if (!String.prototype.replaceAll) {
      String.prototype.replaceAll = function (search, replacement) {
        return this.split(search).join(replacement);
      };
    }

    if (!Array.prototype.at) {
      Array.prototype.at = function (index) {
        index = Math.trunc(index) || 0;
        if (index < 0) index += this.length;
        return this[index];
      };
    }

    if (!Array.prototype.findLast) {
      Array.prototype.findLast = function (callback, thisArg) {
        for (var index = this.length - 1; index >= 0; index -= 1) {
          if (callback.call(thisArg, this[index], index, this)) return this[index];
        }
      };
    }

    if (!Array.prototype.findLastIndex) {
      Array.prototype.findLastIndex = function (callback, thisArg) {
        for (var index = this.length - 1; index >= 0; index -= 1) {
          if (callback.call(thisArg, this[index], index, this)) return index;
        }
        return -1;
      };
    }

    if (!Array.prototype.toSorted) {
      Array.prototype.toSorted = function (compareFunction) {
        return Array.prototype.slice.call(this).sort(compareFunction);
      };
    }

    if (!Array.prototype.toReversed) {
      Array.prototype.toReversed = function () {
        return Array.prototype.slice.call(this).reverse();
      };
    }

    if (!Array.prototype.toSpliced) {
      Array.prototype.toSpliced = function () {
        var copy = Array.prototype.slice.call(this);
        Array.prototype.splice.apply(copy, arguments);
        return copy;
      };
    }

    if (!Array.prototype.with) {
      Array.prototype.with = function (index, value) {
        var copy = Array.prototype.slice.call(this);
        index = Math.trunc(index) || 0;
        if (index < 0) index += copy.length;
        copy[index] = value;
        return copy;
      };
    }

    if (!window.structuredClone) {
      window.structuredClone = function (value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
      };
    }

    if (!window.requestIdleCallback) {
      window.requestIdleCallback = function (callback) {
        return window.setTimeout(function () {
          callback({ didTimeout: false, timeRemaining: function () { return 0; } });
        }, 1);
      };
      window.cancelIdleCallback = window.clearTimeout;
    }

    if (window.crypto && !window.crypto.randomUUID) {
      window.crypto.randomUUID = function () {
        var bytes = new Uint8Array(16);
        if (window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
        else for (var index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        var hex = Array.prototype.map.call(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
        return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
      };
    }
  }

  function diagnosticText(error, context) {
    var message = error && (error.stack || error.message || error.reason) ? (error.stack || error.message || error.reason) : safeString(error);
    return [
      context || "Ошибка игры",
      message || "Неизвестная ошибка",
      "",
      "Браузер: " + navigator.userAgent,
      "Хранилище: " + (window.__TLA_STORAGE_MODE__ || "неизвестно"),
      "Версия совместимости: " + VERSION
    ].join("\n");
  }

  function clearGameStorage() {
    var patterns = ["last", "alignment", "расклад", "rogue", "run", "save", "progress", "essence", "deck"];
    var removed = 0;
    try {
      var storage = window.localStorage;
      var keys = [];
      for (var index = 0; index < storage.length; index += 1) keys.push(storage.key(index));
      keys.forEach(function (key) {
        var normalized = safeString(key).toLowerCase();
        if (patterns.some(function (pattern) { return normalized.indexOf(pattern) !== -1; })) {
          storage.removeItem(key);
          removed += 1;
        }
      });
    } catch (error) {
      try { window.localStorage.clear(); removed += 1; } catch (ignored) { /* no-op */ }
    }
    return removed;
  }

  function showDiagnostic(error, context, allowReset) {
    var existing = document.getElementById("tla-diagnostic");
    if (existing) existing.remove();

    var panel = document.createElement("section");
    panel.id = "tla-diagnostic";
    panel.setAttribute("role", "alert");
    panel.style.cssText = "position:fixed;z-index:2147483647;left:16px;right:16px;bottom:16px;max-width:760px;margin:auto;padding:18px;border:1px solid #c87878;border-radius:16px;background:#17131ef5;color:#f5e9dc;box-shadow:0 20px 70px #000b;font:14px/1.45 system-ui,sans-serif";

    var title = document.createElement("strong");
    title.textContent = allowReset ? "Забег не запустился" : "Обнаружена ошибка игры";
    title.style.cssText = "display:block;margin-bottom:8px;font-size:17px;color:#ffb1a8";

    var text = document.createElement("pre");
    text.textContent = diagnosticText(error, context);
    text.style.cssText = "max-height:170px;overflow:auto;margin:0 0 12px;padding:10px;border-radius:10px;background:#0c0a10;color:#d8ced7;white-space:pre-wrap;word-break:break-word";

    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";

    function makeButton(label, handler, primary) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText = "cursor:pointer;padding:9px 13px;border-radius:10px;border:1px solid #8f7859;background:" + (primary ? "#e6b866" : "#2b2432") + ";color:" + (primary ? "#17110b" : "#f5e9dc") + ";font-weight:700";
      button.addEventListener("click", handler);
      return button;
    }

    actions.appendChild(makeButton("Скопировать ошибку", function () {
      var value = text.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value);
      else window.prompt("Скопируйте текст ошибки:", value);
    }, false));

    if (allowReset) {
      actions.appendChild(makeButton("Сбросить сохранение и запустить", function () {
        clearGameStorage();
        window.location.reload();
      }, true));
    }

    actions.appendChild(makeButton("Закрыть", function () { panel.remove(); }, false));
    panel.appendChild(title);
    panel.appendChild(text);
    panel.appendChild(actions);
    document.body.appendChild(panel);
  }

  function nearestButton(target) {
    while (target && target !== document.body) {
      if (target.tagName === "BUTTON" || target.getAttribute("role") === "button") return target;
      target = target.parentElement;
    }
    return null;
  }

  function isNewRunButton(button) {
    var text = safeString(button && button.textContent).replace(/\s+/g, " ").trim().toLowerCase();
    return text.indexOf("начать новый забег") !== -1 || text === "новый забег";
  }

  function watchNewRunClicks() {
    document.addEventListener("click", function (event) {
      var button = nearestButton(event.target);
      if (!isNewRunButton(button)) return;

      var serialBefore = mutationSerial;
      window.setTimeout(function () {
        var sameButton = null;
        var buttons = document.querySelectorAll("button, [role='button']");
        for (var index = 0; index < buttons.length; index += 1) {
          if (isNewRunButton(buttons[index]) && buttons[index].getClientRects().length) {
            sameButton = buttons[index];
            break;
          }
        }
        if (sameButton && mutationSerial === serialBefore) {
          showDiagnostic(new Error("Нажатие обработано браузером, но игровой экран не изменился."), "Возможна несовместимость браузера или повреждённое сохранение.", true);
        }
      }, 1300);
    }, true);
  }

  installPolyfills();
  installStorageSafety();

  window.addEventListener("error", function (event) {
    var error = event.error || new Error(event.message || "Ошибка JavaScript");
    showDiagnostic(error, "Необработанная ошибка JavaScript", true);
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason instanceof Error ? event.reason : new Error(safeString(event.reason));
    showDiagnostic(reason, "Необработанная ошибка Promise", true);
  });

  if (window.MutationObserver) {
    var observer = new MutationObserver(function () { mutationSerial += 1; });
    function beginObserve() {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", beginObserve, { once: true });
    else beginObserve();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchNewRunClicks, { once: true });
  else watchNewRunClicks();

  window.__TLA_COMPATIBILITY_VERSION__ = VERSION;
  window.__TLA_RESET_GAME_DATA__ = clearGameStorage;
})();
