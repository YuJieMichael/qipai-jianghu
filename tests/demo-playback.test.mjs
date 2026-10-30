import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateSequenceDurations,eventDuration,sampleSceneFeedback} from '../demo/choreography.mjs';
import {createScene} from '../demo/scene.mjs';
import {createAudio} from '../demo/audio.mjs';

const sequence=Object.freeze([Object.freeze({type:'shield'}),Object.freeze({type:'hurt'})]);
const sum=values=>values.reduce((total,value)=>total+value,0);

test('2× playback halves the complete normal and reduced-motion budgets without mutating input or consuming RNG',t=>{
 const before=JSON.stringify(sequence),random=Math.random;
 Math.random=()=>{throw new Error('Presentation timing must not consume RNG');};
 t.after(()=>{Math.random=random;});
 for(const [reducedMotion,playbackSpeed,budget] of [[false,1,2600],[false,2,1300],[true,1,1400],[true,2,700]]){
  assert.equal(sum(allocateSequenceDurations(sequence,{reducedMotion,playbackSpeed})),budget);
  const mixed=allocateSequenceDurations([{type:'strike'},{type:'swordArray'},{type:'poisonTick'}],{reducedMotion,playbackSpeed});
  assert.ok(mixed.every(value=>Number.isFinite(value)&&value>0));
  assert.ok(Math.abs(sum(mixed)-budget)<1e-8);
  assert.ok(mixed[1]>mixed[0],'heavy attacks retain their reading-time weight');
 }
 assert.equal(JSON.stringify(sequence),before);
 assert.deepEqual(allocateSequenceDurations([],{playbackSpeed:2}),[]);
});

test('invalid playback speeds fall back to normal speed',()=>{
 for(const playbackSpeed of [undefined,null,0,-1,3,Infinity,NaN,'2',true]){
  assert.deepEqual(allocateSequenceDurations(sequence,{playbackSpeed}),[1300,1300]);
  assert.equal(eventDuration({type:'shield'},{},{playbackSpeed}),190);
 }
});

test('event timing prefers a valid context speed and otherwise uses scene options for sequence and standalone events',()=>{
 for(const [contextSpeed,optionSpeed,want] of [[2,1,650],[1,2,1300],[0,2,650],['2',2,650],[undefined,2,650],[3,0,1300]]){
  assert.equal(eventDuration(sequence[0],{events:sequence,eventIndex:0,playbackSpeed:contextSpeed},{playbackSpeed:optionSpeed}),want);
 }
 assert.equal(eventDuration({type:'shield'},{playbackSpeed:2},{playbackSpeed:1}),95);
 assert.equal(eventDuration({type:'shield'},{playbackSpeed:1},{playbackSpeed:2}),190);
 assert.equal(eventDuration({type:'shield'},null,{playbackSpeed:2}),95);
 assert.equal(eventDuration(sequence[0],{events:sequence,eventIndex:0,playbackSpeed:2},{reducedMotion:true}),350);
 assert.ok(Math.abs(eventDuration({type:'shield'},{playbackSpeed:2},{reducedMotion:true})-52.25)<1e-10);
});

test('2× speed preserves reduced-motion suppression of camera shake flash and hit stop',()=>{
 for(const type of ['strike','burst','counter','swordArray','phase'])for(const progress of [.49,.52,.7]){
  assert.deepEqual(sampleSceneFeedback({type},progress,{reducedMotion:true,playbackSpeed:2}),{shakeX:0,shakeY:0,flash:0,hold:0});
 }
});

