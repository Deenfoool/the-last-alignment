"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BitayaMastDiegeticUiSpec=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const MATERIALS=Object.freeze({hud:"worn-metal",timer:"mechanical-device",intent:"pinned-plate",log:"paper-strip",button:"mechanical-key",modal:"framed-cabinet",tooltip:"dark-card-label"});
  const REQUIRED=Object.freeze([".hud-actor",".round-panel",".timer-box",".intent-card",".battle-log",".end-turn",".physical-card-tooltip"]);
  const RULES=Object.freeze({singleAmberLight:true,noCleanWhitePanels:true,noGlassmorphism:true,noFlatSaasButtons:true,mobilePreservesHierarchy:true,battleStateUnaffected:true});
  return Object.freeze({version:1,materials:MATERIALS,requiredSelectors:REQUIRED,rules:RULES});
});