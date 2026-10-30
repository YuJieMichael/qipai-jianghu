import {normalizeEventType} from './choreography.mjs';

const TAU=Math.PI*2;
const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:lo));
const smooth=n=>{const q=clamp(n);return q*q*(3-2*q);};
const mix=(a,b,p)=>a+(b-a)*p;
const point=(x,y)=>[clamp(x,12,988),clamp(y,112,452)];
const swordTypes=['sword','swordFocus','swordEcho','swordArray'];
const poisonTypes=['poisonApply','poisonTick','burst'];
const guardTypes=['shield','counter'];

/** Resolve only identities in the currently visible state, never a future snapshot. */
export function effectAnchors(event={},enemies=[]){
 const xs=enemies.length===1?[700]:enemies.length===2?[635,835]:[560,735,905];
 const positions=new Map([['hero',220],...enemies.slice(0,3).map((enemy,index)=>[enemy.id,xs[index]])]);
 const ids=event.targetIds?.length?event.targetIds:['hero'];
 return {sourceX:positions.get(event.sourceId||'hero')??null,targets:[...new Set(ids)].filter(id=>positions.has(id)).map(id=>({id,x:positions.get(id)}))};
}

/** A shallow focus move, independent of shake. Its endpoints are exactly at rest. */
export function sampleCameraFocus(event={},progress=0,anchors={},options={}){
 const rest={x:0,y:0,scale:1},p=clamp(progress),type=normalizeEventType(event);
 if(options.reducedMotion||p===0||p===1||!anchors.targets?.length)return rest;
 const heavy=['swordArray','burst','counter','break'].includes(type),hit=heavy||['strike','hurt','sword','swordFocus','swordEcho'].includes(type);
 if(!hit)return rest;
 const strength=heavy?1:.45,envelope=smooth(p/.43)*(1-smooth((p-.62)/.38)),target=anchors.targets.reduce((n,t)=>n+t.x,0)/anchors.targets.length;
 return {x:clamp((500-target)*.018,-5,5)*envelope*strength,y:envelope*strength,scale:1+.016*envelope*strength};
}

/** School-specific geometry is deterministic, screen-bounded and presentation-only. */
export function sampleSchoolEffect(event={},progress=0,anchors={},options={}){
 const p=clamp(progress),type=normalizeEventType(event),local=Boolean(options.reducedMotion),sx=anchors.sourceX??220;
 const effect={family:swordTypes.includes(type)?'sword':poisonTypes.includes(type)?'poison':guardTypes.includes(type)?'guard':'none',stage:type,alpha:Math.min(1,p*6,(1-p)*5),blades:[],trails:[],pools:[],veins:[],petals:[],plates:[],cuts:[],contactAlpha:clamp((p-.43)/.22)};
 if(effect.family==='none'||anchors.sourceX===null)return effect;
 const impact=smooth((p-.43)/.57);
 for(const target of anchors.targets||[]){const tx=target.x,ty=335;
  if(effect.family==='sword'){
   const array=type==='swordArray',focus=type==='swordFocus',echo=type==='swordEcho',count=array?9:echo?5:focus?1:3;
   for(let i=0;i<count;i++){
    const a=-Math.PI*.92+i*Math.PI*.84/(count-1||1),origin=array?point(sx+Math.cos(a)*116+26,212+Math.sin(a)*66):point(sx+42,327+(i-(count-1)/2)*17),q=local?1:smooth((p-(array?.32:.14)-i*.014)/(array?.36:.53));
    const end=point(tx+(i-(count-1)/2)*(array?3:6),ty+(i-(count-1)/2)*7),control=point((origin[0]+tx)/2,Math.min(origin[1],ty)-(array?29:34)),x=local?tx+(i-(count-1)/2)*9:(1-q)**2*origin[0]+2*(1-q)*q*control[0]+q*q*end[0],y=local?ty+(i-(count-1)/2)*9:(1-q)**2*origin[1]+2*(1-q)*q*control[1]+q*q*end[1];
    const position=point(x,y),angle=local?-.65:Math.atan2(end[1]-control[1],end[0]-control[0]);
    effect.blades.push({x:position[0],y:position[1],angle,length:focus?78:array?46:40,alpha:q===1?1-impact*.8:1});
    if(q>0&&!local)effect.trails.push({points:[origin,control,position],width:focus?7:array?2.2:3.5,alpha:.32*(1-impact*.65)});
   }
   if(array){effect.pools.push({x:clamp(sx+25,94,906),y:433,rx:86,ry:19,kind:'formation'});}
   if(p>.43)effect.cuts.push({x:tx,y:ty,length:focus?90:array?72:47,alpha:Math.sin(impact*Math.PI),angle:-.9});
  }
  if(effect.family==='poison'){
   effect.stage=type==='poisonApply'?'attach':type==='poisonTick'?'erode':'detonate';
   effect.pools.push({x:tx,y:433,rx:type==='burst'?40+impact*44:type==='poisonTick'?40:29,ry:type==='burst'?11+impact*11:10,kind:'poison'});
   if(type==='poisonApply')for(let i=0;i<5;i++){
    const q=local?1:smooth((p-.1)/.56),x=mix(sx+28,tx,q),y=ty+(i-2)*11;
    effect.blades.push({x,y,angle:tx>=sx?0:Math.PI,length:22,alpha:1-impact});
   }
   const count=type==='burst'?8:5;
   for(let i=0;i<count;i++){
    const a=i*TAU/count,x=tx+Math.cos(a)*23,y=ty+Math.sin(a)*51;
    effect.veins.push([point(x,y-12),point(x-6,y+3),point(x+2,y+16),point(x-5,y+26)]);
   }
   if(type==='burst')for(let i=0;i<12;i++){
    const a=i*TAU/12,r=local?37:24+impact*70;
    effect.petals.push([point(tx+Math.cos(a)*r,ty+Math.sin(a)*r*.83),point(tx+Math.cos(a+.11)*(r+22),ty+Math.sin(a+.11)*(r+22)*.83),point(tx+Math.cos(a-.08)*(r+30),ty+Math.sin(a-.08)*(r+30)*.83)]);
   }
  }
  if(effect.family==='guard'){
   const reflect=type==='counter',block=!reflect&&event.value<0;
   effect.stage=reflect?'reflect':block?'block':'raise';
   const x=reflect?sx:block?tx+(sx<tx?-35:35):tx,count=block?3:7;
   for(let i=0;i<count;i++){
    const a=-1.3+i*2.6/(count-1),rx=block?27:47,ry=block?50:84;
    effect.plates.push([point(x+Math.cos(a)*rx,ty+Math.sin(a)*ry),point(x+Math.cos(a+.27)*rx,ty+Math.sin(a+.27)*ry),point(x+Math.cos(a+.27)*(rx+8),ty+Math.sin(a+.27)*(ry+10)),point(x+Math.cos(a)*(rx+8),ty+Math.sin(a)*(ry+10))]);
   }
   effect.pools.push({x,y:433,rx:block?27:56,ry:12,kind:'guard'});
   if(reflect){const q=local?1:smooth((p-.25)/.5),x=mix(sx+40,tx,q);effect.trails.push({points:[point(x-30,305),point(x+7,335),point(x-30,365)],width:5,alpha:1-impact*.6});}
  }
 }
 return effect;
}

