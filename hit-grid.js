// Screen-space broad phase. Keep exact triangle/alpha tests for the nearby candidates.
(function(root){
function create(cellSize=64){
 const cells=new Map(),entries=[],used=[];let count=0;
 const stats={builds:0,queries:0,tests:0};
 function rebuild(pieces){
  for(let i=0;i<used.length;i++)used[i].length=0;used.length=0;count=0;
  for(const piece of pieces)for(const face of piece.faces){
   const a=face[0],b=face[1],c=face[2],ax=a.x,ay=a.y-a.z*.48,bx=b.x,by=b.y-b.z*.48,cx=c.x,cy=c.y-c.z*.48;
   const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<.01)continue;
   let e=entries[count];if(!e)e=entries[count]={};count++;
   e.piece=piece;e.face=face;e.ux=(by-cy)/area;e.uy=(cx-bx)/area;e.uc=(bx*cy-by*cx)/area;
   e.vx=(cy-ay)/area;e.vy=(ax-cx)/area;e.vc=(cx*ay-cy*ax)/area;
   e.left=Math.min(ax,bx,cx);e.right=Math.max(ax,bx,cx);e.top=Math.min(ay,by,cy);e.bottom=Math.max(ay,by,cy);
   const pad=Math.max(.002,(e.right-e.left+e.bottom-e.top)*.002);
   e.left-=pad;e.right+=pad;e.top-=pad;e.bottom+=pad;
   for(let y=Math.floor(e.top/cellSize);y<=Math.floor(e.bottom/cellSize);y++)for(let x=Math.floor(e.left/cellSize);x<=Math.floor(e.right/cellSize);x++){
    const key=x+','+y;let bucket=cells.get(key);if(!bucket){bucket=[];cells.set(key,bucket)}
    if(!bucket.length)used.push(bucket);bucket.push(e);
   }
  }
  // Trim unused face records and old empty grid cells so split pieces can be collected.
  entries.length=count;
  if(cells.size>used.length*2+64)for(const [key,bucket]of cells)if(!bucket.length)cells.delete(key);
  stats.builds++;
 }
 function locate(p,textureWidth,textureHeight){
  stats.queries++;const bucket=cells.get(Math.floor(p.x/cellSize)+','+Math.floor(p.y/cellSize));if(!bucket)return null;
  let best=null,bestHeight=-Infinity,bu=0,bv=0;
  for(let i=0;i<bucket.length;i++){
   const e=bucket[i];if(p.x<e.left-.001||p.x>e.right+.001||p.y<e.top-.001||p.y>e.bottom+.001)continue;
   stats.tests++;const u=e.ux*p.x+e.uy*p.y+e.uc,v=e.vx*p.x+e.vy*p.y+e.vc,w=1-u-v;
   if(u<-.001||v<-.001||w<-.001)continue;
   const face=e.face,z=face[0].z*u+face[1].z*v+face[2].z*w;if(z<bestHeight)continue;
   const x=face[0].u*u+face[1].u*v+face[2].u*w,y=face[0].v*u+face[1].v*v+face[2].v*w;
   const tx=Math.max(0,Math.min(textureWidth-1,Math.floor(x))),ty=Math.max(0,Math.min(textureHeight-1,Math.floor(y)));
   if(e.piece.mask&&e.piece.mask[(ty*textureWidth+tx)*4+3]<32)continue;
   best=e;bestHeight=z;bu=u;bv=v;
  }
  if(!best)return null;const face=best.face,bw=1-bu-bv;
  return {face,weights:[bu,bv,bw],height:bestHeight,piece:best.piece,uv:{x:face[0].u*bu+face[1].u*bv+face[2].u*bw,y:face[0].v*bu+face[1].v*bv+face[2].v*bw,piece:best.piece}};
 }
 return {rebuild,locate,stats};
}
const api={create};root.rugHitGrid=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