// Only browser scheduling and Canvas are replaced; the scene lifecycle runs unchanged.
function sceneClock(t){
 const saved=Object.fromEntries(['performance','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'].map(key=>[key,globalThis[key]]));
 let now=0,next=0;const scenes=[];const timers=new Map(),frames=new Map(),allTimers=new Map(),allFrames=new Map(),labels=[];
 globalThis.performance={now:()=>now};
 globalThis.setTimeout=(callback,delay)=>{const id=++next,entry={callback,due:now+delay,delay};timers.set(id,entry);allTimers.set(id,entry);return id;};
 globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.requestAnimationFrame=callback=>{const id=++next;frames.set(id,callback);allFrames.set(id,callback);return id;};
 globalThis.cancelAnimationFrame=id=>frames.delete(id);
 t.after(()=>{for(const scene of scenes)scene.destroy();for(const [key,value] of Object.entries(saved))globalThis[key]=value;});
 const gradient={addColorStop(){}},context=new Proxy({fillText:text=>labels.push(text),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(object,key)=>key in object?object[key]:()=>{}});
 const canvas={getContext:()=>context,getBoundingClientRect:()=>({width:1000})};
 return {timers,frames,labels,allFrames,
  scene(options){const scene=createScene(canvas,options);scenes.push(scene);return scene;},
  advance(ms){now+=ms;for(const [id,entry] of [...timers])if(entry.due<=now&&timers.has(id)){timers.delete(id);entry.callback();}},
  timer(id){allTimers.get(id).callback();},
  frame(ms=0){now+=ms;const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);}
 };
}
function snapshotEvent(type,name){
 let reads=0;const snapshot={nodeIndex:0,hero:{hp:10,maxHp:10},combat:{enemies:[{id:'foe',name,hp:10,maxHp:10}]}};
 return {event:{type,get snapshot(){reads++;return snapshot;}},reads:()=>reads};
}

test('scene applies constructor and per-event playback speeds with timer completion while frames are suspended',async t=>{
 const clock=sceneClock(t),scene=clock.scene({playbackSpeed:2});
 let settled=false;
 const first=scene.play(sequence[0],{events:sequence,eventIndex:0}).then(()=>{settled=true;});
 assert.equal([...clock.timers.values()][0].delay,650);
 clock.advance(649);await Promise.resolve();assert.equal(settled,false);
 clock.advance(1);await first;assert.equal(settled,true);
 const second=scene.play(sequence[0],{events:sequence,eventIndex:0,playbackSpeed:1});
 assert.equal([...clock.timers.values()][0].delay,1300);
 clock.advance(1300);await second;
 scene.setOptions({reducedMotion:true,playbackSpeed:2});
 const third=scene.play(sequence[0],{events:sequence,eventIndex:0});
 assert.equal([...clock.timers.values()][0].delay,350);
 clock.advance(350);await third;
});

test('skip immediately commits the current snapshot once and a canceled timer cannot overwrite a later event',async t=>{
 const clock=sceneClock(t),scene=clock.scene(),first=snapshotEvent('shield','first foe'),second=snapshotEvent('shield','second foe');
 scene.skip();
 const firstPlay=scene.play(first.event),oldTimer=[...clock.timers.keys()][0];let resolved=false;
 firstPlay.then(()=>{resolved=true;});
 scene.skip();scene.skip();await firstPlay;
 assert.equal(resolved,true);assert.equal(first.reads(),1);assert.equal(clock.timers.size,0);
 clock.frame();assert.ok(clock.labels.includes('first foe'),'skip renders the same event snapshot');
 let nextResolved=false;const nextPlay=scene.play(second.event).then(()=>{nextResolved=true;});
 const newTimer=[...clock.timers.keys()][0];
 clock.timer(oldTimer);await Promise.resolve();
 assert.equal(first.reads(),1);assert.equal(nextResolved,false);assert.ok(clock.timers.has(newTimer));
 scene.skip();await nextPlay;assert.equal(second.reads(),1);
 clock.timer(oldTimer);clock.timer(newTimer);clock.frame();
 assert.equal(first.reads(),1);assert.equal(second.reads(),1);assert.equal(clock.labels.at(-1),'second foe');
});

