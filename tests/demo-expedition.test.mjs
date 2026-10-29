import test from 'node:test';import assert from 'node:assert/strict';
import {rollDice} from '../demo/model.mjs';import {resolveRound,prepareRound} from '../demo/combat.mjs';
import {enterNode,completeBattle,chooseEvent,chooseUpgrade,advanceNode} from '../demo/journey.mjs';
import {saveRun,loadRun,migrateRun} from '../demo/storage.mjs';import {createRun} from '../demo/model.mjs';
const api=await import('../demo/adventures.mjs').catch(()=>({}));
const create=(options={})=>{assert.equal(typeof api.createExpedition,'function','expedition factory is available');return api.createExpedition('sword',42,options);};
const storage=()=>({value:null,setItem(k,v){this.value=v},getItem(){return this.value}});
function play(options={}){let r=enterNode(create(options));const s=storage();for(let i=0;i<300&&!['victory','defeat'].includes(r.flow);i++){
 assert.equal(saveRun(s,r).ok,true,`${r.mode}/${r.nodeIndex}/${r.flow}/${r.combat?.phase}`);assert.deepEqual(loadRun(s).run,r);
 if(r.flow==='battle'){if(r.combat.phase==='resolved')r=prepareRound(r);r=rollDice(r);r=completeBattle(resolveRound(r).state);}
 else if(r.flow==='reward')r=chooseUpgrade(r,r.choices[0].id);
 else if(r.flow==='event')r=chooseEvent(r,'heal');
 else if(r.flow==='camp')r=advanceNode(r);else r=enterNode(r);
 }assert.ok(['victory','defeat'].includes(r.flow));assert.equal(saveRun(s,r).ok,true);assert.deepEqual(loadRun(s).run,r);return r;}
