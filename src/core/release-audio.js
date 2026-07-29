"use strict";
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastAudio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const VERSION = 1;
  const STORAGE_KEY = "bitaya-mast-release-audio-v1";
  const DEFAULTS = Object.freeze({ enabled: true, music: true, master: .65, sfx: .8, musicVolume: .28 });
  let context = null, master = null, musicGain = null, musicNodes = [], unlocked = false;
  function clamp(value, min, max) { const numeric = Number(value); return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : min)); }
  function normalize(raw) { return { enabled: raw && raw.enabled !== false, music: raw && raw.music !== false, master: clamp(raw && raw.master == null ? DEFAULTS.master : raw.master, 0, 1), sfx: clamp(raw && raw.sfx == null ? DEFAULTS.sfx : raw.sfx, 0, 1), musicVolume: clamp(raw && raw.musicVolume == null ? DEFAULTS.musicVolume : raw.musicVolume, 0, 1) }; }
  function load(storage) { try { const raw = storage && storage.getItem(STORAGE_KEY); return normalize(raw ? JSON.parse(raw) : null); } catch (error) { return normalize(); } }
  function ensure() {
    if (!root || !(root.AudioContext || root.webkitAudioContext)) return null;
    if (!context) { context = new (root.AudioContext || root.webkitAudioContext)(); master = context.createGain(); musicGain = context.createGain(); musicGain.connect(master); master.connect(context.destination); }
    return context;
  }
  function setGains(value) { if (!context || !master || !musicGain) return; master.gain.setTargetAtTime(value.enabled ? value.master : 0, context.currentTime, .02); musicGain.gain.setTargetAtTime(value.enabled && value.music ? value.musicVolume : 0, context.currentTime, .05); }
  function apply(settings) { const value = normalize(settings || load(root && root.localStorage)); if (context) setGains(value); if (!value.enabled || !value.music) stopMusic(); else if (unlocked) startMusic(); return value; }
  function save(settings, storage) { const value = normalize(settings); try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (error) {} apply(value); return value; }
  function unlock() { const audio = ensure(); if (!audio) return false; unlocked = true; if (audio.state === "suspended") audio.resume().catch(() => null); setGains(load(root && root.localStorage)); return true; }
  function tone(frequency, duration, type, volume, slide) {
    const settings = load(root && root.localStorage); if (!settings.enabled || (!unlocked && !unlock())) return;
    const now = context.currentTime; const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = type || "square"; oscillator.frequency.setValueAtTime(frequency, now); if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slide), now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * settings.sfx), now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); gain.connect(master); oscillator.start(now); oscillator.stop(now + duration + .02);
  }
  function noise(duration, volume) {
    const settings = load(root && root.localStorage); if (!settings.enabled || (!unlocked && !unlock())) return;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = context.createBufferSource(); const filter = context.createBiquadFilter(); const gain = context.createGain(); filter.type = "lowpass"; filter.frequency.value = 1200; gain.gain.value = volume * settings.sfx; source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(master); source.start();
  }
  function play(name) {
    if (name === "card") { tone(220, .09, "square", .08, 360); tone(440, .06, "square", .04, 520); }
    else if (name === "hit") { noise(.12, .16); tone(90, .16, "sawtooth", .12, 45); }
    else if (name === "shield") tone(420, .18, "triangle", .10, 760);
    else if (name === "heal") { tone(330, .18, "sine", .08, 520); setTimeout(() => tone(520, .18, "sine", .07, 660), 90); }
    else if (name === "coin") { tone(880, .08, "square", .06, 1200); setTimeout(() => tone(1320, .1, "square", .04, 1500), 60); }
    else if (name === "achievement") [440, 660, 880].forEach((frequency, index) => setTimeout(() => tone(frequency, .22, "triangle", .07, frequency * 1.08), index * 100));
    else if (name === "victory") [220, 330, 440, 660].forEach((frequency, index) => setTimeout(() => tone(frequency, .34, "triangle", .09, frequency * 1.03), index * 150));
    else if (name === "defeat") tone(180, .6, "sawtooth", .09, 55);
    else if (name === "click") tone(260, .05, "square", .035, 300);
  }
  function startMusic() {
    const settings = load(root && root.localStorage); if (!settings.enabled || !settings.music || musicNodes.length) return;
    if (!unlocked && !unlock()) return;
    const frequencies = [55, 82.41, 110];
    frequencies.forEach((frequency, index) => { const oscillator = context.createOscillator(); const gain = context.createGain(); const filter = context.createBiquadFilter(); oscillator.type = index === 0 ? "sine" : "triangle"; oscillator.frequency.value = frequency; filter.type = "lowpass"; filter.frequency.value = 240 + index * 90; gain.gain.value = [.16, .045, .025][index]; oscillator.connect(filter); filter.connect(gain); gain.connect(musicGain); oscillator.start(); musicNodes.push(oscillator, gain, filter); });
  }
  function stopMusic() { musicNodes.forEach((node) => { try { if (node.stop) node.stop(); else node.disconnect(); } catch (error) {} }); musicNodes = []; }
  return Object.freeze({ VERSION, STORAGE_KEY, DEFAULTS, normalize, load, save, apply, unlock, play, startMusic, stopMusic });
});