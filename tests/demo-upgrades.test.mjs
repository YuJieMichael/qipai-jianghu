import test from 'node:test';
import assert from 'node:assert/strict';
import * as journey from '../demo/journey.mjs';
import {createRun} from '../demo/model.mjs';
import {startBattle, resolveRound, previewAttack} from '../demo/combat.mjs';
import {saveRun,loadRun,SAVE_KEY} from '../demo/storage.mjs';

const reward=(build='sword',seed=19)=>{const r=createRun(build,seed);r.nodeIndex=1;return journey.createChoices(r);};
const battle=(build='sword',kinds=['boss'])=>{const r=startBattle(createRun(build),{id:'test',enemies:kinds});r.combat.phase='pick';r.combat.dice=[4,2,3,5,6];r.hero.attack=0;return r;};
const memory=()=>({value:null,getItem(k){assert.equal(k,SAVE_KEY);return this.value;},setItem(k,v){assert.equal(k,SAVE_KEY);this.value=v;}});

test('version 2 growth selection requires an explicit pending binding target and cancel is harmless',()=>{
 const r=reward(),before=structuredClone(r),id=r.choices[0].id;
 assert.equal(r.version,3);assert.equal(Object.keys(r.perks).length,6);assert.equal(r.pendingUpgrade,null);
 let selected=journey.selectUpgrade(r,id);assert.deepEqual(selected.pendingUpgrade,{choiceId:id,dieIndex:null});
 assert.equal(journey.chooseUpgrade(selected,id),selected);assert.equal(journey.chooseUpgrade(selected,id,4),selected);
 assert.deepEqual(journey.cancelUpgrade(selected),r);
 selected=journey.selectUpgradeTarget(selected,4);assert.equal(selected.pendingUpgrade.dieIndex,4);
 const out=journey.chooseUpgrade(selected,id);assert.deepEqual(out.diceSkills[4],{kind:'sword',level:1});assert.deepEqual(out.diceSkills[0],r.diceSkills[0]);assert.equal(out.pendingUpgrade,null);
 assert.deepEqual(r,before);
});

test('binding previews replace arbitrary foreign skills and increment matching skills without committing',()=>{
 const r=reward();r.diceSkills[4]={kind:'poison',level:3};const id=r.choices[0].id,before=structuredClone(r);
 assert.equal(journey.previewUpgrade(r,id).valid,false);
 const p=journey.previewUpgrade(r,id,4);assert.equal(p.valid,true);assert.match(p.before,/毒针 3 级/);assert.match(p.after,/剑气 1 级/);
 assert.match(journey.previewUpgrade(r,id,0).after,/剑气 2 级/);
 assert.deepEqual(journey.chooseUpgrade(r,id,4).diceSkills[4],{kind:'sword',level:1});assert.deepEqual(r,before);
 assert.equal(journey.chooseUpgrade(r,id,99),r);
});

test('offers persist deterministically, guarantee own bind and eligible own perk, and exclude caps',()=>{
 const r=reward();assert.deepEqual(r,reward());assert.notEqual(r.seed,19);assert.equal(journey.createChoices(r),r);
 assert.equal(r.choices.length,3);assert.equal(r.choices[0].kind,'bind');assert.equal(r.choices[0].build,'sword');assert.equal(r.choices[1].kind,'perk');assert.equal(r.choices[1].build,'sword');
 assert.equal(new Set(r.choices.map(c=>c.id)).size,3);
 for(const c of r.choices.filter(c=>c.kind==='perk'))assert.equal(c.build,'sword');
 const capped=createRun('sword',19);capped.nodeIndex=1;capped.perks.swordFocus=2;capped.perks.swordEcho=2;
 const fallback=journey.createChoices(capped);assert.equal(fallback.choices.length,3);assert.ok(fallback.choices.every(c=>c.kind==='bind'));assert.equal(new Set(fallback.choices.map(c=>c.build)).size,3);
});

test('perk commit ignores die targets, raises its rank and own mastery, and capped or unbound perk is invalid',()=>{
 const r=reward(),c=r.choices.find(c=>c.kind==='perk'),before=structuredClone(r);
 assert.equal(journey.previewUpgrade(r,c.id).valid,true);
 const selected=journey.selectUpgrade(r,c.id),out=journey.chooseUpgrade(selected,c.id);
 assert.equal(out.perks[c.perkId],1);assert.equal(out.mastery,1);assert.deepEqual(out.diceSkills,r.diceSkills);assert.deepEqual(r,before);
 r.perks[c.perkId]=2;assert.equal(journey.previewUpgrade(r,c.id).valid,false);assert.equal(journey.chooseUpgrade(r,c.id),r);
 r.perks[c.perkId]=0;r.diceSkills=Array(5).fill(null);assert.equal(journey.previewUpgrade(r,c.id).valid,false);
});

