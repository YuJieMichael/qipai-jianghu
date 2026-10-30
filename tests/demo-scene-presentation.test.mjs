import test from 'node:test';
import assert from 'node:assert/strict';
import {createScene} from '../demo/scene.mjs';
import {createAudio} from '../demo/audio.mjs';
import {createRun,rollDice} from '../demo/model.mjs';
import {startBattle,resolveRound} from '../demo/combat.mjs';

// Missing exports are assertions, so the initial RED describes the absent behavior.
const presentation=await import('../demo/scene-effects.mjs').catch(()=>({}));
const atmosphere=await import('../demo/scene-atmosphere.mjs').catch(()=>({}));

test('effect anchors reject nonexistent targets rather than painting a fabricated first foe',()=>{
 assert.equal(typeof presentation.effectAnchors,'function');
 const enemies=[{id:'a'},{id:'b'},{id:'c'}];
 assert.deepEqual(presentation.effectAnchors({sourceId:'hero',targetIds:['c','missing','c']},enemies),{sourceX:220,targets:[{id:'c',x:905}]});
 assert.deepEqual(presentation.effectAnchors({sourceId:'missing',targetIds:['missing']},enemies),{sourceX:null,targets:[]});
 assert.deepEqual(presentation.effectAnchors({type:'shield'},[]),{sourceX:220,targets:[{id:'hero',x:220}]});
});

test('camera focus follows the impact side within a small bound and recovers to rest',()=>{
 assert.equal(typeof presentation.sampleCameraFocus,'function');
 const event={type:'swordArray',sourceId:'hero',targetIds:['foe']},anchors={sourceX:220,targets:[{id:'foe',x:700}]};
 assert.deepEqual(presentation.sampleCameraFocus(event,0,anchors),{x:0,y:0,scale:1});
 assert.deepEqual(presentation.sampleCameraFocus(event,1,anchors),{x:0,y:0,scale:1});
 const focus=presentation.sampleCameraFocus(event,.5,anchors);
 assert.ok(focus.x<0&&focus.x>=-5,'target on the right draws the camera toward the impact');
 assert.ok(focus.scale>1&&focus.scale<=1.018);
 assert.ok(Math.abs(focus.y)<=2);
 assert.ok(presentation.sampleCameraFocus({type:'strike'},.5,anchors).scale<focus.scale);
 for(const p of [0,.3,.5,.8,1,NaN,Infinity])assert.deepEqual(presentation.sampleCameraFocus(event,p,anchors,{reducedMotion:true}),{x:0,y:0,scale:1});
});

test('sword array stages a formation above the caster before converging onto the actual target',()=>{
 assert.equal(typeof presentation.sampleSchoolEffect,'function');
 const anchors={sourceX:220,targets:[{id:'foe',x:700}]};
 const early=presentation.sampleSchoolEffect({type:'swordArray'},.2,anchors),late=presentation.sampleSchoolEffect({type:'swordArray'},.78,anchors);
 assert.equal(early.family,'sword');assert.ok(early.blades.length>=7);
 assert.ok(early.blades.every(blade=>blade.y<285&&blade.x<450));
 assert.ok(late.blades.every(blade=>blade.x>600),'the gathered swords release as an ordered volley');
 assert.ok(late.trails.some(trail=>trail.points.length>=3),'curved travel paths show the source-to-hit direction');
 const normal=presentation.sampleSchoolEffect({type:'sword'},.5,anchors);
 assert.ok(normal.blades.length<early.blades.length);
});

test('poison stages and guard stages produce different spatial shapes without moving the reduced-motion camera',()=>{
 assert.equal(typeof presentation.sampleSchoolEffect,'function');
 const anchors={sourceX:220,targets:[{id:'foe',x:700}]};
 const apply=presentation.sampleSchoolEffect({type:'poisonApply'},.6,anchors),tick=presentation.sampleSchoolEffect({type:'poisonTick'},.6,anchors),burst=presentation.sampleSchoolEffect({type:'burst'},.6,anchors);
 assert.equal(apply.family,'poison');assert.equal(apply.stage,'attach');
 assert.equal(tick.stage,'erode');assert.equal(burst.stage,'detonate');
 assert.ok(tick.veins.length>0&&tick.pools.length>0);
 assert.ok(burst.petals.length>0&&burst.pools[0].rx>tick.pools[0].rx);
 const raised=presentation.sampleSchoolEffect({type:'shield',value:5},.5,anchors),blocked=presentation.sampleSchoolEffect({type:'shield',value:-5},.5,anchors),counter=presentation.sampleSchoolEffect({type:'counter'},.5,anchors);
 assert.equal(raised.stage,'raise');assert.equal(blocked.stage,'block');assert.equal(counter.stage,'reflect');
 assert.ok(raised.plates.length>blocked.plates.length);assert.ok(counter.trails.length>0);
 for(const type of ['sword','swordArray','poisonApply','poisonTick','burst','shield','counter']){
  const effect=presentation.sampleSchoolEffect({type,value:5},.5,anchors,{reducedMotion:true});
  for(const blade of effect.blades||[])assert.ok(Math.abs(blade.x-700)<70,'reduced motion uses a local effect instead of a full-screen volley');
 }
});