test('timer and RAF completion cannot commit an event twice or clear a replacement timer',async t=>{
 const clock=sceneClock(t),scene=clock.scene(),first=snapshotEvent('shield','timed foe'),second=snapshotEvent('shield','replacement foe');
 const firstPlay=scene.play(first.event),oldTimer=[...clock.timers.keys()][0];
 clock.advance(190);await firstPlay;clock.frame();assert.equal(first.reads(),1);
 const replacement=scene.play(second.event),newTimer=[...clock.timers.keys()][0];
 clock.timer(oldTimer);assert.ok(clock.timers.has(newTimer));assert.equal(first.reads(),1);
 scene.skip();await replacement;
 assert.equal(second.reads(),1);assert.equal(clock.timers.size,0);
});

test('RAF can finish before its timer and the canceled callback cannot finish the next presentation',async t=>{
 const clock=sceneClock(t),scene=clock.scene(),first=snapshotEvent('shield','frame foe'),second=snapshotEvent('shield','later foe');
 const firstPlay=scene.play(first.event),oldTimer=[...clock.timers.keys()][0];
 clock.frame(190);await firstPlay;assert.equal(clock.timers.size,0);
 const completedReads=first.reads();clock.frame();assert.equal(first.reads(),completedReads);
 assert.equal(clock.labels.at(-1),'frame foe');
 let nextResolved=false;const nextPlay=scene.play(second.event).then(()=>{nextResolved=true;});
 const nextTimer=[...clock.timers.keys()][0];clock.timer(oldTimer);await Promise.resolve();
 assert.equal(first.reads(),completedReads);assert.equal(nextResolved,false);assert.ok(clock.timers.has(nextTimer));
 clock.advance(190);await nextPlay;clock.frame();assert.equal(clock.labels.at(-1),'later foe');
});

test('destroy settles skipped and later active plays, and canceled callbacks cannot restore destroyed snapshots',async t=>{
 const clock=sceneClock(t),scene=clock.scene(),skipped=snapshotEvent('shield','skipped foe'),abandoned=snapshotEvent('shield','abandoned foe');
 const first=scene.play(skipped.event);scene.skip();await first;
 const second=scene.play(abandoned.event),timer=[...clock.timers.keys()][0],frame=[...clock.allFrames.values()][0];
 scene.destroy();scene.destroy();scene.skip();await second;await scene.play(skipped.event);
 clock.timer(timer);frame(9999);
 assert.equal(skipped.reads(),1);assert.equal(abandoned.reads(),0);assert.equal(clock.timers.size,0);assert.equal(clock.frames.size,0);
});

test('audio stop silences scheduled voices without muting or closing subsequent playback',async t=>{
 const previous=globalThis.AudioContext,sources=[];let closes=0;
 const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
 globalThis.AudioContext=class {
  state='running';currentTime=0;destination={};
  createOscillator(){const source={frequency:param,connect(){},disconnect(){},start(){},stop(at){if(at===undefined)this.stopped=(this.stopped||0)+1;}};sources.push(source);return source;}
  createGain(){return {gain:param,connect(){},disconnect(){}};}
  close(){closes++;return Promise.resolve();}
 };
 t.after(()=>{globalThis.AudioContext=previous;});
 const audio=createAudio();t.after(()=>audio.destroy());
 audio.stop();assert.equal(await audio.unlock(),true);audio.play('roll');assert.equal(sources.length,5);
 audio.stop();audio.stop();assert.ok(sources.every(source=>source.stopped===1));assert.equal(closes,0);
 audio.play('hold');assert.equal(sources.length,6);assert.equal(sources[5].stopped,undefined);
 audio.setMuted(true);audio.play('hold');assert.equal(sources.length,6);assert.equal(sources[5].stopped,1);
 audio.setMuted(false);audio.play('hold');assert.equal(sources.length,7);
 audio.destroy();audio.stop();assert.equal(closes,1);assert.equal(sources[6].stopped,1);
});
