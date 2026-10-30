import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT,validateContent,getContent} from '../demo/content.mjs';
import {createProfile,applyProfileAction,beginExpedition,settleRun} from '../demo/profile.mjs';
import {createExpedition} from '../demo/adventures.mjs';
import {enterNode,completeBattle} from '../demo/journey.mjs';
import {resolveRound} from '../demo/combat.mjs';
import {rollDice} from '../demo/model.mjs';
import {migrateRun,SAVE_KEY,loadRun} from '../demo/storage.mjs';
import {lootProbabilities} from '../demo/creator-data.mjs';
import {createNetworkController} from '../demo/network-controller.mjs';
import {createController} from '../demo/main.mjs';
import {renderHub} from '../demo/hub-ui.mjs';

const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const remote=createProfile(9,100000);

test('one-affix content produces normal boss loot that saves and settles',()=>{
 const content=structuredClone(CONTENT);content.expansion.gear.maxAffixes=1;
 assert.equal(validateContent(content).valid,true);
 const profile=applyProfileAction(createProfile(2,100000),{type:'content-import',value:content},{now:100000}).profile;
 const begun=beginExpedition(profile,{now:100000});
 let run=rollDice(enterNode(createExpedition('sword',2,{runId:begun.runId,loadout:begun.loadout,content,mode:'boss'})));
 run.hero.attack=10000;run=completeBattle(resolveRound(run).state);
 assert.equal(run.flow,'victory');assert.equal(run.loot.length,1);
 assert.equal(run.loot[0].affixes.length,1);
 assert.ok(migrateRun(run));
 const settled=settleRun(begun.profile,run,{now:100000});
 assert.deepEqual(settled.profile.settledRunIds,[1]);assert.equal(settled.profile.inventory.length,begun.profile.inventory.length+1);
});

test('loot preview caps request count by gear limit and unique effect keys',()=>{
 const content=structuredClone(CONTENT);content.expansion.gear.maxAffixes=1;
 assert.ok(lootProbabilities(content).every(row=>row.affixes===1));
 content.expansion.loot.affixCount.common=0;
 assert.equal(lootProbabilities(content).find(row=>row.id==='common').affixes,0);
 content.expansion.gear.maxAffixes=4;content.expansion.affixes.forEach(row=>row.key='attack');
 assert.ok(lootProbabilities(content).every(row=>row.affixes<=1));
});

const invalidImports=[
 ['unknown prerequisite target',c=>c.expansion.rogue.prerequisites.missing={perkId:'swordFocus',rank:1}],
 ['unknown prerequisite source',c=>c.expansion.rogue.prerequisites.swordEcho.perkId='missing'],
 ['unreachable prerequisite rank',c=>c.expansion.rogue.prerequisites.swordEcho.rank=99],
 ['battle branch choices',c=>c.expansion.chapterRoutes.bamboo[0].branchChoices=structuredClone(c.expansion.chapterRoutes.bamboo.find(n=>n.branchChoices).branchChoices)],
 ['non-boss mechanic',c=>c.expansion.chapterRoutes.bamboo[0].enemies[0].mechanic='ward'],
 ['non-elite affix',c=>c.expansion.chapterRoutes.bamboo[0].enemies[0].affix='fierce'],
 ['unknown elite affix',c=>c.expansion.chapterRoutes.bamboo.find(n=>n.eliteAffix).eliteAffix='invented'],
 ['invalid summon flag',c=>c.expansion.chapterRoutes.bamboo[0].enemies[0].noSummon='yes'],
 ['duplicate route ids',c=>c.expansion.chapterRoutes.bamboo[1].id=c.expansion.chapterRoutes.bamboo[0].id],
 ['invalid treasure',c=>c.expansion.chapterRoutes.bamboo[1].treasure=-1]
];
for(const [name,mutate] of invalidImports)test(`content import atomically rejects ${name}`,()=>{
 const content=structuredClone(CONTENT);mutate(content);
 const checked=validateContent(JSON.stringify(content));assert.equal(checked.valid,false);
 const original=createProfile(2,100000),before=structuredClone(original);
 const result=applyProfileAction(original,{type:'content-import',value:JSON.stringify(content)},{now:100000});
 assert.equal(result.profile,original);assert.deepEqual(original,before);
});
test('malformed content JSON returns invalid without throwing',()=>assert.equal(validateContent('{bad').valid,false));

