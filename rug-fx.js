// Shared bounded emission, lifecycle and temporal sprite interpolation.
(function(root){
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function expired(fx,now){return now>=Math.min(fx.at+fx.life,fx.retireUntil??Infinity);}
function prune(effects,now){let n=0;for(const fx of effects)if(!expired(fx,now))effects[n++]=fx;effects.length=n;}
function framePosition(fx,now){return clamp((now-fx.at)/fx.life,0,1)*(fx.spec.count-1);}
function opacity(fx,now){
 if(now<fx.at||expired(fx,now))return 0;
 const fadeIn=smooth((now-fx.at)/Math.min(48,fx.life*.1));
 const fadeOut=smooth((fx.at+fx.life-now)/Math.min(160,fx.life*.25));
 const retire=fx.retireUntil===undefined?1:smooth((fx.retireUntil-now)/(fx.retireUntil-fx.retireAt));
 return fadeIn*fadeOut*retire;
}
function admit(effects,kind,limit,life,now,policy={}){
 prune(effects,now);
 // Never evict a visible sprite to make room. Retirement occupies the same pool.
 if(effects.length>=8)return false;
 const active=effects.filter(f=>f.kind===kind&&f.retireUntil===undefined);
 if(active.length<limit)return true;
 if(effects.some(f=>f.kind===kind&&f.retireUntil!==undefined))return false;
 const oldest=active.reduce((a,b)=>a.at<b.at?a:b);
 const minPlayback=policy.minPlayback??Math.min(150,life*.3);
 if(now-oldest.at<minPlayback)return false;
 oldest.retireAt=now;oldest.retireUntil=Math.min(oldest.at+oldest.life,now+(policy.retire??Math.min(90,life*.16)));
 return true;
}
function createEmitter(tuning,emit){
 let kind='water',last=null,heading=null,distance=0,first=true,candidates=[],accepted=null;
 let lastFlush=-Infinity,used=0;
 function start(next){kind=next;last=null;heading=null;distance=0;first=true;candidates.length=0;accepted=null;lastFlush=-Infinity;used=0;}
 function sample(point,time){
  if(!point){last=null;heading=null;distance=0;first=true;return;}
  if(!last){last={x:point.x,y:point.y,time};return;}
  const dx=point.x-last.x,dy=point.y-last.y,d=Math.hypot(dx,dy);
  if(d<.2)return;
  const raw=Math.atan2(dy,dx);
  if(heading===null)heading=raw;
  else{const turn=Math.atan2(Math.sin(raw-heading),Math.cos(raw-heading));
   // Reversals start a new stroke, never rotate a live sprite through 180 degrees.
   if(Math.abs(turn)>1.25){heading=raw;distance=0;first=true;}
   else heading+=turn*(1-Math.exp(-d/24));
  }
  distance+=d;
  const spacing=tuning[kind]?.spacing??120;
  if(distance>=(first?8:spacing)){
   const candidate={x:point.x,y:point.y,time,angle:heading,kind};
   if(candidates.length<12)candidates.push(candidate);else candidates[11]=candidate;
   distance=first?0:distance%spacing;first=false;
  }
  last={x:point.x,y:point.y,time};
 }
 function flush(now){
  if(now-lastFlush>=12){used=0;lastFlush=now;}
  const count=Math.min(3-used,candidates.length);
  if(count<=0){candidates.length=0;return;}
  // A fast segment uses the whole path, instead of filling slots at its start.
  for(let i=0;i<count;i++){
   const index=count===1?candidates.length-1:Math.round(i*(candidates.length-1)/(count-1));
   const c=candidates[index],spacing=tuning[kind]?.spacing??120;
   if(accepted&&now-accepted.flush<60&&Math.hypot(c.x-accepted.x,c.y-accepted.y)<spacing*.8)continue;
   const at=clamp(Math.min(c.time,now-(count-1-i)*24),now-90,now);
   if(emit(c,c.angle,kind,at,now)){accepted={x:c.x,y:c.y,flush:now};used++;}
  }
  candidates.length=0;
 }
 return {start,sample,flush,stop(){candidates.length=0;last=null;}};
}
// Reflect about the stroke axis AFTER correcting the artwork's authored angle.
// R(heading) * reflect * R(axis) == R(heading + flip*axis) * reflect.
function createPose(spec,heading,sequence){
 const variant=sequence%3,flipY=variant===1?-1:1;
 return {angle:heading+flipY*(spec.axisAngle??0),flipY,variant,variationScale:variant===1?.98:variant===2?1.02:1};
}
function worldPoint(fx,x,y){
 const {spec,scale}=fx,dx=(x-spec.pivot[0])*spec.sx*scale;
 const dy=(y-spec.pivot[1])*spec.sy*scale*(fx.flipY??1),c=Math.cos(fx.angle),n=Math.sin(fx.angle);
 return {x:fx.x+dx*c-dy*n,y:fx.y+dx*n+dy*c};
}
function createRenderer(makeCanvas){
 // One reusable transparent blend surface; no per-effect or per-frame allocation.
 let scratch=null,pen=null;
 function draw(ctx,effects,now){
  for(const fx of effects){
   const {spec,image}=fx,alpha=opacity(fx,now);
   if(!alpha||!image?.complete||!image.naturalWidth)continue;
   const pos=framePosition(fx,now),a=Math.floor(pos),b=Math.min(spec.count-1,a+1),mix=pos-a;
   const density=spec.atlasScale??1,w=spec.w*density,h=spec.h*density;
   ctx.save();ctx.translate(fx.x,fx.y);ctx.rotate(fx.angle);
   ctx.scale(spec.sx*fx.scale,spec.sy*fx.scale*(fx.flipY??1));ctx.globalAlpha=alpha;
   if(spec.blend)ctx.globalCompositeOperation=spec.blend;
   ctx.imageSmoothingEnabled=true;
   if(mix<.025||a===b){ctx.drawImage(image,a%6*w,Math.floor(a/6)*h,w,h,-spec.pivot[0],-spec.pivot[1],spec.w,spec.h);}
   else{
    if(!scratch){scratch=makeCanvas();pen=scratch.getContext('2d');}
    if(scratch.width!==w||scratch.height!==h){scratch.width=w;scratch.height=h;}
    pen.clearRect(0,0,w,h);
    pen.globalCompositeOperation='source-over';pen.globalAlpha=1-mix;
    pen.drawImage(image,a%6*w,Math.floor(a/6)*h,w,h,0,0,w,h);
    // Add premultiplied contributions on transparency, not on the desktop.
    pen.globalCompositeOperation='lighter';pen.globalAlpha=mix;
    pen.drawImage(image,b%6*w,Math.floor(b/6)*h,w,h,0,0,w,h);
    pen.globalAlpha=1;pen.globalCompositeOperation='source-over';
    ctx.drawImage(scratch,0,0,w,h,-spec.pivot[0],-spec.pivot[1],spec.w,spec.h);
   }
   ctx.restore();
  }
 }
 return {draw};
}
const api={expired,prune,framePosition,opacity,admit,createEmitter,createPose,worldPoint,createRenderer};
root.rugFX=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
