import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateSequenceDurations, eventDuration, normalizeEventType, sampleActorPose, sampleSceneFeedback } from '../demo/choreography.mjs';

const events=['windup','strike','swordFocus','poisonApply','poisonTick','shield','counter','swordArray','death','finish'].map(type=>({type,value:12,sourceId:'hero',targetIds:['enemy']}));
test('weighted complete rounds stay inside the normal budget without mutating events',()=>{
 const before=JSON.stringify(events);
 for(const sequence of [events,events.slice(0,3),Array.from({length:70},(_,i)=>events[i%events.length])]){
  const durations=allocateSequenceDurations(sequence);
  assert.equal(durations.length,sequence.length);
  assert.ok(durations.every(n=>Number.isFinite(n)&&n>0));
  assert.ok(Math.abs(durations.reduce((a,b)=>a+b,0)-2600)<.001);
 }
 assert.equal(JSON.stringify(events),before);
 assert.deepEqual(allocateSequenceDurations([]),[]);
});
test('large attacks receive more reading time than ordinary impact and context maps exact allocation',()=>{
 const durations=allocateSequenceDurations(events);
 assert.ok(durations[7]>durations[1]);
 assert.equal(eventDuration(events[7],{events,eventIndex:7}),durations[7]);
 assert.ok(eventDuration({type:'burst'})>eventDuration({type:'strike'}));
 assert.ok(Number.isFinite(eventDuration({type:'unknown'})));
});
test('all roles have finite preparation release recovery and return to their own rest pose',()=>{
 const roles=['hero','melee','ranged','shield','elite','boss'];
 for(const role of roles){
  const rest=sampleActorPose(role,'idle',0);
  for(const p of [0,.18,.34,.52,.7,.9,1]){
   const pose=sampleActorPose(role,'attack',p);
   for(const [key,value] of Object.entries(pose)) assert.ok(Number.isFinite(value),`${role}.${key}`);
  }
  assert.deepEqual(sampleActorPose(role,'attack',0),rest);
  assert.deepEqual(sampleActorPose(role,'attack',1),rest);
  assert.notDeepEqual(sampleActorPose(role,'attack',.4),rest);
 }
 assert.notDeepEqual(sampleActorPose('ranged','attack',.4),sampleActorPose('shield','attack',.4));
 assert.notDeepEqual(sampleActorPose('elite','attack',.4),sampleActorPose('boss','attack',.4));
});
test('reduced motion shortens the round and suppresses camera shake flash hit stop and lunging',()=>{
 assert.ok(allocateSequenceDurations(events,{reducedMotion:true}).reduce((a,b)=>a+b,0)<2200);
 for(const type of ['strike','counter','burst','swordArray','phase'])for(const p of [.4,.55,.7]){
  const feedback=sampleSceneFeedback({type},p,{reducedMotion:true});
  assert.equal(feedback.shakeX,0);assert.equal(feedback.shakeY,0);assert.equal(feedback.flash,0);assert.equal(feedback.hold,0);
 }
 assert.equal(sampleActorPose('hero','attack',.4,{reducedMotion:true}).x,0);
 assert.ok(Math.abs(sampleActorPose('hero','attack',.4).x)>5);
});
test('legacy poison events distinguish application from erosion',()=>{
 assert.equal(normalizeEventType({type:'poison',value:0}),'poisonApply');
 assert.equal(normalizeEventType({type:'poison',value:8}),'poisonTick');
 assert.equal(normalizeEventType({type:'swordArray'}),'swordArray');
});

test('scene promises resolve on replacement, destruction and timer completion without an animation frame',async()=>{
 const {createScene}=await import('../demo/scene.mjs');
 const previousRAF=globalThis.requestAnimationFrame,previousCancel=globalThis.cancelAnimationFrame;
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 try{
  // Intentionally never run a frame, as happens when a tab is in the background.
  const scene=createScene({getContext:()=>({})},{reducedMotion:true});
  const first=scene.play({type:'strike'});let resolved=false;first.then(()=>{resolved=true;});
  const second=scene.play({type:'shield'});await first;assert.equal(resolved,true);
  scene.destroy();await second;scene.destroy();await scene.play({type:'strike'});
  const timedScene=createScene({getContext:()=>({})},{reducedMotion:true});
  await timedScene.play({type:'unknown'});timedScene.destroy();
 }finally{globalThis.requestAnimationFrame=previousRAF;globalThis.cancelAnimationFrame=previousCancel;}
});

test('weapon attacks have different anticipation and release while recovering to rest',()=>{
 const sword=sampleActorPose('hero','attack',.5,{weaponType:'sword'}),staff=sampleActorPose('hero','attack',.5,{weaponType:'staff'}),hammer=sampleActorPose('hero','attack',.5,{weaponType:'hammer'});
 assert.ok(staff.x<sword.x,'staff casts from a planted stance');
 assert.ok(hammer.crouch>sword.crouch,'hammer lands in a low weight-bearing stance');
 assert.notEqual(staff.weapon,hammer.weapon);
 for(const weaponType of ['sword','staff','hammer']){
  assert.deepEqual(sampleActorPose('hero','attack',1,{weaponType}),sampleActorPose('hero','idle',0,{weaponType}));
  assert.equal(sampleActorPose('hero','attack',.5,{weaponType,reducedMotion:true}).x,0);
  const nearlyRest=sampleActorPose('hero','attack',.999,{weaponType}),rest=sampleActorPose('hero','idle',0,{weaponType});
  assert.ok(Math.abs(nearlyRest.frontUpper-rest.frontUpper)<.01,'arm eases into rest without an endpoint snap');
 }
});
test('phase, mechanic and break events map roles without depending on enemy names',async()=>{
 const {eventActorAction}=await import('../demo/choreography.mjs');
 assert.equal(typeof eventActorAction,'function');
 assert.equal(eventActorAction('captain',{type:'phase',sourceId:'captain',targetIds:['captain']}),'guard');
 assert.equal(eventActorAction('captain',{type:'mechanic',sourceId:'captain',targetIds:['captain']}),'prepare');
 assert.equal(eventActorAction('captain',{type:'break',sourceId:'hero',targetIds:['captain']}),'hurt');
 assert.equal(eventActorAction('hero',{type:'break',sourceId:'hero',targetIds:['captain']}),'attack');
 assert.equal(eventActorAction('other',{type:'break',sourceId:'hero',targetIds:['captain']}),'idle');
});