test('sword focus hits current target per triggering die and echo hits all foes per pair',()=>{
 const r=battle('sword',['boss','shield']);r.diceSkills[1]={kind:'sword',level:1};r.combat.dice[1]=4;r.perks.swordFocus=2;r.perks.swordEcho=2;
 const out=resolveRound(r);assert.deepEqual(out.events.filter(e=>e.type==='swordFocus').map(e=>e.value),[6,6]);assert.equal(out.events.filter(e=>e.type==='swordEcho').length,2);assert.equal(out.events.find(e=>e.type==='swordEcho').value,6);
});

test('lingering poison increases damage and duration; catalyst adds layers and consumes its reduced threshold',()=>{
 const r=battle('poison');r.combat.dice[0]=1;r.perks.poisonLingering=2;
 let out=resolveRound(r);assert.equal(out.events.find(e=>e.type==='poisonTick').value,12);assert.deepEqual(out.state.combat.enemies[0].poison,{stacks:1,turns:4});assert.ok(out.events.some(e=>e.type==='poisonApply'));
 r.perks.poisonCatalyst=2;r.ascended=true;r.combat.enemies[0].poison={stacks:5,turns:1};out=resolveRound(r);assert.equal(out.events.find(e=>e.type==='burst').value,48);assert.deepEqual(out.state.combat.enemies[0].poison,{stacks:4,turns:4});
});

test('bulwark adds shield on every trigger and riposte adds to ascension only on positive surviving blocks',()=>{
 const r=battle('guard');r.combat.dice[0]=1;r.perks.guardBulwark=2;r.perks.guardRiposte=2;
 let out=resolveRound(r);assert.equal(out.events.find(e=>e.type==='shield').value,7);assert.equal(out.events.find(e=>e.type==='counter').value,10);
 r.ascended=true;assert.equal(resolveRound(r).events.find(e=>e.type==='counter').value,18);
 r.hero.hp=1;assert.equal(resolveRound(r).events.some(e=>e.type==='counter'),false);
 r.hero.hp=180;r.combat.enemies[0].intent.damage=0;assert.equal(resolveRound(r).events.some(e=>e.type==='counter'),false);
});

test('guard binding previews include active bulwark shield for new bindings and matching upgrades',()=>{
 for(const [rank,newShield,upgradedShield]of [[1,5,8],[2,7,10]]){
  const initial=createRun('guard',19);initial.nodeIndex=1;initial.perks.guardBulwark=rank;
  const r=journey.createChoices(initial),choice=r.choices[0],before=structuredClone(r);
  assert.ok(choice.after.includes(`护盾 ${newShield} 点`),'generated offer includes the active route');
  for(const [index,shield]of [[4,newShield],[0,upgradedShield]]){
   const preview=journey.previewUpgrade(r,choice.id,index);
   assert.equal(preview.valid,true);assert.ok(preview.after.includes(`护盾 ${shield} 点`));
   assert.ok(preview.description.includes(`护盾 ${shield} 点`));
   if(index===0)assert.ok(preview.before.includes(`护盾 ${newShield} 点`));
   const committed=journey.chooseUpgrade(r,choice.id,index);
   const fight=startBattle(committed,{id:'preview-shield',enemies:['boss']});
   fight.combat.phase='pick';fight.combat.dice=[6,6,6,6,6];fight.combat.dice[index]=1;fight.hero.attack=0;
   assert.equal(resolveRound(fight).events.find(e=>e.type==='shield'&&e.value>0).value,shield);
  }
  assert.deepEqual(r,before);
 }
});

test('ascended sword declares ascension before dedicated sword array events',()=>{
 const r=battle();r.ascended=true;r.combat.dice=[4,4,4,2,1];const out=resolveRound(r);const asc=out.events.findIndex(e=>e.type==='ascension'),arr=out.events.findIndex(e=>e.type==='swordArray');assert.ok(asc>=0&&arr>asc);
});

test('forecast and effects use actual resolution including shield, poison, target changes and boss phase without mutation',()=>{
 for(const build of ['sword','poison','guard'])for(const targetIndex of [0,1]){
  const r=battle(build,['boss','shield']);r.hero.attack=20;r.combat.enemies[0].hp=131;r.combat.enemies[1].poison={stacks:2,turns:1};r.combat.targetId=r.combat.enemies[targetIndex].id;r.combat.dice[0]=build==='sword'?4:1;
  const before=structuredClone(r),p=previewAttack(r),out=resolveRound(r);assert.deepEqual(r,before);
  assert.deepEqual(p.forecast,{totalDamage:out.state.stats.damage-r.stats.damage,poisonDamage:out.state.stats.poisonDamage-r.stats.poisonDamage,blocked:out.state.stats.blocked-r.stats.blocked,heroHpAfter:out.state.hero.hp,heroShieldAfter:out.state.hero.shield,enemies:out.state.combat.enemies.map(e=>({id:e.id,name:e.name,hpAfter:e.hp,shieldAfter:e.shield,poisonStacksAfter:e.poison.stacks,poisonTurnsAfter:e.poison.turns}))});
  assert.deepEqual(p.effects,out.events.map(({type,text,value,build,sourceId,targetIds,dieIndex})=>({...{type,text,value,build,sourceId,targetIds},...(dieIndex===undefined?{}:{dieIndex})})));
  assert.equal(previewAttack(out.state).forecast,null);
 }
});