test('network profile guard rejects before requesting and rechecks a pending response',async()=>{
 let allowed=false,calls=0,writes=0;const wait=deferred();
 const c=createNetworkController({client:{loadProfile:()=>{calls++;return allowed?wait.promise:Promise.resolve({profile:remote,revision:1});}},getProfile:()=>remote,setProfile:()=>writes++,canReplaceProfile:()=>allowed});
 try{
  await c.act({type:'load-profile'});assert.equal(calls,0);assert.equal(writes,0);assert.match(c.state.error,/完成|放弃/);
  allowed=true;const pending=c.act({type:'load-profile'});assert.equal(calls,1);allowed=false;
  wait.resolve({profile:remote,revision:4});await pending;assert.equal(writes,0);assert.match(c.state.error,/完成|放弃/);
 }finally{c.destroy();}
});

test('network rechecks replacement permission when an allowed download finishes',async()=>{
 let allowed=true,writes=0;const wait=deferred();
 const c=createNetworkController({client:{loadProfile:()=>wait.promise},getProfile:()=>remote,setProfile:()=>writes++,canReplaceProfile:()=>allowed});
 try{const pending=c.act({type:'load-profile'});allowed=false;wait.resolve({profile:remote,revision:1});await pending;assert.equal(writes,0);assert.match(c.state.error,/完成|放弃/);}finally{c.destroy();}
});

test('plain profile import cannot detach an outstanding current journey',async()=>{
 let view;const c=createController({storage:memory(),now:()=>100000,render:(_r,o)=>view=o});
 try{await c.act({type:'expedition',value:{mode:'boss'}});const before=c.profile;await c.act({type:'profile-import',value:remote});assert.equal(c.profile,before);assert.match(view.message,/完成|放弃/);}finally{c.destroy();}
});

test('saved journey blocks cloud and plain profile replacement but permits content edits',async()=>{
 let calls=0,view;const storage=memory(),c=createController({storage,now:()=>100000,networkClient:{loadProfile:async()=>{calls++;return {profile:remote,revision:3};}},render:(_r,o)=>view=o});
 try{
  await c.act({type:'expedition',value:{mode:'boss'}});const boundary=structuredClone(c.state);
  await c.act({type:'home'});const before=c.profile,saved=storage.getItem(SAVE_KEY);
  await c.act({type:'network',value:{type:'load-profile'}});assert.equal(calls,0);assert.equal(c.profile,before);assert.match(c.network.error,/完成|放弃/);
  await c.act({type:'profile-import',value:remote});assert.equal(c.profile,before);assert.match(view.message,/完成|放弃/);assert.equal(storage.getItem(SAVE_KEY),saved);
  const content=structuredClone(getContent(c.profile));content.equipment[0].name='配置仍可修改';
  await c.act({type:'profile',value:{type:'content-import',value:content}});assert.equal(getContent(c.profile).equipment[0].name,'配置仍可修改');
  await c.act({type:'resume'});assert.deepEqual(c.state,boundary);
 }finally{c.destroy();}
});

test('resume is gated while a profile download is pending',async()=>{
 const storage=memory(),wait=deferred();let view;
 const c=createController({storage,now:()=>100000,networkClient:{loadProfile:()=>wait.promise},render:(_r,o)=>view=o});
 try{
  const pending=c.act({type:'network',value:{type:'load-profile'}});
  // A save appearing from another document must not activate while replacement is pending.
  const other=createController({storage:memory(),now:()=>100000});await other.act({type:'expedition',value:{mode:'boss'}});
  storage.setItem(SAVE_KEY,JSON.stringify(other.state));other.destroy();
  await c.act({type:'resume'});assert.equal(c.state.flow,'intro');assert.match(view.message,/进行中|稍后/);
  wait.resolve({profile:remote,revision:1});await pending;
  assert.match(c.network.error,/完成|放弃/);
 }finally{wait.resolve({profile:remote,revision:1});c.destroy();}
});

test('explicit saved-journey abandonment settles consumed items once and permits safe sync',async()=>{
 const storage=memory();storage.setItem('original-game-save','keep');let calls=0,view;
 const c=createController({storage,now:()=>100000,networkClient:{loadProfile:async()=>{calls++;return {profile:remote,revision:3};}},render:(_r,o)=>view=o});
 try{
  await c.act({type:'expedition',value:{mode:'boss'}});const initial=c.profile.bag.tonic;
  await c.act({type:'use-item',value:'tonic'});await c.act({type:'home'});
  assert.match(renderHub(c.profile,{hasSave:true}),/data-action="abandon-saved"/);
  await c.act({type:'abandon-saved'});assert.equal(c.profile.bag.tonic,initial-1);assert.deepEqual(c.profile.settledRunIds,[1]);
  assert.equal(storage.getItem(SAVE_KEY),null);assert.equal(loadRun(storage).run,null);assert.equal(view.hasSave,false);assert.equal(storage.getItem('original-game-save'),'keep');
  await c.act({type:'abandon-saved'});assert.equal(c.profile.bag.tonic,initial-1);
  await c.act({type:'network',value:{type:'load-profile'}});assert.equal(calls,1);assert.equal(c.profile.nextRunId,1);
  await c.act({type:'resume'});assert.equal(c.state.flow,'intro');assert.deepEqual(c.profile.settledRunIds,[]);
  c.destroy();assert.equal(storage.getItem(SAVE_KEY),null);
 }finally{c.destroy();}
});

