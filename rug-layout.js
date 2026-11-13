// Offline measured painted extents; no runtime image scans or geometry additions.
(function(root){
const spans={"water":267.14,"ember":283.74,"spin":280.42,"zap":235.33,"mist":280.75,"insect":257.27,"love":269.33,"serpent":260.67,"sound":252.67,"stone":211.82,"hinokami":287.0};
function baseWidth(width,height){return 1080;}
function effectScale(kind,rugWidth,percent=100){
 const length=Math.min(Math.max(1,rugWidth/.432)*.48,520);
 return .8*length/(spans[kind]??260)*Math.max(.25,Math.min(1.5,percent/100));
}
const api={baseWidth,effectScale,spans};root.rugLayout=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