function path(c,points,fill,stroke,width=1){
 if(!points.length)return;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(fill)c.closePath();
 if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function oval(c,x,y,rx,ry,fill,stroke,width=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}

export function drawSchoolEffect(c,effect,layer){
 if(effect.family==='none'||effect.alpha<=0)return;
 const color=effect.family==='sword'?'#baffed':effect.family==='poison'?'#c5a2eb':'#f5d491';
 c.save();c.globalAlpha=effect.alpha;c.lineCap='round';
 if(layer==='ground'){
  for(const pool of effect.pools){
   if(pool.kind==='poison'){
    oval(c,pool.x,pool.y,pool.rx,pool.ry,'#513c6870','#ae8cc17a',1.3);
    for(let i=0;i<6;i++){const a=i*TAU/6;oval(c,pool.x+Math.cos(a)*pool.rx*.66,pool.y+Math.sin(a)*pool.ry*.55,4+i%2,1.5,'#bfcc8b77');}
   }else{
    oval(c,pool.x,pool.y,pool.rx,pool.ry,null,color,1.4);oval(c,pool.x,pool.y,pool.rx*.76,pool.ry*.76,null,color+'55',1);
    if(pool.kind==='formation')for(let i=0;i<8;i++){const a=i*TAU/8;path(c,[[pool.x+Math.cos(a)*pool.rx*.8,pool.y+Math.sin(a)*pool.ry*.8],[pool.x+Math.cos(a)*pool.rx*1.13,pool.y+Math.sin(a)*pool.ry*1.13]],null,color,1.5);}
   }
  }
 }else{
  for(const trail of effect.trails){c.globalAlpha=effect.alpha*trail.alpha;c.strokeStyle=color;c.lineWidth=trail.width;c.beginPath();c.moveTo(...trail.points[0]);if(effect.family==='sword')c.quadraticCurveTo(...trail.points[1],...trail.points[2]);else{c.lineTo(...trail.points[1]);c.lineTo(...trail.points[2]);}c.stroke();}
  c.globalAlpha=effect.alpha;
  for(const blade of effect.blades){
   c.save();c.translate(blade.x,blade.y);c.rotate(blade.angle);c.globalAlpha*=blade.alpha;
   if(effect.family==='sword'){path(c,[[-blade.length*.6,-2.5],[blade.length*.35,-2.5],[blade.length*.63,0],[blade.length*.35,2.5],[-blade.length*.6,2.5]],'#dffff0','#72cab8',.8);path(c,[[-blade.length*.48,-5],[-blade.length*.48,5]],null,'#73c0af',2);}
   else{path(c,[[-13,0],[8,-2],[13,0],[8,2]],'#deedb4');oval(c,-13,0,3,2,'#c493d6');}
   c.restore();
  }
  c.globalAlpha=effect.alpha*(effect.stage==='attach'?effect.contactAlpha:1);
  for(const vein of effect.veins)path(c,vein,null,effect.stage==='attach'?'#c8e2a0':'#b79ad7',effect.stage==='detonate'?2.3:1.8);
  c.globalAlpha=effect.alpha;
  for(const cut of effect.cuts){c.save();c.globalAlpha*=cut.alpha;c.translate(cut.x,cut.y);c.rotate(cut.angle);path(c,[[-cut.length*.5,0],[cut.length*.5,0]],null,'#c8fff0',3);path(c,[[-cut.length*.25,-9],[cut.length*.25,9]],null,'#91d8c6',1.3);c.restore();}
  for(const petal of effect.petals)path(c,petal,'#bfa1dfb0','#d2e1a7',.8);
  for(const plate of effect.plates)path(c,plate,effect.stage==='block'?'#e6c56d75':'#d2ad572d',color,effect.stage==='block'?2.8:1.4);
  if(effect.stage==='block'){const edge=effect.plates[1]?.[0];if(edge){path(c,[[edge[0]-14,edge[1]-9],[edge[0]+12,edge[1]+8]],null,'#fff4cc',3);path(c,[[edge[0]-9,edge[1]+12],[edge[0]+8,edge[1]-12]],null,'#fff4cc',2);}}
 }
 c.restore();
}
