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
  state = model.act(state, {type:'attack'}).state;
  state = model.act(state, {type:'choose', choiceId:'s0-vitality'}).state;
  state.enemies.forEach(enemy => { enemy.hp = 1; });
  state.charges = state.enemies.length - 1;
  return model.act(state, {type:'attack'}).state;
}

test('flame waits through reroll then hits only the chosen living enemy after normal attack', () => {
  const state = withSkill('flame', 2);
  state.enemies.push({id:'second',kind:'archer',name:'试炼弩手',hp:40,maxHp:40,attack:5});
  state.targetId = 'second';
  const before = structuredClone(state);
  assert.equal(model.validateAdventure(state), true);
  const rolled = model.act(state, {type:'reroll',index:0});
  assert.deepEqual(rolled.state.enemies.map(enemy => enemy.hp), [30,40]);
  assert.equal(rolled.state.stats.damage, 0);
  assert.equal(rolled.state.rerolls, 2);
  assert.deepEqual(rolled.events.map(event => event.type), ['roll']);
  const result = model.act(rolled.state, {type:'attack'});
  assert.deepEqual(result.state.enemies.map(enemy => enemy.hp), [30,11]);
  assert.equal(result.state.stats.damage, 29);
  assert.deepEqual(result.events.map(event => event.type), ['attack','flame','hurt','hurt','roll']);
  assert.equal(result.events[1].target, 'second');
  assert.equal(result.events[1].amount, 14);
  assert.equal(result.events[0].snapshot.enemies[1].hp, 25);
  assert.equal(result.events[1].snapshot.enemies[1].hp, 11);
  assert.deepEqual(state, before);
});

