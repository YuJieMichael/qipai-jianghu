import test from 'node:test';
import assert from 'node:assert/strict';
import {drawActor} from '../demo/actors.mjs';
import {sampleActorPose} from '../demo/choreography.mjs';

// A Canvas boundary recorder: transforms are applied to the real drawing output.
// It catches non-finite coordinates, leaked saves, clipping and feet below ground.
function canvasRecorder(){
 let matrix=[1,0,0,1,0,0],path=[],stack=[];
 const fills=[],points=[];
 const c={globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,lineCap:'butt',
  save(){stack.push({matrix:[...matrix],globalAlpha:this.globalAlpha,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,lineCap:this.lineCap});},
  restore(){assert.ok(stack.length,'restore must match save');const {matrix:savedMatrix,...properties}=stack.pop();matrix=savedMatrix;Object.assign(this,properties);},
  translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
  transform(a,b,d,e,x,y){const [A,B,D,E,X,Y]=matrix;matrix=[A*a+D*b,B*a+E*b,A*d+D*e,B*d+E*e,A*x+D*y+X,B*x+E*y+Y];assert.ok(matrix.every(Number.isFinite));},
  beginPath(){path=[];},closePath(){},
  moveTo(x,y){point(x,y);},lineTo(x,y){point(x,y);},
  bezierCurveTo(...values){for(let i=0;i<values.length;i+=2)point(values[i],values[i+1]);},
  ellipse(x,y,rx,ry,rotation){assert.ok([x,y,rx,ry,rotation].every(Number.isFinite));for(let i=0;i<32;i++){const a=i*Math.PI/16;point(x+Math.cos(a)*rx,y+Math.sin(a)*ry);}},
  fill(){fills.push({color:this.fillStyle,points:[...path]});},stroke(){},
 };
 function point(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y),'drawing coordinates must be finite');const [a,b,d,e,tx,ty]=matrix,p=[a*x+d*y+tx,b*x+e*y+ty];path.push(p);points.push(p);}
 return {c,fills,points,depth:()=>stack.length};
}
const roles=['hero','melee','ranged','shield','elite','boss'];
const entity=role=>({kind:role,hp:60,shield:0,poison:{stacks:0}});

test('actor drawing safely fills omitted and partial pose fields and balances Canvas state',()=>{
 for(const role of roles)for(const pose of [undefined,{}, {frontUpper:.6},{x:NaN,torso:Infinity}]){
  const recorder=canvasRecorder();
  drawActor(recorder.c,entity(role),{x:220,hero:role==='hero',pose});
  assert.equal(recorder.depth(),0);assert.equal(recorder.c.globalAlpha,1);assert.ok(recorder.points.length>50);
 }
});

test('living actors keep both boots planted through preparation, impact and recovery',()=>{
 for(const role of roles)for(const weaponType of ['sword','staff','hammer'])for(const action of ['idle','prepare','attack','guard','hurt'])for(const p of [.18,.38,.52,.78]){
  const recorder=canvasRecorder();
  drawActor(recorder.c,entity(role),{x:560,hero:role==='hero',time:1,weaponType,pose:sampleActorPose(role,action,p,{weaponType})});
  const boots=recorder.fills.filter(fill=>fill.color==='#15272f');
  assert.equal(boots.length,2);
  for(const boot of boots){const bottom=Math.max(...boot.points.map(point=>point[1]));assert.ok(bottom>=426&&bottom<=434,`${role}/${weaponType}/${action}: boot lifts or sinks (${bottom})`);}
 }
});

test('dead actors stay collapsed after the death event and later unrelated events',()=>{
 const measure=pose=>{const recorder=canvasRecorder();drawActor(recorder.c,{...entity('melee'),hp:0},{x:560,pose,reducedMotion:true});return Math.min(...recorder.points.map(point=>point[1]));};
 const settled=measure(sampleActorPose('melee','death',1));
 assert.ok(settled>340,'collapsed body occupies the ground, rather than its upright silhouette');
 for(const action of ['idle','guard','hurt'])assert.equal(measure(sampleActorPose('melee',action,.5)),settled);
 assert.ok(measure(sampleActorPose('melee','death',0))<300,'first death frame remains upright before collapse');
});

test('living silhouettes and weapons fit the battlefield through their action phases',()=>{
 for(const role of roles)for(const weaponType of ['sword','staff','hammer'])for(const action of ['idle','prepare','attack','guard','hurt'])for(const p of [0,.18,.38,.52,.78,1]){
  const recorder=canvasRecorder();
  drawActor(recorder.c,entity(role),{x:role==='hero'?220:905,hero:role==='hero',weaponType,reducedMotion:true,pose:sampleActorPose(role,action,p,{weaponType})});
  for(const [x,y] of recorder.points)assert.ok(x>=0&&x<=1000&&y>=0&&y<=540,`${role}/${weaponType}/${action}/${p} clipped at ${x},${y}`);
 }
});
