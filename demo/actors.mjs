/** Authored Canvas cut-paper martial actors. All geometry is original and local. */
const TAU=Math.PI*2;
export function actorRole(entity={},hero=false){return hero?'hero':(['ranged','shield','elite','boss'].includes(entity.kind)?entity.kind:'melee');}
const palettes={hero:{cloth:'#e3dfbd',shade:'#b5bea8',cape:'#226b73',edge:'#8bcbc1',metal:'#d5e4d7'},melee:{cloth:'#384650',shade:'#1c2d37',cape:'#57433f',edge:'#aa8b76',metal:'#a8bab7'},ranged:{cloth:'#7a8362',shade:'#344e40',cape:'#263d36',edge:'#c2bb89',metal:'#c9cbaa'},shield:{cloth:'#637579',shade:'#253c44',cape:'#384d4e',edge:'#9baaa0',metal:'#8dacae'},elite:{cloth:'#665153',shade:'#2c313b',cape:'#8a4141',edge:'#cea474',metal:'#b8c1b2'},boss:{cloth:'#927d5b',shade:'#393e44',cape:'#8d3a3c',edge:'#e1bd78',metal:'#c4b996'}};
export function drawActor(c,entity,{x,y=426,hero=false,time=0,pose,reducedMotion=false,weaponType='sword'}={}){
 const role=actorRole(entity,hero),pal=hero?{...palettes.hero,...({staff:{cape:'#4d637d',edge:'#b4d9cd',metal:'#c7dfbd'},hammer:{cape:'#796047',edge:'#d7bc86',metal:'#d3c19a'}}[weaponType]||{})}:palettes[role],scale=({hero:1.25,melee:1.08,ranged:1.1,shield:1.13,elite:1.25,boss:1.4})[role],face=hero?1:-1;
 const poly=(points,fill,stroke=undefined,width=1)=>{c.beginPath();points.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.closePath();if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}};
 const line=(a,b,color,width=2)=>{c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke()};
 const ellipse=(x,y,rx,ry,color,stroke)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);if(color){c.fillStyle=color;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke()}};
 const joint=(origin,angle,length)=>[origin[0]+Math.cos(angle)*length,origin[1]+Math.sin(angle)*length];
 c.save();c.translate(x+face*pose.x,y);ellipse(0,5,39*scale,8,'#03141988');c.scale(face*scale,scale);c.globalAlpha=(entity.hp<=0?.24:1)*pose.opacity;c.translate(0,pose.y);c.rotate(pose.torso);
 const breathe=reducedMotion?0:Math.sin(time*2.1+x)*1.1;c.translate(0,breathe+pose.crouch);
 const wind=pose.cape+(reducedMotion?0:Math.sin(time*2+x)*3),hip=-48;
 // Capes have their own delayed edge and split hems, behind the articulated body.
 if(role==='hero'){
  poly([[-15,-113],[-31,-108],[-40-wind*.5,-71],[-56-wind,-24],[-31-wind,-40],[-22,-27],[-6,-48]],pal.cape,pal.edge);
  poly([[-23,-102],[-34-wind*.5,-69],[-45-wind,-40],[-28-wind*.5,-49]],weaponType==='staff'?'#34445e':weaponType==='hammer'?'#4d4336':'#174b58');
  poly([[-6,-119],[-24,-122],[-57-wind,-109],[-78-wind,-113],[-64-wind,-99],[-37,-102]],pal.edge);
 }else if(role==='boss'){
  poly([[-28,-120],[18,-122],[31,-96],[42-wind*.5,-18],[9,-29],[-8,-17],[-29,-31],[-56-wind,-15],[-44,-71]],pal.cape,'#c18460');
  for(let i=0;i<3;i++)poly([[-20+i*15,-95],[-28+i*18-wind*.3,-27],[-17+i*18-wind*.3,-33],[-12+i*13,-96]],'#b154452f');
  // Back standards create a broad, instantly identifiable commander silhouette.
  for(const d of [-1,1]){line([d*19,-109],[d*43,-173],'#a78b5d',3);poly([[d*42,-170],[d*72,-149],[d*49,-142],[d*49,-118],[d*31,-142]],'#6d3538','#b78e5d');}
 }else if(role==='elite'){
  poly([[-25,-116],[-37,-108],[-48-wind,-32],[-21,-43],[-13,-27],[4,-49]],pal.cape,'#ab7b64');
 }else if(role==='ranged'){
  poly([[-19,-120],[10,-119],[23,-91],[22,-48],[-30-wind*.4,-34],[-28,-81]],pal.cape,pal.edge);
  line([-23,-121],[-32,-52],'#bd9b6c',8);for(let i=0;i<4;i++){line([-31+i*4,-92],[-39+i*4,-133],'#ad9c72',1.7);poly([[-39+i*4,-133],[-42+i*4,-139],[-36+i*4,-137]],'#c4c4a2');}
 }else poly([[-23,-107],[4,-110],[25,-49],[-7,-34],[-33-wind*.4,-31]],pal.cape);
 // Knee and ankle articulation gives attacks a planted split stance.
 for(const [side,foot] of [[-1,pose.backFoot],[1,pose.frontFoot]]){
  const top=[side*10,hip],knee=[foot*.65,-24],ankle=[foot,0];
  line(top,knee,pal.shade,17);line(knee,ankle,pal.shade,13);
  poly([[foot-7,-16],[foot+7,-15],[foot+9,-4],[foot+18,1],[foot+18,5],[foot-8,5]],'#15272f','#667b76');
  for(let j=0;j<3;j++)line([foot-7,-12+j*4],[foot+6,-13+j*4],'#a7a58a',1);
 }
 // Tailored coats, rather than palette-swapped identical bodies.
 if(role==='hero'){
  poly([[-20,-111],[10,-113],[19,-98],[14,-66],[28,-30],[4,-35],[-3,-28],[-26,-37],[-18,-71]],pal.cloth,'#839c91');
  poly([[-16,-108],[2,-96],[13,-110],[5,-77],[-5,-54],[-19,-42]],pal.shade);
  line([-17,-107],[1,-91],pal.edge,3);line([1,-91],[11,-109],'#eff3d1',2);
  poly([[-8,-75],[6,-75],[15,-37],[1,-38]],'#eddfaa');
 }else if(role==='ranged'){
  poly([[-17,-109],[11,-110],[17,-86],[9,-61],[20,-43],[-23,-43],[-13,-72]],pal.cloth,'#9baf8a');
  for(let j=0;j<3;j++)line([-12,-92+j*11],[12,-97+j*11],'#314b3e',4);
 }else if(role==='shield'){
  poly([[-27,-112],[18,-114],[28,-90],[23,-46],[-24,-46],[-32,-82]],pal.cloth,pal.edge);
  for(let j=0;j<4;j++)poly([[-26,-96+j*12],[24,-99+j*12],[24,-90+j*12],[-24,-86+j*12]],pal.shade,'#99ac9c');
 }else if(role==='elite'||role==='boss'){
  const wide=role==='boss'?29:23;
  poly([[-wide,-117],[wide*.7,-118],[wide+4,-96],[wide-4,-54],[-wide,-49],[-wide-6,-94]],pal.cloth,pal.edge);
  for(let j=0;j<4;j++)poly([[-wide,-99+j*12],[wide,-103+j*12],[wide-3,-93+j*12],[-wide+2,-89+j*12]],pal.shade,pal.edge);
  for(const d of [-1,1]){poly([[d*15,-118],[d*(wide+15),-115],[d*(wide+21),-101],[d*16,-103]],pal.metal,pal.edge);poly([[d*11,-60],[d*29,-59],[d*38,-31],[d*13,-39]],pal.shade,pal.edge);}
  ellipse(0,-99,7,9,pal.metal,pal.edge);
 }else{
  poly([[-20,-109],[9,-111],[20,-95],[15,-68],[26,-42],[-3,-37],[-26,-48],[-18,-79]],pal.cloth,pal.edge);
  line([-15,-106],[12,-63],'#87695b',7);line([10,-108],[-17,-65],'#202e34',5);
 }
 line([-20,-62],[19,-63],role==='hero'?'#476d70':role==='elite'?'#a95343':'#b99e6e',7);
 poly([[5,-64],[13,-62],[19+wind*.2,-31],[10,-35]],role==='hero'?'#65a79b':'#9e6751');
 if(role==='hero'||role==='melee'||role==='elite'){line([-18,-65],[-43,-10],'#102b35',6);line([-17,-65],[-42,-12],'#839e92',1);}
 // Rear arm, then head, then front arm/weapon establishes clear overlap.
 const backShoulder=[-14,-104],backElbow=joint(backShoulder,pose.backUpper,23),backHand=joint(backElbow,pose.backFore,23);
 const frontShoulder=[10,-106],frontElbow=joint(frontShoulder,pose.frontUpper,24),frontHand=joint(frontElbow,pose.frontFore,24);
 function arm(shoulder,elbow,hand,front){line(shoulder,elbow,pal.shade,15);line(shoulder,elbow,pal.cloth,11);line(elbow,hand,pal.shade,11);line(elbow,hand,front?pal.cloth:pal.shade,8);ellipse(hand[0],hand[1],4.5,4,'#d4b995');line([hand[0]-3,hand[1]-5],[hand[0]+4,hand[1]-5],'#aa9974',2);}
 arm(backShoulder,backElbow,backHand,false);
 c.save();c.translate(0,-130);c.rotate(pose.head);
 poly([[-10,-8],[8,-11],[12,6],[4,15],[-9,8]],'#c1a785');
 poly([[-13,-8],[-8,-18],[9,-16],[13,-4],[3,-7],[-1,-2],[-12,1]],'#182d36');
 line([5,2],[11,2],'#26383a',2);line([10,5],[13,8],'#d8bb94',1);
 if(role==='hero'){
  poly([[-34,-10],[-7,-32],[32,-10],[4,-5]],'#a99b75','#ddcf9f');
  for(let k=-2;k<=2;k++)line([-7,-29],[k*13,-10],'#6a7864',1);
  line([-30,-9],[29,-9],'#e7ddb3',2);poly([[-10,3],[-20,16],[-26,36],[-18,31],[-13,17]],'#143944');
 }else if(role==='melee'){
  poly([[-17,-7],[-10,-24],[9,-22],[20,-2],[9,-8],[2,-13],[-6,-4]],'#2a3d43','#627675');
  poly([[-9,6],[13,5],[9,17],[-7,15]],'#7b655c');
 }else if(role==='ranged'){
  poly([[-17,3],[-20,-14],[-7,-29],[11,-23],[22,4],[10,0],[4,-14],[-6,-8],[-7,12]],pal.shade,'#9cad8b');
  line([-13,13],[5,18],'#9ea783',3);
 }else if(role==='shield'){
  ellipse(0,-10,19,13,'#273e47','#8aa5a0');line([-24,-5],[24,-5],'#adc2b5',4);poly([[-15,-1],[13,-1],[9,20],[-11,19]],'#30434a','#97aaa0');for(let j=0;j<3;j++)line([-8+j*7,4],[-8+j*7,15],'#a8b9ac',1);
 }else if(role==='elite'){
  poly([[-15,-5],[-11,-22],[11,-20],[18,-4],[8,-7]],'#343c43','#b9a075');
  poly([[-9,-24],[-26,-38],[-38,-26],[-49+wind*.4,-29],[-33,-16],[-17,-17]],'#a14d43','#c47758');
  line([-11,10],[9,13],'#273940',6);
 }else{
  poly([[-18,1],[-19,-18],[-7,-26],[0,-17],[10,-27],[19,-19],[20,3]],'#39444a',pal.edge,2);
  poly([[-17,-17],[-31,-32],[-26,-10],[-15,-4]],pal.metal,pal.edge);poly([[17,-17],[31,-32],[27,-9],[15,-4]],pal.metal,pal.edge);
  poly([[-13,4],[-4,10],[7,5],[13,17],[-1,25],[-12,17]],'#293b42',pal.edge);line([-3,-15],[-3,2],pal.edge,4);
 }
 c.restore();arm(frontShoulder,frontElbow,frontHand,true);
 // Every weapon uses the front-hand joint, but has its own weight and silhouette.
 c.save();c.translate(...frontHand);
 if(role==='hero'&&weaponType==='staff'){
  c.rotate(pose.weapon);line([-36,0],[73,0],'#a89b6d',5);line([-29,-2],[62,-2],'#d4d5ab',1);poly([[63,-13],[80,0],[63,13],[54,0]],'#7bbbad','#c0f1d6',2);ellipse(65,0,5,5,'#d5fae1');line([58,-17],[58,17],pal.edge,2);
 }else if(role==='hero'&&weaponType==='hammer'){
  c.rotate(pose.weapon);line([-25,0],[63,0],'#786752',7);poly([[47,-19],[76,-19],[85,-10],[85,13],[76,21],[47,21],[40,12],[40,-11]],'#7d9b91','#e1d3a6',2);line([52,-14],[52,15],'#c4b47f',3);
 }else if(role==='ranged'){
  c.rotate(pose.weapon+Math.PI/2);c.strokeStyle='#c4af7b';c.lineWidth=4;c.beginPath();c.moveTo(0,-46);c.bezierCurveTo(36,-31,36,30,0,48);c.stroke();line([0,-46],[0,48],'#e9dfb0',1);line([-29,0],[38,0],'#d5d6b6',2);poly([[38,0],[28,-4],[29,5]],'#dfe4ce');
 }else if(role==='shield'){
  // Iron umbrella shield: faceted dome, eight ribs, boss and rim.
  ellipse(4,-8,29,39,'#263f48','#bdd1bd');
  for(let i=0;i<8;i++){const a=i*TAU/8;poly([[4,-8],[4+Math.cos(a)*27,-8+Math.sin(a)*37],[4+Math.cos(a+.7)*27,-8+Math.sin(a+.7)*37]],i%2?'#4c7074':'#36565f');line([4,-8],[4+Math.cos(a)*27,-8+Math.sin(a)*37],'#91aaa1',1);}
  ellipse(4,-8,7,9,'#d3c69d','#162d37');line([-9,33],[13,53],'#b5b193',5);
 }else{
  c.rotate(pose.weapon);const length=role==='boss'?102:role==='elite'?78:role==='hero'?66:53;
  line([-15,0],[role==='boss'?-67:3,0],'#574e3b',5);for(let j=0;j<3;j++)line([-13+j*4,-2],[-12+j*4,2],'#d9c997',1);
  if(role==='boss'){
   line([-63,0],[85,0],'#b69a61',5);poly([[49,-4],[96,-19],[110,-12],[108,-4],[85,11],[49,5]],'#c5ded3',pal.edge);poly([[49,3],[59,18],[72,26],[59,27],[43,13]],'#a8c7bd',pal.edge);poly([[43,-3],[37,-9],[29,-5],[38,1]],'#c7684b');
  }else if(role==='elite'){
   poly([[0,-5],[length-15,-13],[length+4,-6],[length,2],[16,11],[0,5]],'#a7c3c1','#e2e6cc');line([10,6],[length-2,-2],'#6d989e',2);
  }else if(role==='hero')poly([[0,-3],[length-6,-3],[length+9,0],[length-6,3],[0,3]],'#e4fff0','#85c9c9');
  else poly([[0,-4],[length-5,-8],[length+3,-4],[length,3],[0,5]],'#bbcfc7','#dce4cc');
  line([1,-10],[1,10],pal.edge,4);
 }
 c.restore();
 if(entity.shield>0){c.globalAlpha*=.6;ellipse(0,-77,43,82,null,'#efd193');c.globalAlpha/=.6;}
 if(entity.poison?.stacks){for(let i=0;i<Math.min(4,entity.poison.stacks);i++){const px=-20+i*12;poly([[px,-181],[px+4,-174],[px,-168],[px-4,-174]],'#b2d69a','#765a9b');}}
 c.restore();
}
