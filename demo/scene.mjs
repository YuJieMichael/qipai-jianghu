import {getRunNode} from './journey.mjs';
import {actorRole,drawActor} from './actors.mjs';
import {eventActorAction,eventDuration,normalizeEventType,sampleActorPose,sampleSceneFeedback} from './choreography.mjs';
import {effectAnchors,sampleCameraFocus,sampleSchoolEffect,drawSchoolEffect} from './scene-effects.mjs';
import {drawBambooAtmosphere} from './scene-atmosphere.mjs';
const W=1000,H=540,TAU=Math.PI*2,colors={sword:'#baffed',poison:'#c6a6ef',guard:'#ffe0a0'};
const clamp=n=>Math.max(0,Math.min(1,n));
export function createScene(canvas,{reducedMotion=false,playbackSpeed=1}={}){
 const c=canvas.getContext('2d'),options={reducedMotion,playbackSpeed};let run=null,active=null,dead=false,raf=0,timer=0;const started=performance.now();
 // Presentation history belongs to the battle, never the simulation/save data.
 const completedDeaths=new Set();
 const battleKey=state=>state?JSON.stringify([state.runId,state.nodeIndex,state.mode,state.build]):null;
 function setState(next){
  const changed=battleKey(next)!==battleKey(run);
  if(changed){clearTimeout(timer);timer=0;const previous=active;active=null;previous?.resolve();completedDeaths.clear();}
  run=next;
  // Restore/skip ends at a stable decision or result boundary. Resolved event
  // snapshots instead wait for their explicit death event to finish.
  const settled=changed||next?.flow!=='battle'||next?.combat?.phase!=='resolved';
  for(const [id,entity] of [['hero',next?.hero],...(next?.combat?.enemies||[]).map(entity=>[entity.id,entity])]){
   if(entity?.hp>0)completedDeaths.delete(id);else if(settled&&entity?.hp<=0)completedDeaths.add(id);
  }
 }
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
  c.save();c.globalAlpha=.32;for(let i=0;i<21;i++)bamboo(i*51-12,.43+(i%4)*.06,t*.65);c.restore();
  c.save();c.globalAlpha=.64;for(let i=0;i<12;i++)bamboo(i*97-21,.67+(i%3)*.11,t);c.restore();
  drawBambooAtmosphere(c,t,options,'distance');
  // A clearing curves toward distant water; foreground roots break the flat horizon.
  poly([[0,405],[180,388],[480,399],[724,376],[1000,394],[1000,H],[0,H]],'#243b38');
  poly([[400,388],[573,388],[700,447],[840,540],[201,540],[361,455]],'#4e5d4e');
  poly([[0,427],[136,412],[345,446],[295,480],[0,495]],'#1c4649');
  for(let i=0;i<11;i++){const y=431+i*5;line(9+i*7,y,230+i*4,y,'#77aaa132',1);}
  drawBambooAtmosphere(c,t,options,'water');
  for(let i=0;i<30;i++){const x=(i*137)%1000,y=418+(i*31)%120;poly([[x,y],[x+17,y-3],[x+24,y+1],[x+5,y+4]],i%3?'#66806a55':'#a49b7155');}
  for(const [x,y] of [[81,452],[921,441]]){poly([[x-69,y+17],[x-39,y-20],[x+8,y-28],[x+42,y+1],[x+63,y+24]],'#18373b','#4e6e63');line(x-29,y-15,x+15,y-4,'#547567',2);}
  lantern(94,350);bamboo(22,1.1,t,true);bamboo(986,1.16,t,true);drawBambooAtmosphere(c,t,options,'foreground');
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
 function desert(t){
  glow(770,116,190,'#d6985736');ellipse(770,116,42,42,'#dbb985');
  // Layered wind-cut dunes and an excavated caravan ruin occupy different depths.
  poly([[0,262],[112,234],[298,268],[505,202],[728,246],[1000,183],[1000,H],[0,H]],'#73584d');
  poly([[0,331],[220,267],[400,306],[632,253],[822,310],[1000,274],[1000,H],[0,H]],'#a47b57');
  poly([[0,379],[179,341],[416,366],[651,316],[1000,369],[1000,H],[0,H]],'#b99166');
  for(const [x,h] of [[97,191],[204,149],[841,225],[921,169]]){poly([[x,380],[x+6,380-h],[x+37,379-h],[x+45,380]],'#594b44','#c0a073',2);poly([[x-5,378-h],[x+17,365-h],[x+43,376-h],[x+46,390-h],[x-7,390-h]],'#8d7456','#c3aa7c');line(x+16,400-h,x+13,362,'#af8c61',2);}
  poly([[78,194],[116,179],[258,215],[267,240],[195,221],[144,214],[113,226]],'#80644d','#b89568',2);
  poly([[804,176],[846,148],[887,169],[888,189],[849,181],[808,198]],'#84674d','#c4a171',2);
  poly([[0,430],[181,405],[420,422],[686,395],[1000,422],[1000,H],[0,H]],'#8c7355');
  for(let i=0;i<13;i++){const y=432+i*9;line(15+(i%3)*23,y,320+i*48,y-7,'#d5b78339',1);}
  for(const [x,y] of [[52,467],[895,470],[730,415]]){poly([[x-24,y],[x-8,y-22],[x+18,y-15],[x+29,y+6]],'#65584b','#baa17a');}
  // A torn red expedition pennant is the one saturated foreground accent.
  line(947,278,942,445,'#4b443a',5);const sway=options.reducedMotion?0:Math.sin(t*1.5)*8;poly([[947,283],[886,290+sway],[901,314],[885,338+sway],[945,323]],'#7e3e3e','#c49a71');
 }
 function lake(t){
  poly([[0,263],[98,199],[241,254],[378,170],[535,258],[731,201],[1000,258],[1000,H],[0,H]],'#234b61');
  poly([[0,310],[179,265],[319,289],[518,250],[707,286],[1000,260],[1000,H],[0,H]],'#316374');
  c.fillStyle='#28586a';c.fillRect(0,305,W,235);
  for(let i=0;i<24;i++){const x=(i*163)%1000,y=315+i*9,drift=options.reducedMotion?0:Math.sin(t*.65+i)*10;line(x+drift,y,x+46+i%4*21+drift,y,'#9bc9bd30',1);}
  for(let i=0;i<8;i++)ellipse(745,323+i*10,12+i*9,1.3,'#c9dcc241');
  // A broad arched stone bridge supports the fighting plane over open water.
  poly([[0,454],[79,424],[253,395],[500,388],[754,395],[922,424],[1000,454],[1000,H],[0,H]],'#264b56','#7ca294',2);
  for(const x of [106,401,697]){c.fillStyle='#183b4f';c.beginPath();c.moveTo(x,540);c.lineTo(x,479);c.bezierCurveTo(x+15,418,x+137,418,x+155,479);c.lineTo(x+155,540);c.fill();}
  poly([[0,419],[244,392],[503,386],[764,392],[1000,418],[1000,449],[750,422],[505,416],[250,422],[0,450]],'#789384','#a4b7a0',2);
  for(let i=0;i<16;i++){const x=i*68,y=417-Math.sin(i/15*Math.PI)*30;line(x,y,x+9,y+28,'#476d69',1);}
  for(const x of [27,136,869,977]){const y=x<500?402-x*.055:354+x*.055;line(x,y-31,x,y,'#b0bba0',9);ellipse(x,y-36,8,7,'#d1d2af');}
  for(const x of [41,934]){line(x,462,x+9,405,'#4c7a6f',3);for(let j=0;j<3;j++)poly([[x+4,439-j*8],[x-15-j*3,425-j*8],[x+2,447-j*8]],'#557e68');}
  lantern(83,358);lantern(929,358);glow(743,320,115,'#bfdccc0b');
 }
 function tomb(t){
  // Jagged grotto vault, sunken funerary door and warm braziers: no open horizon.
  poly([[0,0],[1000,0],[1000,345],[948,229],[894,254],[861,156],[795,205],[727,99],[659,149],[613,70],[523,130],[441,71],[366,157],[294,119],[215,239],[144,181],[71,303],[0,328]],'#151b29','#514856',2);
  poly([[105,377],[176,193],[320,133],[645,119],[822,208],[909,388]],'#3b3544','#6c6263',2);
  poly([[332,369],[337,210],[401,153],[603,151],[666,211],[668,369]],'#655348','#9a8061',2);
  poly([[371,369],[372,225],[419,183],[582,181],[628,226],[626,369]],'#111f2d','#b09773',3);
  for(let i=0;i<7;i++){const x=410+i*30;line(x,205,x,369,'#473e42',3);poly([[x-4,249],[x+4,240],[x+8,260],[x,273],[x-7,260]],'#7d6858','#bc9367');}
  for(const x of [207,746]){poly([[x-20,220],[x+29,218],[x+34,378],[x-29,378]],'#594a4b','#8d7460');for(let j=0;j<3;j++){line(x-12,249+j*34,x+16,249+j*34,'#a88a65',2);poly([[x,255+j*34],[x+8,265+j*34],[x,274+j*34],[x-8,265+j*34]],'#332d39','#8d7459');}}
  poly([[0,406],[205,380],[797,379],[1000,407],[1000,H],[0,H]],'#292c3b');
  for(let row=0;row<5;row++)for(let col=0;col<9;col++){const x=col*130+(row%2)*50,y=407+row*29;poly([[x,y],[x+120,y],[x+133,y+25],[x-9,y+25]],(row+col)%3?'#3b3946':'#49414a','#1d2835');}
  for(const x of [90,899]){poly([[x-20,401],[x-12,349],[x+13,349],[x+21,401]],'#5b4941','#b78c58');ellipse(x,345,27,9,'#9b744e','#cca469');const flicker=options.reducedMotion?0:Math.sin(t*9+x)*5;glow(x,321,112,'#db853b35');poly([[x-18,339],[x-15,319],[x-7,321],[x+flicker,282],[x+12,311],[x+14,302],[x+22,339]],'#cc713e');poly([[x-10,338],[x-3,305],[x+6,321],[x+12,338]],'#f1cc7c');}
  for(const x of [27,962])poly([[x-30,H],[x-20,257],[x+11,302],[x+25,443],[x+50,H]],'#181f2b','#423c47');
 }
 function peak(t){
  glow(721,89,130,'#d4e5e526');
  // Tall snow-spines and an isolated terrace above the cloud sea.
  for(const [x,y,w] of [[-60,188,260],[209,109,270],[493,143,242],[747,61,304]]){poly([[x-90,430],[x+w*.48,y],[x+w+90,430]],'#3b596e');poly([[x+w*.48,y],[x+w*.76,y+153],[x+w*.57,y+116],[x+w*.5,y+140],[x+w*.35,y+104],[x+w*.15,y+177]],'#b7c9ce','#d9e0d4');line(x+w*.48,y+140,x+w*.58,409,'#78909b',3);}
  for(let i=0;i<4;i++){const y=320+i*26;ellipse(140+i*244+Math.sin(t*.1+i)*10,y,310,30,'#9fb9bb31');}
  poly([[0,439],[112,403],[340,404],[410,430],[621,404],[870,398],[1000,434],[1000,H],[0,H]],'#2c424e','#9aa8a1',2);
  poly([[0,417],[115,387],[336,390],[424,413],[641,389],[880,383],[1000,416],[1000,445],[853,423],[641,430],[423,442],[327,427],[109,425],[0,448]],'#aebbb6','#d6ded0',2);
  for(const x of [74,416,840]){poly([[x,451],[x+18,478],[x+3,515],[x+23,H]],null,'#61717b',2);}
  // Wind-bent alpine pine and hanging talisman mark the summit.
  line(933,411,940,244,'#313f47',13);line(940,292,873,265,'#313f47',7);line(940,323,981,289,'#313f47',6);
  for(const [x,y,w] of [[922,259,68],[874,270,73],[959,292,63],[928,311,83]]){poly([[x-w,y+11],[x-12,y-18],[x+w*.7,y+11]],'#325658','#81988b');line(x-w,y+9,x+w*.6,y+9,'#ccd6ca',4);}
  line(110,301,110,409,'#53646a',5);const sway=options.reducedMotion?0:Math.sin(t*2)*6;poly([[111,306],[150,310],[150+sway,370],[131,359],[111,373]],'#7d464b','#c9ae89');line(124,322,138,345,'#dcc39a',3);
 }
 function background(t){
  const stage=getRunNode(run||{nodeIndex:0})?.scene||'bamboo',palettes={bamboo:['#081e2c','#456051'],temple:['#19232f','#456051'],gate:['#172632','#456051'],desert:['#3c303e','#c9a571'],lake:['#0e3048','#7ba39b'],tomb:['#111622','#42333e'],peak:['#253d5a','#9db8c1']},palette=palettes[stage]||palettes.bamboo,gradient=c.createLinearGradient(0,0,0,H);gradient.addColorStop(0,palette[0]);gradient.addColorStop(1,palette[1]);c.fillStyle=gradient;c.fillRect(0,0,W,H);
  if(!['tomb','desert'].includes(stage)){const moonX=stage==='bamboo'?694:stage==='temple'?797:stage==='lake'?745:stage==='peak'?721:501;glow(moonX,99,88,'#d1dbc920');ellipse(moonX,99,stage==='gate'?25:32,stage==='gate'?25:32,'#c6d6c5');}
  ({bamboo:forest,temple,gate,desert,lake,tomb,peak}[stage]||forest)(t);
  if(stage!=='desert'&&stage!=='tomb')for(let i=0;i<3;i++){const fog=c.createLinearGradient(0,0,W,0);fog.addColorStop(0,'#c4dfcb00');fog.addColorStop(.5,'#c4dfcb0c');fog.addColorStop(1,'#c4dfcb00');c.fillStyle=fog;c.fillRect(Math.sin(t*.13+i)*100,300+i*55,W,23);}
  if(!options.reducedMotion)for(let i=0;i<(stage==='tomb'?15:64);i++){const x=(i*113+t*(stage==='desert'?120:stage==='peak'?40:72))%1100,y=(i*73+t*(stage==='tomb'?-28:stage==='peak'?37:stage==='desert'?20:270)+570)%570;if(stage==='peak')ellipse(x,y,1.4,1.4,'#e4eee68a');else if(stage==='tomb')ellipse(x,y,1,2,'#d8995d66');else if(stage==='desert')line(x,y,x+12,y-1,'#e2c59a33',1);else line(x,y,x-6,y+17,'#b7d6cf22',1);}
 }
 function ring(x,y,rx,ry,color,alpha=1,width=2){c.save();c.globalAlpha=clamp(alpha);ellipse(x,y,rx,ry,null,color,width);c.restore();}
 function sparks(x,y,p,color,count=12,radius=60){for(let i=0;i<count;i++){const a=i*TAU/count+.2,r=radius*p;line(x+Math.cos(a)*r,y+Math.sin(a)*r*.8,x+Math.cos(a)*(r+10),y+Math.sin(a)*(r+10)*.8,color,2);}}
 function seal(x,y,p,color){c.save();c.globalAlpha=Math.sin(p*Math.PI)*.75;ellipse(x,y,75,22,null,color,2);ellipse(x,y,57,16,null,color,1);for(let i=0;i<8;i++){const a=i*TAU/8;line(x+Math.cos(a)*58,y+Math.sin(a)*16,x+Math.cos(a)*81,y+Math.sin(a)*24,color,2);}c.restore();}
 function effects(p,layer){
  if(!active)return;const e=active.event,type=normalizeEventType(e),anchors=effectAnchors(e,enemies()),sx=anchors.sourceX??220,targets=anchors.targets.map(target=>target.id),col=colors[e.build]||'#eaddb8',impact=clamp((p-.43)/.57),motion=options.reducedMotion?.2:1,weapon=e.snapshot?.loadout?.weaponType||run?.loadout?.weaponType||'sword',foe=e.snapshot?.combat?.enemies?.find(unit=>unit.id===e.sourceId)||enemies().find(unit=>unit.id===e.sourceId),mechanic=foe?.mechanic,mechanicColor=mechanic==='assault'?'#f1ad85':mechanic==='ward'?'#e7ce91':'#c4a6e5';
  c.save();
  drawSchoolEffect(c,sampleSchoolEffect(e,p,anchors,options),layer);
  if(layer==='ground'){
   if(type==='swordEcho')for(const id of targets)seal(pos(id),436,p,col);
   if(type==='ascension'&&anchors.sourceX!==null)seal(sx,436,p,col);
   if(['phase','mechanic'].includes(type))seal(sx,434,p,mechanicColor);
   if(type==='break')for(const id of targets)ring(pos(id),431,30+impact*65,10+impact*19,'#e5d4a2',1-impact,3);
   if(type==='strike'&&e.sourceId==='hero'&&weapon==='hammer')for(const id of targets){ring(pos(id),430,15+impact*92,5+impact*25,'#ead1a0',1-impact,4);if(impact>0)for(let i=0;i<5;i++){const x=pos(id)+(i-2)*26*impact;poly([[x,435],[x-9,424-impact*18*motion],[x+9,418-impact*34*motion],[x+14,434]],'#ad9d7e');}}
   c.restore();return;
  }
  for(const id of targets){const tx=pos(id),ty=335;
   if(['strike','hurt'].includes(type)){
    if(type==='hurt'&&enemies().find(foe=>foe.id===e.sourceId)?.kind==='ranged'){
     const q=clamp((p-.2)*1.6),x=sx+(tx-sx)*q;line(x+27,330,x-10,330,'#e2d6a0',2);poly([[x-14,330],[x-3,326],[x-3,334]],'#fff0b9');
    }else if(type==='strike'&&e.sourceId==='hero'&&weapon==='staff'){
     const q=clamp((p-.22)*1.8),x=sx+48+(tx-sx-48)*q,y=325-Math.sin(q*Math.PI)*23*motion;c.globalAlpha=1-impact*.8;glow(x,y,36,'#acddc559');ellipse(x,y,9,9,'#ddf5c5','#8bd7c4',2);line(x-40,y,x-12,y,'#91d9bd',4);for(let i=0;i<3;i++)ring(x-i*11,y,12+i*2,17+i*2,'#b8e8d1',.6-i*.12,1);
    }else if(type==='strike'&&e.sourceId==='hero'&&weapon==='hammer'){
     if(p<.48){const q=clamp(p/.48);c.globalAlpha=q*.65;line(tx-22,ty-70+q*53,tx+9,ty-20+q*58,'#ead6a3',7);}
     else{c.globalAlpha=1-impact;ring(tx,385,16+impact*55,28+impact*44,'#f7db9a',1-impact,4);for(let i=0;i<6;i++){const a=i*TAU/6;line(tx+Math.cos(a)*20,402+Math.sin(a)*12,tx+Math.cos(a)*(28+impact*57),402+Math.sin(a)*(18+impact*28),'#d1bd8a',3);}}
    }else{
     c.globalAlpha=Math.sin(p*Math.PI);c.strokeStyle='#f5e5b3';c.lineWidth=options.reducedMotion?2:6;c.beginPath();c.ellipse(tx,ty,49,76,-.65,-2.2+p*1.2,.9+p*1.2);c.stroke();
    }
    if(impact>0){c.globalAlpha=1-impact;sparks(tx,ty,impact,'#f4e1ad',9,56*motion);}
   }
   if(type==='death'){c.globalAlpha=1-p;for(let i=0;i<7;i++)ellipse(tx+(i-3)*12,427-p*12*motion,4+p*5,2,'#a2b09a');}
   if(type==='heal'){c.globalAlpha=Math.sin(p*Math.PI);ring(tx,340,38,75,'#c5e7b0',1,2);for(let i=0;i<6;i++){const x=tx-30+i*12,y=390-p*80*motion;line(x-3,y,x+3,y,'#c2e8b2',2);line(x,y-3,x,y+3,'#c2e8b2',2);}}
  }
  if(type==='break')for(const id of targets){
   const x=pos(id);c.globalAlpha=Math.sin(p*Math.PI);glow(x,335,78,'#e8cd8e24');
   // An interrupted stance fractures into angular gold plates, distinct from poison bursts.
   for(let i=0;i<6;i++){const a=i*TAU/6,r=29+impact*53*motion;poly([[x+Math.cos(a)*r,334+Math.sin(a)*r],[x+Math.cos(a+.2)*(r+21),334+Math.sin(a+.2)*(r+21)],[x+Math.cos(a-.13)*(r+11),334+Math.sin(a-.13)*(r+11)]],'#e5d3a1','#fff0c5');}
   line(x-40,297,x+39,374,'#fff0c5',3);line(x-35,378,x+40,294,'#fff0c5',2);
  }
  if(['ascension','phase','mechanic'].includes(type)){
   const x=type==='ascension'?220:sx,tint=type==='ascension'?col:mechanicColor;c.globalAlpha=Math.sin(p*Math.PI)*.8;ring(x,325,45+p*16,92,tint,.75,2);
   if(mechanic==='assault')for(let i=0;i<5;i++){const X=x+(i-2)*23;poly([[X-8,420],[X+9,420],[X+4,311-p*55*motion],[X-3,324-p*40*motion]],'#de906e44',tint);}
   else if(mechanic==='ward')for(let i=0;i<6;i++){const a=i*TAU/6;poly([[x+Math.cos(a)*57,326+Math.sin(a)*88],[x+Math.cos(a+.7)*57,326+Math.sin(a+.7)*88],[x+Math.cos(a+.7)*65,326+Math.sin(a+.7)*100],[x+Math.cos(a)*65,326+Math.sin(a)*100]],'#dfc78d24',tint,2);}
   else if(mechanic==='ritual')for(let i=0;i<7;i++){const a=i*TAU/7+p*motion*.8,X=x+Math.cos(a)*75,Y=331+Math.sin(a)*72;poly([[X,Y-12],[X+7,Y],[X,Y+12],[X-7,Y]],'#a583cc55',tint);line(x,331,X,Y,'#ba9bdf44',1);}
   else for(let i=0;i<5;i++){const X=x+(i-2)*24;line(X,410,X,290-Math.sin(p*Math.PI)*69*motion,tint,1);}
  }
  // Readable event callout, grounded in the event rather than a future snapshot.
  const callouts={swordArray:'万 剑 归 宗',swordEcho:'回 响 剑 阵',swordFocus:'凝 锋',poisonApply:'毒 针 · 附 毒',poisonTick:'蚀 骨 · 余 毒',burst:'百 毒 · 引 爆',counter:'借 力 · 反 震',ascension:'武 学 · 质 变',phase:e.text||'守 将 · 变 阵',mechanic:e.text||'敌 势 · 初 现',break:'破 招 · 失 衡'};
  if(callouts[type]||type==='finish'){
   c.globalAlpha=Math.min(1,p*5,(1-p)*5);c.textAlign='center';c.fillStyle=col;c.font=type==='mechanic'||type==='phase'?'bold 18px serif':'bold 22px serif';c.shadowColor='#051b24';c.shadowBlur=10;c.fillText(callouts[type]||e.text||'战斗结束',500,85);
  }
  c.restore();
 }
 function readouts(p){
  if(!active)return;const e=active.event,type=normalizeEventType(e);
  if(!Number.isFinite(e.value)||!e.value||p<=.33||['intent','windup','death','phase','mechanic','break'].includes(type))return;
  const alpha=Math.min(1,(p-.33)*5,(1-p)*6),targets=effectAnchors(e,enemies()).targets;
  c.save();c.globalAlpha=alpha;c.font='bold 29px Georgia';c.textAlign='center';c.textBaseline='middle';
  for(const {x}of targets){
   const sign=type==='shield'?(e.value>=0?'+':'挡 '):type==='heal'?'+':'−',label=sign+Math.abs(e.value),width=Math.max(52,(c.measureText(label)?.width||label.length*18)+20),y=208;
   c.fillStyle='#071a24dc';c.fillRect(x-width/2,y-21,width,39);c.fillStyle=colors[e.build]||(['poisonApply','poisonTick','burst'].includes(type)?colors.poison:type==='shield'||type==='counter'?colors.guard:colors.sword);c.fillRect(x-width/2,y+17,width,2);
   c.lineWidth=4;c.strokeStyle='#05151c';c.strokeText(label,x,y);c.fillStyle=type==='heal'?'#d1f2b9':'#fff2ce';c.fillText(label,x,y);
  }
  c.restore();
 }
 function character(entity,hero,t,p){
  const id=hero?'hero':entity.id,role=actorRole(entity,hero),pose=sampleActorPose(role,eventActorAction(id,active?.event),p,{...options,weaponType:hero?run?.loadout?.weaponType:undefined});
  drawActor(c,entity,{x:pos(id),hero,time:t,pose,reducedMotion:options.reducedMotion,weaponType:hero?run?.loadout?.weaponType:undefined,deathComplete:entity.hp<=0&&completedDeaths.has(id)});
  const x=pos(id),hp=Math.max(0,entity.hp||0),max=entity.maxHp||hp||1;
  c.save();c.textAlign='center';c.font='13px serif';c.fillStyle=hero?'#d5e5c8':'#c7d5c3';c.fillText(hero?'无名侠客':entity.name||'江湖客',x,466);
  c.fillStyle='#071f26bb';c.fillRect(x-34,475,68,4);c.fillStyle=hero?'#9cd7bd':'#c5a77c';c.fillRect(x-34,475,68*clamp(hp/max),4);
  if(!hero&&run?.combat?.targetId===id&&hp>0){poly([[x-6,489],[x,484],[x+6,489]],'#e1cb8e');}
  c.restore();
 }
 function complete(current){
  if(!current||active!==current)return;
  clearTimeout(timer);timer=0;run=current.event.snapshot||run;
  if(normalizeEventType(current.event)==='death')for(const id of current.event.targetIds||[])completedDeaths.add(id);
  active=null;current.resolve();
 }
 function frame(now){
  if(dead)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio||1,2),width=Math.max(1,Math.round((rect.width||W)*dpr)),height=Math.max(1,Math.round(width*H/W));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  c.setTransform(width/W,0,0,height/H,0,0);let p=active?clamp((now-active.time)/active.duration):0,t=options.reducedMotion?0:(now-started)/1000;
  const feedback=active?sampleSceneFeedback(active.event,p,options):{shakeX:0,shakeY:0,flash:0,hold:0};
  if(feedback.hold)p=feedback.hold;const focus=active?sampleCameraFocus(active.event,p,effectAnchors(active.event,enemies()),options):{x:0,y:0,scale:1};
  c.save();c.translate(500+feedback.shakeX+focus.x,270+feedback.shakeY+focus.y);c.scale(focus.scale,focus.scale);c.translate(-500,-270);background(t);effects(p,'ground');character(run?.hero||{hp:1},true,t,p);for(const e of enemies())character(e,false,t,p);effects(p,'front');c.restore();
  const vignette=c.createRadialGradient(500,290,215,500,290,650);vignette.addColorStop(0,'#06151d00');vignette.addColorStop(1,'#030d1866');c.fillStyle=vignette;c.fillRect(0,0,W,H);
  readouts(p);
  if(feedback.flash){c.fillStyle=`rgba(232,244,214,${feedback.flash})`;c.fillRect(0,0,W,H);}
  if(active&&now-active.time>=active.duration)complete(active);raf=requestAnimationFrame(frame);
 }
 raf=requestAnimationFrame(frame);
 return {
  setState,
  play(event,context){
   if(dead||!event)return Promise.resolve();if(active)complete(active);
   return new Promise(resolve=>{const duration=eventDuration(event,context,options),current={event,time:performance.now(),duration,resolve};active=current;timer=setTimeout(()=>complete(current),duration);});
  },
  setOptions(next){Object.assign(options,next);},
  skip(){complete(active);},
  destroy(){if(dead)return;dead=true;cancelAnimationFrame(raf);clearTimeout(timer);const current=active;active=null;current?.resolve();run=null;completedDeaths.clear();}
 };
}
