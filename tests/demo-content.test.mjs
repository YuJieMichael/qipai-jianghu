import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,applyProfileAction,beginExpedition,saveProfile,loadProfile} from '../demo/profile.mjs';
import {createExpedition} from '../demo/adventures.mjs';
import {enterNode} from '../demo/journey.mjs';
import {rollDice} from '../demo/model.mjs';
import {saveRun,loadRun} from '../demo/storage.mjs';
const mod = await import('../demo/content.mjs').catch(()=>null);
test('editable catalog supplies every workshop system as JSON data',()=>{
 assert.ok(mod,'content module must exist');
 const {CONTENT,validateContent,getContent}=mod;
 assert.ok(CONTENT.equipment.length>=40);assert.equal(CONTENT.sects.length,7);assert.ok(CONTENT.skills.length>=12);assert.ok(CONTENT.talents.length>=8);
 assert.equal(CONTENT.materials.length,7);assert.equal(CONTENT.decorations.length,8);assert.equal(CONTENT.marks.length,9);
 assert.ok(CONTENT.relics.length>=8);assert.ok(CONTENT.runes.length>=10);assert.ok(CONTENT.pets.length>=5);assert.ok(CONTENT.souls.length>=6);
 assert.equal(CONTENT.chapters.length,7);assert.ok(CONTENT.modes.length>=11);
 assert.equal(validateContent(JSON.parse(JSON.stringify(CONTENT))).valid,true);
 const changed=structuredClone(CONTENT);changed.equipment[0].effects.attack=17;
 assert.equal(getContent({contentOverrides:changed}).equipment[0].effects.attack,17);assert.notEqual(CONTENT.equipment[0].effects.attack,17);
});
test('content validation rejects unsafe objects, duplicate ids, invalid enums and negative costs',()=>{
 assert.ok(mod);for(const alter of [c=>c.equipment[0].cost={gold:-1},c=>c.materials[0].id='script',c=>c.equipment.push(c.equipment[0]),c=>c.skills[0].effects.attack=Infinity,c=>c.shop[0].name='<script>x</script>',c=>c.equipment[0].effects.attack='x']) {
  const c=structuredClone(mod.CONTENT);alter(c);const result=mod.validateContent(c);assert.equal(result.valid,false);assert.ok(result.errors.length);
 }
});
test('content rejects malformed entries and required numeric fields without throwing',()=>{
 assert.ok(mod);for(const alter of [c=>c.equipment[0]=null,c=>c.relics[0]=null,c=>c.economy.enhanceGold='free',c=>c.pets[0].damage='a',c=>c.shop[0].output={bag:{potion:-1}},c=>c.training[0].effects=null,c=>c.recipes[0].ingredients={unobtainable:1},c=>c.quests[0].target=0,c=>c.runes[0].family='__proto__']) {
  const c=structuredClone(mod.CONTENT);alter(c);let result;assert.doesNotThrow(()=>result=mod.validateContent(c));assert.equal(result.valid,false);
 }
});
test('rarity configuration requires ranks and usable salvage and multiplier numbers',()=>{
 for(const alter of [
  c=>{delete c.rarities[0].rank;},
  c=>{c.rarities[0].rank='0';},
  c=>{c.rarities[0].rank=.5;},
  c=>{delete c.rarities[0].salvage;},
  c=>{c.rarities[0].salvage=1.5;},
  c=>{delete c.rarities[0].multiplier;},
  c=>{c.rarities[0].multiplier=0;},
  c=>{c.rarities[0].multiplier='1';}
 ]){
  const c=structuredClone(mod.CONTENT);alter(c);
  const result=mod.validateContent(c);
  assert.equal(result.valid,false,'malformed rarity must be rejected before importing');
  assert.ok(result.errors.some(message=>message.startsWith('rarities.')));
 }
});
test('configured equipment must supply both ordinary and rare draws',()=>{
 for(const alter of [
  c=>{for(const entry of c.equipment)entry.rarity='common';},
  c=>{for(const entry of c.equipment)entry.rarity='rare';},
  c=>{for(const entry of c.rarities)entry.rank=0;},
  c=>{for(const entry of c.rarities)entry.rank=2;}
 ]){
  const c=structuredClone(mod.CONTENT);alter(c);
  const result=mod.validateContent(c);
  assert.equal(result.valid,false,'accepted configuration must support every draw branch');
  assert.ok(result.errors.some(message=>message.startsWith('equipment.draw')));
 }
});
test('mode turn limits must be present positive integers before an expedition can use them',()=>{
 for(const value of [undefined,0,.5,1001,'8']){
  const c=structuredClone(mod.CONTENT);
  if(value===undefined)delete c.modes[0].turnLimit;else c.modes[0].turnLimit=value;
  const result=mod.validateContent(c);
  assert.equal(result.valid,false,'invalid turn limit must not enter a run snapshot');
  assert.ok(result.errors.some(message=>message.startsWith('modes.campaign.turnLimit')));
 }
 const c=structuredClone(mod.CONTENT);c.modes[0].turnLimit=1000;
 assert.equal(mod.validateContent(c).valid,true);
});
test('offline cap remains editable from one through one hundred hours',()=>{
 for(const hours of [1,48,100]){
  const c=structuredClone(mod.CONTENT);c.economy.offlineHours=hours;
  assert.equal(mod.validateContent(c).valid,true);
 }
 for(const hours of [0,100.5,101]){
  const c=structuredClone(mod.CONTENT);c.economy.offlineHours=hours;
  const result=mod.validateContent(c);
  assert.equal(result.valid,false);assert.ok(result.errors.some(message=>message.startsWith('economy.offlineHours')));
 }
});

