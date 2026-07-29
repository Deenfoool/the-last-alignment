"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastTimerSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SETTINGS_VERSION = 1;
  const MIN_SECONDS = 10;
  const MAX_SECONDS = 180;

  const MODES = Object.freeze({
    CLASSIC: "classic",
    RELAXED: "relaxed",
    HARDCORE: "hardcore",
    CUSTOM: "custom",
  });

  const PENALTIES = Object.freeze({
    END_TURN: "end_turn",
    DISCARD_RANDOM: "discard_random",
    DAMAGE: "damage",
    DEALER_ENERGY: "dealer_energy",
  });

  const PRESETS = Object.freeze({
    [MODES.CLASSIC]: Object.freeze({
      id: MODES.CLASSIC,
      title: "Классика",
      subtitle: "Без таймера",
      timerEnabled: false,
      seconds: 0,
      difficulty: "обычный",
    }),
    [MODES.RELAXED]: Object.freeze({
      id: MODES.RELAXED,
      title: "Быстрый",
      subtitle: "60 секунд",
      timerEnabled: true,
      seconds: 60,
      difficulty: "напряжённый",
    }),
    [MODES.HARDCORE]: Object.freeze({
      id: MODES.HARDCORE,
      title: "Хардкор",
      subtitle: "30 секунд",
      timerEnabled: true,
      seconds: 30,
      difficulty: "жестокий",
    }),
    [MODES.CUSTOM]: Object.freeze({
      id: MODES.CUSTOM,
      title: "Свой режим",
      subtitle: "10–180 секунд",
      timerEnabled: true,
      seconds: 45,
      difficulty: "пользовательский",
    }),
  });

  const PENALTY_DETAILS = Object.freeze({
    [PENALTIES.END_TURN]: Object.freeze({
      id: PENALTIES.END_TURN,
      title: "Конец хода",
      short: "Ход сразу переходит дилеру.",
      announcement: "ВРЕМЯ ВЫШЛО",
    }),
    [PENALTIES.DISCARD_RANDOM]: Object.freeze({
      id: PENALTIES.DISCARD_RANDOM,
      title: "Случайный сброс",
      short: "Одна карта из руки уходит в сброс.",
      announcement: "КАРТА СБРОШЕНА",
    }),
    [PENALTIES.DAMAGE]: Object.freeze({
      id: PENALTIES.DAMAGE,
      title: "Штрафной урон",
      short: "Игрок получает 3 урона, затем ход заканчивается.",
      announcement: "ШТРАФ: 3 УРОНА",
      amount: 3,
    }),
    [PENALTIES.DEALER_ENERGY]: Object.freeze({
      id: PENALTIES.DEALER_ENERGY,
      title: "Бонус дилеру",
      short: "Дилер начинает ход с дополнительной энергией.",
      announcement: "ДИЛЕРУ +1 ЭНЕРГИЯ",
      amount: 1,
    }),
  });

  function integer(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function isMode(value) {
    return Object.values(MODES).includes(value);
  }

  function isPenalty(value) {
    return Object.values(PENALTIES).includes(value);
  }

  function normalize(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const mode = isMode(input.mode) ? input.mode : MODES.CLASSIC;
    const preset = PRESETS[mode];
    const seconds = mode === MODES.CUSTOM
      ? clamp(integer(input.seconds, preset.seconds), MIN_SECONDS, MAX_SECONDS)
      : preset.seconds;
    const penalty = isPenalty(input.penalty) ? input.penalty : PENALTIES.END_TURN;

    return {
      settingsVersion: SETTINGS_VERSION,
      mode,
      timerEnabled: preset.timerEnabled,
      seconds,
      penalty,
    };
  }

  function fromPreset(mode, previous) {
    const current = normalize(previous);
    return normalize({
      mode: isMode(mode) ? mode : MODES.CLASSIC,
      seconds: current.seconds,
      penalty: current.penalty,
    });
  }

  function migrate(raw) {
    if (!raw || typeof raw !== "object") return normalize(null);
    if (raw.settingsVersion === SETTINGS_VERSION) return normalize(raw);

    if (raw.timerEnabled === false) {
      return normalize({ mode: MODES.CLASSIC, penalty: raw.penalty });
    }

    const seconds = clamp(integer(raw.seconds || raw.timerSeconds, 45), MIN_SECONDS, MAX_SECONDS);
    const mode = seconds === 60 ? MODES.RELAXED : seconds === 30 ? MODES.HARDCORE : MODES.CUSTOM;
    return normalize({ mode, seconds, penalty: raw.penalty || PENALTIES.END_TURN });
  }

  function describe(settings) {
    const normalized = normalize(settings);
    const preset = PRESETS[normalized.mode];
    if (!normalized.timerEnabled) return "Классика · без таймера";
    return `${preset.title} · ${normalized.seconds} сек. · ${PENALTY_DETAILS[normalized.penalty].title}`;
  }

  function formatClock(seconds) {
    const safe = Math.max(0, integer(seconds, 0));
    const minutes = Math.floor(safe / 60);
    const remainder = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  return Object.freeze({
    SETTINGS_VERSION,
    MIN_SECONDS,
    MAX_SECONDS,
    MODES,
    PENALTIES,
    PRESETS,
    PENALTY_DETAILS,
    normalize,
    fromPreset,
    migrate,
    describe,
    formatClock,
  });
});