test('plain profile import succeeds after explicit saved-journey abandonment',async()=>{
 const c=createController({storage:memory(),now:()=>100000});
 try{await c.act({type:'expedition',value:{mode:'boss'}});await c.act({type:'home'});await c.act({type:'abandon-saved'});await c.act({type:'profile-import',value:remote});assert.equal(c.profile.seed,remote.seed);assert.equal(c.profile.nextRunId,1);await c.act({type:'resume'});assert.equal(c.state.flow,'intro');}finally{c.destroy();}
});

for(const type of ['profile-import','cloud-download'])test(`${type} retains settled save and current profile when replacement cannot persist`,async()=>{
 const base=memory();let failWrites=false,view;
 const storage={...base,setItem:(key,value)=>{if(failWrites&&key==='qipai-bamboo-profile-v1')throw Error('disk full');base.setItem(key,value);}};
 const content=structuredClone(CONTENT);content.modes.find(m=>m.id==='resource').turnLimit=1;
 const profile=applyProfileAction(createProfile(2,100000),{type:'content-import',value:content},{now:100000}).profile;
 const c=createController({initialProfile:profile,storage,now:()=>100000,networkClient:{loadProfile:async()=>({profile:remote,revision:3})},render:(_r,o)=>view=o});
 try{
  await c.act({type:'expedition',value:{mode:'resource'}});await c.act({type:'attack'});assert.equal(c.state.flow,'victory');
  await c.act({type:'home'});const before=c.profile,saved=storage.getItem(SAVE_KEY);failWrites=true;
  if(type==='profile-import'){await c.act({type:'profile-import',value:remote});assert.match(view.message,/保存|空间/);}
  else{await c.act({type:'network',value:{type:'load-profile'}});assert.match(c.network.error,/保存|空间/);assert.equal(c.network.profileRevision,0);}
  assert.equal(c.profile,before);assert.equal(storage.getItem(SAVE_KEY),saved);assert.ok(loadRun(storage).run);
 }finally{failWrites=false;c.destroy();}
});

test('profile replacement without a saved journey never creates an invalid placeholder save',async()=>{
 const base=memory(),storage={getItem:base.getItem,setItem:base.setItem};
 const c=createController({storage,now:()=>100000});
 try{await c.act({type:'profile-import',value:remote});assert.equal(storage.getItem(SAVE_KEY),null);assert.equal(loadRun(storage).message,'');}finally{c.destroy();}
});

test('terminal saved journey still blocks profile import until its run id is settled',async()=>{
 const content=structuredClone(CONTENT);content.modes.find(m=>m.id==='resource').turnLimit=1;
 const profile=applyProfileAction(createProfile(2,100000),{type:'content-import',value:content},{now:100000}).profile,begun=beginExpedition(profile,{now:100000});
 const run=completeBattle(resolveRound(rollDice(enterNode(createExpedition('sword',2,{runId:begun.runId,loadout:begun.loadout,mode:'resource',content})))).state);
 assert.equal(run.flow,'victory');const storage=memory();storage.setItem(SAVE_KEY,JSON.stringify(run));
 const c=createController({storage,initialProfile:begun.profile,now:()=>100000});
 try{await c.act({type:'profile-import',value:remote});assert.equal(c.profile,begun.profile);assert.equal(storage.getItem(SAVE_KEY),JSON.stringify(run));}finally{c.destroy();}
});

test('failed save clearing prevents abandoned journey replay and a retry never charges twice',async()=>{
 const base=memory();let failClear=true;
 const storage={...base,removeItem:key=>{if(failClear)throw Error('cannot clear');base.removeItem(key);}};
 const c=createController({storage,now:()=>100000});
 try{
  await c.act({type:'expedition',value:{mode:'boss'}});const initial=c.profile.bag.tonic;
  await c.act({type:'use-item',value:'tonic'});await c.act({type:'home'});await c.act({type:'abandon-saved'});
  assert.equal(c.profile.bag.tonic,initial-1);assert.ok(storage.getItem(SAVE_KEY));
  await c.act({type:'resume'});assert.equal(c.state.flow,'intro');
  failClear=false;await c.act({type:'abandon-saved'});assert.equal(c.profile.bag.tonic,initial-1);assert.equal(storage.getItem(SAVE_KEY),null);
 }finally{failClear=false;c.destroy();}
});
