// Fixed Catmull-Rom stencils shared by X/Y/Z. No closures or temporary weights during fill.
(function(root){
function basis(t){const t2=t*t,t3=t2*t;return [-.5*t+t2-.5*t3,1-2.5*t2+1.5*t3,.5*t+2*t2-1.5*t3,-.5*t2+.5*t3]}
function create(cols,rows,subdivision=3){
 const nx=cols*subdivision,ny=rows*subdivision,stencils=[];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
  const u=x/subdivision,v=y/subdivision,ix=Math.floor(u),iy=Math.floor(v),wx=basis(u-ix),wy=basis(v-iy);
  const indices=new Uint16Array(16),weights=new Float64Array(16);
  for(let j=0,k=0;j<4;j++)for(let i=0;i<4;i++,k++){indices[k]=clamp(iy+j-1,0,rows)*(cols+1)+clamp(ix+i-1,0,cols);weights[k]=wx[i]*wy[j];}
  const col=Math.min(cols-1,Math.floor(u)),row=Math.min(rows-1,Math.floor(v)),a=row*(cols+1)+col,du=u-col,dv=v-row;
  stencils.push({indices,weights,flat:[a,a+1,a+cols+1,a+cols+2],blend:du+dv<=1?[1-du-dv,du,dv,0]:[0,1-dv,1-du,du+dv-1],u:x/nx,v:y/ny});
 }
 function fill(nodes,data){
  for(let i=0,k=0;i<stencils.length;i++,k+=8){
   const s=stencils[i];let x=0,y=0,z=0;
   for(let j=0;j<16;j++){const p=nodes[s.indices[j]],w=s.weights[j];x+=p.x*w;y+=p.y*w;z+=p.z*w;}
   let contact=0;for(let j=0;j<4;j++)if(nodes[s.flat[j]].contact)contact+=s.blend[j];
   const amount=Math.min(1,2*contact);
   if(amount){let fx=0,fy=0,fz=0;for(let j=0;j<4;j++){const p=nodes[s.flat[j]],w=s.blend[j];fx+=p.x*w;fy+=p.y*w;fz+=p.z*w;}x+=(fx-x)*amount;y+=(fy-y)*amount;z+=(fz-z)*amount;}
   data[k]=x;data[k+1]=y;data[k+2]=Math.max(0,z);data[k+3]=s.u;data[k+4]=s.v;
  }
 }
 return {fill,vertexCount:stencils.length};
}
const api={create};root.rugSurfaceSampler=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
