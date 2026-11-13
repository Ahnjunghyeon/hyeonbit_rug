function selectDisplay(displays, primary, id) {
  return id === 'primary' ? primary : displays.find(d => String(d.id) === id) || primary;
}
function displayChoices(displays, primary) {
  return displays.slice().sort((a,b)=>a.bounds.x-b.bounds.x||a.bounds.y-b.bounds.y).map((d,i)=>({
    id:String(d.id), label:`화면 ${i+1} · ${d.label || '디스플레이'}${d.id===primary.id?' (주 모니터)':''} · ${d.size.width}×${d.size.height} · ${Math.round(d.scaleFactor*100)}%`,
    primary:d.id===primary.id
  }));
}
module.exports={selectDisplay,displayChoices};
