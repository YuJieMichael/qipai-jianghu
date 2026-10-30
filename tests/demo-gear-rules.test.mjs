import test from 'node:test';
import assert from 'node:assert/strict';
import * as profile from '../demo/profile.mjs';
import {CONTENT} from '../demo/content.mjs';
const gear=await import('../demo/gear-rules.mjs').catch(()=>({}));
const config=()=>{const c=structuredClone(CONTENT);c.expansion.gear.progression={cumulativeFactors:[0,1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30],rarityCaps:{common:10,fine:14,rare:18,epic:20},qualityCapBonus:4,percentRules:[{quality:1,effects:{attack:5}},{quality:2,effects:{maxHp:5}},{quality:3,effects:{attack:5,armor:5}}]};return c;};
const rich=(c=config())=>{const p=profile.createProfile(17,0);p.contentOverrides=c;for(const k of Object.keys(p.resources))p.resources[k]=100000;return p;};
const state=(quality,affixes=[])=>({quality,affixes,locks:[],pending:null,salvaged:false});
const act=(p,type,fields={})=>profile.applyProfileAction(p,{type,...fields},{now:0});
const round=n=>Math.round(n*100)/100;

test('default progression uses original cumulative rows and validates optional legacy configuration',()=>{
 assert.ok(gear.DEFAULT_GEAR_PROGRESSION,'gear progression API must exist');
 assert.deepEqual(gear.DEFAULT_GEAR_PROGRESSION,config().expansion.gear.progression);
 assert.deepEqual(gear.validateGearProgression(undefined),{valid:true,errors:[]});
 assert.equal(gear.validateGearProgression(gear.DEFAULT_GEAR_PROGRESSION).valid,true);
});

test('cumulative enhancement uses row total rather than summing earlier totals and extends the final delta',()=>{
 assert.equal(typeof gear.getSlotProgression,'function');const c=config(),p=rich(c);c.expansion.gear.progression.rarityCaps.common=100;c.economy.maxEnhance=30;p.slotLevels.weapon=12;
 const info=gear.getSlotProgression(p,c,'weapon'),base=c.workshopRules.slotEffects.weapon.attack;
 assert.equal(info.cumulativeEffects.attack,base*14);assert.equal(info.nextEffects.attack,base*2);
 p.slotLevels.weapon=23;assert.equal(gear.getSlotProgression(p,c,'weapon').cumulativeEffects.attack,base*36);
});

test('rarity and quality caps suppress effective levels without losing stored levels when swapping or unequipping',()=>{
 assert.equal(typeof gear.getSlotProgression,'function');let p=rich();p.slotLevels.weapon=18;const c=p.contentOverrides,uid=p.equipped.weapon;
 assert.equal(gear.getSlotProgression(p,c,'weapon').storedLevel,18);assert.equal(gear.getSlotProgression(p,c,'weapon').effectiveLevel,10);
 p.expansion.gear[uid]=state(2);assert.equal(gear.getSlotProgression(p,c,'weapon').effectiveLevel,18);
 const rare=p.inventory.find(i=>c.equipment.find(t=>t.id===i.templateId)?.rarity==='epic'&&c.equipment.find(t=>t.id===i.templateId)?.slot==='weapon');
 assert.ok(rare);p=act(p,'equip',{uid:rare.uid}).profile;assert.equal(p.slotLevels.weapon,18);assert.equal(gear.getSlotProgression(p,c,'weapon').effectiveLevel,18);
 p=act(p,'equip',{uid}).profile;p.expansion.gear[uid].quality=0;assert.equal(gear.getSlotProgression(p,c,'weapon').effectiveLevel,10);
 p=act(p,'unequip',{slot:'weapon'}).profile;assert.equal(p.slotLevels.weapon,18);assert.equal(gear.getSlotProgression(p,c,'weapon').cap,20);assert.deepEqual(gear.getSlotProgression(p,c,'weapon').cumulativeEffects,{});
});

