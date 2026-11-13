// A bounded connected stroke, not an emitter of overlapping full-size sprites.
(function(root){
const profiles={hinokami:[20,'#9c1d21','#ff7138','#fff1be',700],water:[18,'#17628d','#58c4e4','#d4fbff',950],ember:[18,'#b72924','#ff8b35','#ffe8a4',700],mist:[23,'#64868f','#b4d3d4','#edf6ef',1050],stone:[15,'#625b53','#b4a68b','#f2e5cc',650],insect:[8,'#704394','#c3a1ed','#f7e2ff',700],love:[13,'#a6316c','#fa8fbe','#ffe7f3',750],serpent:[12,'#451971','#a468dc','#e2c7ff',750],sound:[12,'#8b4c61','#f4acb6','#fff1ce',650],spin:[14,'#276c48','#82dc9b','#deffe3',700],zap:[8,'#ad7730','#ffcf51','#fff8ca',500]};
function create(){
 const groups=[];let current=null,kind='water',total=0;const limit=256;
 function start(next){current=null;kind=next;}
 function append(p,time){
  if(!current){current={kind,points:[]};groups.push(current);}
  const points=current.points,last=points.at(-1),d=last?Math.hypot(p.x-last.x,p.y-last.y):0;
  if(last&&d<5){last.time=time;return;}
  points.push({x:p.x,y:p.y,time,distance:(last?.distance??0)+d});total++;
  while(total>limit||groups.length>8){const g=groups[0];if(g.points.length){g.points.shift();total--;}if(!g.points.length){groups.shift();if(g===current)current=null;}}
 }
 function path(g,points,offset,now,k){
  g.beginPath();
  let previousX=0,previousY=0;
  for(let i=0;i<points.length;i++){
   const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
   let wave=0;if(offset){wave=Math.sin(p.distance/(k==='zap'?9:22)-now*.004)*offset;}
   const x=p.x-dy/len*wave,y=p.y+dx/len*wave;
   if(i===0)g.moveTo(x,y);
   else if(k==='water'){
    g.quadraticCurveTo(previousX,previousY,(previousX+x)*.5,(previousY+y)*.5);
    if(i===points.length-1)g.lineTo(x,y);
   }else g.lineTo(x,y);
   previousX=x;previousY=y;
  }
 }
 function render(g,now,size=1){
  let write=0;
  for(const group of groups){
   const p=profiles[group.kind]||profiles.water,pts=group.points;
   while(pts.length&&now-pts[0].time>p[4]){pts.shift();total--;}
   if(!pts.length){if(group===current)current=null;continue;}
   groups[write++]=group;if(pts.length<2)continue;
   const age=now-pts.at(-1).time,alpha=Math.min(1,(p[4]-age)/240),w=p[0]*size;
   g.save();g.lineCap='round';g.lineJoin='round';
   for(let layer=0;layer<3;layer++){
    g.globalAlpha=alpha*[.22,.68,.9][layer]*(group.kind==='mist'?.56:1);
    g.strokeStyle=p[layer+1];g.lineWidth=w*[1.35,.68,.13][layer];path(g,pts,0,now,group.kind);g.stroke();
   }
   g.globalAlpha=alpha*.55;g.strokeStyle=p[3];g.lineWidth=group.kind==='water'?2:1;
   if(['water','serpent','spin','zap','ember','sound'].includes(group.kind)){
    path(g,pts,w*.26,now,group.kind);g.stroke();
    if(group.kind==='water'||group.kind==='sound'){path(g,pts,-w*.3,now,group.kind);g.globalAlpha=alpha*.3;g.stroke();}
   }
   g.restore();
  }
  groups.length=write;
 }
 return {start,append,breakPath(){current=null;},render,clear(){groups.length=0;current=null;total=0;},hasActive:()=>groups.length>0,get count(){return total;},limit};
}
const api={create,profiles};root.rugBreathingTrail=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
