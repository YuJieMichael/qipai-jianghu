import test from 'node:test';import assert from 'node:assert/strict';import {createRun} from '../demo/model.mjs';import {enterNode} from '../demo/journey.mjs';import {saveRun,loadRun} from '../demo/storage.mjs';
const memory=()=>({data:{},getItem(k){assert.notEqual(k,'qipai-jianghu-v1');return this.data[k]??null},setItem(k,v){assert.notEqual(k,'qipai-jianghu-v1');this.data[k]=v}});
test('roundtrip choices seed and combat',()=>{const s=memory(),r=enterNode(createRun('poison',123));assert.equal(saveRun(s,r).ok,true);assert.deepEqual(loadRun(s).run,r);assert.ok(JSON.parse(s.data['qipai-bamboo-demo-v1']).combat);});
test('reject invalid data visibly',()=>{for(const mutate of [r=>r.version=2,r=>r.build='bad',r=>r.hero.hp=-1,r=>r.nodeIndex=9,r=>r.combat.enemies[0].poison=null,r=>r.diceSkills=[{}]]){const s=memory(),r=enterNode(createRun('sword'));mutate(r);s.data['qipai-bamboo-demo-v1']=JSON.stringify(r);const out=loadRun(s);assert.equal(out.run,null);assert.ok(out.message);}const s=memory();s.data['qipai-bamboo-demo-v1']='{';assert.equal(loadRun(s).run,null);});
test('blocked storage does not throw',()=>{const s={getItem(){throw Error()},setItem(){throw Error()}};assert.equal(saveRun(s,createRun('guard')).ok,false);assert.equal(loadRun(s).run,null);});

test('reject malformed phase, intent, flags and flow-node boundaries',()=>{
 const mutations=[
  r=>r.combat.phase='pick',
  r=>r.combat.dice[0]=1,
  r=>delete r.combat.swordArrayUsed,
  r=>r.combat.swordArrayUsed=1,
  r=>r.combat.enemies[0].intent.kind='unknown',
  r=>r.combat.enemies[0].intent.damage=999,
  r=>r.combat.enemies[0].intent={kind:'heavy',damage:42,label:'蓄力'},
  r=>r.combat.enemies[0].intent={kind:'stunned',damage:0,label:'失衡'},
  r=>r.nodeIndex=3,
  r=>r.flow='event',
  r=>r.flow='camp',
  r=>r.flow='victory',
  r=>r.flow='defeat'
 ];
 for(const mutate of mutations){const s=memory(),r=enterNode(createRun('sword'));mutate(r);s.data['qipai-bamboo-demo-v1']=JSON.stringify(r);const out=loadRun(s);assert.equal(out.run,null,JSON.stringify(r));assert.ok(out.message);assert.equal(saveRun(s,r).ok,false);}
});

test('all legitimate journey boundaries roundtrip with exact combat data',async()=>{
 const {rollDice}=await import('../demo/model.mjs');
 const {resolveRound,prepareRound}=await import('../demo/combat.mjs');
 const {completeBattle,chooseUpgrade,chooseEvent,advanceNode}=await import('../demo/journey.mjs');
 const flows=new Set(),checkpoint=r=>{const s=memory();assert.equal(saveRun(s,r).ok,true,`${r.flow} ${r.nodeIndex} ${r.combat?.phase}`);assert.deepEqual(loadRun(s).run,r);flows.add(r.flow);};
 let r=createRun('sword',78);checkpoint(r);r=enterNode(r);
 for(let i=0;i<30&&r.flow!=='victory';i++){
  checkpoint(r);
  if(r.flow==='battle'){
   r=rollDice(r);checkpoint(r);
   const defeat=structuredClone(r);defeat.hero.hp=0;defeat.combat.phase='resolved';checkpoint(completeBattle(defeat));
   r=resolveRound(r).state;checkpoint(r);
   // Finish remaining foes at a resolved boundary; journey accepts the combat outcome.
   r.combat.enemies.forEach(e=>e.hp=0);r.combat.targetId='';checkpoint(r);
   r=completeBattle(r);
  }else if(r.flow==='reward')r=chooseUpgrade(r,r.choices.find(c=>c.build===r.build).id);
  else if(r.flow==='event')r=chooseEvent(r,'heal');
  else r=advanceNode(r);
 }
 checkpoint(r);assert.deepEqual([...flows].sort(),['battle','camp','defeat','event','intro','reward','victory']);
 // A living boss uses heavy intent on even rounds, with stunned allowed after stance breaks.
 let boss=createRun('guard');boss.nodeIndex=8;boss=rollDice(enterNode(boss));boss=resolveRound(boss).state;boss=prepareRound(boss);checkpoint(boss);
 assert.equal(boss.combat.enemies[0].intent.kind,'heavy');
 boss=rollDice(boss);boss.combat.phase='resolved';boss.combat.enemies[0].stance=0;boss.combat.enemies[0].intent={kind:'stunned',damage:0,label:'破势失衡'};checkpoint(boss);
});
