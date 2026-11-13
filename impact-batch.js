// Contact detail remains in the cutting paths. Cloth motion has a separate bounded budget.
(function(root){
function create(profiles,options={}){
 const queued=new Map(),history=new WeakMap();
 const ripple=options.motion==='ripple';
 const stats={inputs:0,appliedHits:0,nodePasses:0,changedNodes:0};
 function enqueue(uv,point,angle,kind,now){
  stats.inputs++;let cells=queued.get(uv.piece);if(!cells){cells=new Map();queued.set(uv.piece,cells)}
  const profile=profiles[kind]||{},key=kind+':'+Math.floor(uv.x/64)+':'+Math.floor(uv.y/64);
  if(!cells.has(key))cells.set(key,{uv,point,angle,kind,now,key,profile});
 }
 function flush(now,onVisual){
  let changed=false,visuals=0;
  for(const [piece,cells]of queued){
   let stamps=history.get(piece);if(!stamps){stamps=new Map();history.set(piece,stamps)}
   const hits=[];
   for(const hit of cells.values()){
    const cooldown=ripple?100:(['wind','mist','stone'].includes(hit.kind)?70:45);
    if(now-(stamps.get(hit.key)??-Infinity)<cooldown||hits.length>=(ripple?3:6))continue;
    stamps.set(hit.key,now);hit.radius=hit.profile.radius??(hit.kind==='spin'?116:hit.kind==='water'?88:84);
    if(ripple)hit.radius=Math.min(84,hit.radius);
    hit.lift=hit.profile.lift??(hit.kind==='spin'?7:hit.kind==='water'?6:8);
    hit.nx=-Math.sin(hit.angle);hit.ny=Math.cos(hit.angle);hit.tx=Math.cos(hit.angle);hit.ty=Math.sin(hit.angle);
    hits.push(hit);stats.appliedHits++;
    if(visuals<4){onVisual?.(hit);visuals++;}
   }
   if(!hits.length)continue;
   if(options.motion===false)continue;
   stats.nodePasses++;
   for(const p of piece.active){
    let lift=0,vx=0,vy=0,delay=0;
    for(const h of hits){
     const du=p.u-h.uv.x,dv=p.v-h.uv.y,r=h.radius;if(Math.abs(du)>=r||Math.abs(dv)>=r)continue;
     const d2=du*du+dv*dv;if(d2>=r*r)continue;
     const distance=Math.sqrt(d2),w=1-distance/r,f=w*w*(3-2*w);
     if(h.lift*f>lift){lift=h.lift*f;delay=distance/r*65;}
     const dx=p.x-h.point.x,dy=p.y-p.z*.48-h.point.y,side=dx*h.nx+dy*h.ny>=0?1:-1;
     if(h.kind==='spin'){const d=Math.hypot(dx,dy)||1;vx+=(dx-dy*.5)/d*85*f;vy+=(dy+dx*.5)/d*85*f;}
     else{vx+=h.nx*side*75*f;vy+=h.ny*side*75*f;if(h.kind==='wind'){vx+=h.tx*98*f;vy+=h.ty*98*f;}}
    }
    if(!lift)continue;
    // Overlapping blades no longer multiply lift/velocity on the same node.
    const gain=now-(p.impactAt??-Infinity)<(ripple?90:55)?.25:1;p.impactAt=now;
    if(ripple){
     // One short, travelling spring pulse per node; overlapping blades cannot
     // restart its rising phase or pump the rug higher on every pointer sample.
     if(!(p.flutterUntil>now+120)){
      p.flutterAt=now+delay;p.flutterUntil=p.flutterAt+420;
      p.flutterLift=Math.min(8.5,lift*1.25);
     }else p.flutterLift=Math.min(8.5,Math.max(p.flutterLift,lift*1.25));
    }else{
     p.z+=Math.min(6,lift)*gain;p.vz=Math.max(p.vz,Math.min(180,lift*24)*gain);
    }
    const length=Math.hypot(vx,vy),limit=Math.min(1,(ripple?8:90)/Math.max(1,length))*gain;
    p.vx=Math.max(-480,Math.min(480,p.vx+vx*limit));p.vy=Math.max(-480,Math.min(480,p.vy+vy*limit));
    changed=true;stats.changedNodes++;
   }
  }
  queued.clear();return changed;
 }
 // The pulse drives the existing constrained cloth, not a second visual mesh.
 // A dragged/high fold keeps the normal gravity and collision solver.
 function verticalAcceleration(p,now){
  if(!ripple||!(p.flutterUntil>now))return null;
  if(p.z>18||p.pz>18){p.flutterUntil=0;return null;}
  const age=now-p.flutterAt;
  if(age<0)return null;
  const t=age/420;
  const wave=Math.sin(Math.PI*t);
  const target=p.flutterLift*wave*wave*(1-.65*t);
  return Math.max(-1800,Math.min(1800,(target-p.z)*300-p.vz*25));
 }
 return {enqueue,flush,verticalAcceleration,clear:()=>queued.clear(),stats};
}
const api={create};root.rugImpactBatch=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
