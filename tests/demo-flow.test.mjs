import test from 'node:test';
import assert from 'node:assert/strict';
import {createController,seedFromQuery} from '../demo/main.mjs';
import {createRun} from '../demo/model.mjs';
import {enterNode,createChoices} from '../demo/journey.mjs';

function memory(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
function playable(){const r=enterNode(createRun('sword',19));r.combat.phase='pick';r.combat.dice=[6,6,6,6,6];r.combat.enemies[0].hp=1;return r;}
function reward(){const r=createRun('sword',19);r.flow='reward';r.nodeIndex=1;r.pendingUpgrade=null;r.choices=['sword','poison','guard'].map(build=>({id:`test-${build}`,kind:'bind',build,title:'武学传承',description:'骰技触发',before:'未绑定',after:'技能一级',dieIndex:1}));return r;}
test('upgrade selection is reversible and confirmation requires an explicit target',async()=>{
 const initial=reward(),c=createController({initial,storage:memory()});
 await c.act({type:'upgrade',value:'test-sword'});
 assert.equal(c.state.flow,'reward');assert.deepEqual(c.state.pendingUpgrade,{choiceId:'test-sword',dieIndex:null});
 assert.deepEqual(c.state.diceSkills,initial.diceSkills);assert.equal(c.state.mastery,0);assert.equal(c.state.seed,initial.seed);
 const selected=structuredClone(c.state);await c.act({type:'upgrade-confirm'});assert.deepEqual(c.state,selected);
 await c.act({type:'upgrade-target',value:4});assert.equal(c.state.pendingUpgrade.dieIndex,4);
 await c.act({type:'upgrade-cancel'});assert.equal(c.state.pendingUpgrade,null);assert.deepEqual(c.state.choices,initial.choices);
 assert.deepEqual(c.state.diceSkills,initial.diceSkills);assert.equal(c.state.seed,initial.seed);
 await c.act({type:'upgrade',value:'test-sword'});await c.act({type:'upgrade-target',value:4});
 await c.act({type:'upgrade-confirm'});const committed=structuredClone(c.state);await c.act({type:'upgrade-confirm'});
 assert.deepEqual(c.state,committed);assert.deepEqual(c.state.diceSkills[4],{kind:'sword',level:1});assert.equal(c.state.diceSkills[1],null);assert.equal(c.state.mastery,1);assert.equal(c.state.stats.upgrades.length,1);c.destroy();
});
test('perk selection confirms without a target and records its named rank change',async()=>{
 const initial=createRun('sword',19);initial.nodeIndex=1;const offer=createChoices(initial),choice=offer.choices.find(c=>c.kind==='perk');
 const c=createController({initial:offer,storage:memory()});await c.act({type:'upgrade',value:choice.id});
 assert.equal(c.state.perks[choice.perkId],0);assert.equal(c.state.pendingUpgrade.dieIndex,null);
 await c.act({type:'upgrade-target',value:2});assert.equal(c.state.pendingUpgrade.dieIndex,null);
 await c.act({type:'upgrade-confirm'});assert.equal(c.state.perks[choice.perkId],1);assert.equal(c.state.mastery,1);
 const history=c.state.stats.upgradeHistory.at(-1);assert.equal(history.title,choice.title);assert.ok(history.before.includes('0'));assert.ok(history.after.includes('1'));c.destroy();
});
test('restored pending upgrade preserves its exact offer and target until confirmation',async()=>{
 const storage=memory(),first=createController({initial:reward(),storage});
 await first.act({type:'upgrade',value:'test-sword'});await first.act({type:'upgrade-target',value:3});const boundary=structuredClone(first.state);first.destroy();
 const resumed=createController({storage});await resumed.act({type:'resume'});assert.deepEqual(resumed.state,boundary);
 await resumed.act({type:'upgrade-confirm'});assert.deepEqual(resumed.state.diceSkills[3],{kind:'sword',level:1});assert.equal(resumed.state.stats.upgrades.length,1);resumed.destroy();
});
test('round playback receives the shared event list and matching index while busy rejects restart',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve),contexts=[];
 const c=createController({initial:playable(),storage:memory(),play:async(event,context)=>{contexts.push({event,context});await wait;}});
 const playing=c.act({type:'attack'}),boundary=structuredClone(c.state);
 for(const action of [{type:'start',value:'poison'},{type:'retry'},{type:'resume'},{type:'upgrade-confirm'}])await c.act(action);
 assert.deepEqual(c.state,boundary);release();await playing;
 assert.ok(contexts.length>0);for(const [i,item]of contexts.entries()){assert.equal(item.context.eventIndex,i);assert.equal(item.context.events[i],item.event);assert.equal(item.context.events,contexts[0].context.events);}c.destroy();
});
test('seed query uses requested digits and falls back for invalid values',()=>{
 assert.equal(seedFromQuery('2',()=>99),2);assert.equal(seedFromQuery('0',()=>99),0);
 assert.equal(seedFromQuery(null,()=>99),99);assert.equal(seedFromQuery('4294967296',()=>99),99);
 assert.equal(seedFromQuery('-2',()=>99),99);
});
test('serialized actions accept only one attack while playback is pending',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);let plays=0;
 const c=createController({initial:playable(),storage:memory(),play:async()=>{plays++;await wait;}});
 const first=c.act({type:'attack'});const second=c.act({type:'attack'});
 assert.equal(c.busy,true);await second;release();await first;
 assert.equal(c.state.stats.kills,1);assert.ok(plays>0);assert.equal(c.busy,false);
 assert.equal(c.state.flow,'reward');c.destroy();
});
test('animation exit cancels remaining updates and saves preattack boundary',async()=>{
 let release;let renders=0;const wait=new Promise(resolve=>release=resolve);const storage=memory();
 const initial=playable();const c=createController({initial,storage,play:()=>wait,render:()=>renders++});
 const playing=c.act({type:'attack'});c.destroy();const atExit=renders;release();await playing;
 assert.equal(renders,atExit);assert.equal(c.state.stats.kills,0);
 const saved=JSON.parse(storage.getItem('qipai-bamboo-demo-v1'));
 assert.deepEqual(saved.combat.dice,initial.combat.dice);assert.equal(saved.seed,initial.seed);
});
test('restore keeps held dice, generated choices and enemy intent',async()=>{
 const storage=memory();const first=createController({initial:playable(),storage});
 await first.act({type:'hold',value:2});const boundary=structuredClone(first.state);first.destroy();
 const resumed=createController({storage});await resumed.act({type:'resume'});
 assert.deepEqual(resumed.state.combat,boundary.combat);assert.equal(resumed.state.seed,boundary.seed);resumed.destroy();
});
test('a failed storage write leaves the game playable with visible notice',async()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('quota');}};let message='';
 const c=createController({storage,render:(_r,opts)=>message=opts.message});
 await c.act({type:'start',value:'guard'});
 assert.equal(c.state.flow,'battle');assert.ok(message.length>0);c.destroy();
});
test('closing the title screen preserves the previous playable checkpoint',()=>{
 const storage=memory();const existing=playable();storage.setItem('qipai-bamboo-demo-v1',JSON.stringify(existing));
 const c=createController({storage});c.destroy();
 assert.deepEqual(JSON.parse(storage.getItem('qipai-bamboo-demo-v1')),existing);
});

