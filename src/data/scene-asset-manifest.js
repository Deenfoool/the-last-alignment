"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BitayaMastSceneAssets=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const VERSION=1;
  const BASE="assets/scene/v2/";
  const ANCHORS=Object.freeze({
    dealer:{x:.5,y:.51,w:.34,h:.62},table:{x:.5,y:.79,w:.74,h:.31},hand:{x:.5,y:.93,w:.66,h:.27},
    hud:{x:.115,y:.35,w:.19,h:.63},timer:{x:.125,y:.79,w:.18,h:.25},intent:{x:.865,y:.31,w:.19,h:.22},log:{x:.87,y:.68,w:.18,h:.28},
    draw:{x:.39,y:.72,w:.09,h:.14},discard:{x:.61,y:.72,w:.09,h:.14}
  });
  const MOBILE=Object.freeze({dealer:{x:.5,y:.38,w:.64,h:.46},hand:{x:.5,y:.88,w:.94,h:.27},hud:{x:.18,y:.19,w:.32,h:.25},timer:{x:.82,y:.19,w:.28,h:.2}});
  const LAYERS=Object.freeze([
    {id:"background",src:BASE+"background.svg",z:0,required:true},
    {id:"ambient",src:BASE+"ambient.svg",z:10,required:false,blend:"screen"},
    {id:"dealer",src:"assets/dealers/v2/dealer-atlas.svg",z:20,required:true,dynamic:true},
    {id:"table",src:BASE+"table.svg",z:30,required:true},
    {id:"dust",src:BASE+"dust.svg",z:40,required:false,blend:"screen"},
    {id:"vignette",src:BASE+"vignette.svg",z:50,required:true}
  ]);
  const CARD_SHEET="assets/cards/v2/starter-sheet.svg";
  function dealerViewBox(id){const order={shuler:0,collector:1,sysadmin:2,projectionist:3,archivist:4,mascot:5,house_master:6};return {index:order[id]??0,columns:7};}
  function validate(){const ids=new Set();LAYERS.forEach(l=>{if(ids.has(l.id))throw new Error("Duplicate layer: "+l.id);ids.add(l.id);if(!l.src)throw new Error("Missing src: "+l.id);});return true;}
  return Object.freeze({VERSION,BASE,LAYERS,ANCHORS,MOBILE,CARD_SHEET,dealerViewBox,validate});
});