test('all eleven modes make progress and terminate with a restorable result',()=>{
 for(const mode of ['campaign','boss','tower','dungeon','arena','bounty','escort','worldboss','tournament','resource','totem']){
  const r=play({mode,loadout:{weaponType:'sword',effects:{attack:120,maxHp:500},bag:{},dice:Array.from({length:5},()=>({faces:[1,2,3,4,5,6],marks:Array(6).fill(null),materialId:'wood',materialLevel:1,decorationId:'plain'}))}});
  assert.equal(r.flow,'victory',mode);assert.ok(r.coins>0,mode);assert.ok(r.results.completed);}
});
test('route snapshots scale seven chapters and retain custom chapter configuration',()=>{
 const a=create({chapter:'bamboo'}),b=create({chapter:'peak'});assert.ok(b.route[0].enemies[0].hp>a.route[0].enemies[0].hp);
 const content={chapters:[{id:'custom',name:'自创',hpScale:3,attackScale:2}]};const r=create({chapter:'custom',content});content.chapters[0].hpScale=99;assert.equal(r.route[0].enemies[0].hp,165);assert.equal(api.getRunNode(r),r.route[0]);assert.equal(api.getRunNodes(r).length,9);
 assert.equal(create({mode:'dungeon'}).route.length,8);assert.equal(create({mode:'escort'}).route.filter(n=>n.type==='battle').length,3);assert.equal(create({mode:'tournament'}).route.filter(n=>n.type==='battle').length,4);
});
test('world boss records partial damage, resource ends on its limit, and tower preserves entered HP',()=>{
 const w=play({mode:'worldboss',worldBossHp:100000});assert.ok(w.results.worldBossDamage>0);assert.ok(w.results.worldBossDamage<100000);assert.equal(w.flow,'victory');
 const r=play({mode:'resource'});assert.equal(r.combat.round,r.combat.turnLimit);assert.ok(r.coins>0);
 const tower=create({mode:'tower',floor:4,loadout:{effects:{},progression:{towerHp:77},bag:{}}});assert.equal(tower.hero.hp,77);assert.equal(tower.floor,4);
});
test('consumables apply once per use, are immutable, cap rerolls and cannot be used after a run',()=>{
 assert.equal(typeof api.useRunItem,'function');let r=enterNode(create({loadout:{effects:{},bag:{potion:1,reroll:1,antidote:1,tonic:1}}}));r=rollDice(r);r.hero.hp=100;const before=structuredClone(r);
 let next=api.useRunItem(r,'potion');assert.equal(next.hero.hp,135);assert.equal(next.bag.potion,0);assert.equal(next.consumed.potion,1);assert.deepEqual(r,before);assert.strictEqual(api.useRunItem(next,'potion'),next);
 next.combat.rerolls=6;assert.strictEqual(api.useRunItem(next,'reroll'),next);next.combat.rerolls=1;next=api.useRunItem(next,'reroll');assert.equal(next.combat.rerolls,2);
 next=api.useRunItem(next,'antidote');assert.equal(next.hero.hp,150);assert.equal(next.hero.shield,5);next=api.useRunItem(next,'tonic');assert.equal(next.hero.attack,15);next.flow='victory';assert.strictEqual(api.useRunItem(next,'tonic'),next);
});
test('merchant costs actual run coins and rejects unavailable purchases without changing state',()=>{
 let r=create();r.nodeIndex=3;r=enterNode(r);r.coins=20;const before=structuredClone(r);const next=chooseEvent(r,'buy-potion');assert.equal(next.coins,0);assert.equal(next.bag.potion,(before.bag.potion||0)+1);assert.equal(next.nodeIndex,4);assert.deepEqual(r,before);
 r.coins=19;assert.strictEqual(chooseEvent(r,'buy-potion'),r);
});
test('v1 and v2 migrate to v3 without consuming seed or changing dice choices and pending selection',()=>{
 for(const version of [1,2]){const r=enterNode(createRun('sword',31));r.version=version;if(version===1){delete r.perks;delete r.pendingUpgrade;}const copy=structuredClone(r);const migrated=migrateRun(r);assert.ok(migrated);assert.equal(migrated.version,3);assert.equal(migrated.seed,31);assert.deepEqual(migrated.combat.dice,copy.combat.dice);assert.deepEqual(r,copy);}
});
test('new saves reject corrupt loadout route effects physical indices and scaled intent',()=>{
 const good=rollDice(enterNode(create({loadout:{effects:{extraRerolls:4},dice:Array.from({length:5},()=>({faces:[1,2,3,4,5,6],marks:Array(6).fill(null),materialId:'wood',materialLevel:1,decorationId:'plain'})),bag:{potion:1}}})));assert.ok(migrateRun(good));
 for(const mutate of [r=>r.route[0].enemies[0].hp=-1,r=>r.loadout.effects.armor=-1,r=>r.loadout.dice[0].faces[0]=7,r=>r.combat.faceIndices[0]=6,r=>r.combat.rerolls=7,r=>r.combat.enemies[0].intent.damage++,r=>r.bag.potion=-1,r=>r.consumed.potion=0.5]){const r=structuredClone(good);mutate(r);assert.equal(migrateRun(r),null);}
});
test('all modes also reach and restore defeat, including living enemies at totem turn limit',()=>{
 for(const mode of ['campaign','boss','tower','dungeon','arena','bounty','escort','worldboss','tournament','resource','totem']){
  let r=rollDice(enterNode(create({mode})));r.hero.hp=1;r.hero.attack=0;r.diceSkills=Array(5).fill(null);r=completeBattle(resolveRound(r).state);assert.equal(r.flow,'defeat',mode);assert.ok(migrateRun(r),mode);
 }
 let r=rollDice(enterNode(create({mode:'totem',content:{chapters:[{id:'bamboo',hpScale:1,attackScale:1}],modes:[{id:'totem',hpScale:1,attackScale:1,turnLimit:1,reward:{gold:1}}]}})));r.hero.attack=0;r.diceSkills=Array(5).fill(null);r=completeBattle(resolveRound(r).state);assert.equal(r.flow,'defeat');assert.ok(migrateRun(r));
});
test('save validation returns null for malformed nested objects instead of throwing',()=>{
 const good=enterNode(create());for(const mutate of [r=>r.combat.enemies={},r=>r.combat.enemies=null,r=>r.route=[null],r=>r.loadout={effects:null},r=>r.results=null]){const bad=structuredClone(good);mutate(bad);assert.equal(migrateRun(bad),null);}
});
test('profile run identity remains numeric through expedition and save restore',()=>{
 const r=create({runId:17});assert.equal(r.runId,17);assert.equal(migrateRun(r).runId,17);
});
test('totem daily modifier is seeded into actual shield attack or health stats',()=>{
 const a=api.createExpedition('sword',1,{mode:'totem'}),b=api.createExpedition('sword',2,{mode:'totem'});assert.notDeepEqual(a.route[0].enemies,b.route[0].enemies);assert.notEqual(a.route[0].modifier,b.route[0].modifier);
});
test('seeded expedition simulator terminates and validates every mode with equipped profile snapshots',async()=>{
 const {playExpedition}=await import('../tools/simulate-demo.mjs');assert.equal(typeof playExpedition,'function');
 const {createProfile,deriveLoadout}=await import('../demo/profile.mjs');const loadout=deriveLoadout(createProfile(1,0));
 for(const mode of ['campaign','boss','tower','dungeon','arena','bounty','escort','worldboss','tournament','resource','totem'])for(const seed of [1,7,42]){
  const result=playExpedition('sword',seed,{mode,loadout,runId:seed});assert.ok(['victory','defeat'].includes(result.outcome),mode);assert.ok(result.turns>0);assert.ok(result.turns<300);assert.equal(result.mode,mode);
 }
});
test('save validation rejects invented reinforcements, unlock tampering and unknown consumed items',()=>{
 const r=create({loadout:{effects:{},dice:Array.from({length:5},()=>({faces:[1,2,3,4,5,6],marks:Array(6).fill(null),materialId:'wood',materialLevel:1,decorationId:'focus'})),bag:{potion:1}}});const good=rollDice(enterNode(r));
 for(const mutate of [s=>s.combat.frozen[0]=false,s=>s.consumed.herb=1,s=>{const e=structuredClone(s.combat.enemies[0]);e.id='invented-aid-1';s.combat.enemies.push(e);},s=>s.bag.potion=0]){const bad=structuredClone(good);mutate(bad);assert.equal(migrateRun(bad),null);}
});
for(const mode of ['campaign','boss'])test(`direct ${mode} factory bounds malformed turn limits before starting a restorable battle`,()=>{
 for(const [value,want]of [[.5,1],[0,30],[-2,30],[NaN,30],[Infinity,30],['3',30],[1001,1000],[4.9,4],[null,30]]){
  const r=enterNode(create({mode,content:{chapters:[{id:'bamboo',hpScale:1,attackScale:1,reward:{gold:1}}],modes:[{id:mode,hpScale:1,attackScale:1,turnLimit:value,reward:{gold:1}}]}}));
  assert.equal(r.combat.turnLimit,want,`${mode} turnLimit ${String(value)}`);assert.ok(migrateRun(r));
 }
});
for(const [field,index]of [['coins',0],['treasure',3]])for(const [label,value]of [['negative',-100],['fraction',.5],['nan',NaN],['infinity',Infinity],['string','100'],['null',null],['overflow',1000000001],['unsafe',Number.MAX_SAFE_INTEGER+1]])test(`saved route rejects ${label} ${field} before it can affect run currency`,()=>{
 const r=create();r.route[index][field]=value;assert.equal(migrateRun(r),null);const s=storage();assert.equal(saveRun(s,r).ok,false);
});
test('saved route accepts zero currency and rejects an out of range battle turn cap',()=>{
 const r=create();r.route[0].coins=0;r.route[3].treasure=0;assert.ok(migrateRun(r));r.route[0].turnLimit=1001;assert.equal(migrateRun(r),null);
});