test('settings preserve latest playback snapshot and preattack checkpoint',async()=>{
 const waits=[];const views=[];const storage=memory();const c=createController({initial:playable(),storage,render:r=>views.push(structuredClone(r)),play:()=>new Promise(resolve=>waits.push(resolve))});
 const attack=c.act({type:'attack'});waits.shift()();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(waits.length,1);waits.shift()();await new Promise(resolve=>setImmediate(resolve));assert.equal(waits.length,1);const latest=views.at(-1);assert.equal(latest.combat.enemies[0].hp,0);await c.act({type:'mute'});assert.deepEqual(views.at(-1),latest);
 assert.equal(JSON.parse(storage.getItem('qipai-bamboo-demo-v1')).combat.phase,'pick');
 c.destroy();waits.shift()();await attack;
});
test('system motion preference is default and saved false overrides it',()=>{
 const storage=memory();let settings;const first=createController({storage,defaultSettings:{reducedMotion:true},onSettings:s=>settings=s});assert.equal(settings.reducedMotion,true);first.destroy();
 storage.setItem('qipai-bamboo-settings-v1',JSON.stringify({muted:false,reducedMotion:false}));const second=createController({storage,defaultSettings:{reducedMotion:true},onSettings:s=>settings=s});assert.equal(settings.reducedMotion,false);second.destroy();
});
for(const build of ['sword','poison','guard'])test(`controller traverses full real journey ${build} seed 2`,async()=>{
 const c=createController({storage:memory(),seed:()=>2,play:async()=>{}});let rewards=0,event=false,camp=false,steps=0;const actions=new Set();
 const act=async(type,value)=>{actions.add(type);await c.act({type,value});assert.equal(c.busy,false);if(c.state.flow==='battle'){assert.equal(c.state.combat.phase,'pick');assert.ok(c.state.combat.dice.every(value=>Number.isInteger(value)&&value>=1&&value<=6));}};
 await act('start',build);
 while(!['victory','defeat'].includes(c.state.flow)&&steps++<200){const r=c.state;
  if(r.flow==='battle'){
   while(c.state.combat.rerolls>0){for(let i=0;i<5;i++){const s=c.state;const kind=s.diceSkills[i]?.kind??build,v=s.combat.dice[i];const hold=kind==='sword'?v>=4:kind==='poison'?v%2===1:v<=3;if(hold!==s.combat.held[i])await act('hold',i);}if(c.state.combat.held.every(Boolean))break;await act('reroll');}
   const live=c.state.combat.enemies.filter(e=>e.hp>0);const target=live.find(e=>e.kind==='boss'&&e.intent.kind==='heavy'&&e.stance>0)??[...live].sort((a,b)=>a.hp-b.hp||a.id.localeCompare(b.id))[0];await act('target',target.id);await act('attack');
  }else if(r.flow==='reward'){rewards++;const choice=r.choices.find(c=>c.build===build&&c.kind!=='perk');await act('upgrade',choice.id);await act('upgrade-target',r.diceSkills.findIndex(s=>s===null)>=0?r.diceSkills.findIndex(s=>s===null):0);await act('upgrade-confirm');}else if(r.flow==='event'){event=true;await act('event',r.hero.maxHp-r.hero.hp>=35?'heal':'train');}else if(r.flow==='camp'){camp=true;await act('next');}else assert.fail(`stalled ${r.flow}`);
 }
 assert.equal(c.state.flow,'victory');assert.equal(rewards,5);assert.ok(event&&camp);assert.equal(actions.has('roll'),false);for(const type of ['hold','reroll','target','attack','upgrade','upgrade-target','upgrade-confirm','event','next'])assert.ok(actions.has(type));c.destroy();
});
test('bfcache restore remounts once without accumulating lifecycle listeners',async()=>{
 const {bindPageLifecycle}=await import('../demo/main.mjs');const win=new EventTarget();let cleaned=0,mounted=0;
 bindPageLifecycle(win,()=>cleaned++,()=>{mounted++;bindPageLifecycle(win,()=>cleaned++,()=>mounted++);});
 win.dispatchEvent(new Event('pagehide'));assert.equal(cleaned,1);
 const restore=new Event('pageshow');Object.defineProperty(restore,'persisted',{value:true});win.dispatchEvent(restore);win.dispatchEvent(restore);assert.equal(mounted,1);
 win.dispatchEvent(new Event('pagehide'));assert.equal(cleaned,2);win.dispatchEvent(restore);assert.equal(mounted,2);
});
