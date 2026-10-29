import {NODES} from './config.mjs';
import {actorRole,drawActor} from './actors.mjs';
import {eventDuration,normalizeEventType,sampleActorPose,sampleSceneFeedback} from './choreography.mjs';
const W=1000,H=540,TAU=Math.PI*2,colors={sword:'#baffed',poison:'#c6a6ef',guard:'#ffe0a0'};
const clamp=n=>Math.max(0,Math.min(1,n));
export function createScene(canvas,{reducedMotion=false}={}){
 const c=canvas.getContext('2d'),options={reducedMotion};let run=null,active=null,dead=false,raf=0,timer=0;const started=performance.now();
 const poly=(pts,fill,stroke,width=1)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}};
 const line=(x,y,X,Y,color,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke()};
 const ellipse=(x,y,rx,ry,color,stroke,width=1)=>{c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);if(color){c.fillStyle=color;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}};
 function glow(x,y,r,color){const g=c.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 const enemies=()=>run?.combat?.enemies||[];
 const pos=id=>{if(!id||id==='hero')return 220;const index=Math.max(0,enemies().findIndex(e=>e.id===id));return (enemies().length===1?[700]:enemies().length===2?[635,835]:[560,735,905])[index]||905;};
 function bamboo(x,scale,t,front=false){c.save();c.translate(x,440);c.scale(scale,scale);const sway=Math.sin(t*.55+x)*4;line(0,0,sway,-505,front?'#092a2a':'#2c5651',front?14:8);for(let j=1;j<7;j++){const y=-j*75;line(-5,y,6,y,'#68816b',2);for(const d of [-1,1]){line(0,y,d*58+sway,y-31,front?'#163b33':'#326856',2);for(let k=1;k<5;k++)poly([[d*k*12,y-k*6],[d*(k*12+24),y-k*6-24],[d*(k*12+7),y-k*6+2]],front?'#143c32':'#366e57');}}c.restore();}
 function mountains(){for(let layer=0;layer<3;layer++){const pts=[[0,H]];for(let i=0;i<=13;i++)pts.push([i*88,155+layer*57+Math.sin(i*2.7+layer)*49]);pts.push([W,H]);poly(pts,['#15323c','#21464a','#2b5852'][layer]);}}
 function lantern(x,y){glow(x,y,87,'#eab96843');line(x,y+17,x,y+88,'#152d31',5);poly([[x-13,y-18],[x+13,y-18],[x+16,y+16],[x-16,y+16]],'#c79658','#242f2b',2);line(x,y-13,x,y+13,'#ffe4a1',3);line(x-18,y-20,x+18,y-20,'#273939',4);line(x-18,y+18,x+18,y+18,'#273939',4);}
 function forest(t){
  mountains();glow(686,123,143,'#b8dcd024');
  for(let i=0;i<17;i++)bamboo(i*67-20,.55+(i%3)*.13,t);
  // A clearing curves toward distant water; foreground roots break the flat horizon.
  poly([[0,405],[180,388],[480,399],[724,376],[1000,394],[1000,H],[0,H]],'#243b38');
  poly([[400,388],[573,388],[700,447],[840,540],[201,540],[361,455]],'#4e5d4e');
  poly([[0,427],[136,412],[345,446],[295,480],[0,495]],'#1c4649');
  for(let i=0;i<11;i++){const y=431+i*5;line(9+i*7,y,230+i*4,y,'#77aaa132',1);}
  for(let i=0;i<30;i++){const x=(i*137)%1000,y=418+(i*31)%120;poly([[x,y],[x+17,y-3],[x+24,y+1],[x+5,y+4]],i%3?'#66806a55':'#a49b7155');}
  for(const [x,y] of [[81,452],[921,441]]){poly([[x-69,y+17],[x-39,y-20],[x+8,y-28],[x+42,y+1],[x+63,y+24]],'#18373b','#4e6e63');line(x-29,y-15,x+15,y-4,'#547567',2);}
  lantern(94,350);bamboo(32,1.1,t,true);bamboo(976,1.16,t,true);
 }
 function temple(){
  mountains();poly([[0,364],[103,336],[1000,351],[1000,440],[0,440]],'#263d40');
  // Off-center ruined hall: missing roof bays, open doorway, broken right colonnade.
  poly([[60,202],[121,166],[376,147],[549,178],[613,213],[470,196],[234,194]],'#172c35','#63776c',2);
  poly([[108,161],[164,127],[348,108],[421,123],[476,152],[399,146],[310,134],[190,153]],'#263d42','#768573',2);
  for(let i=0;i<9;i++)line(133+i*43,169,112+i*47,198,'#536a63',2);
  c.fillStyle='#304743';c.fillRect(114,207,410,163);c.fillStyle='#101f28';c.fillRect(216,225,167,145);
  for(const x of [130,466]){poly([[x,205],[x+22,204],[x+18,373],[x-5,373]],'#665d4b','#9e8c67');line(x+6,218,x+3,358,'#b39b6c',2);}
  poly([[400,221],[425,219],[417,263],[428,282],[414,302],[426,329],[414,365],[397,367]],'#506256');
  c.fillStyle='#4c4e3b';c.fillRect(260,201,83,29);c.fillStyle='#a9a178';c.font='18px serif';c.fillText('听 雨 庵',264,222);
  // Buddha niche and incense silhouette, with a cool shaft through the ruined roof.
  poly([[311,158],[368,171],[465,383],[362,386]],'#c0d7b90a');ellipse(300,283,16,20,'#676b56');poly([[283,300],[316,300],[331,340],[271,340]],'#525e4d');ellipse(300,342,42,10,'#364d43');
  for(const x of [667,893]){poly([[x-20,288],[x+22,288],[x+13,382],[x-24,381]],'#5c6a5c','#7b8671');poly([[x-24,288],[x-5,274],[x+6,286],[x+25,278],[x+22,299],[x-25,300]],'#71806b');line(x-5,307,x+5,339,'#273f3e',2);}
  for(let i=0;i<4;i++){const y=366+i*14;poly([[78-i*13,y],[545+i*18,y],[551+i*18,y+13],[65-i*13,y+13]],i%2?'#3d5149':'#506054','#647264');}
  c.fillStyle='#253b3b';c.fillRect(0,420,W,120);
  for(let row=0;row<5;row++)for(let col=-1;col<10;col++){const x=col*126+(row%2)*58,y=421+row*27;poly([[x,y],[x+115,y],[x+127,y+24],[x-6,y+24]],(row+col)%3?'#46594f':'#526258','#273f3c');if((row+col)%4===0)poly([[x+35,y],[x+44,y+8],[x+38,y+14],[x+58,y+24]],null,'#203936');}
  for(const [x,y] of [[550,398],[603,412],[889,420],[84,436]])poly([[x,y],[x+27,y-8],[x+39,y+5],[x+5,y+10]],'#617467','#80917a');
  lantern(176,344);lantern(947,344);glow(300,304,95,'#e7c2881a');
 }
 function gate(t){
  mountains();
  // Monumental axial gate and tiered approach replace the forest/temple horizon.
  poly([[264,183],[317,148],[679,148],[740,183],[696,185],[303,185]],'#172b35','#86917a',2);
  poly([[228,239],[287,198],[717,198],[777,237],[715,229],[292,230]],'#1b3238','#8d957c',2);
  c.fillStyle='#47554c';c.fillRect(290,238,427,155);c.fillStyle='#172b31';c.fillRect(417,259,175,145);
  for(let x=433;x<590;x+=22){line(x,264,x,391,'#594e40',9);for(const y of [287,335,374])ellipse(x,y,2,2,'#9a885f');}
  for(const x of [301,681]){c.fillStyle='#77694c';c.fillRect(x,232,21,177);line(x+5,241,x+5,393,'#c8b27e',2);}
  c.fillStyle='#7e7254';c.fillRect(461,217,93,34);c.fillStyle='#e2c78d';c.font='bold 21px serif';c.fillText('断 雨 关',466,242);
  for(const x of [127,835]){poly([[x,263],[x+38,256],[x+41,384],[x-3,386]],'#697369','#a0a38a');poly([[x-8,258],[x+15,242],[x+47,257],[x+48,268],[x-9,269]],'#344a49','#86947e');}
  for(let side=0;side<2;side++)for(let j=0;j<3;j++){const x=side?793+j*72:50+j*72,y=363+j*4;line(x,y,x,y+57,'#8a917b',12);ellipse(x,y-1,9,6,'#a6a68b');line(x-32,y+13,x+34,y+17,'#6e806f',7);}
  for(let row=0;row<7;row++){const y=391+row*22;poly([[0,y],[1000,y],[1000,y+21],[0,y+21]],row%2?'#5a6554':'#415548');line(0,y,1000,y,'#9b9d7b55',2);for(let j=0;j<8;j++)line(j*143+(row%2)*61,y,j*143+(row%2)*61+8,y+20,'#263f3d',1);}
  for(const x of [210,788]){line(x,146,x,376,'#222f2c',6);const sway=options.reducedMotion?0:Math.sin(t*1.7+x)*5;poly([[x,155],[x+49,169],[x+45+sway,263],[x+23,253],[x+3+sway,274]],'#743b3d','#bf9663');line(x+18,179,x+16,232,'#c0a371',4);line(x+8,197,x+33,202,'#c0a371',3);}
  lantern(105,336);lantern(917,336);
 }
 function background(t){
  const stage=NODES[run?.nodeIndex??0]?.scene||'bamboo',gradient=c.createLinearGradient(0,0,0,H);gradient.addColorStop(0,stage==='bamboo'?'#081e2c':stage==='temple'?'#19232f':'#172632');gradient.addColorStop(1,'#456051');c.fillStyle=gradient;c.fillRect(0,0,W,H);
  const moonX=stage==='bamboo'?694:stage==='temple'?797:501;glow(moonX,99,88,'#d1dbc920');ellipse(moonX,99,stage==='gate'?25:32,stage==='gate'?25:32,'#c6d6c5');
  if(stage==='bamboo')forest(t);else if(stage==='temple')temple();else gate(t);
  for(let i=0;i<3;i++){const fog=c.createLinearGradient(0,0,W,0);fog.addColorStop(0,'#c4dfcb00');fog.addColorStop(.5,'#c4dfcb0c');fog.addColorStop(1,'#c4dfcb00');c.fillStyle=fog;c.fillRect(Math.sin(t*.13+i)*100,300+i*55,W,23);}
  if(!options.reducedMotion)for(let i=0;i<64;i++){const x=(i*113+t*72)%1100,y=(i*73+t*270)%570;line(x,y,x-6,y+17,'#b7d6cf22',1);}
  c.fillStyle='#c4d7c3aa';c.font='14px serif';c.textAlign='left';c.fillText(({bamboo:'夜 雨 · 竹 林',temple:'残 灯 · 破 庙',gate:'霜 刃 · 山 门'})[stage],34,38);
 }
 const blade=(x,y,angle,length=53,color='#cffff0')=>{c.save();c.translate(x,y);c.rotate(angle);poly([[-length*.6,-3],[length*.4,-3],[length*.62,0],[length*.4,3],[-length*.6,3]],color);line(-length*.56,-6,-length*.56,6,'#6ba9a3',2);c.restore();};
 function ring(x,y,rx,ry,color,alpha=1,width=2){c.save();c.globalAlpha=clamp(alpha);ellipse(x,y,rx,ry,null,color,width);c.restore();}
 function sparks(x,y,p,color,count=12,radius=60){for(let i=0;i<count;i++){const a=i*TAU/count+.2,r=radius*p;line(x+Math.cos(a)*r,y+Math.sin(a)*r*.8,x+Math.cos(a)*(r+10),y+Math.sin(a)*(r+10)*.8,color,2);}}
 function seal(x,y,p,color){c.save();c.globalAlpha=Math.sin(p*Math.PI)*.75;ellipse(x,y,75,22,null,color,2);ellipse(x,y,57,16,null,color,1);for(let i=0;i<8;i++){const a=i*TAU/8;line(x+Math.cos(a)*58,y+Math.sin(a)*16,x+Math.cos(a)*81,y+Math.sin(a)*24,color,2);}c.restore();}
 function effects(p,layer){
  if(!active)return;const e=active.event,type=normalizeEventType(e),sx=pos(e.sourceId),targets=e.targetIds?.length?e.targetIds:['hero'],col=colors[e.build]||'#eaddb8',impact=clamp((p-.43)/.57),motion=options.reducedMotion?.2:1;
  c.save();
  if(layer==='ground'){
   if(['swordArray','swordEcho','ascension'].includes(type))seal(type==='swordEcho'?pos(targets[0]):sx,436,p,col);
   if(type==='shield'&&e.value>=0)seal(220,436,p,'#e2b765');
   if(type==='burst')for(const id of targets)ring(pos(id),430,18+impact*80,6+impact*23,'#ad83d4',1-impact,3);
   c.restore();return;
  }
  for(const id of targets){const tx=pos(id),ty=335;
   if(['strike','hurt','counter'].includes(type)){
    if(type==='hurt'&&enemies().find(foe=>foe.id===e.sourceId)?.kind==='ranged'){
     const q=clamp((p-.2)*1.6),x=sx+(tx-sx)*q;line(x+27,330,x-10,330,'#e2d6a0',2);poly([[x-14,330],[x-3,326],[x-3,334]],'#fff0b9');
    }else if(type!=='counter'){
     c.globalAlpha=Math.sin(p*Math.PI);c.strokeStyle='#f5e5b3';c.lineWidth=options.reducedMotion?2:6;c.beginPath();c.ellipse(tx,ty,49,76,-.65,-2.2+p*1.2,.9+p*1.2);c.stroke();
    }
    if(type==='counter'){
     // Reflection has a shield-shaped origin and returning pressure wave, not a sword slash.
     const q=clamp((p-.15)*1.6),x=220+(tx-220)*q;ring(252,335,20,49,'#f8d18a',1-p,3);poly([[x-26,310],[x+11,335],[x-26,360],[x-10,335]],null,'#ffe6a6',4);line(x-55,335,x-19,335,'#c6984c',3);
    }
    if(impact>0){c.globalAlpha=1-impact;sparks(tx,ty,impact,'#f4e1ad',type==='counter'?16:9,56*motion);}
   }
   if(['sword','swordFocus','swordEcho','swordArray'].includes(type)){
    const array=type==='swordArray',echo=type==='swordEcho',focus=type==='swordFocus',count=array?9:echo?5:focus?1:3;
    for(let i=0;i<count;i++){
     const q=clamp((p-(array?i*.025:i*.04))*(array?1.7:1.6)),ox=array?sx+105+Math.cos(i*.8)*90:sx+20,oy=array?180+Math.sin(i*.8)*64:327+(i-(count-1)/2)*18;
     const x=ox+(tx-ox)*q,y=oy+(ty-oy)*q-Math.sin(q*Math.PI)*(array?25:40)*motion;
     c.globalAlpha=(q>=1?1-impact:1)*.9;line(x-42,y+3,x+5,y-1,'#67dacb55',focus?12:7);blade(x,y,Math.atan2(ty-oy,tx-ox),focus?97:array?61:53,focus?'#fffad3':'#c9fff0');
    }
    if(echo){ring(tx,ty,17+impact*59,45+impact*31,'#8fe6d6',1-impact,3);ring(tx,ty,7+impact*40,28+impact*25,'#d2ffec',1-impact,1);}
    if(impact>0){c.globalAlpha=1-impact;sparks(tx,ty,impact,'#c9fff0',array?19:7,(array?86:49)*motion);line(tx-18,ty+30,tx+23,ty-40,'#edffdf',array?5:2);}
   }
   if(type==='poisonApply'){
    const q=clamp((p-.1)*1.7);c.globalAlpha=1-impact*.8;
    for(let i=0;i<5;i++){const x=sx+(tx-sx)*q,y=330+(i-2)*9;line(x-24,y+2,x+5,y-2,'#d0eaa7',1.8);poly([[x-27,y+1],[x-37,y-2],[x-32,y+5]],'#bc93d2');}
    if(impact>0){ring(tx,ty,20+impact*22,32+impact*26,'#abd693',1-impact,1);}
   }
   if(type==='poisonTick'){
    c.globalAlpha=Math.sin(p*Math.PI)*.85;glow(tx,ty,68,'#a0bc5e32');
    // Erosion branches remain attached to the enemy's body, with rising spores.
    for(let i=0;i<5;i++){const x=tx-21+i*10,y=285+i*11;poly([[x,y],[x-6,y+14],[x+3,y+23],[x-5,y+39]],null,i%2?'#b1d78e':'#bb92db',2);ellipse(x+Math.sin(i*3)*12,y-9-p*13*motion,2+i%2,3,'#d3da9a');}
   }
   if(type==='burst'){
    c.globalAlpha=1-impact;glow(tx,ty,45+impact*58,'#b788e65c');
    if(p<.45){ring(tx,ty,43*(1-p),61*(1-p),'#d6b8f1',p*2,3);}
    else {for(let i=0;i<13;i++){const a=i*TAU/13,r=impact*98*motion;poly([[tx+Math.cos(a)*r,ty+Math.sin(a)*r*.8],[tx+Math.cos(a+.11)*(r+25),ty+Math.sin(a+.11)*(r+25)*.8],[tx+Math.cos(a-.09)*(r+40),ty+Math.sin(a-.09)*(r+40)*.8]],i%2?'#c8a1e5':'#b9d88f');}ring(tx,ty,25+impact*75,31+impact*89,'#d0a7ee',1-impact,3);}
   }
   if(type==='shield'){
    const positive=e.value>=0;const x=positive?tx:tx+39; c.globalAlpha=Math.sin(p*Math.PI)*.85;
    if(positive){ring(x,335,45,86,'#f0ce86',1,3);for(let i=0;i<5;i++){const a=-1.1+i*.55;poly([[x+Math.cos(a)*39,335+Math.sin(a)*76],[x+Math.cos(a+.4)*39,335+Math.sin(a+.4)*76],[x+Math.cos(a+.4)*48,335+Math.sin(a+.4)*86],[x+Math.cos(a)*48,335+Math.sin(a)*86]],'#d7b9623a','#ffe3a0');}}
    else{poly([[x,293],[x+19,306],[x+17,353],[x,373],[x-17,353],[x-19,306]],'#d8b65b33','#ffdfa0',3);if(impact>0)sparks(x,331,impact,'#ffe3ad',10,44*motion);}
   }
   if(type==='death'){c.globalAlpha=1-p;for(let i=0;i<7;i++)ellipse(tx+(i-3)*12,427-p*12*motion,4+p*5,2,'#a2b09a');}
   if(type==='heal'){c.globalAlpha=Math.sin(p*Math.PI);ring(tx,340,38,75,'#c5e7b0',1,2);for(let i=0;i<6;i++){const x=tx-30+i*12,y=390-p*80*motion;line(x-3,y,x+3,y,'#c2e8b2',2);line(x,y-3,x,y+3,'#c2e8b2',2);}}
   if(e.value&&p>.33&&!['intent','windup','death'].includes(type)){
    c.globalAlpha=Math.min(1,(p-.33)*5)*(1-impact*.45);c.fillStyle=type==='heal'?'#c5edb0':col;c.font='bold 27px Georgia';c.textAlign='center';c.shadowColor='#061d22';c.shadowBlur=8;
    const sign=type==='shield'?(e.value>=0?'+':'挡 '):type==='heal'?'+':'−';c.fillText(sign+Math.abs(e.value),tx,222-impact*20*motion);c.shadowBlur=0;
   }
  }
  if(['ascension','phase'].includes(type)){
   const x=type==='phase'?sx:220;c.globalAlpha=Math.sin(p*Math.PI)*.7;ring(x,325,45+p*16,92,col,.75,2);
   for(let i=0;i<5;i++){const X=x+(i-2)*24;line(X,410,X,290-Math.sin(p*Math.PI)*69*motion,col,1);}
  }
  // Readable event callout, grounded in the event rather than a future snapshot.
  const callouts={swordArray:'万 剑 归 宗',swordEcho:'回 响 剑 阵',swordFocus:'凝 锋',poisonApply:'毒 针 · 附 毒',poisonTick:'蚀 骨 · 余 毒',burst:'百 毒 · 引 爆',counter:'借 力 · 反 震',ascension:'武 学 · 质 变',phase:'守 将 · 变 阵'};
  if(callouts[type]||type==='finish'){
   c.globalAlpha=Math.min(1,p*5,(1-p)*5);c.textAlign='center';c.fillStyle=col;c.font='bold 22px serif';c.shadowColor='#051b24';c.shadowBlur=10;c.fillText(callouts[type]||e.text||'战斗结束',500,85);
  }
  c.restore();
 }
 function actionFor(id,event){
  if(!event)return'idle';const type=normalizeEventType(event),source=event.sourceId===id,target=event.targetIds?.includes(id);
  if(target&&type==='death')return'death';
  if(target&&['strike','sword','swordFocus','swordEcho','swordArray','counter','hurt','burst','poisonTick'].includes(type))return'hurt';
  if(target&&type==='shield')return'guard';
  if(source&&['intent','windup'].includes(type))return'prepare';
  if(source&&['strike','sword','swordFocus','swordEcho','swordArray','counter','hurt','poisonApply','burst'].includes(type))return'attack';
  if(source&&['shield','ascension'].includes(type))return'guard';return'idle';
 }
 function character(entity,hero,t,p){
  const id=hero?'hero':entity.id,role=actorRole(entity,hero),pose=sampleActorPose(role,actionFor(id,active?.event),p,options);
  drawActor(c,entity,{x:pos(id),hero,time:t,pose,reducedMotion:options.reducedMotion});
  const x=pos(id),hp=Math.max(0,entity.hp||0),max=entity.maxHp||hp||1;
  c.save();c.textAlign='center';c.font='13px serif';c.fillStyle=hero?'#d5e5c8':'#c7d5c3';c.fillText(hero?'无名侠客':entity.name||'江湖客',x,466);
  c.fillStyle='#071f26bb';c.fillRect(x-34,475,68,4);c.fillStyle=hero?'#9cd7bd':'#c5a77c';c.fillRect(x-34,475,68*clamp(hp/max),4);
  if(!hero&&run?.combat?.targetId===id&&hp>0){poly([[x-6,489],[x,484],[x+6,489]],'#e1cb8e');}
  c.restore();
 }
 function complete(current){if(!current||active!==current)return;clearTimeout(timer);timer=0;run=current.event.snapshot||run;active=null;current.resolve();}
 function frame(now){
  if(dead)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio||1,2),width=Math.max(1,Math.round((rect.width||W)*dpr)),height=Math.max(1,Math.round(width*H/W));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  c.setTransform(width/W,0,0,height/H,0,0);let p=active?clamp((now-active.time)/active.duration):0,t=options.reducedMotion?0:(now-started)/1000;
  const feedback=active?sampleSceneFeedback(active.event,p,options):{shakeX:0,shakeY:0,flash:0,hold:0};
  if(feedback.hold)p=feedback.hold;c.save();c.translate(feedback.shakeX,feedback.shakeY);background(t);effects(p,'ground');character(run?.hero||{hp:1},true,t,p);for(const e of enemies())character(e,false,t,p);effects(p,'front');c.restore();
  const vignette=c.createRadialGradient(500,290,215,500,290,650);vignette.addColorStop(0,'#06151d00');vignette.addColorStop(1,'#030d1866');c.fillStyle=vignette;c.fillRect(0,0,W,H);
  if(feedback.flash){c.fillStyle=`rgba(232,244,214,${feedback.flash})`;c.fillRect(0,0,W,H);}
  if(active&&now-active.time>=active.duration)complete(active);raf=requestAnimationFrame(frame);
 }
 raf=requestAnimationFrame(frame);
 return {
  setState(next){run=next;},
  play(event,context){
   if(dead||!event)return Promise.resolve();if(active)complete(active);
   return new Promise(resolve=>{const duration=eventDuration(event,context,options),current={event,time:performance.now(),duration,resolve};active=current;timer=setTimeout(()=>complete(current),duration);});
  },
  setOptions(next){Object.assign(options,next);},
  destroy(){if(dead)return;dead=true;cancelAnimationFrame(raf);clearTimeout(timer);const current=active;active=null;current?.resolve();run=null;}
 };
}