test('enhancement cap rejection is atomic and consumes no currency or RNG; empty slots use global cap',()=>{
 const p=rich();p.slotLevels.weapon=10;const before=structuredClone(p),result=act(p,'enhance',{slot:'weapon'});
 assert.strictEqual(result.profile,p);assert.deepEqual(p,before);assert.match(result.message,/上限/);
 const empty=act(p,'unequip',{slot:'weapon'}).profile,next=act(empty,'enhance',{slot:'weapon'}).profile;
 assert.equal(next.slotLevels.weapon,11);assert.equal(next.resources.gold,empty.resources.gold-440);assert.equal(next.resources.dust,empty.resources.dust-44);assert.equal(next.seed,empty.seed);
});

test('progression reports current-level cost, resource rejection and exact prior-step refund',()=>{
 assert.equal(typeof gear.getSlotProgression,'function');const p=rich(),c=p.contentOverrides;p.slotLevels.weapon=2;c.economy.downgradeGoldRefund=.3;
 let info=gear.getSlotProgression(p,c,'weapon');assert.deepEqual(info.nextCost,{gold:120,dust:12});assert.deepEqual(info.refund,{gold:24,dust:8});
 const down=act(p,'downgrade',{slot:'weapon'}).profile;assert.equal(down.resources.gold,p.resources.gold+24);assert.equal(down.resources.dust,p.resources.dust+8);
 p.resources.dust=0;info=gear.getSlotProgression(p,c,'weapon');assert.equal(info.canEnhance,false);assert.equal(info.nextEffects,null);assert.match(info.reason,/资源/);assert.strictEqual(act(p,'enhance',{slot:'weapon'}).profile,p);
});

test('equipment percentage sums tiers across items and applies once to every flat equipment source',()=>{
 assert.equal(typeof gear.deriveEquipment,'function');const c=config(),p=rich(c),uid=p.equipped.weapon,item=p.inventory.find(i=>i.uid===uid),template=c.equipment.find(t=>t.id===item.templateId);
 p.equipped={weapon:uid};item.fusionLevel=2;item.refine.effects={attack:3,maxHp:4,critChance:2};item.gems=['ruby'];p.slotLevels.weapon=2;p.expansion.gear[uid]=state(3,[{key:'attack',value:4}]);
 const snapshot=structuredClone(p),result=gear.deriveEquipment(p,c);
 const flatAttack=template.effects.attack*(1+2*c.economy.fusionBonus)+3+c.gems.find(g=>g.id==='ruby').effects.attack+c.workshopRules.slotEffects.weapon.attack*2+template.effects.attack*3*c.expansion.gear.qualityBonus+4+1;
 assert.equal(result.flatEffects.attack,round(flatAttack));assert.deepEqual(result.percentBonuses,{attack:10,maxHp:5,armor:5});assert.equal(result.effects.attack,round(flatAttack*1.1));assert.equal(result.effects.critChance,2);assert.deepEqual(p,snapshot);
 assert.equal(profile.deriveLoadout(p).effects.attack,round((c.sects.find(s=>s.id===p.sectId).effects.attack??0)+flatAttack*1.1));
 const body=profile.createProfile().equipped.armor;p.equipped.armor=body;p.expansion.gear[body]=state(1);assert.equal(gear.deriveEquipment(p,c).percentBonuses.attack,15);
});

test('loadout equipment percentages leave talent, set, relic, rune and resonance sources outside the bucket',()=>{
 const p=rich(),c=p.contentOverrides;for(const uid of Object.values(p.equipped))p.expansion.gear[uid]=state(1);
 p.talents[c.talents.find(t=>t.effects.attack).id]=2;p.relics.equipped=['reed-flute'];p.runes.slots[0]='edge';p.expansion.relics['reed-flute']=state(1,[{key:'attack',value:3}]);
 const without=config();without.expansion.gear.progression.percentRules=[];const plain=structuredClone(p);plain.contentOverrides=without;
 const before=profile.deriveLoadout(plain),after=profile.deriveLoadout(p);assert.ok(after.equipmentBreakdown,'loadout must expose additive equipment metadata');
 assert.equal(round(after.effects.attack-before.effects.attack),round(after.equipmentBreakdown.flatEffects.attack*.30));
 assert.equal(after.effects.attack,round(before.effects.attack+after.equipmentBreakdown.flatEffects.attack*.30));
});

