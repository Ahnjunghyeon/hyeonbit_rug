// Shared desktop/web control and cylindrical breathing selector.
(function(root){
function create(options){
const {canvas,actions,skills}=options;
let wheelRemainder=0,lastWheelAt=-Infinity,lastWheelInputAt=-Infinity,wheelDirection=0,wheelMode='',skillToastTimer,skillToastHideTimer,sizeToastTimer;
let skillReelRows=null,skillReelStatus=null;
function reelFrame(offset){
  const angle=offset*Math.PI/7;
  return {
    transform:`translate(-50%,-50%) translate3d(0,${Math.sin(angle)*77}px,${(Math.cos(angle)-1)*135}px) rotateX(${-offset*25.7}deg) scale(${Math.max(.72,1-Math.abs(offset)*.085)})`,
    opacity:String(Math.abs(offset)>2.5?0:Math.max(0,1-Math.abs(offset)*.34)),
    filter:`blur(${Math.abs(offset)*.65}px)`,
    color:offset===0?'#fff1ce':'#a9b4c3'
  };
}
function showSkillToast(direction=0){
  const toast=options.toast;
  if(!skillReelRows){
    const reel=document.createElement('div');reel.className='skill-reel';reel.setAttribute('aria-hidden','true');
    skillReelRows=Array.from({length:7},()=>{
      const row=document.createElement('span');row.className='skill-reel-row';reel.append(row);return row;
    });
    skillReelStatus=document.createElement('span');skillReelStatus.className='skill-reel-status';
    toast.replaceChildren(reel,skillReelStatus);
  }
  clearTimeout(skillToastTimer);clearTimeout(skillToastHideTimer);
  const wasHidden=toast.hidden;toast.hidden=false;toast.classList.remove('leaving');
  const selected=actions.indexOf(options.getAction());
  const previousFrames=new Map();
  if(!wasHidden)skillReelRows.forEach(row=>{
    const frame=window.getComputedStyle(row);
    previousFrames.set(row.dataset.skill,{transform:frame.transform,opacity:frame.opacity,filter:frame.filter,color:frame.color});
  });
  skillReelRows.forEach((row,index)=>{
    const offset=index-3;
    row.getAnimations().forEach(animation=>animation.cancel());
    const id=actions[(selected+offset+actions.length)%actions.length];
    row.dataset.skill=id;row.textContent=skills[id];
    const target=reelFrame(offset);Object.assign(row.style,target);
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      row.animate([previousFrames.get(id)??reelFrame(offset+(wasHidden?0:direction)),target],{duration:240,easing:'cubic-bezier(.18,.8,.25,1)'});
  });
  skillReelStatus.textContent=skills[options.getAction()];
  skillToastTimer=setTimeout(()=>{
    toast.classList.add('leaving');
    skillToastHideTimer=setTimeout(()=>{toast.hidden=true;},200);
  },1450);
}
function onWheel(event){
  if(!(event.ctrlKey||options.isArmed())||event.altKey||event.metaKey)return;
  const delta=event.deltaY||(event.shiftKey?event.deltaX:0);
  if(!Number.isFinite(delta)||!delta)return;
  event.preventDefault();
  if(!options.canSwitch())return;
  const now=performance.now(),direction=Math.sign(delta),mode=event.shiftKey?'skill':'size';
  if(mode!==wheelMode){wheelMode=mode;wheelRemainder=0;lastWheelAt=-Infinity;}
  if(direction!==wheelDirection||now-lastWheelInputAt>350)wheelRemainder=0;
  lastWheelInputAt=now;
  wheelDirection=direction;
  wheelRemainder+=delta*(event.deltaMode===1?16:event.deltaMode===2?80:1);
  if(Math.abs(wheelRemainder)<60||now-lastWheelAt<(mode==='skill'?140:60))return;
  wheelRemainder=0;lastWheelAt=now;
  if(mode==='size'){
    const size=options.resizeBy?.(direction<0?5:-5);
    if(Number.isFinite(size)&&options.sizeToast){
      clearTimeout(sizeToastTimer);options.toast.hidden=true;
      options.sizeToast.textContent='러그 크기 '+size+'%';options.sizeToast.hidden=false;
      sizeToastTimer=setTimeout(()=>{options.sizeToast.hidden=true;},1100);
    }
    return;
  }
  if(options.sizeToast)options.sizeToast.hidden=true;
  clearTimeout(sizeToastTimer);
  const next=actions[(actions.indexOf(options.getAction())+direction+actions.length)%actions.length];
  options.selectAction(next);showSkillToast(direction);options.syncAction(next);
}
canvas.addEventListener('wheel',onWheel,{passive:false});
return {dispose(){canvas.removeEventListener('wheel',onWheel);clearTimeout(skillToastTimer);clearTimeout(skillToastHideTimer);clearTimeout(sizeToastTimer);}};

}
const api={create};root.rugBreathingUI=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
