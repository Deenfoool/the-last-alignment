"use strict";
(function () {
  const VERSION = "1.0.0-rc1";
  const Achievements = window.BitayaMastAchievements;
  const Audio = window.BitayaMastAudio;
  const Run = window.BitayaMastActRun;
  const Profile = window.BitayaMastRunProfile;
  if (!Achievements || !Audio || !Run || !Profile) throw new Error("Не загружены модули релизного интерфейса.");
  const SETTINGS_KEY = "bitaya-mast-release-settings-v1";
  const TUTORIAL_KEY = "bitaya-mast-release-tutorial-v1";
  const storage = (() => { try { return window.localStorage; } catch (error) { return null; } })();
  const mediaReduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const defaults = { reducedMotion: mediaReduced, highContrast: false, screenShake: true, particles: true };
  let settings = loadSettings();
  let achievements = Achievements.load(storage);
  let lastResult = null;
  let evaluationTimer = 0;
  let tutorialStep = 0;
  let tutorialOpen = false;
  const tutorial = [
    { target: "#runButton", title: "МАРШРУТ", text: "Открой карту акта. Выбирай следующий узел: дуэль, событие, торговец, отдых или тайник." },
    { target: "#playerHud", title: "ТВОЁ СОСТОЯНИЕ", text: "Здоровье переносится между боями. Щит принимает урон первым, энергия тратится на карты." },
    { target: "#hand", title: "КАРТЫ", text: "Стоимость находится слева сверху. Разыгрывай любое число карт, пока хватает энергии." },
    { target: "#intentCard", title: "НАМЕРЕНИЕ", text: "Дилер показывает направление следующего хода, но не раскрывает точную карту." },
    { target: "#endTurnButton", title: "КОНЕЦ ХОДА", text: "Когда энергия закончилась или нужные карты сыграны, передай ход дилеру. Клавиша: Пробел." }
  ];
  function readJson(key) { try { const raw = storage && storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (error) { return null; } }
  function writeJson(key, value) { try { if (storage) storage.setItem(key, JSON.stringify(value)); } catch (error) {} }
  function loadSettings() { return Object.assign({}, defaults, readJson(SETTINGS_KEY) || {}); }
  function saveSettings(next) { settings = Object.assign({}, defaults, next || {}); writeJson(SETTINGS_KEY, settings); applySettings(); return settings; }
  function currentRun() { const raw = readJson(Run.STORAGE_KEY); if (!raw) return null; try { return Run.migrate(raw); } catch (error) { return null; } }
  function currentProfile() { try { return Profile.load(storage); } catch (error) { return Profile.create(); } }
  function applySettings() {
    document.documentElement.classList.toggle("release-reduced-motion", settings.reducedMotion);
    document.documentElement.classList.toggle("release-high-contrast", settings.highContrast);
    document.documentElement.classList.toggle("release-no-shake", !settings.screenShake);
    document.documentElement.classList.toggle("release-no-particles", !settings.particles);
  }
  function buildShell() {
    const nav = document.querySelector(".top-actions");
    if (nav && !document.querySelector("#releaseButton")) { const button = document.createElement("button"); button.id = "releaseButton"; button.className = "icon-button release-button"; button.type = "button"; button.title = "Достижения, статистика и звук"; button.textContent = "★"; nav.insertBefore(button, nav.firstChild); }
    if (!document.querySelector("#releaseOverlay")) { const overlay = document.createElement("div"); overlay.id = "releaseOverlay"; overlay.className = "release-overlay"; overlay.hidden = true; document.body.append(overlay); }
    if (!document.querySelector("#tutorialOverlay")) { const overlay = document.createElement("div"); overlay.id = "tutorialOverlay"; overlay.className = "tutorial-overlay"; overlay.hidden = true; overlay.innerHTML = '<div class="tutorial-focus"></div><section class="tutorial-card"><span class="tutorial-counter"></span><h2></h2><p></p><footer><button data-tutorial-skip type="button">ПРОПУСТИТЬ</button><button data-tutorial-next type="button">ДАЛЬШЕ</button></footer></section>'; document.body.append(overlay); }
    if (!document.querySelector("#achievementToast")) { const toast = document.createElement("div"); toast.id = "achievementToast"; toast.className = "achievement-toast"; document.body.append(toast); }
    if (!document.querySelector("#releaseBadge")) { const badge = document.createElement("span"); badge.id = "releaseBadge"; badge.className = "release-badge"; badge.textContent = `RC · ${VERSION}`; document.querySelector(".brand")?.append(badge); }
  }
  function format(value) { return new Intl.NumberFormat("ru-RU").format(Number(value || 0)); }
  function renderPanel(tab) {
    const overlay = document.querySelector("#releaseOverlay"); const profile = currentProfile(); const run = currentRun(); const progress = Achievements.progress(achievements); const audio = Audio.load(storage); const active = tab || "achievements";
    const achievementCards = Achievements.DEFINITIONS.map((item) => { const unlocked = achievements.unlocked[item.id]; return `<article class="release-achievement ${unlocked ? "unlocked" : "locked"}"><i>${item.symbol}</i><div><b>${item.name}</b><p>${item.description}</p><small>${unlocked ? new Date(unlocked.at).toLocaleDateString("ru-RU") : "НЕ ОТКРЫТО"}</small></div></article>`; }).join("");
    const stats = [["Забегов",profile.runs],["Побед",profile.victories],["Поражений",profile.defeats],["Боссов побеждено",profile.bossKills],["Элитных дилеров",profile.elitesDefeated],["Узлов посещено",profile.nodesVisited],["Заработано",`${format(profile.totalGoldEarned)} ₽`],["Карт добавлено",profile.cardsAdded],["Карт удалено",profile.cardsRemoved],["Карт улучшено",profile.cardsUpgraded],["Лучший счёт",profile.bestRun&&profile.bestRun.score||0],["Текущий seed",run&&run.seed||"—"]].map(([name,value])=>`<div><small>${name}</small><b>${value}</b></div>`).join("");
    overlay.innerHTML = `<section class="release-panel" role="dialog" aria-modal="true" aria-labelledby="releaseTitle"><header><div><span>★</span><div><h2 id="releaseTitle">БИТАЯ МАСТЬ</h2><p>Релиз-кандидат первого акта · ${VERSION}</p></div></div><button data-release-close type="button">×</button></header><nav><button data-release-tab="achievements" class="${active==="achievements"?"active":""}">ДОСТИЖЕНИЯ <b>${progress.unlocked}/${progress.total}</b></button><button data-release-tab="stats" class="${active==="stats"?"active":""}">СТАТИСТИКА</button><button data-release-tab="settings" class="${active==="settings"?"active":""}">ЗВУК И ЭКРАН</button><button data-release-tab="about" class="${active==="about"?"active":""}">О ВЕРСИИ</button></nav><main>${active==="achievements"?`<div class="release-progress"><span><i style="width:${progress.percent}%"></i></span><b>${progress.percent}%</b></div><div class="release-achievements">${achievementCards}</div>`:active==="stats"?`<div class="release-stats">${stats}</div>`:active==="settings"?settingsMarkup(audio):aboutMarkup()}</main></section>`;
    bindPanel();
  }
  function settingsMarkup(audio) { return `<div class="release-settings"><label><span>ОБЩАЯ ГРОМКОСТЬ <b>${Math.round(audio.master*100)}%</b></span><input data-audio="master" type="range" min="0" max="1" step="0.05" value="${audio.master}"></label><label><span>ЗВУКИ <b>${Math.round(audio.sfx*100)}%</b></span><input data-audio="sfx" type="range" min="0" max="1" step="0.05" value="${audio.sfx}"></label><label><span>МУЗЫКА <b>${Math.round(audio.musicVolume*100)}%</b></span><input data-audio="musicVolume" type="range" min="0" max="1" step="0.05" value="${audio.musicVolume}"></label><div class="release-switches"><label><input data-audio-toggle="enabled" type="checkbox" ${audio.enabled?"checked":""}><span>ВКЛЮЧИТЬ ЗВУК</span></label><label><input data-audio-toggle="music" type="checkbox" ${audio.music?"checked":""}><span>ФОНОВАЯ МУЗЫКА</span></label><label><input data-visual="reducedMotion" type="checkbox" ${settings.reducedMotion?"checked":""}><span>МЕНЬШЕ АНИМАЦИЙ</span></label><label><input data-visual="screenShake" type="checkbox" ${settings.screenShake?"checked":""}><span>ТРЯСКА ПРИ УДАРЕ</span></label><label><input data-visual="particles" type="checkbox" ${settings.particles?"checked":""}><span>ЧАСТИЦЫ</span></label><label><input data-visual="highContrast" type="checkbox" ${settings.highContrast?"checked":""}><span>ВЫСОКИЙ КОНТРАСТ</span></label></div><button data-tutorial-start class="release-primary" type="button">ПОВТОРИТЬ ОБУЧЕНИЕ</button></div>`; }
  function aboutMarkup() { return `<div class="release-about"><span class="release-skull">☠</span><h3>ПЕРВАЯ ИГРАБЕЛЬНАЯ ВЕРСИЯ</h3><p>Один полный акт, 30 карт, семь дилеров, маршруты, события, торговец, отдых, артефакты, таймеры, офлайн-режим и сохранение прогресса.</p><dl><div><dt>Версия</dt><dd>${VERSION}</dd></div><div><dt>Баланс карт</dt><dd>${window.BitayaMastReleaseCardBalance?.version||"—"}</dd></div><div><dt>Экономика</dt><dd>${window.BitayaMastReleaseRunBalance?.version||"—"}</dd></div><div><dt>Service Worker</dt><dd>v13</dd></div></dl><button data-copy-seed class="release-primary" type="button">СКОПИРОВАТЬ SEED ЗАБЕГА</button></div>`; }
  function bindPanel() {
    document.querySelector("[data-release-close]")?.addEventListener("click",closePanel);
    document.querySelectorAll("[data-release-tab]").forEach((button)=>button.addEventListener("click",()=>renderPanel(button.dataset.releaseTab)));
    document.querySelectorAll("[data-audio]").forEach((input)=>input.addEventListener("input",()=>{const next=Audio.load(storage);next[input.dataset.audio]=Number(input.value);Audio.save(next,storage);input.previousElementSibling.querySelector("b").textContent=`${Math.round(Number(input.value)*100)}%`;}));
    document.querySelectorAll("[data-audio-toggle]").forEach((input)=>input.addEventListener("change",()=>{const next=Audio.load(storage);next[input.dataset.audioToggle]=input.checked;Audio.save(next,storage);}));
    document.querySelectorAll("[data-visual]").forEach((input)=>input.addEventListener("change",()=>saveSettings(Object.assign({},settings,{[input.dataset.visual]:input.checked}))));
    document.querySelector("[data-tutorial-start]")?.addEventListener("click",()=>{closePanel();startTutorial(true);});
    document.querySelector("[data-copy-seed]")?.addEventListener("click",async()=>{const run=currentRun();const value=run?String(run.seed):"Нет активного забега";try{await navigator.clipboard.writeText(value);showToast("SEED СКОПИРОВАН","♠");}catch(error){prompt("SEED забега",value);}});
  }
  function openPanel(tab){evaluate();renderPanel(tab);document.querySelector("#releaseOverlay").hidden=false;document.querySelector("#app").inert=true;Audio.play("click");}
  function closePanel(){const overlay=document.querySelector("#releaseOverlay");if(overlay)overlay.hidden=true;const app=document.querySelector("#app");if(app)app.inert=false;}
  function evaluate(){const result=Achievements.evaluate(achievements,{profile:currentProfile(),run:currentRun()});achievements=Achievements.save(result.state,storage);result.unlockedNow.forEach((id,index)=>setTimeout(()=>{const item=Achievements.definition(id);showToast(item.name,item.symbol);Audio.play("achievement");particles();},index*900));}
  function scheduleEvaluate(){clearTimeout(evaluationTimer);evaluationTimer=setTimeout(evaluate,250);}
  function showToast(text,symbol){const toast=document.querySelector("#achievementToast");toast.innerHTML=`<i>${symbol||"★"}</i><div><small>ДОСТИЖЕНИЕ</small><b>${text}</b></div>`;toast.classList.remove("show");void toast.offsetWidth;toast.classList.add("show");}
  function particles(){if(!settings.particles)return;const layer=document.createElement("div");layer.className="release-particles";for(let i=0;i<18;i+=1){const bit=document.createElement("i");bit.style.setProperty("--x",`${Math.random()*100}vw`);bit.style.setProperty("--delay",`${Math.random()*.5}s`);bit.style.setProperty("--spin",`${Math.random()*360}deg`);layer.append(bit);}document.body.append(layer);setTimeout(()=>layer.remove(),2200);}
  function startTutorial(force){if(!force&&readJson(TUTORIAL_KEY)?.complete)return;tutorialOpen=true;tutorialStep=0;document.querySelector("#tutorialOverlay").hidden=false;renderTutorial();}
  function renderTutorial(){const overlay=document.querySelector("#tutorialOverlay");const step=tutorial[tutorialStep];const card=overlay.querySelector(".tutorial-card");const focus=overlay.querySelector(".tutorial-focus");const target=document.querySelector(step.target);overlay.querySelector(".tutorial-counter").textContent=`${tutorialStep+1} / ${tutorial.length}`;overlay.querySelector("h2").textContent=step.title;overlay.querySelector("p").textContent=step.text;overlay.querySelector("[data-tutorial-next]").textContent=tutorialStep===tutorial.length-1?"НАЧАТЬ ИГРАТЬ":"ДАЛЬШЕ";if(target){const rect=target.getBoundingClientRect();focus.style.cssText=`left:${Math.max(5,rect.left-8)}px;top:${Math.max(5,rect.top-8)}px;width:${Math.min(innerWidth-10,rect.width+16)}px;height:${Math.min(innerHeight-10,rect.height+16)}px`;const below=rect.bottom+18+card.offsetHeight<innerHeight;card.style.left=`${Math.max(12,Math.min(innerWidth-card.offsetWidth-12,rect.left+rect.width/2-card.offsetWidth/2))}px`;card.style.top=below?`${rect.bottom+18}px`:`${Math.max(12,rect.top-card.offsetHeight-18)}px`;}}
  function closeTutorial(complete){tutorialOpen=false;document.querySelector("#tutorialOverlay").hidden=true;if(complete)writeJson(TUTORIAL_KEY,{complete:true,version:VERSION,at:Date.now()});}
  function bindGlobal(){
    document.querySelector("#releaseButton")?.addEventListener("click",()=>openPanel("achievements"));
    document.querySelector("[data-tutorial-next]")?.addEventListener("click",()=>{if(tutorialStep>=tutorial.length-1)closeTutorial(true);else{tutorialStep+=1;renderTutorial();}Audio.play("click");});
    document.querySelector("[data-tutorial-skip]")?.addEventListener("click",()=>closeTutorial(true));
    document.addEventListener("click",(event)=>{const target=event.target.closest("button,a,.game-card");if(!target)return;if(target.classList.contains("game-card"))Audio.play("card");else if(!target.closest("#releaseOverlay")&&!target.closest("#tutorialOverlay"))Audio.play("click");scheduleEvaluate();},true);
    document.addEventListener("keydown",(event)=>{if(event.key==="F1"){event.preventDefault();startTutorial(true);}if(event.key.toLowerCase()==="a"&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.matches("input,textarea,select"))openPanel("achievements");if(event.key.toLowerCase()==="m"&&!event.target.matches("input,textarea,select")){const next=Audio.load(storage);next.enabled=!next.enabled;Audio.save(next,storage);showToast(next.enabled?"ЗВУК ВКЛЮЧЁН":"ЗВУК ВЫКЛЮЧЕН","♪");}});
    window.addEventListener("storage",scheduleEvaluate);window.addEventListener("bitaya:app-ready",scheduleEvaluate);window.addEventListener("resize",()=>{if(tutorialOpen)renderTutorial();});
    document.addEventListener("pointerdown",()=>{Audio.unlock();Audio.startMusic();},{once:true});
    const observer=new MutationObserver(()=>{const result=document.querySelector("#resultOverlay");const signature=result&&!result.hidden?document.querySelector("#resultTitle")?.textContent:null;if(signature&&signature!==lastResult){lastResult=signature;if(/ПОБЕД|ВЫИГР|ДОМ ПРОИГРАЛ/i.test(signature)){Audio.play("victory");particles();}else Audio.play("defeat");scheduleEvaluate();}});observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:["hidden","class"],childList:true});
  }
  applySettings();buildShell();bindGlobal();Audio.apply(Audio.load(storage));scheduleEvaluate();
  const idle=window.requestIdleCallback||((callback)=>setTimeout(callback,400));idle(()=>{document.documentElement.classList.add("release-ready");startTutorial(false);});
  window.BitayaMastRelease=Object.freeze({version:VERSION,open:openPanel,tutorial:()=>startTutorial(true),evaluate});
})();