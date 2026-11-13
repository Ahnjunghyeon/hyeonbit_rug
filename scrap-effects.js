// Bounded, reusable cloth-fragment disappearance renderer. No per-frame canvases or pixel scans.
(function(root){
const styles={
 hinokami:{type:'fire',life:940,tint:'#8c1829',edge:'#ffe1a0',motes:'#ff8e51',lift:-28},
 ember:{type:'fire',life:880,tint:'#53302d',edge:'#ffd583',motes:'#ff8d37',lift:-23},
 zap:{type:'electric',life:670,tint:'#4e362d',edge:'#fff5a5',motes:'#ffd958',lift:-7},
 water:{type:'water',life:1050,tint:'#163b69',edge:'#9be7ff',motes:'#56c3ff',lift:15},
 spin:{type:'wind',life:780,tint:'#244e3d',edge:'#baffce',motes:'#63da98',lift:-14},
 mist:{type:'mist',life:1180,tint:'#a5c4d0',edge:'#e1f0ee',motes:'#bfdde0',lift:-20},
 insect:{type:'butterfly',life:970,tint:'#67417e',edge:'#edd6ff',motes:'#cba1ff',lift:-17},
 love:{type:'petal',life:960,tint:'#a84d74',edge:'#ffe3f2',motes:'#ff9fca',lift:-12},
 serpent:{type:'serpent',life:900,tint:'#3e195f',edge:'#c898ff',motes:'#a365e6',lift:-9},
 sound:{type:'sound',life:780,tint:'#3b635f',edge:'#f5e3a8',motes:'#89d9cd',lift:-8},
 stone:{type:'stone',life:850,tint:'#65563f',edge:'#ecd59f',motes:'#a68b5a',lift:21}
};
const clamp=x=>Math.max(0,Math.min(1,x));
function prepare(scrap,makeCanvas){
 const c=makeCanvas();c.width=scrap.image.width;c.height=scrap.image.height;
 const g=c.getContext('2d');g.drawImage(scrap.image,0,0);g.globalCompositeOperation='source-atop';
 g.fillStyle=scrap.style.tint;g.globalAlpha=.78;g.fillRect(0,0,c.width,c.height);scrap.tinted=c;
 scrap.motes=Array.from({length:12},(_,i)=>{const a=Math.sin((i+1)*74.13+scrap.x*.03)*4375;return [(a%1+1)%1,((a*.37)%1+1)%1,((a*.63)%1+1)%1]});
 return scrap;
}
function cloth(g,s,t){
 const {style,image,tinted,width:w,height:h}=s,type=style.type;
 let sx=1,sy=1;
 if(type==='water')sy=1-.48*t;
 if(type==='mist'){sx=1+t*.22;sy=1-t*.13;}
 if(type==='wind'||type==='beast')sx=1-t*.42;
 if(type==='stone')sy=1-t*.16;
 const front=-h*.5+(h+12)*clamp((t-.08)/.85),burn=type==='fire'||type==='electric';
 g.save();g.scale(sx,sy);g.globalAlpha=(1-t)**(type==='mist'?1.1:.65);
 if(burn){g.beginPath();g.moveTo(-w*.6,h*.6);g.lineTo(-w*.6,front);for(let i=0;i<=10;i++)g.lineTo(-w*.5+w*i/10,front+Math.sin(i*2.7+t*16)*3);g.lineTo(w*.6,h*.6);g.closePath();g.clip();}
 // Make scraps shear into narrow strips for slicing styles, with fixed count draw calls.
 if(['wind','beast','serpent'].includes(type)){
  const strips=5,source=image.width/strips;
  for(let i=0;i<strips;i++){
   const dx=(i-2)*t*(type==='beast'?9:5),dy=Math.sin(i*2+t*4)*t*8;
   g.drawImage(image,i*source,0,source,image.height,-w*.5+i*w/strips+dx,-h*.5+dy,w/strips+.5,h);
  }
 }else g.drawImage(image,-w*.5,-h*.5,w,h);
 if(!['wind','beast','serpent'].includes(type)){
  g.globalAlpha*=t*.8;g.drawImage(tinted,-w*.5,-h*.5,w,h);
 }
 g.restore();return front;
}
function accent(g,s,t,front){
 const {style,width:w,height:h,motes}=s,type=style.type;
 g.strokeStyle=style.edge;g.fillStyle=style.motes;g.lineWidth=1;
 if(type==='fire')for(let i=0;i<7;i++){
  const x=(i/6-.5)*w,y=front+Math.sin(i*2.7+t*16)*3,len=(9+7*Math.sin(i*7+t*23))*(1-t);
  g.globalAlpha=(1-t)*.8;g.fillStyle=i%2?style.edge:style.motes;g.beginPath();g.moveTo(x-3,y+2);g.quadraticCurveTo(x-7,y-len*.4,x+3,y-len);g.quadraticCurveTo(x+1,y-len*.2,x+4,y+2);g.fill();
 }
 if(type==='electric'&&t<.85){
  g.globalAlpha=(1-t)*.95;g.lineWidth=1.25;
  for(let k=0;k<2;k++){g.beginPath();for(let i=0;i<9;i++){const x=(i/8-.5)*w*1.2,y=front+Math.sin(i*5+Math.floor(t*22)+k*3)*(4+k*2);i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()}
 }
 if(type==='water'){
  g.globalAlpha=(1-t)*.5;g.beginPath();g.ellipse(0,h*.48+t*12,w*(.3+t*.3),2+t*3,0,0,Math.PI*2);g.stroke();
 }
 if(type==='wind'||type==='serpent'||type==='sound'){
  const rings=type==='sound'?3:2;
  for(let i=0;i<rings;i++){g.globalAlpha=(1-t)*(.4-i*.07);g.beginPath();g.ellipse(0,Math.sin(t*4+i)*4,w*(.5+t*.4)+i*4,h*.35+i*3,-.3,0,type==='sound'?Math.PI*2:Math.PI*1.55);g.stroke();}
 }
 if(type==='mist')for(let i=0;i<3;i++){
  g.globalAlpha=(1-t)*.18;g.fillStyle=style.motes;g.beginPath();g.ellipse(Math.sin(t*4+i*3)*10,(i-1)*h*.23,w*(.45+t*.3),3+t*5,.1*Math.sin(i),0,Math.PI*2);g.fill();
 }
 if(type==='water')for(let i=0;i<3;i++){g.globalAlpha=(1-t)*.38;g.beginPath();g.arc((i-1)*w*.23, h*.1-t*20-i*3,1.5+t*2,0,Math.PI*2);g.stroke();}
 if(type==='mist'){g.globalAlpha=(1-t)*.12;for(let i=0;i<2;i++)g.drawImage(s.tinted,-w*.5+(i?1:-1)*t*12,-h*.5-t*7,w*(1+t*.2),h);}
 if(type==='stone'&&t<.7){g.globalAlpha=(1-t)*.55;for(let i=0;i<3;i++){g.beginPath();g.moveTo((i-1)*w*.25,-h*.3);g.lineTo((i-1)*w*.25+4,0);g.lineTo((i-1)*w*.25-3,h*.3);g.stroke();}}
 for(let i=0;i<motes.length;i++){
  const [x,y,p]=motes[i],age=t-y*.4;if(age<0||age>.7)continue;
  const down=type==='water'||type==='stone',px=(x-.5)*w+(x-.5)*age*35,py=(down?h*.3:front*.6)+(down?1:-1)*age*(type==='stone'?55:32);
  g.globalAlpha=(1-age/.7)*(1-t);g.fillStyle=style.motes;
  if(type==='butterfly'){
   g.save();g.translate(px,py);g.rotate(Math.sin(age*8+i)*.6);const wing=2.5+Math.sin(age*28)*1.1;
   g.beginPath();g.ellipse(-wing*.6,0,wing,1.6,-.6,0,Math.PI*2);g.ellipse(wing*.6,0,wing,1.6,.6,0,Math.PI*2);g.fill();g.restore();
  }else if(type==='petal'){
   g.save();g.translate(px,py);g.rotate(age*5+x*6);g.beginPath();g.moveTo(-3,0);g.quadraticCurveTo(0,-4,3,0);g.quadraticCurveTo(0,3,-3,0);g.fill();g.restore();
  }else if(type==='stone'||type==='beast'){
   g.save();g.translate(px,py);g.rotate(age*4+i);g.fillRect(-1.4,-1,2.8,2);g.restore();
  }else if(type==='water'){
   g.beginPath();g.ellipse(px,py,1.1,2.1+age*2,0,0,Math.PI*2);g.fill();
  }else{g.beginPath();g.arc(px,py,p>.65?1.4:.9,0,Math.PI*2);g.fill();}
 }
}
function render(g,scraps,now){
 let write=0;
 for(let i=0;i<scraps.length;i++){
  const s=scraps[i];if(now-s.at>=s.style.life){s.image=null;s.tinted=null;continue;}
  scraps[write++]=s;const t=clamp((now-s.at)/s.style.life);
  g.save();g.translate(s.x+s.direction*(11*t+6*Math.sin(t*2.4)),s.y+s.style.lift*t-7*Math.sin(Math.PI*t));g.rotate(s.angle+s.direction*t*.2);
  const front=cloth(g,s,t);accent(g,s,t,front);g.restore();
 }
 scraps.length=write;
}
const api={styles,prepare,render,limits:{scraps:8,motes:12}};root.rugScrapEffects=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
