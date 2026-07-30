"use strict";
(function(){
  const M=window.BitayaMastSceneAssets;
  if(!M)return;
  function makeLayer(entry){
    const node=document.createElement("div");
    node.className=`scene-asset-layer scene-asset-layer--${entry.id}`;
    node.dataset.assetLayer=entry.id;
    node.style.setProperty("--asset-z",String(entry.z));
    node.style.backgroundImage=`url("${entry.src}")`;
    if(entry.blend)node.style.mixBlendMode=entry.blend;
    return node;
  }
  function setAnchors(root){
    const mobile=window.matchMedia&&window.matchMedia("(max-width: 760px)").matches;
    const map=mobile?Object.assign({},M.ANCHORS,M.MOBILE):M.ANCHORS;
    Object.entries(map).forEach(([id,a])=>{
      root.style.setProperty(`--anchor-${id}-x`,`${a.x*100}%`);
      root.style.setProperty(`--anchor-${id}-y`,`${a.y*100}%`);
      root.style.setProperty(`--anchor-${id}-w`,`${a.w*100}%`);
      root.style.setProperty(`--anchor-${id}-h`,`${a.h*100}%`);
    });
  }
  function activeDealerId(){
    const selected=document.querySelector("[data-dealer-id].selected,[data-dealer-id][aria-checked='true'],[data-dealer-id].active");
    try{return selected&&selected.dataset.dealerId||localStorage.getItem("bitaya-mast-stage6-dealer-v1")||"shuler";}
    catch(error){return selected&&selected.dataset.dealerId||"shuler";}
  }
  function applyDealer(root){
    const node=root.querySelector("[data-asset-layer='dealer']");
    if(!node)return;
    const id=activeDealerId();
    const view=M.dealerViewBox(id);
    node.style.setProperty("--dealer-index",String(view.index));
    node.style.setProperty("--dealer-columns",String(view.columns));
    node.dataset.dealerId=id;
    root.dataset.visualDealer=id;
  }
  function assemble(){
    const scene=document.querySelector("#scene");
    if(!scene)return;
    if(scene.dataset.assetAssembly!=="ready"){
      scene.dataset.assetAssembly="ready";
      scene.classList.add("scene-asset-root");
      const stack=document.createElement("div");
      stack.className="scene-asset-stack";
      M.LAYERS.forEach(entry=>stack.append(makeLayer(entry)));
      scene.prepend(stack);
    }
    setAnchors(scene);
    applyDealer(scene);
    window.addEventListener("resize",()=>setAnchors(scene));
    document.addEventListener("change",event=>{if(event.target&&event.target.closest&&event.target.closest("[data-dealer-id]"))requestAnimationFrame(()=>applyDealer(scene));});
    document.addEventListener("click",event=>{if(event.target&&event.target.closest&&event.target.closest("[data-dealer-id]"))setTimeout(()=>applyDealer(scene),0);});
    window.addEventListener("storage",event=>{if(event.key==="bitaya-mast-stage6-dealer-v1")applyDealer(scene);});
    window.addEventListener("bitaya:dealer-changed",()=>applyDealer(scene));
    const observer=new MutationObserver(()=>applyDealer(scene));
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:["class","aria-checked"]});
  }
  window.addEventListener("bitaya:app-ready",assemble);
  window.addEventListener("bitaya:visual-v2-ready",assemble);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",assemble);else assemble();
})();