test('school geometry stays on stage for edge targets and never fabricates a missing caster',()=>{
 assert.equal(typeof presentation.sampleSchoolEffect,'function');
 const invalid=presentation.effectAnchors({sourceId:'missing',targetIds:['foe']},[{id:'foe'}]);
 assert.equal(presentation.sampleSchoolEffect({type:'swordArray'},.5,invalid).blades.length,0);
 const anchors={sourceX:220,targets:[{id:'left',x:220},{id:'right',x:905}]};
 for(const type of ['sword','swordFocus','swordEcho','swordArray','poisonApply','poisonTick','burst','shield','counter'])for(const p of [-1,0,.1,.3,.5,.75,.95,1,2,NaN]){
  const effect=presentation.sampleSchoolEffect({type,value:5},p,anchors);
  for(const points of [...effect.veins,...effect.petals,...effect.plates,...effect.trails.map(trail=>trail.points)])for(const [x,y]of points)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1000&&y>=0&&y<=540);
  for(const blade of effect.blades)assert.ok(Number.isFinite(blade.angle)&&blade.x>=0&&blade.x<=1000&&blade.y>=0&&blade.y<=540);
  for(const pool of effect.pools)assert.ok(pool.x-pool.rx>=0&&pool.x+pool.rx<=1000&&pool.y+pool.ry<=540);
 }
 const windup=presentation.sampleSchoolEffect({type:'poisonApply'},.1,anchors),attached=presentation.sampleSchoolEffect({type:'poisonApply'},.7,anchors);
 assert.equal(windup.contactAlpha,0);assert.ok(attached.contactAlpha>.8,'attached poison waits until needles have arrived');
 const sword=presentation.sampleSchoolEffect({type:'sword'},.7,anchors),focus=presentation.sampleSchoolEffect({type:'swordFocus'},.7,anchors);
 assert.ok(sword.cuts.length>0);assert.ok(focus.cuts[0].length>sword.cuts[0].length,'focused sword has a larger local cut without increasing global flash');
});

test('bamboo rain ripples stay within water and reduced motion freezes atmospheric movement',()=>{
 assert.equal(typeof atmosphere.sampleBambooAtmosphere,'function');
 const still=atmosphere.sampleBambooAtmosphere(0,{reducedMotion:true});
 assert.deepEqual(atmosphere.sampleBambooAtmosphere(100,{reducedMotion:true}),still);
 const first=atmosphere.sampleBambooAtmosphere(0),later=atmosphere.sampleBambooAtmosphere(.4);
 assert.notDeepEqual(later.ripples,first.ripples,'rain rings expand on the existing pond rather than the fighting plane');
 for(const t of [0,.4,10,100,NaN,Infinity]){
  const sample=atmosphere.sampleBambooAtmosphere(t);
  assert.ok(sample.shafts.length>0&&sample.fog.length>1);
  for(const ripple of sample.ripples){assert.ok(ripple.x-ripple.rx>=0&&ripple.x+ripple.rx<=285);assert.ok(ripple.y>=435&&ripple.y<=478);assert.ok(ripple.rx>=0&&ripple.rx<=24);assert.ok(ripple.alpha>=0&&ripple.alpha<=1);}
 }
});

