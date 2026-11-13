// Pure geometry scaling: cut textures, material UVs and split pieces are retained.
(function(root){
const axes=[['x','px','sx','rx','frameX'],['y','py','sy','ry','frameY'],['z','pz','sz','frameZ']];
function scalePieces(pieces,factor){
 if(!Number.isFinite(factor)||factor<=0||factor===1)return false;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const piece of pieces)for(const p of piece.active){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);}
 if(!Number.isFinite(left))return false;
 const centers=[(left+right)/2,(top+bottom)/2,0];
 for(const piece of pieces){
  for(const p of piece.nodes){
   for(let a=0;a<3;a++)for(const key of axes[a])if(Number.isFinite(p[key]))p[key]=centers[a]+(p[key]-centers[a])*factor;
   for(const key of ['vx','vy','vz'])if(Number.isFinite(p[key]))p[key]*=factor;
   if(Number.isFinite(p.flutterLift))p.flutterLift*=factor;
  }
  for(const link of piece.links)link.length*=factor;
 }
 return true;
}
const api={scalePieces};root.rugResize=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
