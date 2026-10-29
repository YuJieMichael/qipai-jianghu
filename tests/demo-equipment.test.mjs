import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../demo/profile.mjs').catch(()=>null);
const content=await import('../demo/content.mjs').catch(()=>null);
const action=(p,type,fields={})=>api.applyProfileAction(p,{type,...fields},{now:100000}).profile;
test('six starter pieces derive a serializable loadout and slot enhancement survives changing equipment',()=>{
 assert.ok(api,'profile module must exist');let p=api.createProfile(1,0);assert.equal(Object.keys(p.equipped).length,6);
 const first=api.deriveLoadout(p);assert.equal(first.dice.length,5);assert.equal(first.weaponType,'sword');assert.equal(first.bag.potion,3);
 const original=structuredClone(p);p=action(p,'enhance',{slot:'weapon'});assert.equal(p.slotLevels.weapon,1);assert.equal(p.resources.gold,960);assert.equal(p.resources.dust,116);assert.deepEqual(original,api.createProfile(1,0));
 assert.ok(api.deriveLoadout(p).effects.attack>first.effects.attack);
 const replacement=p.inventory.find(i=>i.templateId==='weapon-staff-1');p=action(p,'equip',{uid:replacement.uid});assert.equal(api.deriveLoadout(p).weaponType,'staff');assert.equal(p.slotLevels.weapon,1);
 p=action(p,'downgrade',{slot:'weapon'});assert.equal(p.slotLevels.weapon,0);assert.equal(p.resources.gold,980);assert.equal(p.resources.dust,120);
 assert.deepEqual(JSON.parse(JSON.stringify(api.deriveLoadout(p))),api.deriveLoadout(p));
});
test('locked or equipped equipment cannot be destroyed and invalid actions are immutable',()=>{
 assert.ok(api);let p=api.createProfile();const uid=p.equipped.weapon;
 for(const type of ['salvage','fuse'])assert.strictEqual(api.applyProfileAction(p,{type,uid}).profile,p);
 const loose=p.inventory.find(i=>!Object.values(p.equipped).includes(i.uid));p=action(p,'lock',{uid:loose.uid});
 assert.strictEqual(api.applyProfileAction(p,{type:'salvage',uid:loose.uid}).profile,p);assert.strictEqual(api.applyProfileAction(p,{type:'fuse',uid:loose.uid}).profile,p);
 for(const a of [{type:'enhance',slot:'constructor'},{type:'face',die:0,face:0,value:-1},{type:'socket',uid,gemId:'missing'}])assert.strictEqual(api.applyProfileAction(p,a).profile,p);
});
test('refinement requires explicit acceptance and cancellation preserves old stats',()=>{
 assert.ok(api);let p=api.createProfile(7,0);const uid=p.equipped.weapon;const before=api.deriveLoadout(p).effects.attack;
 p=action(p,'refine',{uid});assert.ok(p.inventory.find(i=>i.uid===uid).pendingRefine);assert.equal(api.deriveLoadout(p).effects.attack,before);
 assert.strictEqual(api.applyProfileAction(p,{type:'refine',uid}).profile,p);
 p=action(p,'refine-cancel',{uid});assert.equal(p.inventory.find(i=>i.uid===uid).pendingRefine,undefined);assert.equal(api.deriveLoadout(p).effects.attack,before);
 p=action(p,'refine',{uid});const pending=structuredClone(p.inventory.find(i=>i.uid===uid).pendingRefine);p=action(p,'refine-accept',{uid});assert.deepEqual(p.inventory.find(i=>i.uid===uid).refine,pending);
});
test('fusion consumes a matching unequipped copy and salvage returns usable resources',()=>{
 assert.ok(api);let p=api.createProfile();const uid=p.inventory.find(i=>i.templateId==='weapon-sword-1'&&i.uid!==p.equipped.weapon).uid;
 const count=p.inventory.length;p=action(p,'fuse',{uid});assert.equal(p.inventory.length,count-1);assert.equal(p.inventory.find(i=>i.uid===uid).fusionLevel,1);
 const before=p.resources.dust;p=action(p,'salvage',{uid});assert.equal(p.inventory.length,count-2);assert.ok(p.resources.dust>before);
});
test('gems add real effects and removal refunds the gem',()=>{
 assert.ok(api);let p=api.createProfile();const uid=p.equipped.weapon;const before=api.deriveLoadout(p).effects.attack;
 p=action(p,'socket',{uid,gemId:'ruby'});assert.equal(p.gems.ruby,2);assert.equal(api.deriveLoadout(p).effects.attack,before+2);
 p=action(p,'unsocket',{uid,index:0});assert.equal(p.gems.ruby,3);assert.equal(api.deriveLoadout(p).effects.attack,before);
});
