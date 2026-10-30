import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT,getContent,validateContent} from '../demo/content.mjs';
import {validateExpansion} from '../demo/expansion-content.mjs';
import {createProfile,applyProfileAction,deriveLoadout,getSlotProgression,beginExpedition,loadProfile,validateProfile} from '../demo/profile.mjs';
import {renderHub} from '../demo/hub-ui.mjs';
import {createExpedition} from '../demo/adventures.mjs';
import {enterNode} from '../demo/journey.mjs';
import {migrateRun} from '../demo/storage.mjs';

const legacy=()=>{const c=structuredClone(CONTENT);delete c.expansion;return c;};
function imported(content,profile=createProfile(7,0)){
 const result=applyProfileAction(profile,{type:'content-import',value:content},{now:0});
 assert.notStrictEqual(result.profile,profile,result.message);return result.profile;
}
function assertLegacy(content){
 assert.ok(content.expansion.gear);assert.ok(content.expansion.rogue);assert.ok(content.expansion.chapterRoutes.peak.length);
 assert.equal(content.expansion.gear.progression,undefined);assert.equal(content.expansion.rogue.selection,undefined);
}
function expedition(profile){
 const begun=beginExpedition(profile,{now:0});assert.ok(begun.loadout,begun.message);
 return enterNode(createExpedition('sword',42,{runId:begun.runId,loadout:begun.loadout,content:getContent(begun.profile)}));
}

test('custom rarity content imports and renders finite rank-mapped equipment caps through a new expedition',()=>{
 for(const [rank,cap] of [[0,10],[1,14],[2,18],[3,20],[100,20]]){
  const c=structuredClone(CONTENT),p=createProfile(7,0);p.slotLevels.weapon=12;
  c.rarities.push({...c.rarities[0],id:'custom',name:'自订品质',rank});c.expansion.loot.affixCount.custom=1;
  c.equipment.find(t=>t.id===p.inventory.find(i=>i.uid===p.equipped.weapon).templateId).rarity='custom';
  assert.equal(validateContent(c).valid,true);const next=imported(c,p),info=getSlotProgression(next,getContent(next),'weapon');
  assert.equal(info.cap,cap);assert.equal(info.effectiveLevel,Math.min(12,cap));assert.equal(info.storedLevel,12);
  const loadout=deriveLoadout(next);assert.ok(Object.values(loadout.effects).every(Number.isFinite));
  const html=renderHub(next,{tab:'equipment',now:0});assert.match(html,new RegExp(`装备上限 \\+${cap}`));assert.doesNotMatch(html,/NaN|undefined|Infinity/);
  const run=expedition(next);assert.deepEqual(run.loadout,loadout);assert.ok(migrateRun(run));
 }
});

test('known rarity ids keep their configured cap while custom rank caps also receive quality bonuses',()=>{
 const c=structuredClone(CONTENT);c.rarities.find(r=>r.id==='common').rank=100;
 let p=imported(c);assert.equal(getSlotProgression(p,getContent(p),'weapon').cap,10);
 const custom=structuredClone(CONTENT);custom.rarities.push({...custom.rarities[0],id:'custom',name:'自订品质',rank:1});custom.expansion.loot.affixCount.custom=1;custom.equipment[0].rarity='custom';
 p=imported(custom);p=applyProfileAction(p,{type:'gear-advance',uid:p.equipped.weapon},{now:0}).profile;
 assert.equal(getSlotProgression(p,getContent(p),'weapon').cap,18);
});

test('getContent and validation fill absent legacy expansion without enabling optional new rules or mutating input',()=>{
 const c=legacy(),p=createProfile(7,0);p.contentOverrides=c;const before=structuredClone(p);
 assertLegacy(getContent(p));assert.deepEqual(p,before);assert.equal(Object.hasOwn(c,'expansion'),false);
 const checked=validateContent(c);assert.equal(checked.valid,true,checked.errors.join(';'));assertLegacy(checked.content);assert.equal(Object.hasOwn(c,'expansion'),false);
 const expansion=validateExpansion(undefined,c);assert.equal(expansion.valid,true);assert.equal(expansion.expansion.gear.progression,undefined);assert.equal(expansion.expansion.rogue.selection,undefined);
});

test('expansion-free content import preserves resources items and saved +12 with legacy linear slot effects',()=>{
 const initial=createProfile(7,0);initial.slotLevels.weapon=12;const before=structuredClone(initial),p=imported(legacy(),initial);
 assertLegacy(getContent(p));assert.deepEqual(p.resources,before.resources);assert.deepEqual(p.inventory,before.inventory);assert.deepEqual(p.slotLevels,before.slotLevels);
 const info=getSlotProgression(p,getContent(p),'weapon');assert.equal(info.cap,20);assert.equal(info.effectiveLevel,12);assert.equal(info.cumulativeEffects.attack,24);assert.deepEqual(info.percentBonuses,{attack:0,maxHp:0,armor:0});
 const base=structuredClone(p);base.slotLevels.weapon=0;assert.equal(deriveLoadout(p).effects.attack-deriveLoadout(base).effects.attack,24);
 const run=expedition(p);assert.equal(run.rogue.rules.selection,undefined);assert.equal(run.expeditionContent.expansion.gear.progression,undefined);assert.ok(migrateRun(run));
});

test('profile restore from an expansion-free old override keeps legacy enhancement and new expedition selection',()=>{
 const saved=createProfile(7,0);saved.contentOverrides=legacy();saved.slotLevels.weapon=12;const raw=JSON.stringify(saved);
 const checked=validateProfile(raw);assert.equal(checked.valid,true,checked.errors.join(';'));assertLegacy(getContent(checked.profile));
 const restored=loadProfile({getItem:()=>raw});assert.ok(restored.profile,restored.message);assert.equal(getSlotProgression(restored.profile,getContent(restored.profile),'weapon').cumulativeEffects.attack,24);
 assert.deepEqual(restored.profile.resources,saved.resources);assert.deepEqual(restored.profile.inventory,saved.inventory);assert.equal(expedition(restored.profile).rogue.rules.selection,undefined);
});

test('new profiles and explicit reset retain new defaults while previously started legacy runs stay frozen',()=>{
 assert.ok(CONTENT.expansion.gear.progression);assert.ok(CONTENT.expansion.rogue.selection);assert.equal(validateContent(CONTENT).valid,true);
 const fresh=createProfile(7,0);assert.ok(getContent(fresh).expansion.gear.progression);assert.ok(expedition(fresh).rogue.rules.selection);
 const p=imported(legacy());p.slotLevels.weapon=12;const run=expedition(p),before=structuredClone(run);
 const reset=applyProfileAction(p,{type:'content-reset'},{now:0});assert.notStrictEqual(reset.profile,p,reset.message);
 assert.ok(getContent(reset.profile).expansion.gear.progression);assert.ok(getContent(reset.profile).expansion.rogue.selection);
 assert.equal(getSlotProgression(reset.profile,getContent(reset.profile),'weapon').effectiveLevel,10);assert.ok(expedition(reset.profile).rogue.rules.selection);
 assert.deepEqual(run,before);assert.deepEqual(migrateRun(run),before);
});
