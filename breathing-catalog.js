// Shared runtime/settings artwork catalog and per-window decode cache.
(function(root){
'use strict';
const base={"w":320,"h":160,"pivot":[160,80],"sx":1,"sy":1,"life":620,"count":32,"atlasScale":1.5,"painted":true};
const overrides={"water":{"axisAngle":0.2617993877991494},"ember":{"axisAngle":0.24434609527920614},"spin":{"life":600,"axisAngle":0.40142572795869574},"zap":{"life":600,"blend":"screen"},"mist":{"life":560,"axisAngle":0.47123889803846897},"insect":{"life":480},"love":{"life":650,"blend":"screen"},"serpent":{"life":630,"blend":"screen"},"sound":{"life":630,"blend":"screen"},"stone":{"life":790},"hinokami":{"life":720,"axisAngle":-0.2792526803190927}};
const specs=Object.fromEntries(Object.entries(overrides).map(([k,v])=>[k,Object.freeze({...base,...v})]));
const tuning={"stone":{"spacing":82,"limit":2,"minPlayback":310,"retire":100},"water":{"spacing":112,"limit":3},"mist":{"spacing":72,"limit":3},"insect":{"spacing":55,"limit":3},"love":{"spacing":130,"limit":2},"serpent":{"spacing":170,"limit":2},"sound":{"spacing":85,"limit":3},"spin":{"spacing":80,"limit":3},"hinokami":{"spacing":110,"limit":3},"ember":{"spacing":100,"limit":3},"zap":{"spacing":95,"limit":2}};
const files={serpent:'serpent-v3.webp',sound:'sound-v3.webp',insect:'insect-v4.webp'};
function assetPath(kind){if(!specs[kind])throw Error('Unknown breathing effect');return 'assets/'+(files[kind]??kind+'.webp');}
function createAtlasStore(ImageType,embedded={}){
 const images=new Map(),decoding=new Map();
 function get(kind){if(!images.has(kind)){const image=new ImageType();image.src=embedded?.[kind]??assetPath(kind);images.set(kind,image);}return images.get(kind);}
 function ready(kind){if(!decoding.has(kind))decoding.set(kind,get(kind).decode().catch(error=>{decoding.delete(kind);throw error;}));return decoding.get(kind);}
 return {get,ready};
}
const api={specs,tuning,assetPath,createAtlasStore};root.rugCatalog=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
