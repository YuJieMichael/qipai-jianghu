import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../demo/renewal/model.mjs';
import {createAdventureController} from '../demo/renewal/controller.mjs';

const active = () => model.act(model.newAdventure(42), {type:'begin'}).state;
const withSkill = (skill, level = 1) => {
  const state = active(); state.dice[0].skill = skill; state.dice[0].level = level;
  return state;
};

test('saved skill identifiers must be primitive strings and never invoke coercion', () => {
  const state = withSkill('flame'); state.dice[0].skill = ['flame'];
  assert.equal(model.validateAdventure(JSON.parse(JSON.stringify(state))), false);
  let coerced = 0;
  state.dice[0].skill = {toString(){ coerced++; return 'flame'; }};
  assert.equal(model.validateAdventure(state), false);
  assert.equal(coerced, 0);
});
function secondReward() {
  let state = active(); state.enemies[0].hp = 1;
  state = model.act(state, {type:'reroll', index:0}).state;
  state = model.act(state, {type:'choose', choiceId:'s0-vitality'}).state;
  state.enemies.forEach(enemy => { enemy.hp = 1; });
  return model.act(state, {type:'reroll', index:0}).state;
}

test('flame hits only the chosen living enemy immediately on one reroll', () => {
  const state = withSkill('flame', 2);
  state.enemies.push({id:'second',kind:'archer',name:'试炼弩手',hp:25,maxHp:25,attack:5});
  state.targetId = 'second';
  const before = structuredClone(state);
  assert.equal(model.validateAdventure(state), true);
  const result = model.act(state, {type:'reroll',index:0});
  assert.deepEqual(result.state.enemies.map(enemy => enemy.hp), [26,11]);
  assert.equal(result.state.stats.damage, 18);
  assert.equal(result.state.rerolls, 2);
  assert.deepEqual(result.events.map(event => event.type), ['roll','flame']);
  assert.equal(result.events[1].target, 'second');
  assert.equal(result.events[1].amount, 14);
  assert.equal(result.events[0].snapshot.enemies[1].hp, 25);
  assert.equal(result.events[1].snapshot.enemies[1].hp, 11);
  assert.deepEqual(state, before);
});

test('flame kills select a surviving target and final kills settle one reward', () => {
  const group = withSkill('flame');
  group.enemies.push({id:'second',kind:'archer',name:'残血弩手',hp:3,maxHp:25,attack:5});
  group.targetId = 'second';
  const targeted = model.act(group, {type:'reroll',index:0});
  assert.equal(targeted.state.targetId, group.enemies[0].id);
  assert.deepEqual(targeted.state.enemies.map(enemy => enemy.hp), [26,0]);
  assert.equal(targeted.state.phase, 'battle');
  const state = withSkill('flame'); state.enemies[0].hp = 3;
  const result = model.act(state, {type:'reroll',index:0});
  assert.equal(result.state.phase, 'reward');
  assert.equal(result.state.stats.damage, 7, 'four opening sword damage plus actual three remaining health');
  assert.deepEqual(result.events.map(event => event.type), ['roll','flame','death','unlock','reward']);
  assert.equal(result.events[1].amount, 3);
  assert.equal(model.validateAdventure(result.state), true);
  assert.strictEqual(model.act(result.state, {type:'reroll',index:0}).state, result.state);
});

test('controller restores a saved new skill and shield without granting another trigger', async () => {
  const state = withSkill('guard', 2); state.hero.shield = 37;
  const values = new Map([[model.SAVE_KEY, JSON.stringify(state)]]);
  const storage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const controller = createAdventureController({storage,scene:{ready:Promise.resolve(),update(){}}});
  try {
    await controller.ready;
    assert.deepEqual(controller.state, state);
    assert.deepEqual(JSON.parse(storage.getItem(model.SAVE_KEY)), state);
    assert.equal(controller.busy, false);
  } finally { controller.destroy(); }
});