test('flame follows a defeated selected target to a survivor and final flame kills settle one reward', () => {
  const group = withSkill('flame');
  group.enemies.push({id:'second',kind:'archer',name:'残血弩手',hp:3,maxHp:25,attack:5});
  group.targetId = 'second';
  const targeted = model.act(group, {type:'attack'});
  assert.equal(targeted.state.targetId, group.enemies[0].id);
  assert.deepEqual(targeted.state.enemies.map(enemy => enemy.hp), [23,0]);
  assert.equal(targeted.events.find(event => event.type === 'flame').target, group.enemies[0].id);
  assert.equal(targeted.state.phase, 'battle');
  const state = withSkill('flame'); state.enemies[0].hp = 20;
  const result = model.act(state, {type:'attack'});
  assert.equal(result.state.phase, 'reward');
  assert.equal(result.state.stats.damage, 20, 'normal attack and flame count actual remaining health');
  assert.deepEqual(result.events.map(event => event.type), ['attack','flame','death','unlock','reward']);
  assert.equal(result.events[1].amount, 4);
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

test('guard waits through reroll and grants capped shield after attacking before retaliation', () => {
  const state = withSkill('guard', 2); const before = structuredClone(state);
  const result = model.act(state, {type:'reroll',index:0});
  assert.equal(result.state.hero.shield, 0);
  assert.equal(result.state.enemies[0].hp, 30);
  assert.equal(result.state.stats.damage, 0);
  assert.deepEqual(result.events.map(event => event.type), ['roll']);
  const attack = model.act(result.state, {type:'attack'});
  assert.deepEqual(attack.events.map(event => event.type), ['attack','guard','hurt','roll']);
  assert.equal(attack.events[1].amount, 12);
  assert.equal(attack.events[1].target, 'hero');
  const blocked = attack.events.find(event => event.type === 'hurt');
  assert.equal(blocked.amount, 0);
  assert.equal(blocked.blocked, 7);
  assert.equal(blocked.snapshot.hero.shield, 5);
  assert.equal(attack.state.hero.hp, 120);
  assert.equal(attack.state.hero.shield, 5, 'the next automatic roll grants no extra shield');
  assert.deepEqual(state, before);
  const capped = withSkill('guard', 2); capped.hero.shield = 58;
  const cap = model.act(capped, {type:'attack'});
  assert.equal(cap.events[1].snapshot.hero.shield, 60);
  assert.equal(cap.state.hero.shield, 53);
  assert.equal(cap.events[1].amount, 2);
  const fullyShielded = withSkill('guard', 2); fullyShielded.hero.shield = 60;
  const full = model.act(fullyShielded, {type:'attack'});
  assert.equal(full.events[1].snapshot.hero.shield, 60);
  assert.equal(full.events[1].amount, 0);
});

test('second victory offers the two new styles and previews explicit skill replacement before confirmation', () => {
  const state = secondReward();
  assert.equal(state.phase, 'reward');
  assert.deepEqual(state.choices.map(choice => choice.kind), ['flame','guard','vitality']);
  const before = structuredClone(state);
  const preview = model.rewardPreview(state, 's1-flame', 0);
  assert.match(preview.before, /剑影.*1.*\+1/);
  assert.match(preview.after, /烈火.*1.*7.*替换/);
  assert.deepEqual(state, before);
  assert.equal(model.rewardPreview(state, 's1-guard', 4), null);
  const result = model.act(state, {type:'choose',choiceId:'s1-flame',index:2});
  assert.equal(result.state.dice[2].skill, 'flame');
  assert.equal(result.state.dice[2].level, 1);
  assert.equal(result.state.dice[0].skill, 'sword');
  assert.equal(result.events.filter(event => ['sword','charge','flame','guard'].includes(event.type)).length, 0);
  assert.ok(result.state.enemies.every(enemy => enemy.hp === enemy.maxHp));
  assert.equal(model.validateAdventure(result.state), true);
  assert.deepEqual(state, before);
});

test('matching skills upgrade, different skills replace at level one, and guard previews its cap', () => {
  const state = secondReward(); state.dice[0].skill = 'guard'; state.dice[0].level = 2;
  const p = model.rewardPreview(state, 's1-guard', 0);
  assert.match(p.before, /护体.*2.*12/); assert.match(p.after, /护体.*3.*18.*60/);
  const upgrade = model.act(state, {type:'choose',choiceId:'s1-guard',index:0});
  assert.equal(upgrade.state.dice[0].level, 3);
  assert.ok(upgrade.events.every(event => event.type !== 'guard'), 'entering the next fight does not trigger guard');
  const guardedAttack = model.act(upgrade.state, {type:'attack'});
  assert.ok(guardedAttack.events.some(event => event.type === 'guard' && event.amount === 18));
  state.dice[0].level = 20;
  assert.equal(model.rewardPreview(state, 's1-guard', 0), null);
  const replace = model.act(state, {type:'choose',choiceId:'s1-flame',index:0});
  assert.equal(replace.state.dice[0].skill, 'flame');
  assert.equal(replace.state.dice[0].level, 1);
});

test('valid version-one reward choices remain usable while new style saves round-trip without replaying effects', () => {
  const legacy = secondReward();
  legacy.version = 1;
  for (const key of ['chapterId','runId','loadout','charges']) delete legacy[key];
  legacy.choices = [
    {id:'s1-sword',kind:'sword',name:'御剑诀',description:'旧存档',rarity:'rare'},
    {id:'s1-face',kind:'face',name:'六面归元',description:'旧存档',rarity:'uncommon'},
    {id:'s1-vitality',kind:'vitality',name:'养元心法',description:'旧存档',rarity:'common'},
  ];
  assert.equal(model.validateAdventure(legacy), true);
  const legacyBefore = structuredClone(legacy);
  assert.match(model.rewardPreview(legacy, 's1-sword', 2).after, /剑影.*重掷蓄气.*\+1/);
  const chosen = model.act(legacy, {type:'choose',choiceId:'s1-sword',index:2});
  assert.equal(chosen.state.stage, 2);
  assert.equal(chosen.state.version, 2);
  assert.deepEqual(legacy, legacyBefore);
  const state = withSkill('guard'); state.hero.shield = 24;
  const saved = JSON.parse(JSON.stringify(state));
  assert.equal(model.validateAdventure(saved), true);
  assert.strictEqual(model.act(saved, {type:'begin'}).state, saved);
  assert.equal(saved.hero.shield, 24);
  for (const mutate of [s=>{s.dice[0].skill='unknown';}, s=>{s.dice[0].level=21;}, s=>{s.dice[1].skill='guard';s.dice[1].level=1;}]) {
    const invalid = structuredClone(state); mutate(invalid); assert.equal(model.validateAdventure(invalid), false);
  }
});
