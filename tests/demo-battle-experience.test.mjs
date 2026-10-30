import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../demo/main.mjs';
import {createProfile,applyProfileAction} from '../demo/profile.mjs';
import {CONTENT} from '../demo/content.mjs';
import {createRun,rollDice} from '../demo/model.mjs';
import {enterNode} from '../demo/journey.mjs';
import {resolveRound} from '../demo/combat.mjs';
import {SAVE_KEY} from '../demo/storage.mjs';
const reportModule=await import('../demo/battle-report.mjs').catch(()=>null);
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function strongProfile(){const content=structuredClone(CONTENT);content.equipment[0].effects.attack=10000;return applyProfileAction(createProfile(1,100000),{type:'content-import',value:content},{now:100000}).profile;}
function fixture(options={}){return createController({storage:memory(),now:()=>100000,seed:()=>2,...options});}
async function boss(c){await c.act({type:'expedition',value:{build:'sword',chapter:'bamboo',mode:'boss'}});}
test('playback speed persists separately and never changes reduced motion',async()=>{
 const storage=memory(),c=fixture({storage,defaultSettings:{reducedMotion:true}});try{await c.act({type:'speed'});assert.equal(c.settings.playbackSpeed,2);assert.equal(c.settings.reducedMotion,true);}finally{c.destroy();}
 const next=fixture({storage});assert.equal(next.settings.playbackSpeed,2);assert.equal(next.settings.reducedMotion,true);next.destroy();
 storage.setItem('qipai-bamboo-settings-v1',JSON.stringify({playbackSpeed:99,reducedMotion:false}));const invalid=fixture({storage});assert.equal(invalid.settings.playbackSpeed,1);invalid.destroy();
});
test('skip resolves a pending presentation and yields identical victory and exactly-once settlement',async()=>{
 const normal=fixture({initialProfile:strongProfile()}),storage=memory();let calls=0,skips=0,view;
 const skipped=fixture({storage,initialProfile:strongProfile(),render:(_r,o)=>view=o,play:()=>{calls++;return new Promise(()=>{});},onSkipPlayback:()=>skips++});
 try{await boss(normal);await boss(skipped);await normal.act({type:'attack'});const playing=skipped.act({type:'attack'});assert.equal(skipped.busy,true);assert.ok(view.playback?.total>0);await skipped.act({type:'skip-playback'});await skipped.act({type:'skip-playback'});await Promise.race([playing,new Promise(r=>setTimeout(r,40))]);assert.equal(skipped.busy,false);assert.equal(calls,1);assert.equal(skips,1);assert.deepEqual(skipped.state,normal.state);assert.deepEqual(skipped.profile,normal.profile);assert.deepEqual(skipped.profile.settledRunIds,[1]);assert.ok(view.roundReport.damage>0);assert.equal(view.playback,null);assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).flow,'victory');}
 finally{normal.destroy();skipped.destroy();}
});
test('skip followed immediately by exit retains the decision and forbids late commit',async()=>{
 const storage=memory();let renders=0;const c=fixture({storage,initialProfile:strongProfile(),play:()=>new Promise(()=>{}),render:()=>renders++});
 try{await boss(c);const before=structuredClone(c.state);const playing=c.act({type:'attack'});const skip=c.act({type:'skip-playback'});const exiting=c.act({type:'exit'});const atExit=renders;await skip;await exiting;await tick();assert.equal(c.busy,false);assert.deepEqual(c.state,before);assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEY)),before);assert.equal(c.profile.settledRunIds.length,0);assert.equal(renders,atExit);await Promise.race([playing,tick()]);}
 finally{c.destroy();}
});
test('busy speed changes preserve current snapshot and apply to later events',async()=>{
 const contexts=[],waits=[],views=[];const c=fixture({play:(_e,ctx)=>{contexts.push(ctx);return new Promise(r=>waits.push(r));},render:r=>views.push(structuredClone(r))});
 try{await boss(c);const playing=c.act({type:'attack'});const before=structuredClone(views.at(-1));await c.act({type:'speed'});assert.equal(c.settings.playbackSpeed,2);assert.deepEqual(views.at(-1),before);assert.equal(contexts[0].playbackSpeed,1);waits.shift()();await tick();assert.equal(contexts[1].playbackSpeed,2);c.destroy();await Promise.race([playing,tick()]);assert.equal(c.state.stats.turns,0);}
 finally{c.destroy();}
});
test('battle report uses actual HP damage rather than shield or overkill and detaches all data',()=>{
 assert.ok(reportModule,'battle report builder exists');const before=rollDice(enterNode(createRun('sword',2)));before.hero.attack=10;before.hero.hp=100;before.diceSkills=Array(5).fill(null);before.combat.dice=[1,2,3,4,5];Object.assign(before.combat.enemies[0],{name:'独行刀客',hp:30,maxHp:30,shield:5});
 const result=resolveRound(before),original=JSON.stringify({before,result});const report=reportModule.createBattleReport(before,result);
 assert.equal(report.hand.name,'顺子');assert.deepEqual(report.hand.dice,[1,2,3,4,5]);assert.equal(report.damage,30);assert.equal(report.kills,1);assert.deepEqual(report.hero,{hpBefore:100,hpAfter:100,shieldBefore:0,shieldAfter:0});assert.ok(report.events.some(e=>e.targetNames.includes('独行刀客')));assert.ok(report.events.every(e=>!Object.hasOwn(e,'snapshot')));
 report.hand.dice[0]=6;report.events[0].targetNames.push('not in original');assert.equal(JSON.stringify({before,result}),original);
});
test('roll cues fire on genuine changes and report remains transient',async()=>{
 const cues=[];let view;const c=fixture({onDiceCue:type=>cues.push(type),render:(_r,o)=>view=o});
 try{await boss(c);assert.deepEqual(cues,['dice']);await c.act({type:'roll'});assert.deepEqual(cues,['dice']);await c.act({type:'reroll'});assert.deepEqual(cues,['dice']);await c.act({type:'hold',value:1});assert.deepEqual(cues,['dice','hold']);await c.act({type:'reroll'});assert.deepEqual(cues,['dice','hold','dice']);await c.act({type:'attack'});assert.ok(view.roundReport);assert.equal(Object.hasOwn(c.state,'roundReport'),false);await c.act({type:'home'});assert.equal(view.roundReport,null);await c.act({type:'resume'});assert.equal(view.roundReport,null);}
 finally{c.destroy();}
});
test('skipping a surviving boss round still rolls exactly one identical next turn',async()=>{
 let cueCount=0;const normal=fixture(),skipped=fixture({play:()=>new Promise(()=>{}),onDiceCue:type=>{if(type==='dice')cueCount++;}});
 try{await boss(normal);await boss(skipped);await normal.act({type:'attack'});const playing=skipped.act({type:'attack'});await skipped.act({type:'skip-playback'});await playing;assert.equal(skipped.state.flow,'battle');assert.equal(skipped.state.combat.round,2);assert.equal(skipped.state.combat.phase,'pick');assert.deepEqual(skipped.state,normal.state);assert.equal(cueCount,2);assert.equal(skipped.state.stats.turns,1);}
 finally{normal.destroy();skipped.destroy();}
});