test('guard grants capped shield without damaging enemies, then shield really absorbs retaliation', () => {
  const state = withSkill('guard', 2); const before = structuredClone(state);
  const result = model.act(state, {type:'reroll',index:0});
  assert.equal(result.state.hero.shield, 12);
  assert.equal(result.state.enemies[0].hp, 26);
  assert.equal(result.state.stats.damage, 4);
  assert.deepEqual(result.events.map(event => event.type), ['roll','guard']);
  assert.equal(result.events[1].amount, 12);
  assert.equal(result.events[1].target, 'hero');
  const attack = model.act(result.state, {type:'attack'});
  const blocked = attack.events.find(event => event.type === 'hurt');
  assert.equal(blocked.amount, 0);
  assert.equal(blocked.blocked, 7);
  assert.equal(blocked.snapshot.hero.shield, 5);
  assert.equal(attack.state.hero.hp, 120);
  assert.equal(attack.state.hero.shield, 17, 'next automatic roll grants shield again');
  assert.deepEqual(state, before);
  const capped = withSkill('guard', 2); capped.hero.shield = 58;
  const cap = model.act(capped, {type:'reroll',index:0});
  assert.equal(cap.state.hero.shield, 60);
  assert.equal(cap.events[1].amount, 2);
  const full = model.act(cap.state, {type:'reroll',index:0});
  assert.equal(full.state.hero.shield, 60);
  assert.equal(full.events[1].amount, 0);
});

test('second victory offers the two new styles and previews explicit skill replacement before confirmation', () => {
  const state = secondReward();
  assert.equal(state.phase, 'reward');
  assert.deepEqual(state.choices.map(choice => choice.kind), ['flame','guard','vitality']);
  const before = structuredClone(state);
  const preview = model.rewardPreview(state, 's1-flame', 0);
  assert.match(preview.before, /剑气.*1.*4/);
  assert.match(preview.after, /烈火.*1.*7.*替换/);
  assert.deepEqual(state, before);
  assert.equal(model.rewardPreview(state, 's1-guard', 4), null);
  const result = model.act(state, {type:'choose',choiceId:'s1-flame',index:2});
  assert.equal(result.state.dice[2].skill, 'flame');
  assert.equal(result.state.dice[2].level, 1);
  assert.equal(result.state.dice[0].skill, 'sword');
  assert.equal(result.events.filter(event => event.type === 'flame').length, 1);
  assert.equal(model.validateAdventure(result.state), true);
  assert.deepEqual(state, before);
});

test('matching skills upgrade, different skills replace at level one, and guard previews its cap', () => {
  const state = secondReward(); state.dice[0].skill = 'guard'; state.dice[0].level = 2;
  const p = model.rewardPreview(state, 's1-guard', 0);
  assert.match(p.before, /护体.*2.*12/); assert.match(p.after, /护体.*3.*18.*60/);
  const upgrade = model.act(state, {type:'choose',choiceId:'s1-guard',index:0});
  assert.equal(upgrade.state.dice[0].level, 3);
  assert.ok(upgrade.events.some(event => event.type === 'guard' && event.amount === 18));
  state.dice[0].level = 20;
  assert.equal(model.rewardPreview(state, 's1-guard', 0), null);
  const replace = model.act(state, {type:'choose',choiceId:'s1-flame',index:0});
  assert.equal(replace.state.dice[0].skill, 'flame');
  assert.equal(replace.state.dice[0].level, 1);
});

test('existing reward saves restore exactly while new style saves round-trip without replaying effects', () => {
  const legacy = secondReward();
  legacy.choices = [
    {id:'s1-sword',kind:'sword',name:'御剑诀',description:'旧存档',rarity:'rare'},
    {id:'s1-face',kind:'face',name:'六面归元',description:'旧存档',rarity:'uncommon'},
    {id:'s1-vitality',kind:'vitality',name:'养元心法',description:'旧存档',rarity:'common'},
  ];
  assert.equal(model.validateAdventure(legacy), true);
  assert.equal(model.act(legacy, {type:'choose',choiceId:'s1-sword',index:2}).state.stage, 2);
  const state = withSkill('guard'); state.hero.shield = 24;
  const saved = JSON.parse(JSON.stringify(state));
  assert.equal(model.validateAdventure(saved), true);
  assert.strictEqual(model.act(saved, {type:'begin'}).state, saved);
  assert.equal(saved.hero.shield, 24);
  for (const mutate of [s=>{s.dice[0].skill='unknown';}, s=>{s.dice[0].level=21;}, s=>{s.dice[1].skill='guard';s.dice[1].level=1;}]) {
    const invalid = structuredClone(state); mutate(invalid); assert.equal(model.validateAdventure(invalid), false);
  }
});
