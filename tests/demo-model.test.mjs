import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,nextRandom,evaluateDice,rollDice,toggleHold,rerollDice} from '../demo/model.mjs';
import {NODES,BUILDS,BALANCE,ENEMY_TYPES} from '../demo/config.mjs';
const battle = (seed=123) => ({...createRun('sword',seed),flow:'battle',combat:{round:1,phase:'roll',dice:[0,0,0,0,0],held:[false,false,false,false,false],rerolls:2,enemies:[],targetId:''}});
test('recognizes_all_eight_combos',()=>{
 const cases=[[[1,2,3,4,6],1],[[1,1,2,3,5],1.5],[[1,1,2,2,5],2],[[1,1,1,2,5],3],[[1,2,3,4,5],4],[[2,3,4,5,6],4],[[1,1,1,2,2],5],[[1,1,1,1,2],7],[[6,6,6,6,6],10]];
 for(const [dice,multiplier] of cases) assert.equal(evaluateDice(dice).multiplier,multiplier);
 assert.equal(evaluateDice([1,2,3,4,6]).rank,0);
 assert.equal(evaluateDice([6,6,6,6,6]).rank,7);
});
test('initial_roll_has_no_selected_dice_and_empty_selection_preserves_rng_and_uses',()=>{
 const initial=battle();const before=structuredClone(initial);const rolled=rollDice(initial);
 assert.deepEqual(initial,before);assert.equal(rolled.combat.phase,'pick');
 assert.deepEqual(rolled.combat.held,[true,true,true,true,true]);
 const snapshot=structuredClone(rolled);
 assert.strictEqual(rerollDice(rolled),rolled);assert.deepEqual(rolled,snapshot);
 assert.equal(rolled.seed,1543727538);assert.equal(rolled.combat.rerolls,2);
});
test('reroll_replaces_only_selected_dice_and_clears_selection_without_mutating_input',()=>{
 const rolled=rollDice(battle());assert.deepEqual(rolled.combat.dice,[2,3,1,2,3]);
 const selected=toggleHold(toggleHold(rolled,0),3);const before=structuredClone(selected);
 const replaced=rerollDice(selected);
 assert.deepEqual(replaced.combat.dice,[4,3,1,3,3]);assert.equal(replaced.seed,1551689652);
 assert.deepEqual(replaced.combat.held,[true,true,true,true,true]);assert.equal(replaced.combat.rerolls,1);
 assert.deepEqual(selected,before);assert.deepEqual(rolled.combat.held,[true,true,true,true,true]);
});
test('each_of_two_rerolls_requires_a_fresh_selection',()=>{
 const first=rerollDice(toggleHold(rollDice(battle()),0));
 assert.equal(first.combat.rerolls,1);assert.strictEqual(rerollDice(first),first);
 const second=rerollDice(toggleHold(first,2));
 assert.deepEqual(second.combat.dice,[4,3,3,2,3]);assert.equal(second.seed,1551689652);
 assert.equal(second.combat.rerolls,0);assert.deepEqual(second.combat.held,[true,true,true,true,true]);
 const selected=toggleHold(second,1);assert.strictEqual(rerollDice(selected),selected);
});
test('same_seed_replays_same_roll',()=>{
 assert.deepEqual(rollDice(battle(456)),rollDice(battle(456)));
 const rng=nextRandom(0);assert.equal(rng.seed>>>0,rng.seed);assert.ok(rng.value>=0&&rng.value<1);assert.deepEqual(rng,nextRandom(0));
 assert.notEqual(nextRandom(rng.seed).seed,rng.seed);
});
test('invalid_index_and_wrong_phase_are_noops',()=>{
 const run=battle();for(const index of [-1,5,NaN,1.5,'1']) assert.strictEqual(toggleHold(run,index),run);
 assert.strictEqual(toggleHold(run,0),run);assert.strictEqual(rerollDice(run),run);
 const rolled=rollDice(run);assert.strictEqual(rollDice(rolled),rolled);
 for(const fn of [rollDice,rerollDice]) assert.strictEqual(fn(createRun('sword',4)).flow,'intro');
 for(const index of [-1,5,NaN,1.5,'1']) assert.strictEqual(toggleHold(rolled,index),rolled);
 const held=toggleHold(rolled,0);assert.equal(held.combat.held[0],false);assert.equal(rolled.combat.held[0],true);
});
test('initial_state_and_config_contract',()=>{
 for(const build of ['sword','poison','guard']) {const r=createRun(build,9);assert.equal(r.flow,'intro');assert.equal(r.combat,null);assert.equal(r.hero.id,'hero');assert.equal(r.hero.hp,180);assert.equal(r.hero.attack,12);assert.deepEqual(r.diceSkills,[{kind:build,level:1},null,null,null,null]);assert.equal(BUILDS[build].id,build);}
 assert.equal(NODES.length,9);assert.deepEqual(NODES.filter(n=>n.reward).map(n=>n.index),[0,2,4,6,7]);assert.equal(BALANCE.rerolls,2);assert.equal(ENEMY_TYPES.boss.hp,260);
 assert.throws(()=>createRun('unknown',1),RangeError);
 const a=createRun('sword',1),b=createRun('sword',1);a.stats.upgrades.push('x');assert.deepEqual(b.stats.upgrades,[]);
});
