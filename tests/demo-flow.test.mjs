import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../demo/main.mjs';
import {createRun} from '../demo/model.mjs';
import {enterNode} from '../demo/journey.mjs';

function memory(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
function playable(){const r=enterNode(createRun('sword',19));r.combat.phase='pick';r.combat.dice=[6,6,6,6,6];r.combat.enemies[0].hp=1;return r;}
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
 const act=async(type,value)=>{actions.add(type);await c.act({type,value});assert.equal(c.busy,false);};
 await act('start',build);
 while(!['victory','defeat'].includes(c.state.flow)&&steps++<200){const r=c.state;
  if(r.flow==='battle'){
   await act('roll');while(c.state.combat.rerolls>0){for(let i=0;i<5;i++){const s=c.state;const kind=s.diceSkills[i]?.kind??build,v=s.combat.dice[i];const hold=kind==='sword'?v>=4:kind==='poison'?v%2===1:v<=3;if(hold!==s.combat.held[i])await act('hold',i);}if(c.state.combat.held.every(Boolean))break;await act('reroll');}
   const live=c.state.combat.enemies.filter(e=>e.hp>0);const target=live.find(e=>e.kind==='boss'&&e.intent.kind==='heavy'&&e.stance>0)??[...live].sort((a,b)=>a.hp-b.hp||a.id.localeCompare(b.id))[0];await act('target',target.id);await act('attack');
  }else if(r.flow==='reward'){rewards++;await act('upgrade',r.choices.find(c=>c.build===build).id);}else if(r.flow==='event'){event=true;await act('event',r.hero.maxHp-r.hero.hp>=35?'heal':'train');}else if(r.flow==='camp'){camp=true;await act('next');}else assert.fail(`stalled ${r.flow}`);
 }
 assert.equal(c.state.flow,'victory');assert.equal(rewards,5);assert.ok(event&&camp);for(const type of ['roll','hold','reroll','target','attack','upgrade','event','next'])assert.ok(actions.has(type));c.destroy();
});
test('bfcache restore remounts once without accumulating lifecycle listeners',async()=>{
 const {bindPageLifecycle}=await import('../demo/main.mjs');const win=new EventTarget();let cleaned=0,mounted=0;
 bindPageLifecycle(win,()=>cleaned++,()=>{mounted++;bindPageLifecycle(win,()=>cleaned++,()=>mounted++);});
 win.dispatchEvent(new Event('pagehide'));assert.equal(cleaned,1);
 const restore=new Event('pageshow');Object.defineProperty(restore,'persisted',{value:true});win.dispatchEvent(restore);win.dispatchEvent(restore);assert.equal(mounted,1);
 win.dispatchEvent(new Event('pagehide'));assert.equal(cleaned,2);win.dispatchEvent(restore);assert.equal(mounted,2);
});
