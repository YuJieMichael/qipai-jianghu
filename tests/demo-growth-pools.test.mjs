import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT} from '../demo/content.mjs';
import {createExpedition} from '../demo/adventures.mjs';
import {createChoices,refreshChoices,banChoice,getJourneyOptions,enterNode,chooseUpgrade,advanceNode} from '../demo/journey.mjs';
import {migrateRun} from '../demo/storage.mjs';
import {DEFAULT_GROWTH_SELECTION,validateGrowthSelection} from '../demo/growth-pools.mjs';

const selection=()=>structuredClone(DEFAULT_GROWTH_SELECTION);
function prepared({build='sword',chapter='bamboo',seed=17,configure=()=>{},setup=()=>{},nodeType='reward'}={}){
 const content=structuredClone(CONTENT);
 content.expansion.rogue={rarityWeights:{common:1,fine:0,rare:0,epic:0},refreshCost:10,maxRefresh:2,maxBans:2,prerequisites:{swordEcho:{perkId:'swordFocus',rank:1},poisonCatalyst:{perkId:'poisonLingering',rank:1},guardRiposte:{perkId:'guardBulwark',rank:1}},selection:selection()};
 configure(content.expansion.rogue);
 const run=createExpedition(build,seed,{content,chapter});
 run.nodeIndex=run.route.findIndex(node=>node.type===nodeType);run.flow='intro';setup(run);
 return run;
}
function reward(options={}){const run=prepared(options);return options.nodeType==='camp'?enterNode(run):createChoices(run);}
test('selection validator rejects hostile keys, missing builds and unusable weights',()=>{
 assert.equal(validateGrowthSelection(undefined).valid,true);
 for(const mutate of [s=>s.poolWeights.sword=-1,s=>s.poolWeights.guard=Infinity,s=>s.poolWeights.extra=1,s=>delete s.poolWeights.guard,s=>Object.keys(s.entryWeights).forEach(key=>s.entryWeights[key]=0),s=>s.entryWeights.swordEcho=1001,s=>s.entryWeights.extra=1,s=>s.chapterBias.unknown={},s=>s.chapterBias.bamboo.extra=1,s=>s.ownBuildBonus='2']){
  const candidate=selection();mutate(candidate);assert.equal(validateGrowthSelection(candidate).valid,false);
 }
});
test('zero entry weights and zero base pool weights exclude choices including the own binding guarantee',()=>{
 const input=prepared({configure:r=>{r.selection.poolWeights.sword=0;r.selection.entryWeights.bind=0;r.selection.entryWeights.swordFocus=0;}});
 const run=createChoices(input);
 assert.equal(run.choices.length,0);assert.notEqual(run.flow,'reward');
 assert.equal(run.nodeIndex,input.nodeIndex+1);assert.equal(run.seed,input.seed);
 assert.equal(run.mastery,input.mastery);assert.deepEqual(run.stats.upgrades,input.stats.upgrades);
 assert.equal(run.rogue.offer,undefined);assert.ok(migrateRun(run));
});
test('one and two layered choices remain saveable and selectable while legacy rewards still need three',()=>{
 for(const [pools,count]of [[{sword:1,poison:0,guard:0},1],[{sword:1,poison:1,guard:0},2]]){
  const run=reward({configure:r=>{r.selection.poolWeights=pools;r.selection.entryWeights.swordFocus=0;}});
  assert.equal(run.flow,'reward');assert.equal(run.choices.length,count);
  assert.deepEqual(migrateRun(run),run);
  const next=chooseUpgrade(run,run.choices[0].id);
  assert.equal(next.nodeIndex,run.nodeIndex+1);assert.notEqual(next.flow,'reward');assert.ok(migrateRun(next));
 }
 const legacy=reward({configure:r=>delete r.selection});assert.equal(legacy.choices.length,3);
 legacy.choices.pop();assert.equal(migrateRun(legacy),null);
});
test('empty layered camp offer marks camp complete and advances without an upgrade',()=>{
 const run=reward({nodeType:'camp',configure:r=>{r.selection.entryWeights={bind:0,swordFocus:0,poisonLingering:1};}});
 assert.equal(run.flow,'camp');assert.equal(run.choices.length,0);
 assert.equal(run.upgrades[`campComplete-${run.nodeIndex}`],1);
 assert.equal(run.upgrades[`campHealed-${run.nodeIndex}`],1);
 assert.equal(run.mastery,0);assert.equal(run.stats.upgrades.length,0);
 assert.ok(migrateRun(run));
 const next=advanceNode(run);assert.equal(next.nodeIndex,run.nodeIndex+1);assert.ok(migrateRun(next));
});
test('one and two layered camp choices save, commit and allow departure',()=>{
 for(const [pools,count]of [[{sword:1,poison:0,guard:0},1],[{sword:1,poison:1,guard:0},2]]){
  const run=reward({nodeType:'camp',configure:r=>{r.selection.poolWeights=pools;r.selection.entryWeights.swordFocus=0;}});
  assert.equal(run.flow,'reward');assert.equal(run.choices.length,count);assert.ok(migrateRun(run));
  const committed=chooseUpgrade(run,run.choices[0].id);
  assert.equal(committed.flow,'camp');assert.equal(committed.upgrades[`campComplete-${run.nodeIndex}`],1);assert.ok(migrateRun(committed));
  const next=advanceNode(committed);assert.equal(next.nodeIndex,run.nodeIndex+1);assert.ok(migrateRun(next));
 }
});
test('a layered ban may leave one choice but rolls back if it would remove the last choice',()=>{
 const two=reward({configure:r=>{r.selection.poolWeights={sword:1,poison:1,guard:0};r.selection.entryWeights.swordFocus=0;}});
 assert.equal(two.choices.length,2);
 const one=banChoice(two,two.choices[0].id);
 assert.equal(one.choices.length,1);assert.equal(one.rogue.banned.length,1);assert.ok(migrateRun(one));
 assert.strictEqual(banChoice(one,one.choices[0].id),one);
 assert.equal(one.rogue.banned.length,1);
});
test('weighted pool and entry selection honors chapter bias and known perk prerequisites',()=>{
 const run=reward({chapter:'temple',configure:r=>{r.rarityWeights={common:0,fine:0,rare:1,epic:0};r.selection.poolWeights={sword:1,poison:1,guard:0};r.selection.ownBuildBonus=0;r.selection.entryWeights={bind:1,swordFocus:0,swordEcho:0,poisonLingering:1,poisonCatalyst:0,guardBulwark:0,guardRiposte:0};r.selection.chapterBias.temple={poison:50};},setup:r=>{r.diceSkills[0]={kind:'poison',level:1};}});
 assert.deepEqual(run.choices.map(c=>c.perkId||c.build),['sword','poisonLingering','poison']);
 assert.equal(run.choices[1].poolId,'poison');
 assert.deepEqual(run.rogue.offer,{rarity:'rare',usedFallback:true});
});
test('batch uses one rarity when enough entries and reports a lower-rarity fallback honestly',()=>{
 const enough=reward({configure:r=>{r.rarityWeights={common:0,fine:0,rare:1,epic:0};},setup:r=>{r.diceSkills=[{kind:'sword',level:1},{kind:'poison',level:1},{kind:'guard',level:1},null,null];}});
 assert.equal(enough.choices.length,3);assert.deepEqual(enough.choices.slice(1).map(c=>c.rarity),['rare','rare']);
 assert.deepEqual(enough.rogue.offer,{rarity:'rare',usedFallback:false});
 const short=reward({configure:r=>{r.rarityWeights={common:0,fine:0,rare:1,epic:0};},setup:r=>{r.diceSkills[0]={kind:'sword',level:1};}});
 assert.equal(short.choices.length,3);assert.equal(short.choices[1].rarity,'rare');assert.equal(short.choices[2].rarity,'common');
 assert.deepEqual(short.rogue.offer,{rarity:'rare',usedFallback:true});
 assert.equal(new Set(short.choices.map(c=>c.kind==='perk'?`perk:${c.perkId}`:`bind:${c.build}`)).size,3);
});
test('bans, prerequisites and rank caps remove entries before the weighted draws',()=>{
 for(const [rank,banned]of [[2,['bind:poison','perk:swordEcho']],[0,['bind:poison','perk:swordFocus']]]){
  const run=reward({configure:r=>{r.rarityWeights={common:0,fine:0,rare:1,epic:1};},setup:r=>{r.diceSkills[0]={kind:'sword',level:1};r.perks.swordFocus=rank;r.rogue.banned=banned;}});
  assert.deepEqual(run.choices.map(c=>c.kind==='perk'?c.perkId:c.build),['sword','guard']);
  assert.equal(new Set(run.choices.map(c=>c.kind==='perk'?`perk:${c.perkId}`:`bind:${c.build}`)).size,run.choices.length);
 }
});
test('refresh charges once, invalid bans roll back, save restore preserves seed and frozen rules',()=>{
 let run=reward();run.coins=100;
 const old=structuredClone(run),refreshed=refreshChoices(run);
 assert.equal(refreshed.coins,90);assert.equal(refreshed.rogue.refreshes,1);assert.equal(run.coins,100);
 assert.deepEqual(refreshChoices(old),refreshed);
 assert.deepEqual(getJourneyOptions(refreshed).selection,{mode:'layered',...refreshed.rogue.offer});
 assert.deepEqual(migrateRun(refreshed),refreshed);assert.equal(migrateRun(refreshed).seed,refreshed.seed);
 const sparse=reward({configure:r=>{r.selection.poolWeights={sword:1,poison:0,guard:0};r.selection.entryWeights.swordFocus=0;}});
 assert.strictEqual(banChoice(sparse,sparse.choices[0].id),sparse);
 assert.equal(sparse.rogue.banned.length,0);
});
test('saved selection and offer require their original shallow-merged rules; old snapshots stay accepted',()=>{
 const run=reward();assert.ok(migrateRun(run));
 for(const mutate of [r=>r.rogue.rules.selection.poolWeights.sword=999,r=>r.rogue.offer.rarity='invented',r=>r.rogue.offer.usedFallback='no',r=>r.expeditionContent.expansion.rogue.selection.entryWeights.bind=-1]){
  const bad=structuredClone(run);mutate(bad);assert.equal(migrateRun(bad),null);
 }
 const old=reward({configure:r=>delete r.selection});delete old.rogue.offer;
 assert.ok(migrateRun(old));assert.equal(getJourneyOptions(old).selection,undefined);
 assert.ok(old.choices.every(c=>c.poolId===undefined));
});