// These boundaries prevent content accepted by the editor from creating an unrestorable run.
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
function rejectsImport(content,path){
 const before=createProfile(7,100000),snapshot=structuredClone(before);
 const checked=mod.validateContent(content);
 assert.equal(checked.valid,false,`${path} must be rejected before replacing content`);
 assert.ok(checked.errors.some(message=>message.startsWith(path)),checked.errors.join('; '));
 assert.equal(checked.content,null);
 const result=applyProfileAction(before,{type:'content-import',value:JSON.stringify(content)},{now:100000});
 assert.strictEqual(result.profile,before,'invalid import retains the exact current profile');
 assert.deepEqual(before,snapshot,'invalid import cannot mutate the profile or run counter');
}
for(const effect of ['maxHp','armor','critChance','critDamage','lifesteal','poisonDamage','shieldGain','extraRerolls','openingShield','regen','thorns','fireDamage','freezeChance','comboBonus','goldBonus'])test(`skill content rejects unsupported ${effect} atomically`,()=>{
 const content=structuredClone(mod.CONTENT);content.skills[0].effects[effect]=1;
 rejectsImport(content,`skills.bamboo-strike.${effect}`);
});
for(const change of ['add','remove','rename'])test(`mode content rejects ${change} of a fixed mode ID atomically`,()=>{
 const content=structuredClone(mod.CONTENT);
 if(change==='add')content.modes.push({...structuredClone(content.modes[0]),id:'custom-mode'});
 else if(change==='remove')content.modes=content.modes.filter(mode=>mode.id!=='resource');
 else content.modes.find(mode=>mode.id==='resource').id='custom-mode';
 rejectsImport(content,'modes');
});
for(const catalog of ['modes','chapters'])for(const value of ['missing','null'])test(`${catalog} require a currency reward object when ${value}`,()=>{
 const content=structuredClone(mod.CONTENT),entry=content[catalog][0];
 if(value==='missing')delete entry.reward;else entry.reward=null;
 rejectsImport(content,`${catalog}.${entry.id}.reward`);
});
test('all supported skill effects survive content import and immutable battle save snapshots',()=>{
 const content=structuredClone(mod.CONTENT),effects={damage:2,heal:3,shield:4,poison:1,attack:5};
 content.skills[0].effects=effects;
 const imported=applyProfileAction(createProfile(7,100000),{type:'content-import',value:content},{now:100000}).profile;
 assert.ok(imported.contentOverrides);
 const started=beginExpedition(imported),run=rollDice(enterNode(createExpedition('sword',7,{runId:started.runId,loadout:started.loadout,content:imported.contentOverrides})));
 const boundary=structuredClone(run),store=memory();
 assert.deepEqual(run.loadout.skills[0].effects,effects);
 assert.equal(saveRun(store,run).ok,true);assert.deepEqual(loadRun(store).run,boundary);
 content.skills[0].effects.damage=99;imported.contentOverrides.skills[0].effects.attack=99;
 assert.deepEqual(run,boundary,'later editor changes cannot alter saved skill effects');
});
test('default and editable fixed-mode content produce restorable runs, including custom chapters and empty rewards',()=>{
 const edited=structuredClone(mod.CONTENT);
 edited.chapters.push({id:'custom-chapter',name:'自创章节',hpScale:1.5,attackScale:1.2,reward:{}});
 for(const mode of edited.modes){mode.name='自创'+mode.name;mode.hpScale=1.1;mode.attackScale=1.2;mode.turnLimit=12;mode.reward={};}
 for(const content of [structuredClone(mod.CONTENT),edited]){
  assert.equal(mod.validateContent(content).valid,true);
  const imported=applyProfileAction(createProfile(7,100000),{type:'content-import',value:content},{now:100000}).profile;
  assert.ok(imported.contentOverrides);
  const store=memory();assert.equal(saveProfile(store,imported).ok,true);assert.deepEqual(loadProfile(store).profile,imported);
  for(const mode of content.modes){
   const chapter=content===edited?'custom-chapter':'bamboo',started=beginExpedition(imported);
   const run=rollDice(enterNode(createExpedition('sword',7,{runId:started.runId,loadout:started.loadout,mode:mode.id,chapter,content:imported.contentOverrides})));
   const snapshot=structuredClone(run);
   assert.equal(saveRun(store,run).ok,true,`${mode.id} reward snapshot persists`);
   assert.deepEqual(loadRun(store).run,snapshot);
   if(content===edited)assert.deepEqual(run.reward,{});
   content.modes.find(entry=>entry.id===mode.id).reward={gold:999};
   assert.deepEqual(run,snapshot,'later reward edits cannot alter a run');
  }
 }
});
