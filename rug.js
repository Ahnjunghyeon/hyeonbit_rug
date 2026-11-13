/*
MIT License

Copyright (c) 2026 Patch
Copyright (c) 2026 Hugo Duprez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// Cloth desktop and painted breathing effects; original MIT notices retained.
(() => {
const $=id=>document.querySelector('#hyeonbit-rug #'+id);
const nativeDesktop=window.rugDesktop;
const settingsOnly=Boolean(nativeDesktop&&new URLSearchParams(window.location.search).get('mode')==='settings');
const {skills,defaults,normalize,upgradeAppearance}=window.rugPreferences;
const actions=Object.keys(skills);
let preferences={...defaults},preferencesRevision=0,rugArt=null,action=defaults.defaultSkill;
let wheelSizeTimer=null,wheelSizePending=false,defaultArtPromise;
const defaultArtSource=window.hyeonbitDefaultRug??'assets/default-rug-v2.png';
const catalog=window.rugCatalog,atlasStore=catalog.createAtlasStore(Image,window.hyeonbitFxAtlas);
if(settingsOnly){window.RugSettingsUI.mount({standalone:true,bridge:nativeDesktop,atlasStore,defaultArtSource});return;}
let effects=[], fibers=[], contactFlashes=[], scraps=[], arrival=null;
let effectSequence=Object.create(null);
const impactColors={hinokami:'#ff8d46',water:'#abecff',ember:'#ffb35c',spin:'#71ef80',zap:'#ffd655',mist:'#d6f3ff',insect:'#dfb8ff',love:'#ff70b7',serpent:'#ac67f0',sound:'#c2eedc',stone:'#c7baae'};
const edgeWidths={hinokami:9,water:7,ember:9,spin:6,zap:3.6,insect:4,love:5.6,serpent:6.4,sound:6.8,mist:7.8,stone:8};
const preciseCuts=new Set(['insect','love','serpent','sound','mist']);
const effectTuning=catalog.tuning;
const rugLayout=window.rugLayout;
let rugRestWidth=500,nativeHoverState=false;
const impactProfiles={
  hinokami:{lift:9,radius:88,count:6,colors:['#fff5d3','#ffbc43','#f84b2f']},
  zap:{lift:7,radius:56,count:8,colors:['#fff7ce','#ffd655','#d29230']},
  mist:{lift:4,radius:54,count:4,colors:['#e8faff','#8ce9dc','#477d91']},
  insect:{lift:3,radius:38,count:5,colors:['#f4e1ff','#dfb8ff','#9d72d3']},
  love:{lift:5,radius:57,count:8,colors:['#fff0fa','#ff70b7','#ee70aa']},
  serpent:{lift:4,radius:55,count:7,colors:['#e4bbff','#ac67f0','#6229a7']},
  sound:{lift:9,radius:92,count:10,colors:['#effff3','#9ce3da','#edcc75']},
  stone:{lift:12,radius:122,count:6,colors:['#fff3cc','#c7a568','#76644d']}
};
const fxSpecs=catalog.specs;
const atlas={};
const paintedContactFrames=window.rugPaintedContacts.frames;
for(const name of Object.keys(fxSpecs))atlas[name]=atlasStore.get(name);
const canvas=$('desktop'),ctx=canvas.getContext('2d');
const effectCanvas=$('effects'),effectContext=effectCanvas.getContext('2d');
const fxRuntime=window.rugFX,fxRenderer=fxRuntime.createRenderer(()=>document.createElement('canvas'));
const fxEmitter=fxRuntime.createEmitter(effectTuning,spawnEffect);
const floor=document.createElement('canvas'),bg=floor.getContext('2d');
let textile,ink,pieces=[];
const columns=16,rows=10;
let W,H,scale,nodes=[],links=[],faces=[],folders=[],grab=null;
let blade=null, streaks=[], nativeCutArmed=false,nativeMoveArmed=false;
const breathingTrail=window.rugBreathingTrail.create();
let clothKick={at:-Infinity,strength:0};
let frame=0,previous=0,accumulator=0,quiet=0,inTick=false;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

const TEX_WIDTH=640,TEX_HEIGHT=400,MAX_PIECES=12,MIN_ISLAND_PIXELS=16,SMALL_SCRAP_RATIO=.007;
let materialArea=TEX_WIDTH*TEX_HEIGHT;

function readWebPreferences(){
  try {
    const key='hyeonbit-rug.settings',raw=localStorage.getItem(key);
    if(!raw)return {...defaults};
    const {preferences:next,changed}=upgradeAppearance(JSON.parse(raw));
    if(changed){
      const backup=key+'.before-appearance-v2';
      // If backup/storage fails, leave the old persistent data untouched.
      try{if(!localStorage.getItem(backup))localStorage.setItem(backup,raw);
        localStorage.setItem(key,JSON.stringify(next));}catch(error){console.warn('Appearance backup could not be saved',error);}
    }
    return next;
  }catch{return {...defaults};}
}
function decodeArt(data){
  if(!data)return defaultArtPromise??=(async()=>{
    const image=new Image();image.src=defaultArtSource;await image.decode();return image;
  })().catch(error=>{defaultArtPromise=null;throw error;});
  const image=new Image();
  image.src=data;
  return image.decode().then(()=>image);
}
async function applyPreferences(value){
  const next=normalize(value),revision=++preferencesRevision;
  const changedArt=next.art!==preferences.art||!rugArt;
  const image=changedArt?await decodeArt(next.art).catch(error=>{
    console.warn('Custom rug failed to decode; loading the default rug',error);
    return decodeArt('');
  }):rugArt;
  if(revision!==preferencesRevision)return;
  if(wheelSizePending)next.size=preferences.size;
  const previousSize=preferences.size;
  const geometryChanged=next.size!==preferences.size||changedArt;
  const skillChanged=next.defaultSkill!==preferences.defaultSkill;
  preferences=next;
  rugArt=image;
  if(skillChanged)selectAction(next.defaultSkill);
  if(geometryChanged&&W&&H){
    if(changedArt||arrival)reset(true);
    else scaleLiveRug(next.size/previousSize);
    if(!arrival)selectAction(action);
  }
}
function scaleLiveRug(factor){
  if(window.rugResize.scalePieces(pieces,factor)){rugRestWidth*=factor;hitGridValid=false;wake();}
}
async function persistWheelSize(){
  wheelSizeTimer=null;
  const target=preferences.size;
  try{
    if(nativeDesktop)await nativeDesktop.setSize(target);
    else localStorage.setItem('hyeonbit-rug.settings',JSON.stringify(preferences));
    if(preferences.size===target&&wheelSizeTimer===null)wheelSizePending=false;
  }catch(error){wheelSizePending=false;console.warn('Rug size could not be saved',error);$('hint').textContent='러그 크기를 저장하지 못했습니다.';}
}
function changeRugSize(delta){
  const previous=preferences.size,next=clamp(previous+delta,60,300);
  if(next===previous)return next;
  preferences={...preferences,size:next};wheelSizePending=true;
  scaleLiveRug(next/previous);
  clearTimeout(wheelSizeTimer);wheelSizeTimer=setTimeout(persistWheelSize,180);
  return next;
}


function bindPiece(piece){
  ({nodes,links,faces,textile,ink,layerOrder}=piece);
}

function textureIndex(u,v){
  return (clamp(Math.floor(v),0,TEX_HEIGHT-1)*TEX_WIDTH+clamp(Math.floor(u),0,TEX_WIDTH-1))*4+3;
}

function findIslands(rgba,bounds){
  const n=TEX_WIDTH*TEX_HEIGHT;
  const labels=findIslands.labels??=new Int32Array(n);
  const queue=findIslands.queue??=new Int32Array(n);
  labels.fill(0);
  const leftBound=bounds?.left??0,rightBound=bounds?.right??TEX_WIDTH-1;
  const topBound=bounds?.top??0,bottomBound=bounds?.bottom??TEX_HEIGHT-1;
  const islands=[];
  for(let row=topBound;row<=bottomBound;row++)for(let col=leftBound;col<=rightBound;col++){
    const start=row*TEX_WIDTH+col;
    if(labels[start]||rgba[start*4+3]<32)continue;
    const id=islands.length+1;
    let head=0,tail=1,xSum=0,ySum=0,left=TEX_WIDTH,right=0,top=TEX_HEIGHT,bottom=0;
    queue[0]=start;labels[start]=id;
    function visit(next){
      if(!labels[next]&&rgba[next*4+3]>=32){labels[next]=id;queue[tail++]=next;}
    }
    while(head<tail){
      const i=queue[head++],x=i%TEX_WIDTH,y=(i-x)/TEX_WIDTH;
      xSum+=x;ySum+=y;
      left=Math.min(left,x);right=Math.max(right,x);
      top=Math.min(top,y);bottom=Math.max(bottom,y);
      if(x>0)visit(i-1);
      if(x<TEX_WIDTH-1)visit(i+1);
      if(y>0)visit(i-TEX_WIDTH);
      if(y<TEX_HEIGHT-1)visit(i+TEX_WIDTH);
    }
    islands.push({id,count:tail,u:xSum/tail,v:ySum/tail,left,right,top,bottom});
  }
  return {labels,islands};
}

function buildPiece(parent,rgba,labels,island,center){
  const textile=document.createElement('canvas');
  textile.width=TEX_WIDTH;textile.height=TEX_HEIGHT;
  const ink=textile.getContext('2d',{willReadFrequently:true});
  const image=ink.createImageData(TEX_WIDTH,TEX_HEIGHT);
  const cells=new Uint8Array(columns*rows);
  for(let y=island.top;y<=island.bottom;y++)for(let x=island.left;x<=island.right;x++){
    const i=y*TEX_WIDTH+x;
    if(labels[i]!==island.id)continue;
    const k=i*4;
    image.data[k]=rgba[k];image.data[k+1]=rgba[k+1];
    image.data[k+2]=rgba[k+2];image.data[k+3]=rgba[k+3];
    cells[Math.floor(y*rows/TEX_HEIGHT)*columns+Math.floor(x*columns/TEX_WIDTH)]=1;
  }
  ink.putImageData(image,0,0);
  const nodes=parent.nodes.map(node=>({...node,contact:false}));
  const clone=new Map(parent.nodes.map((node,i)=>[node,nodes[i]]));
  const faces=[],activeSet=new Set();
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    if(!cells[row*columns+col])continue;
    const i=row*(columns+1)+col;
    const a=nodes[i],b=nodes[i+1],c=nodes[i+columns+1],d=nodes[i+columns+2];
    faces.push([a,b,c],[b,d,c]);
    for(const node of [a,b,c,d])activeSet.add(node);
  }
  const active=[...activeSet];
  const links=parent.links.map(link=>({...link,a:clone.get(link.a),b:clone.get(link.b)}))
    .filter(link=>activeSet.has(link.a)&&activeSet.has(link.b));
  const ghosts=nodes.filter(node=>!activeSet.has(node)).map(node=>{
    let closest=active[0],distance=Infinity;
    for(const candidate of active){
      const d=(node.u-candidate.u)**2+(node.v-candidate.v)**2;
      if(d<distance){distance=d;closest=candidate;}
    }
    return {node,closest};
  });
  return {nodes,active,links,faces,ghosts,textile,ink,mask:image.data,bounds:{left:island.left,right:island.right,top:island.top,bottom:island.bottom},layerOrder:new Map(),dirty:true};
}

const scrapStyles=window.rugScrapEffects.styles;

function screenAt(piece,u,v){
  const x=u/TEX_WIDTH*columns,y=v/TEX_HEIGHT*rows;
  const col=Math.min(columns-1,Math.floor(x)),row=Math.min(rows-1,Math.floor(y));
  const i=row*(columns+1)+col,j=i+columns+1;
  const dx=x-col,dy=y-row;
  const [a,b,c,d]=[piece.nodes[i],piece.nodes[i+1],piece.nodes[j],piece.nodes[j+1]].map(projected);
  return dx+dy<=1?{x:a.x+(b.x-a.x)*dx+(c.x-a.x)*dy,y:a.y+(b.y-a.y)*dx+(c.y-a.y)*dy}:
    {x:d.x+(c.x-d.x)*(1-dx)+(b.x-d.x)*(1-dy),y:d.y+(c.y-d.y)*(1-dx)+(b.y-d.y)*(1-dy)};
}

function scrapKind(piece,labels,island){
  const marks=piece.cutMarks??[];
  for(let i=marks.length-1;i>=0;i--){
    const {a,b,kind,width}=marks[i],r=Math.ceil(width/2)+3;
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));
    for(let step=0;step<=steps;step++){
      const x=Math.floor(a.x+(b.x-a.x)*step/steps),y=Math.floor(a.y+(b.y-a.y)*step/steps);
      if(x+r<island.left||x-r>island.right||y+r<island.top||y-r>island.bottom)continue;
      for(const [dx,dy] of [[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]]){
        const u=x+dx,v=y+dy;
        if(u>=0&&u<TEX_WIDTH&&v>=0&&v<TEX_HEIGHT&&labels[v*TEX_WIDTH+u]===island.id)return kind;
      }
    }
  }
  return marks.at(-1)?.kind??'water';
}

function addScrap(piece,rgba,labels,island,center,now){
  if(island.count<8||scraps.length>=window.rugScrapEffects.limits.scraps)return;
  const {left,right,top,bottom,u,v}=island;
  const width=right-left+1,height=bottom-top+1;
  const image=document.createElement('canvas');
  image.width=width;image.height=height;
  const paint=image.getContext('2d'),data=paint.createImageData(width,height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const at=(top+y)*TEX_WIDTH+left+x;
    if(labels[at]===island.id)data.data.set(rgba.subarray(at*4,at*4+4),(y*width+x)*4);
  }
  paint.putImageData(data,0,0);
  const middle=screenAt(piece,(left+right+1)/2,(top+bottom+1)/2);
  const a=screenAt(piece,left,v),b=screenAt(piece,right+1,v),c=screenAt(piece,u,top),d=screenAt(piece,u,bottom+1);
  const kind=scrapKind(piece,labels,island),style=scrapStyles[kind];
  scraps.push(window.rugScrapEffects.prepare({...middle,at:now,kind,style,image,
    width:Math.max(2,Math.hypot(b.x-a.x,b.y-a.y)),height:Math.max(2,Math.hypot(d.x-c.x,d.y-c.y)),
    angle:Math.atan2(b.y-a.y,b.x-a.x),direction:u<center.u?-1:1,
    motes:null},()=>document.createElement('canvas')));

}

function renderScraps(now,target=ctx){window.rugScrapEffects.render(target,scraps,now);}

function finishCuts(){
  hitGridValid=false;
  let updated=false,limited=false,processed=0;
  for(const piece of pieces.slice()){
    if(!piece.cutPending)continue;
    if(processed===1)break;
    processed++;
    piece.cutPending=false;
    const image=piece.ink.getImageData(0,0,TEX_WIDTH,TEX_HEIGHT),rgba=image.data;
    piece.mask=rgba;
    const {labels,islands}=findIslands(rgba,piece.bounds);
    const threshold=materialArea*SMALL_SCRAP_RATIO;
    const small=islands.filter(island=>island.count<=threshold);
    const keep=islands.filter(island=>island.count>threshold);
    const baseline=piece.baseIslands??1;
    if(!small.length&&keep.length&&keep.length<=baseline){
      piece.baseIslands=keep.length;
      continue;
    }
    const total=islands.reduce((sum,island)=>sum+island.count,0);
    const center=islands.reduce((result,island)=>({
      u:result.u+island.u*island.count/total,
      v:result.v+island.v*island.count/total
    }),{u:0,v:0});
    const now=performance.now();
    for(const island of small)addScrap(piece,rgba,labels,island,center,now);
    if(keep.length===1||pieces.length+keep.length-1>MAX_PIECES){
      limited=limited||keep.length>1;
      const discarded=new Set(small.map(island=>island.id));
      for(let i=0;i<labels.length;i++)if(discarded.has(labels[i]))rgba[i*4+3]=0;
      piece.ink.putImageData(image,0,0);piece.dirty=true;
      piece.baseIslands=keep.length;
      if(keep.length===1){const k=keep[0];piece.bounds={left:k.left,right:k.right,top:k.top,bottom:k.bottom};}
      updated=updated||small.length>0;
      continue;
    }
    const split=keep.map(island=>buildPiece(piece,rgba,labels,island,center));
    drawSurface?.dispose(piece);
    pieces.splice(pieces.indexOf(piece),1,...split);
    updated=true;
  }
  if(limited)$('hint').textContent='이 데모에서는 러그 조각을 최대 12개까지 나눌 수 있습니다.';
  else if(updated)$('hint').textContent='러그가 갈라졌습니다. 작은 조각은 검기 효과와 함께 사라집니다.';
  if(updated)wake(false);
}

function release(){
  const id=grab?.id;
  grab=null;canvas.style.cursor='';
  if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
}
function reset(animated=false){
  if(!rugArt)return; // Never flash the old procedural rug while artwork is loading.
  hitGridValid=false;
  impactBatch.clear();
  release();stopBlade();
  for(const piece of pieces)drawSurface?.dispose(piece);
  clothKick.at=-Infinity;clothKick.strength=0;
  breathingTrail.clear();
  streaks=[];effects=[];fibers=[];contactFlashes=[];scraps=[];arrival=null;
  fxEmitter.stop();effectSequence=Object.create(null);effectContext.clearRect(0,0,W,H);
  textile=document.createElement('canvas');
  ink=textile.getContext('2d',{willReadFrequently:true});
  let mask=null,baseIslands=1;
  materialArea=TEX_WIDTH*TEX_HEIGHT;
  if(rugArt){
    textile.width=TEX_WIDTH;textile.height=TEX_HEIGHT;
    ink.drawImage(rugArt,0,0,TEX_WIDTH,TEX_HEIGHT);
    mask=ink.getImageData(0,0,TEX_WIDTH,TEX_HEIGHT).data;
    const visible=findIslands(mask).islands;
    materialArea=Math.max(1,visible.reduce((sum,island)=>sum+island.count,0));
    baseIslands=Math.max(1,visible.filter(island=>island.count>=MIN_ISLAND_PIXELS).length);
  }
  nodes=[];links=[];faces=[];layerOrder=new Map();

  const size=preferences.size/100;
  const ratio=TEX_HEIGHT/TEX_WIDTH;
  const width=rugLayout.baseWidth(W,H)*size,height=width*ratio;
  rugRestWidth=width;
  const left=Math.max(12,(W-width)*.5),top=Math.max(12,H*.48-height*.5);
  function addLink(a,b,compliance){
    links.push({a,b,length:Math.hypot(a.x-b.x,a.y-b.y),compliance});
  }
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const x=left+width*col/columns,y=top+height*row/rows;
    nodes.push({x,y,z:0,px:x,py:y,pz:0,vx:0,vy:0,vz:0,rx:x,ry:y,u:640*col/columns,v:400*row/rows});
  }
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const i=row*(columns+1)+col,n=nodes[i],stride=columns+1;
    if(col<columns)addLink(n,nodes[i+1],0);
    if(row<rows)addLink(n,nodes[i+stride],0);
    if(col+2<=columns)addLink(n,nodes[i+2],8e-6);
    if(row+2<=rows)addLink(n,nodes[i+stride*2],8e-6);
    if(col<columns&&row<rows){
      const b=nodes[i+1],c=nodes[i+stride],d=nodes[i+stride+1];
      addLink(n,d,1.8e-6);addLink(b,c,1.8e-6);
      faces.push([n,b,c],[b,d,c]);
    }
  }
  pieces=[{nodes,active:nodes,links,faces,ghosts:[],textile,ink,mask,baseIslands,layerOrder,dirty:true}];
  if(animated&&preferences.animate){
    arrival={at:performance.now(),lift:(top+height+24)/.48,cx:left+width/2,cy:top+height/2,width,height};
    $('hint').textContent='러그가 내려오는 중';
    unfoldRug(arrival.at);
  }
  wake();
}
function unfoldRug(now){
  const t=clamp((now-arrival.at)/1450,0,1);
  for(const p of pieces[0].nodes){
    const u=p.u/TEX_WIDTH,v=p.v/TEX_HEIGHT;
    const fall=clamp((t-(1-v)*.13)/.87,0,1);
    const open=clamp(t/.68,0,1);
    const spread=.42+.58*open*open*(3-2*open);
    const flutter=Math.sin(t*17-u*8+v*3)*(1-fall)*Math.sin(Math.PI*t);
    p.x=p.rx+(arrival.cx-p.rx)*(1-spread)+24*flutter;
    p.y=p.ry+(arrival.cy-p.ry)*(1-spread)*.27+16*flutter;
    p.z=arrival.lift*(1-fall)**1.8+44*flutter*flutter;
  }
  if(t===1){arrival=null;selectAction(action);}
}
function resize(){
  const rect=canvas.getBoundingClientRect();
  W=rect.width;H=rect.height;scale=1;
  canvas.width=effectCanvas.width=floor.width=Math.round(W*scale);
  canvas.height=effectCanvas.height=floor.height=Math.round(H*scale);
  ctx.setTransform(scale,0,0,scale,0,0);bg.setTransform(scale,0,0,scale,0,0);
  if(nativeDesktop){folders=[];reset();return;}
  bg.fillStyle='#392c29';bg.fillRect(0,0,W,H);
  for(let y=0,row=0;y<H;y+=31,row++)for(let x=-(row%3)*60;x<W;x+=180){
    bg.fillStyle=['#594439','#634d3f','#523e36'][(Math.round(x/60)+row+3)%3];
    bg.fillRect(x,y,179,30);
    bg.strokeStyle='#ac907726';bg.lineWidth=1;
    for(let i=0;i<4;i++){
      bg.beginPath();bg.moveTo(x+10+i*12,y+5+i*6);
      bg.bezierCurveTo(x+48,y+i*6,x+86,y+8+i*6,x+141-i*7,y+6+i*6);bg.stroke();
    }
  }
  bg.fillStyle='#111927';bg.fillRect(0,H-35,W,35);
  bg.fillStyle='#f4e9da';bg.font='13px system-ui';bg.fillText('⊞    Windows',14,H-13);
  folders=[
    {x:W*.70,y:H*.40,name:'작업 파일'},
    {x:W*.87,y:H*.40,name:'다운로드'},
    {x:W*.79,y:H*.60,name:'스크린샷'}
  ];
  reset();
}
let layerOrder=new Map();
let contactFrame=0;

// Find overlap corners, including crossings where neither triangle contains a vertex.
function overlapPoints(a,b){
  const result=[];
  function verticesInside(from,to,reverse){
    const dx=to[1].x-to[0].x,dy=to[1].y-to[0].y;
    const ex=to[2].x-to[0].x,ey=to[2].y-to[0].y;
    const det=dx*ey-dy*ex;
    if(Math.abs(det)<.01)return;
    for(let i=0;i<3;i++){
      const x=from[i].x-to[0].x,y=from[i].y-to[0].y;
      const v=(x*ey-y*ex)/det,w=(dx*y-dy*x)/det,u=1-v-w;
      if(Math.min(u,v,w)<0)continue;
      const point=[0,0,0];point[i]=1;
      const bary=[u,v,w];
      result.push(reverse?[bary,point]:[point,bary]);
    }
  }
  verticesInside(a,b,false);verticesInside(b,a,true);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const k=(i+1)%3,l=(j+1)%3;
    const dx=a[k].x-a[i].x,dy=a[k].y-a[i].y;
    const ex=b[l].x-b[j].x,ey=b[l].y-b[j].y;
    const det=dx*ey-dy*ex;
    if(Math.abs(det)<.01)continue;
    const x=b[j].x-a[i].x,y=b[j].y-a[i].y;
    const t=(x*ey-y*ex)/det,s=(x*dy-y*dx)/det;
    if(t<=0||t>=1||s<=0||s>=1)continue;
    const wa=[0,0,0],wb=[0,0,0];
    wa[i]=1-t;wa[k]=t;wb[j]=1-s;wb[l]=s;
    result.push([wa,wb]);
  }
  return result;
}
function layerHeight(face,weights,axis){
  return face[0][axis]*weights[0]+face[1][axis]*weights[1]+face[2][axis]*weights[2];
}
function resolveLayers(collisionNodes){
  const cell=32,gap=2.6,grid=new Map(),contacts=[];
  contactFrame++;
  for(const p of collisionNodes)p.contact=false;
  for(let i=0;i<faces.length;i++){
    const face=faces[i], [a,b,c]=face;
    const left=Math.floor(Math.min(a.x,b.x,c.x)/cell),right=Math.floor(Math.max(a.x,b.x,c.x)/cell);
    const top=Math.floor(Math.min(a.y,b.y,c.y)/cell),bottom=Math.floor(Math.max(a.y,b.y,c.y)/cell);
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const key=y*4096+x;
      if(!grid.has(key))grid.set(key,[]);
      grid.get(key).push(i);
    }
  }
  const bounds=faces.map(face=>{
    const a=face[0],b=face[1],c=face[2];
    return [Math.min(a.x,b.x,c.x),Math.max(a.x,b.x,c.x),Math.min(a.y,b.y,c.y),Math.max(a.y,b.y,c.y),Math.min(a.z,b.z,c.z),Math.max(a.z,b.z,c.z)];
  });
  const checked=new Set();
  for(const bucket of grid.values())for(let i=0;i<bucket.length;i++)for(let j=i+1;j<bucket.length;j++){
    const ai=bucket[i],bi=bucket[j],key=ai*faces.length+bi;
    if(checked.has(key))continue;
    checked.add(key);
    const a=faces[ai],b=faces[bi];
    if(a.some(n=>b.includes(n)))continue;
    const ba=bounds[ai],bb=bounds[bi];
    if(ba[1]<bb[0]||bb[1]<ba[0]||ba[3]<bb[2]||bb[3]<ba[2])continue;
    const priorOrder=layerOrder.get(key);
    if(priorOrder&&((priorOrder.side>0&&ba[4]>bb[5]+gap+6)||(priorOrder.side<0&&bb[4]>ba[5]+gap+6))){
      priorOrder.frame=contactFrame;continue;
    }
    const points=overlapPoints(a,b);
    if(!points.length)continue;
    let prior=0,current=0;
    for(const [wa,wb] of points){
      prior+=layerHeight(a,wa,'pz')-layerHeight(b,wb,'pz');
      current+=layerHeight(a,wa,'z')-layerHeight(b,wb,'z');
    }
    const saved=layerOrder.get(key);
    const side=saved?.side??(Math.abs(prior)>.08?Math.sign(prior):current<0?-1:1);
    layerOrder.set(key,{side,frame:contactFrame});
    for(const [wa,wb] of points){
      const separation=side*(layerHeight(a,wa,'z')-layerHeight(b,wb,'z'));
      if(separation>=gap+6)continue;
      for(const p of a)p.contact=true;
      for(const p of b)p.contact=true;
      contacts.push(side>0?[a,b,wa,wb]:[b,a,wb,wa]);
    }
  }
  for(const [key,record] of layerOrder)if(record.frame<contactFrame-1)layerOrder.delete(key);
  // Push the top layer up and the bottom layer down, with the floor as a hard stop.
  for(let pass=0;pass<4;pass++)for(const [upper,lower,up,down] of contacts){
    const overlap=gap-layerHeight(upper,up,'z')+layerHeight(lower,down,'z');
    if(overlap<=.015)continue;
    let upMass=0,downMass=0;
    for(let i=0;i<3;i++){upMass+=up[i]**2;downMass+=down[i]**2;}
    const step=overlap/(upMass+downMass);
    let remaining=overlap;
    for(let i=0;i<3;i++){
      const shift=Math.min(lower[i].z,step*down[i]);
      lower[i].z-=shift;lower[i].pz=Math.max(0,lower[i].pz-shift*.85);
      remaining-=shift*down[i];
    }
    for(let i=0;i<3;i++){
      const shift=remaining*up[i]/upMass;
      upper[i].z+=shift;upper[i].pz+=shift*.85;
    }
  }
}
// Position constraints, grab tethers, and ground friction adapted from
// siliconbag/under-the-rug, Sources/Cloth.swift (MIT; see LICENSE).
function simulatePiece(piece,now){
  bindPiece(piece);
  const nodes=piece.active,grabbed=grab?.piece===piece?grab:null;
  const substeps=3,dt=1/60/substeps;
  // Reuse node fields instead of allocating a nested array every physics step.
  for(const p of nodes){p.frameX=p.x;p.frameY=p.y;p.frameZ=p.z;if(grabbed)p.flutterUntil=0;}
  if(grabbed){
    const dx=grabbed.target.x-grabbed.follow.x,dy=grabbed.target.y-grabbed.follow.y;
    const ratio=Math.min(1,19/Math.max(.01,Math.hypot(dx,dy)));
    grabbed.follow.x+=dx*ratio;grabbed.follow.y+=dy*ratio;
  }
  for(let sub=0;sub<substeps;sub++){
    const sampleTime=now-(substeps-1-sub)*dt*1000;
    for(const p of nodes){
      p.sx=p.x;p.sy=p.y;p.sz=p.z;
      p.x+=p.vx*dt*.988;p.y+=p.vy*dt*.988;
      const acceleration=impactBatch.verticalAcceleration(p,sampleTime)??-4200;
      p.z+=(p.vz+acceleration*dt)*dt*.985;
    }
    if(grabbed){
      const {face,weights,follow,lift}=grabbed;
      let x=0,y=0,z=0,norm=0;
      for(let i=0;i<3;i++){
        const p=face[i],w=weights[i];x+=p.x*w;y+=p.y*w;z+=p.z*w;norm+=w*w;
      }
      for(let i=0;i<3;i++){
        const p=face[i],f=weights[i]/norm;
        p.x+=(follow.x-x)*.36*f;p.y+=(follow.y+lift*.48-y)*.36*f;p.z+=(lift-z)*.23*f;
      }
    }
    for(const {a,b,length,compliance} of links){
      const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,len=Math.hypot(x,y,z);
      if(len<.00001)continue;
      const correction=(len-length)/(len*(2+compliance/(dt*dt)));
      a.x+=x*correction;a.y+=y*correction;a.z+=z*correction;
      b.x-=x*correction;b.y-=y*correction;b.z-=z*correction;
    }
    if(grabbed){
      const anchor=grabbed.face[grabbed.anchorIndex];
      for(const [p,rest] of grabbed.tethers){
        const x=p.x-anchor.x,y=p.y-anchor.y,z=p.z-anchor.z,len=Math.hypot(x,y,z);
        if(len>rest&&len>.00001){
          const f=(len-rest)/len;
          p.x-=x*f;p.y-=y*f;p.z-=z*f;
        }
      }
    }
    for(const p of nodes){
      if(p.z<0){
        const penetration=-p.z,dx=p.x-p.sx,dy=p.y-p.sy,length=Math.hypot(dx,dy);
        const f=length<2*penetration?1:Math.min(1,1.3*penetration/Math.max(.00001,length));
        p.x-=dx*f;p.y-=dy*f;p.z=0;
      }
      const marginX=Math.max(0,(rugRestWidth-W)/2)+24,marginY=Math.max(0,(rugRestWidth*TEX_HEIGHT/TEX_WIDTH-H)/2)+24;
      p.x=clamp(p.x,-marginX,W+marginX);p.y=clamp(p.y,-marginY,H+marginY);
      p.vx=clamp((p.x-p.sx)/dt,-1250,1250);p.vy=clamp((p.y-p.sy)/dt,-1250,1250);
      p.vz=clamp((p.z-p.sz)/dt,-850,850);
    }
  }
  const raised=nodes.some(p=>p.z>.02||p.pz>.02);
  const gentleRipple=!grabbed&&!layerOrder.size&&!nodes.some(p=>p.z>14||p.pz>14);
  piece.rippleLayerTick=(piece.rippleLayerTick??0)+1;
  if((grabbed||layerOrder.size||raised)&&(!gentleRipple||piece.rippleLayerTick%3===0)){
    resolveLayers(nodes);
    for(const p of nodes)if(p.contact)p.vz*=.3;
  }
  let motion=0;
  for(const p of nodes){
    motion=Math.max(motion,Math.abs(p.x-p.frameX)+Math.abs(p.y-p.frameY)+Math.abs(p.z-p.frameZ));
    if(p.flutterUntil>now)motion=Math.max(motion,.1);
    p.px=p.frameX;p.py=p.frameY;p.pz=p.frameZ;
  }
  for(const {node,closest} of piece.ghosts){
    node.x=closest.x+(node.rx-closest.rx);
    node.y=closest.y+(node.ry-closest.ry);
    node.z=closest.z;
  }
  return motion;
}
function simulate(now){
  hitGridValid=false;
  let motion=0;
  for(const piece of pieces)motion=Math.max(motion,simulatePiece(piece,now));
  quiet=motion<.09&&!grab?quiet+1:0;
}
function projected(p){return {x:p.x,y:p.y-p.z*.48};}
function triangle(a,b,c,pad=0){
  const x=(a.x+b.x+c.x)/3,y=(a.y+b.y+c.y)/3;
  ctx.beginPath();
  [a,b,c].forEach((p,i)=>{
    const d=Math.max(1,Math.hypot(p.x-x,p.y-y));
    const px=p.x+pad*(p.x-x)/d,py=p.y+pad*(p.y-y)/d;
    if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
  });
  ctx.closePath();
}
function texture(face,screen){
  const [u,v,w]=face,[a,b,c]=screen;
  const du=v.u-u.u,dv=v.v-u.v,eu=w.u-u.u,ev=w.v-u.v,det=du*ev-dv*eu;
  const xx=((b.x-a.x)*ev-(c.x-a.x)*dv)/det;
  const xy=((c.x-a.x)*du-(b.x-a.x)*eu)/det;
  const yx=((b.y-a.y)*ev-(c.y-a.y)*dv)/det;
  const yy=((c.y-a.y)*du-(b.y-a.y)*eu)/det;
  ctx.save();
  triangle(a,b,c,.65);ctx.clip();
  ctx.transform(xx,yx,xy,yy,a.x-xx*u.u-xy*u.v,a.y-yx*u.u-yy*u.v);
  ctx.drawImage(textile,0,0);
  ctx.restore();
  if(arrival)return;
  const slope=((v.z-u.z)*(v.u-u.u)+(w.z-u.z)*(w.u-u.u))/1800;
  if(Math.abs(slope)>.015){
    triangle(a,b,c,.22);ctx.fillStyle=slope>0?'#ffe4b8':'#21131d';
    ctx.globalAlpha=Math.min(.31,Math.abs(slope));ctx.fill();ctx.globalAlpha=1;
  }
}
function createSurface(){
  const output=document.createElement('canvas');
  const settled=document.createElement('canvas'),settledContext=settled.getContext('2d');
  let settledReady=false;
  const gl=output.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
  if(!gl)return null;
  const program=gl.createProgram();
  function attach(type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program,shader);
  }
  attach(gl.VERTEX_SHADER,`
    attribute vec3 position;
    attribute vec2 uv;
    attribute vec3 normal;
    uniform vec2 size;
    varying vec2 texCoord;
    varying vec3 clothNormal;
    void main(){
      vec2 screen=vec2(position.x,position.y-position.z*.48);
      gl_Position=vec4(screen/size*vec2(2.,-2.)+vec2(-1.,1.),-position.z/256.,1.);
      texCoord=uv;clothNormal=normal;
    }`);
  attach(gl.FRAGMENT_SHADER,`
    precision mediump float;
    uniform sampler2D pattern;
    varying vec2 texCoord;
    varying vec3 clothNormal;
    void main(){
      vec3 n=normalize(clothNormal+vec3(0.,0.,.0001));
      float light=.72+.32*max(0.,dot(n,normalize(vec3(-.45,-.42,1.))));
      vec4 fabric=texture2D(pattern,texCoord);
      if(fabric.a<.12)discard;
      gl_FragColor=vec4(fabric.rgb*light,fabric.a);
    }`);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const nx=columns*2,ny=rows*2,stride=nx+1;
  const data=new Float32Array(stride*(ny+1)*8);
  const indices=new Uint16Array(nx*ny*6);
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
  for(const [name,count,offset] of [['position',3,0],['uv',2,12],['normal',3,20]]){
    const location=gl.getAttribLocation(program,name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location,count,gl.FLOAT,false,32,offset);
  }
  for(let y=0,k=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=y*stride+x,b=a+stride;
    indices.set([a,a+1,b,a+1,b+1,b],k);k+=6;
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const textures=new WeakMap(),meshes=new WeakMap();
  function bindTexture(piece){
    let texture=textures.get(piece);
    if(!texture){
      texture=gl.createTexture();textures.set(piece,texture);
      gl.bindTexture(gl.TEXTURE_2D,texture);
      for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
      for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,piece.textile);
    }else{
      gl.bindTexture(gl.TEXTURE_2D,texture);
      if(piece.dirty)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,piece.textile);
    }
    piece.dirty=false;
  }
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const size=gl.getUniformLocation(program,'size');
  const surfaceSampler=window.rugSurfaceSampler.create(columns,rows,2);
  const draw=()=>{
    if(gl.isContextLost())return false;
    const resized=output.width!==canvas.width||output.height!==canvas.height;
    if(resized){
      output.width=canvas.width;output.height=canvas.height;
      gl.viewport(0,0,output.width,output.height);
    }
    const stable=!arrival&&quiet>=12&&!grab&&!pieces.some(piece=>piece.dirty);
    if(resized||!stable||!settledReady){
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(size,W,H);
    for(const piece of pieces){
      bindPiece(piece);bindTexture(piece);
      let mesh=meshes.get(piece),changed=!mesh;
      if(!mesh){mesh={vertices:new Float32Array(data.length),nodes:new Float64Array(piece.nodes.length*4),ready:false};meshes.set(piece,mesh);}
      if(!changed)for(let i=0,j=0;i<piece.nodes.length;i++,j+=4){
        const p=piece.nodes[i];
        if(Math.abs(mesh.nodes[j]-p.x)>.05||Math.abs(mesh.nodes[j+1]-p.y)>.05||Math.abs(mesh.nodes[j+2]-p.z)>.05||mesh.nodes[j+3]!==Number(Boolean(p.contact))){changed=true;break;}
      }
      if(changed||!mesh.ready){
      surfaceSampler.fill(nodes,data);
      for(let y=0,k=0;y<=ny;y++)for(let x=0;x<=nx;x++,k+=8){
        const a=k-(x>0?8:0),b=k+(x<nx?8:0);
        const c=k-(y>0?stride*8:0),d=k+(y<ny?stride*8:0);
        const ux=data[b]-data[a],uy=data[b+1]-data[a+1],uz=data[b+2]-data[a+2];
        const vx=data[d]-data[c],vy=data[d+1]-data[c+1],vz=data[d+2]-data[c+2];
        data[k+5]=uy*vz-uz*vy;data[k+6]=uz*vx-ux*vz;data[k+7]=ux*vy-uy*vx;
      }
        mesh.vertices.set(data);
        for(let i=0,j=0;i<piece.nodes.length;i++,j+=4){const p=piece.nodes[i];mesh.nodes[j]=p.x;mesh.nodes[j+1]=p.y;mesh.nodes[j+2]=p.z;mesh.nodes[j+3]=Number(Boolean(p.contact));}
        mesh.ready=true;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.vertices);
      gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
    }
    if(stable){
      settled.width=output.width;settled.height=output.height;
      settledContext.drawImage(output,0,0);settledReady=true;
    }else settledReady=false;
    }
    ctx.save();
    ctx.drawImage(stable?settled:output,0,0,W,H);ctx.restore();
    return true;
  };
  draw.dispose=piece=>{
    meshes.delete(piece);
    const texture=textures.get(piece);
    if(texture){gl.deleteTexture(texture);textures.delete(piece);}
  };
  return draw;
}

let drawSurface;
function render(now){
  if(nativeDesktop)ctx.clearRect(0,0,W,H);
  else ctx.drawImage(floor,0,0,W,H);
  for(const f of folders){
    ctx.fillStyle='#93d7fb';ctx.fillRect(f.x-17,f.y-13,16,8);
    ctx.fillStyle='#50a2d8';ctx.fillRect(f.x-17,f.y-7,34,20);
    ctx.textAlign='center';ctx.font='12px system-ui';
    ctx.lineWidth=3;ctx.strokeStyle='#4d3321';ctx.strokeText(f.name,f.x,f.y+28);
    ctx.fillStyle='#fff';ctx.fillText(f.name,f.x,f.y+28);
  }
  if(arrival){
    const {cx,cy,width,height,at}=arrival;
    const a=clamp((now-at)/1040,0,1);
    ctx.save();ctx.translate(cx,cy);ctx.scale(width*.60,height*.62);
    const shadow=ctx.createRadialGradient(0,0,0,0,0,1);
    shadow.addColorStop(0,'rgba(31,20,18,'+a*.24+')');shadow.addColorStop(1,'rgba(31,20,18,0)');
    ctx.fillStyle=shadow;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  ctx.save();
  const kickAge=now-clothKick.at;
  if(kickAge<110){const strength=clothKick.strength*(1-kickAge/110);ctx.translate(Math.sin(kickAge*.16)*strength,Math.cos(kickAge*.12)*strength*.5);}
  if(!drawSurface?.())for(const piece of pieces){
    bindPiece(piece);
    faces.slice().sort((a,b)=>(a[0].z+a[1].z+a[2].z)-(b[0].z+b[1].z+b[2].z))
      .forEach(face=>texture(face,face.map(projected)));
  }
  ctx.restore();
}
function renderEffects(now){
  const ctx=effectContext;ctx.clearRect(0,0,W,H);
  renderScraps(now,ctx);
  breathingTrail.render(ctx,now,preferences.effectSize/100);
  compactEffects(streaks,now,'time',145);
  ctx.save();ctx.lineCap='round';
  for(const s of streaks){
    ctx.globalAlpha=1-(now-s.time)/145;
    ctx.strokeStyle=impactColors[s.action];
    ctx.lineWidth=2.25;
    ctx.beginPath();ctx.moveTo(s.a.x,s.a.y);ctx.lineTo(s.b.x,s.b.y);ctx.stroke();
    ctx.strokeStyle='#fff6dc';ctx.lineWidth=1;ctx.stroke();
  }
  ctx.restore();
  compactEffects(fibers,now);
  ctx.save();
  for(const fiber of fibers){
    const age=Math.max(0,(now-fiber.at)/1000);
    const height=Math.max(0,fiber.height+fiber.vz*age-650*age*age);
    const x=fiber.x+fiber.vx*age,y=fiber.y+fiber.vy*age-height*.48;
    ctx.globalAlpha=Math.min(1,(fiber.life-age*1000)/95);
    ctx.fillStyle=fiber.color;
    const radius=fiber.size*.38;
    ctx.beginPath();ctx.ellipse(x,y,radius*1.46,radius,Math.atan2(fiber.vy,fiber.vx),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  compactEffects(contactFlashes,now,'at',145);
  ctx.save();ctx.lineCap='round';
  for(const hit of contactFlashes){
    const a=clamp((now-hit.at)/145,0,1),r=2+9*a;
    ctx.save();ctx.translate(hit.x,hit.y);ctx.rotate(hit.angle);
    ctx.strokeStyle=hit.color;
    ctx.globalAlpha=(1-a)*.23;ctx.lineWidth=3.8;
    ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r,0);
    ctx.moveTo(0,-r*.45);ctx.lineTo(0,r*.45);ctx.stroke();
    ctx.globalAlpha=(1-a)*.88;ctx.lineWidth=1.15;ctx.stroke();
    ctx.fillStyle='#fff4da';
    ctx.beginPath();ctx.arc(0,0,1.25*(1-a),0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  fxRuntime.prune(effects,now);
  fxRenderer.draw(ctx,effects,now);
}
function selectAction(next){
  if(!actions.includes(next))return;
  action=next;
  for(const id of actions)$(id).setAttribute('aria-pressed',String(id===next));
  $('hint').textContent=nativeDesktop?'러그 위 좌클릭 이동 · 우클릭 베기 · Shift 입력 통과 · Ctrl+휠 크기':'좌클릭 이동 · 우클릭 베기 · Ctrl+휠 크기 · Ctrl+Shift+휠 검술';
}
function spawnEffect(point,angle,kind,at,now=at){
  const spec=fxSpecs[kind],image=atlas[kind];
  if(!spec||!image?.complete||!image.naturalWidth)return null;
  const limit=effectTuning[kind]?.limit??2;
  if(!fxRuntime.admit(effects,kind,limit,spec.life,now,effectTuning[kind]))return null;
  const sequence=effectSequence[kind]??0;
  const pose=fxRuntime.createPose(spec,angle,sequence);
  effectSequence[kind]=sequence+1;
  const effect={x:point.x,y:point.y,...pose,kind,spec,image,at,life:spec.life,
    scale:rugLayout.effectScale(kind,rugRestWidth,preferences.effectSize)*pose.variationScale,paintedFrame:-1};
  effects.push(effect);return effect;
}
// Move the existing cloth nodes at the cut in material space. A fold can have
// multiple layers at the same screen coordinate; only the picked layer is struck.
const impactBatch=window.rugImpactBatch.create(impactProfiles,{motion:'ripple'});
function strikeCloth(uv,point,angle,kind,now){impactBatch.enqueue(uv,point,angle,kind,now);}
function emitImpactVisual(hit){
  const {uv,point,angle,kind,profile,now}=hit;
  if(now-clothKick.at>110)clothKick.at=now;
  clothKick.strength=Math.min(2.4,(profile.lift??6)*.22);
  const isWater=kind==='water',spin=kind==='spin',nx=-Math.sin(angle),ny=Math.cos(angle);
  contactFlashes.push({...point,angle,at:now,color:impactColors[kind]});
  if(contactFlashes.length>18)contactFlashes.shift();
  const count=profile?.count??(isWater?4:10);
  const colors=profile?.colors??(isWater?['#c8aa75','#2c455a','#abecff']:spin?['#daffef','#8ce7b7','#355546']:['#c8aa75','#603832','#ffb35c']);
  for(let i=0;i<count;i++){
    const side=i%2?1:-1,spread=side*(20+Math.random()*45);
    const forward=15+Math.random()*33;
    fibers.push({x:point.x,y:point.y,height:5,vx:Math.cos(angle)*forward+nx*spread,
      vy:Math.sin(angle)*forward+ny*spread,vz:95+Math.random()*120,at:now,
      life:170+Math.random()*135,size:i%3===0?3:2,color:colors[i%colors.length]});
  }
  if(fibers.length>48)fibers.splice(0,fibers.length-48);
}
function flushImpacts(now){
  if(impactBatch.flush(now,emitImpactVisual)){hitGridValid=false;quiet=0;}
}

function wake(physics=true){
  if(physics)quiet=0;
  if(!frame&&!inTick){previous=performance.now();accumulator=16.67;frame=requestAnimationFrame(tick);}
}
function flushBladeMotion(){
  if(!blade)return;
  const pending=blade.pendingTrail;
  if(!pending?.length)return;
  for(let i=0;i<pending.length;i++)slash(pending[i]);
  pending.length=0;
  fxEmitter.flush(performance.now());
}
function compactEffects(list,now,key='at',life=0){
  let count=0;
  for(let i=0;i<list.length;i++)if(now-list[i][key]<(life||list[i].life))list[count++]=list[i];
  list.length=count;
}
let lastRenderedFrame=-Infinity,lastVisualFrame=-Infinity;
function tick(now){
  frame=0;inTick=true;
  // Cloth/hit work stays at its previous cadence. Only the lightweight VFX
  // layer follows display rAF, reusing the last rendered cloth below it.
  const clothStep=arrival?1000/60:1000/30;
  if(now-lastRenderedFrame>=clothStep-.25){
    lastRenderedFrame=Number.isFinite(lastRenderedFrame)?lastRenderedFrame+Math.max(1,Math.floor((now-lastRenderedFrame+.25)/clothStep))*clothStep:now;
    accumulator+=Math.min(33.34,now-previous);previous=now;
    if(arrival){hitGridValid=false;unfoldRug(now);accumulator=0;}
    else{
      flushBladeMotion();
      applyEffectContacts(now);flushImpacts(now);settleCuts(now);
      while(accumulator>=16.67){if(quiet<12||grab)simulate(now-accumulator+16.67);accumulator-=16.67;}
    }
    render(now);
  }
  const visualStep=1000/60;
  if(now-lastVisualFrame>=visualStep-.25){
    lastVisualFrame=Number.isFinite(lastVisualFrame)?lastVisualFrame+Math.max(1,Math.floor((now-lastVisualFrame+.25)/visualStep))*visualStep:now;
    renderEffects(now);
  }
  inTick=false;
  if(arrival||quiet<12||breathingTrail.hasActive()||streaks.length||effects.length||fibers.length||contactFlashes.length||scraps.length||blade?.pendingTrail.length||(!grab&&!blade&&pieces.some(piece=>piece.cutPending)))frame=requestAnimationFrame(tick);
}
const hitGrid=window.rugHitGrid.create(64);
let hitGridValid=false;
function locate(p){
  if(!hitGridValid){hitGrid.rebuild(pieces);hitGridValid=true;}
  return hitGrid.locate(p,TEX_WIDTH,TEX_HEIGHT);
}

function publishRugHover(hit,buttons=0){
  if(!nativeDesktop)return;
  const next=!!hit&&!buttons;
  if(nativeHoverState===next)return;
  nativeHoverState=next;nativeDesktop.setHover(next);
}
function pointer(e){
  const rect=canvas.getBoundingClientRect();
  return {x:e.clientX-rect.left,y:e.clientY-rect.top,time:performance.now()};
}
function updateCutCursor(){
  if(!nativeDesktop)return;
  const armed=nativeCutArmed||blade?.buttonMask===1;
  document.body.classList.toggle('cut-armed',armed);
  if(armed&&!grab)canvas.style.cursor='crosshair';
  else if(!blade&&!grab&&canvas.style.cursor==='crosshair')canvas.style.cursor='';
}
function stopBlade(){
  const id=blade?.id;blade=null;fxEmitter.stop();
  if(id===undefined)return;
  canvas.style.cursor='';
  updateCutCursor();
  if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
}
function materialPoint(p){return locate(p)?.uv??null;}
function connectedMaterial(a,b){
  return Boolean(a&&b&&a.piece===b.piece&&Math.hypot(a.x-b.x,a.y-b.y)<48);
}
function cutBoundary(inside,outside,uv){
  let lo=inside,hi=outside;
  for(let i=0;i<7;i++){
    const point={x:(lo.x+hi.x)*.5,y:(lo.y+hi.y)*.5};
    const hit=materialPoint(point);
    if(connectedMaterial(uv,hit)){lo=point;uv=hit;}
    else hi=point;
  }
  return uv;
}
function worldEffectPoint(fx,x,y){return fxRuntime.worldPoint(fx,x,y);}

function addCut(cuts,from,to){
  if(!cuts.has(to.piece))cuts.set(to.piece,[]);
  cuts.get(to.piece).push([from,to]);
}
function paintCuts(cuts,kind,width){
  const fineRim=preciseCuts.has(kind)&&kind!=='insect';
  for(const [piece,segments] of cuts){
    const ink=piece.ink;
    ink.save();ink.lineCap='round';ink.lineJoin='round';ink.beginPath();
    let previous=null;
    const marks=piece.cutMarks??=[];
    for(const [a,b] of segments){
      if(previous!==a)ink.moveTo(a.x,a.y);
      ink.lineTo(b.x+(a===b?.01:0),b.y);
      marks.push({a,b,kind,width});
      previous=b;
    }
    if(marks.length>128)marks.splice(0,marks.length-128);
    ink.globalCompositeOperation='source-atop';
    ink.globalAlpha=kind==='zap'?.68:['ember','hinokami'].includes(kind)?.48:fineRim?.22:.32;
    ink.strokeStyle=kind==='zap'?'#6c4a21':['ember','hinokami'].includes(kind)?'#af603f':impactColors[kind];
    ink.lineWidth=width+(fineRim?2:4);ink.stroke();
    ink.globalAlpha=1;ink.globalCompositeOperation='destination-out';
    ink.strokeStyle='#000';ink.lineWidth=width;ink.stroke();ink.restore();
    piece.dirty=true;piece.cutPending=true;
  }
}

function applyPaintedContacts(fx,now,cutsByKind,reactions,budget){
  const frame=Math.round(fxRuntime.framePosition(fx,now));
  if(frame<0||frame===fx.paintedFrame)return budget;
  // Do not replay stale contact frames after a delayed desktop frame.
  fx.paintedFrame=frame;
  const segments=paintedContactFrames[fx.kind]?.[frame];
  if(!segments)return budget;
  const selected=fx.kind==='stone'?segments.filter((_,i)=>i%2===frame%2).slice(0,5):segments;
  for(const [ax,ay,bx,by]of selected){
    if(budget<=0)break;
    budget--;
    const a=worldEffectPoint(fx,ax,ay),b=worldEffectPoint(fx,bx,by);
    const auv=materialPoint(a),buv=materialPoint(b);
    if(!auv&&!buv)continue;
    if(!cutsByKind.has(fx.kind))cutsByKind.set(fx.kind,new Map());
    const cuts=cutsByKind.get(fx.kind);
    if(connectedMaterial(auv,buv))addCut(cuts,auv,buv);
    else{if(auv)addCut(cuts,auv,auv);if(buv)addCut(cuts,buv,buv);}
    reactions.push({uv:buv??auv,p:buv?b:a,angle:Math.atan2(b.y-a.y,b.x-a.x),kind:fx.kind});
  }
  return budget;
}

function applyEffectContacts(now){
  const cutsByKind=new Map(),reactions=[];
  let paintedBudget=48;
  for(const fx of effects){
    if(!fx.image.complete||!fx.image.naturalWidth||fxRuntime.expired(fx,now)||fxRuntime.opacity(fx,now)<.04)continue;
    paintedBudget=applyPaintedContacts(fx,now,cutsByKind,reactions,paintedBudget);
  }
  for(const [kind,cuts] of cutsByKind)paintCuts(cuts,kind,edgeWidths[kind]);
  for(const hit of reactions)strikeCloth(hit.uv,hit.p,hit.angle,hit.kind,now);
  // Cloth wake-up is decided by the aggregated impulse, not by cut sample count.
}

function hasPendingCuts(fx,now){
  if(fxRuntime.expired(fx,now))return false;
  return now-fx.at<fx.life*.73;
}

function settleCuts(frameTime){
  if(blade||grab||!pieces.some(piece=>piece.cutPending))return;
  if(frameTime===undefined){wake();return;}
  if(effects.some(fx=>hasPendingCuts(fx,frameTime)))return;
  finishCuts();
}

function slash(end){
  const start=blade.last;
  const distance=Math.hypot(end.x-start.x,end.y-start.y);
  if(distance<.4)return;
  const count=Math.min(128,Math.ceil(distance/4));
  let previous=blade.tailUV===undefined?materialPoint(start):blade.tailUV,last=start,changed=false;
  const now=performance.now(),endTime=Math.min(now,end.time??now),startTime=Math.max(endTime-90,Math.min(endTime,start.time??endTime));
  const cuts=new Map();
  const width=['ember','hinokami'].includes(blade.action)?11:8;
  const followsPointer=true;
  for(let i=1;i<=count;i++){
    const t=i/count,p={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};
    const uv=materialPoint(p);
    if(uv){
      if(!previous||!connectedMaterial(previous,uv))breathingTrail.breakPath();
      else breathingTrail.append(last,now);
      breathingTrail.append(p,now);
    }else breathingTrail.breakPath();
    if(followsPointer){
      if(connectedMaterial(previous,uv)){
        addCut(cuts,previous,uv);

      }else{
        if(previous)addCut(cuts,previous,cutBoundary(last,p,previous));
        if(uv)addCut(cuts,cutBoundary(p,last,uv),uv);
      }
    }
    if(uv)changed=true;
    fxEmitter.sample(uv?p:null,startTime+(endTime-startTime)*t);
    previous=uv;last=p;
  }
  if(cuts.size)paintCuts(cuts,blade.action,width);
  if(changed||cuts.size)wake(false);
  if(streaks.length>200)streaks.splice(0,streaks.length-200);
  blade.last=end;blade.tailUV=previous;
}
const breathingController=!settingsOnly?window.rugBreathingUI.create({
  canvas,actions,skills,toast:$('skillToast'),sizeToast:$('sizeToast'),getAction:()=>action,
  isArmed:()=>nativeCutArmed,canSwitch:()=>!grab&&!blade&&!arrival&&!document.querySelector('dialog[open]'),
  resizeBy:changeRugSize,
  selectAction,syncAction:next=>nativeDesktop?.setAction(next)
}):null;
canvas.oncontextmenu=e=>e.preventDefault();
canvas.onpointerdown=e=>{
  if(arrival||grab||blade)return;
  if(nativeDesktop && !(nativeCutArmed||nativeMoveArmed))return;
  const ctrlCut=e.button===0&&e.pointerType==='mouse'&&(e.ctrlKey||nativeCutArmed);
  if(e.button===2||ctrlCut){
    e.preventDefault();
    breathingTrail.start(action);fxEmitter.start(action);
    blade={id:e.pointerId,buttonMask:ctrlCut?1:2,last:pointer(e),action,
      lastEffect:-Infinity,nextImpact:0,cutLength:0,pendingTrail:[]};
    canvas.setPointerCapture(e.pointerId);canvas.style.cursor='crosshair';
    updateCutCursor();
    return;
  }
  if(e.button!==0)return;
  const p=pointer(e),hit=locate(p);
  if(!hit){
    const folder=folders.find(f=>Math.abs(p.x-f.x)<24&&p.y>=f.y-16&&p.y<=f.y+31);
    if(folder){$('folderName').textContent=folder.name;$('explorer').showModal();}
    return;
  }
  const anchorIndex=hit.weights.indexOf(Math.max(...hit.weights)),anchor=hit.face[anchorIndex];
  const tethers=hit.piece.active.filter(n=>!hit.face.includes(n)).map(n=>[n,Math.hypot(n.rx-anchor.rx,n.ry-anchor.ry)*1.03+4]);
  grab={...hit,anchorIndex,tethers,id:e.pointerId,target:p,follow:{...p},lift:clamp(W*.095,27,78)};
  canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
  wake();
};
canvas.onpointermove=e=>{
  const p=pointer(e);
  if(blade?.id===e.pointerId){
    if(!(e.buttons&blade.buttonMask)){
      stopBlade();settleCuts();return;
    }
    if(blade.pendingTrail.length<8)blade.pendingTrail.push(p);
    else blade.pendingTrail[7]=p;
    wake(false);return;
  }
  if(grab?.id===e.pointerId){
    if(!(e.buttons&1)){release();wake();return;}
    grab.target={x:clamp(p.x,3,W-3),y:clamp(p.y,8,H-48)};wake();
  }else if(!grab&&e.pointerType==='mouse'){
    const hit=Boolean(locate(p));
    canvas.style.cursor=nativeCutArmed||(!nativeDesktop&&e.ctrlKey)?'crosshair':hit?'grab':'default';
    publishRugHover(hit,e.buttons);

  }
};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{
  if(blade?.id===e.pointerId){
    if(e.type==='pointerup'){flushBladeMotion();slash(pointer(e));fxEmitter.flush(performance.now());}
    stopBlade();settleCuts();
  }
  if(grab?.id===e.pointerId){release();wake();}
  if(!grab&&!blade)publishRugHover(Boolean(locate(pointer(e))),e.buttons);
};
canvas.addEventListener('mousemove',e=>{if(!grab&&!blade)publishRugHover(Boolean(locate(pointer(e))),e.buttons);});
nativeDesktop?.onHoverProbe?.(point=>{if(!grab&&!blade)publishRugHover(Boolean(locate(point)),point.buttons);});
canvas.addEventListener('pointerleave',()=>{if(!grab&&!blade)publishRugHover(false);});
window.addEventListener('blur',()=>{stopBlade();settleCuts();if(grab){release();wake();}publishRugHover(false);});
nativeDesktop?.onReset(()=>reset(true));
nativeDesktop?.onAction(selectAction);
nativeDesktop?.onInputMode(mode=>{
  nativeCutArmed=mode==='cut';nativeMoveArmed=mode==='move';
  updateCutCursor();
});
for(const id of actions)$(id).onclick=()=>selectAction(id);
nativeDesktop?.onSuspend(()=>{stopBlade();settleCuts();if(grab){release();wake();}publishRugHover(false);});
if(nativeDesktop)document.body.classList.add('native-rug');
$('reset').onclick=()=>reset(true);
window.addEventListener('keydown',event=>{
  if(nativeDesktop||event.repeat||!event.ctrlKey||!event.shiftKey||event.altKey||event.metaKey||event.code!=='KeyR')return;
  if(document.querySelector('dialog[open]'))return;
  event.preventDefault();
  reset(true);
});
try { drawSurface=createSurface(); } catch (error) { console.warn(error); }
new ResizeObserver(resize).observe(canvas);
if(nativeDesktop){
  nativeDesktop.onPreferences(value=>{void applyPreferences(value).catch(console.warn);});
  nativeDesktop.getPreferences().then(value=>applyPreferences({...value,defaultSkill:'water'})).catch(console.warn);
}else{
  window.RugSettingsUI.mount({bridge:nativeDesktop,atlasStore,defaultArtSource,getPreferences:()=>preferences,applyPreferences,onOpen:()=>{stopBlade();release();settleCuts();}});
  void applyPreferences({...readWebPreferences(),defaultSkill:'water'});
}
})();