function sceneHarness(t){
 const originals=Object.fromEntries(['performance','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
 let now=0,next=0;const frames=new Map(),timers=new Map(),calls=[],labels=[],faces=[],scenes=[];
 const gradient={addColorStop(){}};
 const context=new Proxy({measureText:text=>({width:String(text).length*17}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(object,key)=>key in object?object[key]:(...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${key} received ${value}`);calls.push({key,args});if(key==='fillText')labels.push(args[0]);if(key==='fill'&&object.fillStyle==='#c1a785')faces.push(object.globalAlpha);}});
 globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=callback=>{frames.set(++next,callback);return next;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 globalThis.setTimeout=(callback,delay)=>{timers.set(++next,{callback,delay});return next;};globalThis.clearTimeout=id=>timers.delete(id);
 t.after(()=>{for(const scene of scenes)scene.destroy();for(const [k,v] of Object.entries(originals))globalThis[k]=v;});
 return {calls,labels,faces,frames,timers,create(options){const s=createScene({getContext:()=>context,getBoundingClientRect:()=>({width:390})},options);scenes.push(s);return s;},frame(ms=0){now+=ms;const [id,callback]=frames.entries().next().value;frames.delete(id);faces.length=0;calls.length=0;callback(now);},complete(){const [id,entry]=timers.entries().next().value;timers.delete(id);now+=entry.delay;entry.callback();}};
}
const run={nodeIndex:0,loadout:{weaponType:'sword'},hero:{hp:17,maxHp:20},combat:{targetId:'a',enemies:[{id:'a',name:'刀客',hp:12,maxHp:20},{id:'b',name:'弓手',kind:'ranged',hp:8,maxHp:10},{id:'c',name:'护卫',kind:'shield',hp:19,maxHp:25}]}};

function lethalRound(variation){
 const breaking=variation==='break';
 const before=rollDice(startBattle(createRun('sword',42,{runId:`death-order-${variation}`}),{id:'death-order',enemies:[{kind:breaking?'boss':'melee',hp:breaking?5:200,attack:90,shield:0,stance:breaking?1:0,noSummon:true,...(variation==='vampiric'?{affix:variation}:breaking?{}:{mechanic:variation})}]}));
 before.diceSkills=[null,null,null,null,null];before.hero.hp=breaking?90:3;before.hero.attack=breaking?20:1;before.combat.dice=[1,2,3,4,6];
 if(breaking)before.combat.enemies[0].intent={kind:'heavy',damage:90,label:'蓄力重击'};
 return {before,result:resolveRound(before),face:breaking?1:0};
}

test('real break → strike → death and lethal hurt → heal/shield → death stay upright until death, then remain collapsed',async t=>{
 for(const variation of ['break','vampiric','ward','ritual'])await t.test(variation,async t=>{
  const h=sceneHarness(t);
  const {before,result,face}=lethalRound(variation),scene=h.create({reducedMotion:true});scene.setState(before);
  const types=result.events.map(event=>event.type),deathIndex=types.indexOf('death');
  assert.ok(deathIndex>1);assert.equal(types[deathIndex-1],variation==='break'?'strike':variation==='ward'?'shield':'heal');
  let deathFinished=false;
  for(const [eventIndex,event] of result.events.entries()){
   const pending=scene.play(event,{events:result.events,eventIndex});h.frame();
   assert.ok(Math.abs(h.faces[face]-(deathFinished ? .2 : 1))<1e-8,`${variation}/${event.type}: no premature collapse or first-frame resurrection`);
   if(event.type==='death'){h.frame([...h.timers.values()][0].delay*.5);assert.ok(h.faces[face]>.2&&h.faces[face]<1,'death itself interpolates from the upright hurt pose');}
   h.complete();await pending;scene.setState(event.snapshot);if(event.type==='death')deathFinished=true;
   h.frame();assert.ok(Math.abs(h.faces[face]-(deathFinished ? .2 : 1))<1e-8,`${variation}/${event.type}: completed pose persists between events`);
  }
  const replay=scene.play(result.events[deathIndex]);h.frame();assert.ok(h.faces[face]<.3,'a replacement death event cannot raise an already collapsed actor');scene.skip();await replay;scene.destroy();
 });
});

test('restored or skipped final states settle deaths, while a different run or node cancels old presentation state and timers',async t=>{
 const h=sceneHarness(t),{before,result,face}=lethalRound('break'),scene=h.create({reducedMotion:true});
 scene.setState(result.state);h.frame();assert.ok(h.faces[face]<.3,'restoring a final snapshot starts with a settled corpse');
 scene.setState(before);h.frame();assert.equal(h.faces[face],1,'resuming the saved decision boundary clears stale completed deaths');
 const pending=scene.play(result.events[0],{events:result.events,eventIndex:0});scene.skip();await pending;
 scene.setState({...result.state,flow:'reward'});h.frame();assert.ok(h.faces[face]<.3,'skipping the remainder reconciles the final battle outcome');
 scene.setState(before);const replacedDeath=scene.play(result.events.find(event=>event.type==='death'));
 const replacement=scene.play(result.events.at(-1));await replacedDeath;h.frame();assert.ok(h.faces[face]<.3,'replacing an active death commits its completed presentation');scene.skip();await replacement;
 for(const next of [{...before,runId:'new-run'},{...before,nodeIndex:1}]){
  scene.setState(before);const deathEvent=result.events.find(event=>event.type==='death'),death=scene.play(deathEvent),oldTimer=[...h.timers.values()][0];
  scene.setState(next);assert.equal(h.timers.size,0,'changing battle cancels the previous presentation timer');await death;oldTimer.callback();h.frame();assert.equal(h.faces[face],1,'late death completion cannot collapse the new battle');
 }
});

test('all real scene event paths draw finite Canvas frames without revealing future health or changing state or RNG',async t=>{
 const h=sceneHarness(t),scene=h.create(),before=JSON.stringify(run),random=Math.random;
 t.after(()=>{Math.random=random;});Math.random=()=>{throw new Error('presentation consumed RNG');};
 scene.setState(run);
 for(const type of ['windup','strike','hurt','sword','swordFocus','swordEcho','swordArray','poisonApply','poisonTick','burst','shield','counter','break','ascension','mechanic','phase','death','heal','finish']){
  const event={type,sourceId:'hero',targetIds:['c'],value:type==='shield'?-7:9,snapshot:{...run,hero:{hp:1,maxHp:20}}},eventBefore=JSON.stringify(event);
  const pending=scene.play(event);h.frame(90);assert.equal(JSON.stringify(event),eventBefore);
  assert.ok(h.calls.some(call=>call.key==='fillRect'&&call.args[0]===186&&Math.abs(call.args[2]-57.8)<.001),'visible hero health remains 17/20 until commit');
  scene.skip();await pending;scene.setState(run);h.calls.length=0;
 }
 assert.equal(JSON.stringify(run),before);scene.destroy();assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
});

test('damage labels have an outline and dark backing and never render unknown targets',async t=>{
 const h=sceneHarness(t),scene=h.create({reducedMotion:true});scene.setState(run);
 let pending=scene.play({type:'burst',sourceId:'hero',targetIds:['a','b','c'],value:12});h.frame(100);
 assert.ok(h.calls.filter(call=>call.key==='strokeText'&&call.args[0]==='−12').length===3,'every simultaneous damage label has an outline');
 assert.ok(h.calls.some(call=>call.key==='fillRect'&&call.args[1]<235&&call.args[1]>160),'labels have a dark plate above the actor silhouette');
 scene.skip();await pending;h.labels.length=0;
 pending=scene.play({type:'hurt',sourceId:'hero',targetIds:['unknown'],value:99});h.frame(80);
 assert.ok(!h.labels.includes('−99'));scene.skip();await pending;
});

test('synthesized school cues include a delayed impact layer and release scheduled voices on stop',async t=>{
 const previous=globalThis.AudioContext,sources=[];const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
 globalThis.AudioContext=class {state='running';currentTime=3;sampleRate=8000;destination={};createGain(){return{gain:param,connect(){},disconnect(){}};}createOscillator(){const s={frequency:param,connect(){},disconnect(){},start(at){this.at=at;},stop(at){if(at===undefined)this.stopped=true;}};sources.push(s);return s;}createBuffer(){return{getChannelData:()=>new Float32Array(4000)};}createBufferSource(){const s={connect(){},disconnect(){},start(at){this.at=at;},stop(at){if(at===undefined)this.stopped=true;}};sources.push(s);return s;}createBiquadFilter(){return{frequency:param,Q:{value:0},connect(){},disconnect(){}};}close(){return Promise.resolve();}};
 t.after(()=>{globalThis.AudioContext=previous;});const audio=createAudio();t.after(()=>audio.destroy());await audio.unlock();
 for(const type of ['swordArray','burst','counter']){const from=sources.length;audio.play({type});assert.ok(sources.slice(from).some(s=>s.at>=3.15),`${type} has a separate release/impact tail`);}
 audio.stop();assert.ok(sources.every(s=>s.stopped));
});