test('v1 reward migrates without rerolling or regenerating choice text, while v2 restores pending selection',()=>{
 const old=reward();old.version=1;delete old.perks;delete old.pendingUpgrade;old.choices=old.choices.map((c,i)=>({...c,kind:'skill',build:['sword','poison','guard'][i]}));
 const s=memory();s.value=JSON.stringify(old);const migrated=loadRun(s).run;assert.ok(migrated);assert.equal(migrated.version,3);assert.equal(migrated.seed,old.seed);assert.deepEqual(migrated.choices,old.choices.map(c=>({...c,kind:'bind'})));assert.equal(migrated.pendingUpgrade,null);
 let r=journey.selectUpgrade(reward(),reward().choices[0].id);r=journey.selectUpgradeTarget(r,3);assert.equal(saveRun(s,r).ok,true);assert.deepEqual(loadRun(s).run,r);
});

test('v2 malformed perk ranks, choices and pending state are rejected',()=>{
 for(const mutate of [r=>delete r.perks,r=>r.perks.swordFocus=3,r=>r.pendingUpgrade={choiceId:'missing',dieIndex:0},r=>r.pendingUpgrade={choiceId:r.choices[0].id,dieIndex:5},r=>r.choices[1].perkId='bad',r=>r.choices[2].id=r.choices[0].id]){
  const r=reward();mutate(r);const s=memory();s.value=JSON.stringify(r);assert.equal(loadRun(s).run,null);assert.equal(saveRun(s,r).ok,false);
 }
});

test('committed growth retains readable history alongside stable legacy IDs',()=>{
 const r=reward(),choice=r.choices[0],out=journey.chooseUpgrade(r,choice.id,4);
 assert.deepEqual(out.stats.upgradeHistory,[{id:choice.id,title:choice.title,build:'sword',kind:'bind',dieIndex:4,perkId:null,before:'未绑定',after:'剑气 1 级 · 每道剑气 6 伤害'}]);
 assert.deepEqual(out.stats.upgrades,[choice.id]);
 const s=memory();assert.equal(saveRun(s,out).ok,true);assert.deepEqual(loadRun(s).run,out);
 out.stats.upgradeHistory[0].dieIndex=99;assert.equal(saveRun(s,out).ok,false);
});

test('route-aware simulator completes fixed-seed journeys with explicit binding targets',async()=>{
 const {playSeed}=await import('../tools/simulate-demo.mjs');
 for(const [build,route]of [['sword','swordFocus'],['sword','swordEcho'],['poison','poisonLingering'],['poison','poisonCatalyst'],['guard','guardBulwark'],['guard','guardRiposte']]){
  const run=playSeed(build,100,route);assert.equal(run.route,route);assert.equal(run.outcome,'victory');assert.ok(run.perks[route]>0);assert.equal(run.mastery,5);assert.ok(run.ascended);
 }
});

test('poison binding preview reflects lingering duration and damage at the active rank',()=>{
 for(const [rank,damage,turns]of [[0,8,3],[1,10,4],[2,12,5]]){
  const r=reward('poison');r.perks.poisonLingering=rank;
  const before=structuredClone(r),preview=journey.previewUpgrade(r,r.choices[0].id,4);
  assert.equal(preview.valid,true);assert.ok(preview.description.includes(`每层毒每回合 ${damage} 伤害，持续 ${turns} 回合`));assert.deepEqual(r,before);
 }
});

test('poison binding preview reflects catalyst layers and the current burst threshold consumption',()=>{
 for(const [rank,layers,threshold]of [[0,1,6],[1,2,5],[2,3,4]]){
  const r=reward('poison');r.perks.poisonCatalyst=rank;
  const preview=journey.previewUpgrade(r,r.choices[0].id,4);
  assert.ok(preview.description.includes(`附加 ${layers} 层毒`));
  assert.ok(preview.description.includes(`满 ${threshold} 层触发 48 伤害毒爆`));
  assert.ok(preview.description.includes(`消耗 ${threshold} 层`));
 }
});

test('boss summon forecast retains readable names for new enemies absent from the input state',()=>{
 const r=battle();r.hero.attack=12;r.combat.enemies[0].hp=131;
 const before=structuredClone(r),forecast=previewAttack(r).forecast;
 assert.deepEqual(forecast.enemies.map(({id,name})=>({id,name})),[
  {id:'test-0',name:'山门守将'},
  {id:'test-0-aid-1',name:'竹林刀客'},
  {id:'test-0-aid-2',name:'夜雨弩手'}
 ]);
 assert.equal(r.combat.enemies.length,1);assert.deepEqual(r,before);
});
