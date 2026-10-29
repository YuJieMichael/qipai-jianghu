import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,rollDice,toggleHold,rerollDice} from '../demo/model.mjs';
import {startBattle,resolveRound,previewAttack,prepareRound} from '../demo/combat.mjs';
const dice=()=>Array.from({length:5},()=>({faces:[1,2,3,4,5,6],marks:Array(6).fill(null),materialId:'wood',materialLevel:1,decorationId:'plain'}));
const load=(effects={},extra={})=>({weaponType:'sword',effects,dice:dice(),skills:[],relics:[],pet:null,bag:{potion:2,reroll:2,antidote:2,tonic:2},...extra});
const battle=(loadout,values=[1,2,3,4,6],kinds=['boss'])=>{const r=startBattle(createRun('sword',42,{loadout}),{enemies:kinds});r.combat.phase='pick';r.combat.dice=values;r.combat.faceIndices=[0,1,2,3,5];r.diceSkills=Array(5).fill(null);return r;};
test('loadout attack health opening shield and six rerolls affect a battle without mutating snapshot',()=>{
 const l=load({attack:8,maxHp:20,openingShield:7,extraRerolls:20});const before=structuredClone(l);
 const r=rollDice(startBattle(createRun('sword',2,{loadout:l}),{enemies:['boss']}));
 assert.equal(r.hero.attack,20);assert.equal(r.hero.maxHp,200);assert.equal(r.hero.shield,7);assert.equal(r.combat.rerolls,6);assert.deepEqual(l,before);
});
test('custom duplicate faces preserve physical index and only its corresponding mark fires',()=>{
 const l=load();l.dice[0].faces=[6,6,6,6,6,6];l.dice[0].marks=['heal',null,null,null,null,null];
 let r=rollDice(startBattle(createRun('sword',1,{loadout:l}),{enemies:['boss']}));r.hero.hp=100;r.diceSkills=Array(5).fill(null);
 assert.equal(r.combat.dice[0],6);assert.equal(r.combat.faceIndices[0],1);
 assert.equal(resolveRound(r).events.some(e=>e.type==='heal'),false);
 r.combat.faceIndices[0]=0;assert.ok(resolveRound(r).events.some(e=>e.type==='heal'&&e.dieIndex===0));
});
test('wild changes combo only and handles at most two marked dice',()=>{
 const l=load();l.dice[0].marks[0]='wild';l.dice[1].marks[1]='wild';l.dice[2].marks[2]='wild';
 const r=battle(l,[1,2,3,6,6]);const p=previewAttack(r);
 assert.equal(p.combo.rank,6);assert.deepEqual(r.combat.dice,[1,2,3,6,6]);
});
test('weapon straight sword, paired staff area, and triple hammer shield produce distinct outcomes',()=>{
 const s=resolveRound(battle(load({}, {weaponType:'sword'}),[1,2,3,4,5])).events.find(e=>e.type==='strike').value;
 const h=resolveRound(battle(load({}, {weaponType:'hammer'}),[1,2,3,4,5])).events.find(e=>e.type==='strike').value;assert.ok(s>h);
 const staff=resolveRound(battle(load({}, {weaponType:'staff'}),[1,1,2,2,6],['boss','melee']));assert.equal(staff.events.filter(e=>e.type==='strike').length,2);
 const hammer=resolveRound(battle(load({}, {weaponType:'hammer'}),[1,1,1,2,6]));assert.ok(hammer.events.some(e=>e.type==='shield'&&e.value>0));
});
test('crit and freeze consume run RNG identically in immutable preview and resolution',()=>{
 const r=battle(load({critChance:75,critDamage:100,freezeChance:100,comboBonus:25}));const before=structuredClone(r);const p=previewAttack(r),o=resolveRound(r);
 assert.deepEqual(r,before);assert.equal(p.directDamage,o.events.find(e=>e.type==='strike').value);assert.equal(p.forecast.heroHpAfter,o.state.hero.hp);assert.equal(o.state.hero.hp,180);assert.notEqual(o.state.seed,r.seed);assert.equal(p.forecast.totalDamage,o.state.stats.damage);
});
test('armor thorns regen lifesteal fire poison shield bonuses and pet skills relics settle real effects',()=>{
 const l=load({armor:3,thorns:5,regen:2,lifesteal:50,fireDamage:4,poisonDamage:2,shieldGain:2},{pet:{damage:3,heal:2,shield:2},skills:[{id:'a',trigger:'always',effects:{damage:2,shield:2,poison:1}}],relics:[{handRank:0,damage:3}]});
 const r=battle(l);r.hero.hp=100;const o=resolveRound(r);
 assert.ok(o.events.some(e=>e.type==='poisonTick'&&e.value===10));assert.ok(o.events.some(e=>e.type==='counter'&&e.value===5));assert.ok(o.events.some(e=>e.type==='heal'));assert.ok(o.events.some(e=>e.type==='shield'));assert.ok(o.state.hero.hp>r.hero.hp);assert.ok(o.state.stats.blocked>=3);
});
test('chain expands adjacent skill triggers once and frost physically prevents changing its die',()=>{
 const l=load();l.dice[0].decorationId='chain';l.dice[1].decorationId='chain';l.dice[0].materialId='frost';
 let r=battle(l,[4,1,1,1,1]);r.diceSkills=[{kind:'sword',level:1},{kind:'sword',level:1},{kind:'sword',level:1},null,null];
 assert.deepEqual(previewAttack(r).triggers.map(s=>s.dieIndex),[0,1]);
 r=prepareRound(resolveRound(r).state);r=rollDice(r);assert.equal(r.combat.frozen[0],true);assert.strictEqual(toggleHold(r,0),r);
});
test('chain rerolls one adjacent hop without propagating again or moving frozen dice',()=>{
 const l=load();l.dice[1].decorationId='chain';l.dice[2].decorationId='chain';l.dice[0].decorationId='focus';
 let r=rollDice(startBattle(createRun('sword',123,{loadout:l}),{enemies:['boss']}));r=toggleHold(r,1);const before=structuredClone(r);const changed=rerollDice(r);
 assert.equal(changed.seed,1551689652); // two eligible draws: selected index 1 and its right neighbour 2.
 assert.deepEqual(changed.combat.faceIndices,[1,3,2,1,2]);assert.deepEqual(r,before);assert.equal(changed.combat.rerolls,1);
});
test('every material and non-chain decoration has an observable effect',()=>{
 for(const [material,type]of [['jade','heal'],['iron','shield'],['flame','burst'],['thunder','sword'],['poison','poisonApply']]){
  const l=load();l.dice[0].materialId=material;const r=battle(l);r.hero.hp=100;assert.ok(resolveRound(r).events.some(e=>e.type===type&&e.dieIndex===0),material);
 }
 for(const [decoration,type]of [['blood','heal'],['guard','shield'],['restore','heal']]){const l=load();l.dice[0].decorationId=decoration;const r=battle(l);r.hero.hp=100;assert.ok(resolveRound(r).events.some(e=>e.type===type&&e.dieIndex===0),decoration);}
 const l=load();l.dice[0].decorationId='fortune';assert.equal(resolveRound(battle(l)).state.coins,1);
});
test('tuning rules are read from the saved loadout rather than mutable catalog defaults',()=>{
 const l=load({}, {rules:{swordStraightBonus:100,hammerShield:18}});const r=battle(l,[1,2,3,4,5]);assert.equal(resolveRound(r).events.find(e=>e.type==='strike').value,96);
 r.loadout.weaponType='hammer';assert.ok(resolveRound(r).events.some(e=>e.type==='shield'&&e.value===18));
});
test('fractional custom effect tuning rounds damage and currency to whole units',()=>{
 const l=load({fireDamage:2.5},{rules:{fortuneCoins:1.5},skills:[{id:'fraction',trigger:'always',effects:{damage:2.5}}]});l.dice[0].decorationId='fortune';const r=battle(l);const out=resolveRound(r);assert.equal(out.state.coins,1);assert.ok(Number.isInteger(out.state.combat.enemies[0].hp));
});
test('unknown enemy kinds still reject a malformed battle request',()=>{assert.throws(()=>startBattle(createRun('sword'),{enemies:['unknown']}),RangeError);});
