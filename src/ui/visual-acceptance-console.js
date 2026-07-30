"use strict";
(function(){
  const query=new URLSearchParams(location.search);
  const enabled=query.get("acceptance")==="1"||query.get("visualDebug")==="1";
  if(!enabled)return;
  const checks=[];
  const add=(name,ok,detail)=>checks.push({name,ok:Boolean(ok),detail:String(detail||"")});
  function swVersion(){return new Promise(resolve=>{if(!navigator.serviceWorker||!navigator.serviceWorker.controller){resolve("нет активного контроллера");return;}const channel=new MessageChannel();const timer=setTimeout(()=>resolve("тайм-аут"),1200);channel.port1.onmessage=e=>{clearTimeout(timer);resolve((e.data&&e.data.version)||"неизвестно");};navigator.serviceWorker.controller.postMessage({type:"GET_VERSION"},[channel.port2]);});}
  async function run(){
    const root=document.documentElement,scene=document.querySelector("#scene"),dealer=scene&&scene.querySelector("[data-asset-layer='dealer']"),hand=document.querySelector("#hand");
    add("visual-v2-ready",root.classList.contains("visual-v2-ready"),root.className);
    add("сцена собрана",scene&&scene.dataset.assetAssembly==="ready",scene&&scene.dataset.assetAssembly);
    add("6 слоёв сцены",scene&&scene.querySelectorAll("[data-asset-layer]").length>=6,scene&&scene.querySelectorAll("[data-asset-layer]").length);
    add("дилер активен",dealer&&dealer.dataset.dealerId,dealer&&dealer.dataset.dealerId);
    add("рука игрока",hand&&hand.children.length>0,hand&&hand.children.length);
    add("tooltip-модуль",Boolean(window.BitayaMastPhysicalCardInteractions||document.querySelector(".physical-card-tooltip")),"hover/tap");
    add("режим касания",matchMedia("(pointer: coarse)").matches,"pointer coarse");
    add("PWA v15+",Number(await swVersion())>=15,await swVersion());
    const passed=checks.filter(x=>x.ok).length;
    const panel=document.createElement("aside");panel.id="visualAcceptanceConsole";panel.innerHTML=`<header><strong>ПРИЁМКА ВИЗУАЛА</strong><button type="button" aria-label="Закрыть">×</button></header><p>${passed}/${checks.length} проверок пройдено</p><ol>${checks.map(x=>`<li data-ok="${x.ok}"><b>${x.ok?"✓":"✕"}</b><span>${x.name}</span><small>${x.detail}</small></li>`).join("")}</ol><footer><button type="button" data-copy>СКОПИРОВАТЬ ОТЧЁТ</button></footer>`;
    document.body.append(panel);
    panel.querySelector("header button").onclick=()=>panel.remove();
    panel.querySelector("[data-copy]").onclick=async()=>{const report={url:location.href,time:new Date().toISOString(),viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},checks};await navigator.clipboard.writeText(JSON.stringify(report,null,2));panel.querySelector("[data-copy]").textContent="СКОПИРОВАНО";};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(run,900));else setTimeout(run,900);
})();
