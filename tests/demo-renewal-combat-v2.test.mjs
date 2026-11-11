import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../demo/renewal/model.mjs';
const begun=()=>m.act(m.newAdventure(42),{type:'begin'}).state;
test('initial rolls never damage; rerolls charge every sword die; attack precedes random single-target release',()=>{
 const start=m.act(m.newAdventure(42),{type:'begin'});
 assert.equal(start.state.enemies[0].hp,30);assert.equal(start.state.charges,0);
 let s=start.state;s.enemies[0].hp=100;s.enemies[0].maxHp=100;
 s.dice[0].level=2;
 const r=m.act(s,{type:'reroll',index:0});
 assert.equal(r.state.enemies[0].hp,100);assert.equal(r.state.charges,2);
 assert.deepEqual(r.events.map(e=>e.type),['roll','charge']);
 const a=m.act(r.state,{type:'attack'});
 assert.deepEqual(a.events.slice(0,3).map(e=>e.type),['attack','sword','sword']);
 assert.equal(a.state.charges,0);assert.equal(a.events.filter(e=>e.type==='sword').length,2);
 assert.equal(a.state.enemies[0].hp,100-m.handOf(r.state).damage-8);
 assert.equal(m.validateAdventure(a.state),true);
});
test('all participating dice points contribute, including duplicate points',()=>{
 const s=begun();s.dice[1]={...s.dice[1],unlocked:true,value:2};s.dice[0].value=2;
 assert.equal(m.handOf(s).points,4);assert.equal(m.handOf(s).damage,27);
});
test('legacy reward migration preserves HP, faces and pending reward without replaying effects',()=>{
 let s=begun();s.enemies[0].hp=1;s=m.act(s,{type:'attack'}).state;
 const legacy=structuredClone(s);legacy.version=1;for(const k of ['chapterId','runId','loadout','charges'])delete legacy[k];
 legacy.hero.hp=93;const copy=structuredClone(legacy);
 const restored=m.migrateAdventure(legacy);
 assert.equal(restored.version,2);assert.equal(restored.phase,'reward');assert.equal(restored.hero.hp,93);
 assert.deepEqual(restored.dice,copy.dice);assert.deepEqual(restored.choices.map(c=>c.id),copy.choices.map(c=>c.id));
 assert.equal(restored.charges,0);assert.equal(m.validateAdventure(restored),true);
 assert.deepEqual(legacy,copy);assert.strictEqual(m.act(restored,{type:'begin'}).state,restored);
});
test('boss charge can be interrupted by two pairs; half-health phase happens once',()=>{
 const s=begun();s.stage=5;s.dice.forEach((d,i)=>Object.assign(d,{unlocked:true,value:[2,2,3,3,5][i]}));
 s.enemies=[{id:'boss',kind:'boss',name:'试炼官',hp:200,maxHp:200,attack:18,intent:'charge',phase:1}];s.targetId='boss';
 assert.equal(m.validateAdventure(s),true);
 const a=m.act(s,{type:'attack'});assert.ok(a.events.some(e=>e.type==='intent'&&/打断/.test(e.text)));
 assert.ok(!a.events.some(e=>e.type==='hurt'));assert.equal(a.state.enemies[0].intent,'strike');
 a.state.enemies[0].hp=99;const b=m.act(a.state,{type:'attack'});
 assert.equal(b.state.enemies[0].phase,2);assert.equal(b.events.filter(e=>e.type==='phase').length,1);
 const c=m.act(b.state,{type:'attack'});assert.equal(c.events.filter(e=>e.type==='phase').length,0);
});
test('loadout changes on next encounter change stats without healing through swaps',()=>{
 let s=begun();s.hero.hp=80;s.enemies[0].hp=1;s=m.act(s,{type:'attack'}).state;
 const loadout={attack:4,maxHp:20,armor:2,sword:1,flame:2,guard:2,weapon:'staff'};
 const n=m.act(s,{type:'choose',choiceId:'s0-face',index:0,loadout}).state;
 assert.equal(n.hero.hp,80);assert.equal(n.hero.maxHp,140);assert.equal(n.hero.attack,18);assert.deepEqual(n.loadout,loadout);
 assert.equal(m.validateAdventure(n),true);
});
test('second chapter has a full distinct six-fight path and v2 bounds reject hostile data',()=>{
 let s=m.act(m.newAdventure(1,{chapterId:2,runId:'run-3'}),{type:'begin'}).state;
 assert.equal(s.chapterId,2);assert.notEqual(s.enemies[0].name,'拦路刀客');
 for(const mutate of [s=>s.charges=61,s=>s.chapterId=3,s=>s.runId=-1,s=>s.loadout.armor=10001]){
  const bad=structuredClone(s);mutate(bad);assert.equal(m.validateAdventure(bad),false);
 }
 for(let stage=0;stage<6;stage++){
  s.hero.attack=10000;while(s.phase==='battle')s=m.act(s,{type:'attack'}).state;
  assert.equal(s.stage,stage);assert.equal(m.validateAdventure(s),true);
  if(stage<5)s=m.act(s,{type:'choose',choiceId:`s${stage}-vitality`}).state;
 }
 assert.equal(s.phase,'won');
});

test('all flame impacts precede all guard effects independent of equipped die slot',()=>{
 const s=begun();s.stage=1;Object.assign(s.dice[0],{skill:'guard',value:1});Object.assign(s.dice[1],{unlocked:true,skill:'flame',level:1,value:2});
 s.enemies[0].hp=100;s.enemies[0].maxHp=100;
 const r=m.act(s,{type:'attack'});assert.deepEqual(r.events.slice(0,4).map(e=>e.type),['attack','flame','guard','hurt']);
});
