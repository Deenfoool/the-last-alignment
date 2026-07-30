"use strict";
(function(){
  const root=document.documentElement;
  const scene=document.querySelector("#scene");
  if(!scene)return;
  const dealerHp=document.querySelector("#dealerHp");
  const dealerShield=document.querySelector("#dealerShield");
  const result=document.querySelector("#resultOverlay");
  let lastHp=null,lastShield=null,timer=null;
  function numberFrom(node){const match=String(node&&node.textContent||"").match(/-?\d+/);return match?Number(match[0]):0;}
  function pulse(name,duration){clearTimeout(timer);root.classList.remove("visual-dealer-hit","visual-dealer-shield","visual-dealer-win","visual-dealer-lose");void scene.offsetWidth;root.classList.add(name);timer=setTimeout(()=>root.classList.remove(name),duration||420);}
  function inspectStats(){
    const hp=numberFrom(dealerHp),shield=numberFrom(dealerShield);
    if(lastHp!==null&&hp<lastHp)pulse("visual-dealer-hit",420);
    else if(lastShield!==null&&shield>lastShield)pulse("visual-dealer-shield",500);
    lastHp=hp;lastShield=shield;
  }
  function inspectResult(){
    if(!result||result.hidden)return;
    const title=String(document.querySelector("#resultTitle")?.textContent||"").toLowerCase();
    root.classList.remove("visual-dealer-win","visual-dealer-lose");
    root.classList.add(title.includes("побед")?"visual-dealer-lose":"visual-dealer-win");
  }
  const observer=new MutationObserver(()=>{inspectStats();inspectResult();});
  [dealerHp,dealerShield,result].filter(Boolean).forEach(node=>observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["hidden"]}));
  const params=new URLSearchParams(location.search);
  if(params.get("visualDebug")==="1")root.classList.add("visual-debug");
  window.addEventListener("keydown",event=>{if(event.ctrlKey&&event.shiftKey&&event.code==="KeyV"){root.classList.toggle("visual-debug");}});
  inspectStats();
})();