test('new expeditions receive current gear and old loadout snapshots remain frozen',()=>{
 let p=rich(),old=profile.beginExpedition(p,{now:0});assert.ok(old.loadout);const frozen=structuredClone(old.loadout);p=old.profile;
 p=act(p,'gear-advance',{uid:p.equipped.weapon}).profile;const next=profile.beginExpedition(p,{now:0});assert.ok(next.loadout.effects.attack>old.loadout.effects.attack);assert.deepEqual(old.loadout,frozen);
});

test('absent optional progression preserves legacy linear enhancement without percentage or rarity cap',()=>{
 assert.equal(typeof gear.getSlotProgression,'function');const c=config();delete c.expansion.gear.progression;let p=rich(c);p.slotLevels.weapon=12;p.expansion.gear[p.equipped.weapon]=state(3);
 const info=gear.getSlotProgression(p,c,'weapon');assert.equal(info.cap,20);assert.equal(info.effectiveLevel,12);assert.equal(info.cumulativeEffects.attack,c.workshopRules.slotEffects.weapon.attack*12);assert.deepEqual(info.percentBonuses,{attack:0,maxHp:0,armor:0});
 p=act(p,'enhance',{slot:'weapon'}).profile;assert.equal(p.slotLevels.weapon,13);
});

test('validator rejects malformed imported rules, hostile keys, sparse rows and nonfinite values without clamping',()=>{
 assert.equal(typeof gear.validateGearProgression,'function');
 for(const alter of [v=>{v.extra=1;},v=>{v.cumulativeFactors=[0,NaN];},v=>{v.cumulativeFactors=[0,Infinity];},v=>{v.cumulativeFactors=[0,2,1];},v=>{v.cumulativeFactors=[1,2];},v=>{v.cumulativeFactors=[0,1001];},v=>{v.cumulativeFactors=[0,,2];},v=>{v.rarityCaps.common=1.5;},v=>{delete v.rarityCaps.epic;},v=>{v.rarityCaps.extra=1;},v=>{v.qualityCapBonus=-1;},v=>{v.percentRules=[{quality:0,effects:{attack:1}}];},v=>{v.percentRules=[{quality:1,effects:{}}];},v=>{v.percentRules=[{quality:1,effects:{critChance:5}}];},v=>{v.percentRules=[{quality:1,effects:{attack:101}}];},v=>{v.percentRules=[{quality:1,effects:{attack:5},extra:1}];},v=>{v.percentRules=Array(11).fill({quality:1,effects:{attack:1}});},v=>{v.percentRules=Array(2);}]){
  const value=config().expansion.gear.progression;alter(value);const result=gear.validateGearProgression(value);assert.equal(result.valid,false,JSON.stringify(value));assert.ok(result.errors.length);
 }
 for(const value of [null,[],Object.create({}),{...config().expansion.gear.progression,...JSON.parse('{"__proto__":{}}')}])assert.equal(gear.validateGearProgression(value).valid,false);
});

test('fractional sources round once after equipment and external sources aggregate',()=>{
 const c=config();c.expansion.gear.progression.percentRules=[];const p=rich(c),uid=p.equipped.weapon;p.equipped={weapon:uid};
 c.equipment.find(t=>t.id===p.inventory.find(i=>i.uid===uid).templateId).effects={attack:.004};c.sects.find(s=>s.id===p.sectId).effects={attack:.004};
 assert.equal(profile.deriveLoadout(p).effects.attack,.01);
 c.workshopRules.slotEffects.weapon={attack:.004};p.slotLevels.weapon=1;
 assert.equal(gear.deriveEquipment(p,c).effects.attack,.01);
});

test('legacy content without workshop rules retains default slot effects through public profile helpers',()=>{
 const c=config();delete c.expansion.gear.progression;delete c.workshopRules;const p=rich(c);p.slotLevels.weapon=2;
 const base=structuredClone(p);base.slotLevels.weapon=0;
 assert.equal(profile.deriveLoadout(p).effects.attack-profile.deriveLoadout(base).effects.attack,4);
 assert.equal(profile.getSlotProgression(p,c,'weapon').cumulativeEffects.attack,4);
});
