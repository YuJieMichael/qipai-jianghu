import test from 'node:test';
import assert from 'node:assert/strict';

const model = await import('../demo/renewal/model.mjs').catch(() => ({}));

test('a new adventure waits for one visible initial roll with only one unlocked die', () => {
  assert.equal(typeof model.newAdventure, 'function', 'adventure constructor must exist');
  const state = model.newAdventure(42);
  assert.equal(state.phase, 'battle');
  assert.equal(state.stage, 0);
  assert.equal(state.round, 1);
  assert.equal(state.rerolls, 3);
  assert.equal(state.hero.hp, 120);
  assert.equal(state.hero.maxHp, 120);
  assert.equal(state.dice.length, 5);
  assert.equal(state.dice.filter(die => die.unlocked).length, 1);
  assert.equal(state.dice[0].value, 0);
  assert.equal(state.dice[0].skill, 'sword');
  assert.equal(state.dice[0].level, 1);
  assert.ok(state.enemies.every(enemy => enemy.hp === enemy.maxHp));
  assert.equal(state.stats.damage, 0);
  assert.equal(model.validateAdventure(state), true);
  assert.equal(model.SAVE_KEY, 'qipai-reference-chapter-v1');
});

const copy = value => structuredClone(value);
const active = (seed = 42) => model.act(model.newAdventure(seed), {type:'begin'}).state;

test('begin and each single-die reroll fire sword immediately even on a face of one', () => {
  assert.equal(typeof model.act, 'function', 'actions must return state and playback events');
  const pending = model.newAdventure(42);
  const original = copy(pending);
  for (const action of [{type:'attack'}, {type:'reroll',index:0}]) {
    assert.deepEqual(model.act(pending, action), {state:pending,events:[]});
  }
  const begun = model.act(pending, {type:'begin'});
  assert.deepEqual(pending, original);
  assert.deepEqual(begun.events.map(event => event.type), ['roll','sword']);
  assert.equal(begun.state.dice[0].value, 2);
  assert.equal(begun.state.enemies[0].hp, 26);
  assert.equal(begun.state.rerolls, 3);
  assert.equal(begun.state.stats.damage, 4);
  assert.equal(begun.state.stats.rounds, 1);
  assert.strictEqual(model.act(begun.state, {type:'begin'}).state, begun.state);
  const before = copy(begun.state);
  const rerolled = model.act(begun.state, {type:'reroll',index:0});
  assert.equal(rerolled.state.dice[0].value, 1);
  assert.equal(rerolled.state.enemies[0].hp, 22);
  assert.equal(rerolled.state.rerolls, 2);
  assert.equal(rerolled.state.stats.rerolls, 1);
  assert.deepEqual(rerolled.state.dice.slice(1), before.dice.slice(1));
  assert.deepEqual(begun.state, before);
  assert.deepEqual(rerolled.events.map(event => event.type), ['roll','sword']);
  assert.equal(rerolled.events[1].dieIndex, 0);
  assert.equal(rerolled.events[1].source, 'hero');
  assert.equal(rerolled.events[1].amount, 4);
});

test('playback snapshots preserve the state at each impact and share no mutable references', () => {
  const result = model.act(model.newAdventure(42), {type:'begin'});
  assert.equal(result.events[0].snapshot.enemies[0].hp, 30);
  assert.equal(result.events[1].snapshot.enemies[0].hp, 26);
  assert.notStrictEqual(result.events[0].snapshot, result.events[1].snapshot);
  result.state.hero.hp = 1;
  result.state.dice[0].faces[0] = 6;
  result.events[1].snapshot.enemies[0].hp = 2;
  assert.equal(result.events[0].snapshot.enemies[0].hp, 30);
  assert.equal(result.events[0].snapshot.hero.hp, 120);
  assert.equal(result.events[0].snapshot.dice[0].faces[0], 1);
});

test('locked dice, exhausted rerolls, invalid targets and repeated begin are atomic noops', () => {
  const state = active();
  for (const action of [
    {type:'reroll',index:1}, {type:'reroll',index:-1}, {type:'reroll',index:5},
    {type:'reroll',index:1.5}, {type:'reroll',index:'0'}, {type:'target',id:'absent'},
    {type:'begin'}, {type:'unknown'}, null,
  ]) {
    const result = model.act(state, action);
    assert.strictEqual(result.state, state);
    assert.deepEqual(result.events, []);
  }
  const exhausted = {...state,rerolls:0};
  assert.strictEqual(model.act(exhausted, {type:'reroll',index:0}).state, exhausted);
});

test('hand strength uses unlocked dice and recognizes partial pairs, triples and four of a kind', () => {
  assert.equal(typeof model.handOf, 'function');
  const cases = [
    [[6],0,1,14], [[1,1],1,1.5,21], [[2,2,3,3],2,2,28],
    [[4,4,4],3,2.5,35], [[1,2,3,4],0,1,14], [[1,2,3,4,5],4,3,42],
    [[1,1,1,2,2],5,3.5,49], [[2,2,2,2],6,5,70], [[6,6,6,6,6],7,10,140],
  ];
  for (const [values,rank,multiplier,damage] of cases) {
    const state = model.newAdventure();
    state.dice.forEach((die, index) => { die.unlocked = index < values.length; die.value = values[index] ?? 6; });
    const hand = model.handOf(state);
    assert.equal(hand.rank, rank, values.join(','));
    assert.equal(hand.multiplier, multiplier);
    assert.equal(hand.damage, damage);
    assert.equal(typeof hand.name, 'string');
  }
});

test('manual attack is followed by living enemies and the next round automatic roll', () => {
  const state = active(42), original = copy(state);
  const result = model.act(state, {type:'attack'});
  assert.deepEqual(state, original);
  assert.deepEqual(result.events.map(event => event.type), ['attack','hurt','roll','sword']);
  assert.equal(result.events[0].amount, 14);
  assert.equal(result.events[0].snapshot.enemies[0].hp, 12);
  assert.equal(result.events[1].source, state.enemies[0].id);
  assert.equal(result.state.hero.hp, 113);
  assert.equal(result.state.enemies[0].hp, 8);
  assert.equal(result.state.round, 2);
  assert.equal(result.state.stats.rounds, 2);
  assert.equal(result.state.rerolls, 3);
});

test('sword sweeps every living enemy regardless of selected direct-attack target', () => {
  const state = active(42);
  state.enemies.push({id:'second',kind:'archer',name:'试炼弩手',hp:3,maxHp:3,attack:5});
  const selected = model.act(state, {type:'target',id:'second'});
  assert.equal(selected.state.targetId, 'second');
  assert.equal(state.targetId, state.enemies[0].id);
  const result = model.act(selected.state, {type:'reroll',index:0});
  assert.equal(result.state.enemies[0].hp, 22);
  assert.equal(result.state.enemies[1].hp, 0);
  assert.equal(result.state.hero.hp, 120);
  assert.equal(result.state.phase, 'battle');
  assert.equal(result.state.targetId, state.enemies[0].id);
  assert.equal(result.state.stats.kills, 1);
  assert.deepEqual(result.events.map(event => event.type), ['roll','sword','sword','death']);
  assert.equal(result.events[2].amount, 3, 'damage stats use actual remaining enemy health');
});

test('target selection changes the manual hit before surviving enemies take their turns', () => {
  const state = active(42);
  state.enemies.push({id:'second',kind:'archer',name:'试炼弩手',hp:25,maxHp:25,attack:5});
  const selected = model.act(state, {type:'target',id:'second'}).state;
  const result = model.act(selected, {type:'attack'});
  assert.equal(result.events[0].target, 'second');
  assert.deepEqual(result.events[0].snapshot.enemies.map(enemy => enemy.hp), [26,11]);
  assert.equal(result.events.filter(event => event.type === 'hurt').length, 2);
  assert.equal(result.state.hero.hp, 108);
});

test('a sword sweep killing another enemy preserves the living selected target for the next direct attack',()=>{
 const state=active(42);state.enemies[0].hp=1;
 state.enemies.push({id:'second',kind:'archer',name:'试炼弩手',hp:30,maxHp:30,attack:5},{id:'third',kind:'sentinel',name:'石阶卫',hp:30,maxHp:30,attack:5});
 const selected=model.act(state,{type:'target',id:'third'}).state;
 assert.equal(model.validateAdventure(selected),true);
 const result=model.act(selected,{type:'reroll',index:0});
 assert.deepEqual(result.state.enemies.map(enemy=>enemy.hp),[0,26,26]);assert.equal(result.state.targetId,'third');
 assert.equal(model.act(result.state,{type:'attack'}).events[0].target,'third');
});

test('a reroll kill ends combat before manual attack and grants exactly one stable reward', () => {
  const state = active();
  state.enemies[0].hp = 2;
  const result = model.act(state, {type:'reroll',index:0});
  assert.equal(result.state.phase, 'reward');
  assert.equal(result.state.hero.hp, 120);
  assert.equal(result.state.enemies[0].hp, 0);
  assert.equal(result.state.stats.kills, 1);
  assert.equal(result.state.dice.filter(die => die.unlocked).length, 2);
  assert.deepEqual(result.events.map(event => event.type), ['roll','sword','death','unlock','reward']);
  assert.equal(result.events.filter(event => event.type === 'reward').length, 1);
  assert.deepEqual(new Set(result.state.choices.map(choice => choice.kind)), new Set(['sword','face','vitality']));
  const saved = JSON.parse(JSON.stringify(result.state));
  assert.equal(model.validateAdventure(saved), true);
  assert.deepEqual(saved.choices, result.state.choices);
  for (const action of [{type:'attack'},{type:'begin'},{type:'reroll',index:0}]) {
    const again = model.act(saved, action);
    assert.strictEqual(again.state, saved);
    assert.deepEqual(again.events, []);
  }
});

test('shield absorbs enemy damage and lethal retaliation stops all subsequent rolls', () => {
  const shielded = active();
  shielded.hero.shield = 10;
  const blocked = model.act(shielded, {type:'attack'});
  assert.equal(blocked.state.hero.hp, 120);
  assert.equal(blocked.state.hero.shield, 3);
  const fragile = active();
  fragile.hero.hp = 3;
  const result = model.act(fragile, {type:'attack'});
  assert.equal(result.state.phase, 'lost');
  assert.equal(result.state.hero.hp, 0);
  assert.deepEqual(result.events.map(event => event.type), ['attack','hurt','death']);
  assert.equal(result.events[1].amount, 3);
  assert.equal(result.events[2].target, 'hero');
  assert.equal(model.validateAdventure(result.state), true);
  assert.strictEqual(model.act(result.state, {type:'attack'}).state, result.state);
});

const rewardState = () => {
  const state = active();
  state.enemies[0].hp = 1;
  return model.act(state, {type:'reroll',index:0}).state;
};

test('reward preview and sword confirmation upgrade only the selected die then auto-roll the next fight', () => {
  assert.equal(typeof model.rewardPreview, 'function');
  const state = rewardState(), before = copy(state);
  const sword = state.choices.find(choice => choice.kind === 'sword');
  const preview = model.rewardPreview(state, sword.id, 1);
  assert.match(preview.before, /无剑气/);
  assert.match(preview.after, /1.*4/);
  assert.equal(model.rewardPreview(state, sword.id, 4), null);
  const result = model.act(state, {type:'choose',choiceId:sword.id,index:1});
  assert.deepEqual(state, before);
  assert.equal(result.state.stage, 1);
  assert.equal(result.state.phase, 'battle');
  assert.equal(result.state.round, 1);
  assert.equal(result.state.rerolls, 3);
  assert.deepEqual(result.state.choices, []);
  assert.equal(result.state.dice[1].skill, 'sword');
  assert.equal(result.state.dice[1].level, 1);
  assert.equal(result.state.dice[0].skill, 'sword');
  assert.equal(result.state.dice[0].level, 1);
  assert.deepEqual(result.state.dice.map(die => die.faces), before.dice.map(die => die.faces));
  assert.deepEqual(result.events.filter(event => event.type === 'roll').map(event => event.dieIndex), [0,1]);
  assert.deepEqual(result.events.filter(event => event.type === 'sword').map(event => event.dieIndex), [0,0,1,1]);
  assert.ok(result.events.filter(event => event.type === 'sword').every(event => event.amount === 4));
  assert.ok(result.state.dice.slice(0,2).every(die => die.value > 0));
  const leveled = model.rewardPreview(state, sword.id, 0);
  assert.match(leveled.before, /1.*4/);
  assert.match(leveled.after, /2.*8/);
});

test('face reward replaces one minimum physical face on exactly one selected die', () => {
  const state = rewardState(), before = copy(state);
  const choiceId = state.choices.find(choice => choice.kind === 'face').id;
  const preview = model.rewardPreview(state, choiceId, 1);
  assert.match(preview.before, /1/);
  assert.match(preview.after, /6/);
  const result = model.act(state, {type:'choose',choiceId,index:1});
  assert.deepEqual(result.state.dice[1].faces, [6,2,3,4,5,6]);
  assert.deepEqual(result.state.dice[0].faces, [1,2,3,4,5,6]);
  assert.equal(result.state.dice[1].skill, null);
  assert.equal(result.state.dice[0].level, 1);
  assert.deepEqual(state, before);
});

test('vitality reward previews real health values and heals without a target die', () => {
  const state = rewardState();
  state.hero.hp = 80;
  const choiceId = state.choices.find(choice => choice.kind === 'vitality').id;
  const preview = model.rewardPreview(state, choiceId);
  assert.match(preview.before, /80.*120/);
  assert.match(preview.after, /112.*144/);
  const result = model.act(state, {type:'choose',choiceId});
  assert.equal(result.state.hero.maxHp, 144);
  assert.equal(result.state.hero.hp, 112);
  assert.equal(result.events[0].type, 'heal');
  assert.equal(result.events[0].amount, 32);
  assert.equal(result.events[0].snapshot.hero.hp, 112);
  assert.deepEqual(result.state.dice.map(die => die.faces), state.dice.map(die => die.faces));
});

test('missing, stale, locked and fractional reward targets leave the whole saved reward unchanged', () => {
  const state = rewardState(), before = copy(state);
  const sword = state.choices.find(choice => choice.kind === 'sword');
  for (const action of [
    {type:'choose',choiceId:'missing',index:0}, {type:'choose',choiceId:sword.id},
    {type:'choose',choiceId:sword.id,index:4}, {type:'choose',choiceId:sword.id,index:-1},
    {type:'choose',choiceId:sword.id,index:0.5}, {type:'choose',choiceId:sword.id,index:'0'},
  ]) {
    const result = model.act(state, action);
    assert.strictEqual(result.state, state);
    assert.deepEqual(result.events, []);
  }
  assert.deepEqual(state, before);
  const chosen = model.act(state, {type:'choose',choiceId:sword.id,index:0}).state;
  assert.strictEqual(model.act(chosen, {type:'choose',choiceId:sword.id,index:0}).state, chosen);
});

test('six distinct encounters progressively unlock at most five slots and the boss ends immediately', () => {
  let state = active(99);
  const kinds = new Set();
  let rewards = 0, unlocks = 0;
  for (let stage = 0; stage < 6; stage++) {
    assert.equal(state.stage, stage);
    assert.equal(state.phase, 'battle');
    state.enemies.forEach(enemy => { kinds.add(enemy.kind); enemy.hp = 1; });
    while (state.phase === 'battle') {
      const result = model.act(state, {type:state.rerolls ? 'reroll' : 'attack',index:0});
      rewards += result.events.filter(event => event.type === 'reward').length;
      unlocks += result.events.filter(event => event.type === 'unlock').length;
      state = result.state;
    }
    assert.equal(state.dice.filter(die => die.unlocked).length, Math.min(5,stage+2));
    if (stage < 5) {
      assert.equal(state.phase, 'reward');
      assert.equal(model.validateAdventure(state), true);
      const choice = state.choices.find(value => value.kind === 'vitality');
      state = model.act(state, {type:'choose',choiceId:choice.id}).state;
    }
  }
  assert.equal(state.phase, 'won');
  assert.equal(state.stage, 5);
  assert.equal(state.enemies.every(enemy => enemy.hp === 0), true);
  assert.deepEqual(state.choices, []);
  assert.equal(rewards, 5);
  assert.equal(unlocks, 4);
  assert.deepEqual(kinds, new Set(['bandit','archer','sentinel','boss']));
  assert.equal(model.validateAdventure(state), true);
});

test('save validation rejects non-finite, oversized and inconsistent data without throwing or mutating', () => {
  const state = active();
  const mutations = [
    ['seed infinity', value => { value.seed = Infinity; }],
    ['seed fraction', value => { value.seed = 0.5; }],
    ['stage overflow', value => { value.stage = 6; }],
    ['round overflow', value => { value.round = 1e100; }],
    ['health nan', value => { value.hero.hp = NaN; }],
    ['health above maximum', value => { value.hero.hp = 121; }],
    ['maximum overflow', value => { value.hero.maxHp = Number.MAX_VALUE; }],
    ['attack negative', value => { value.hero.attack = -1; }],
    ['shield infinity', value => { value.hero.shield = Infinity; }],
    ['extra hero key', value => { value.hero.payload = {}; }],
    ['no unlocked dice', value => { value.dice[0].unlocked = false; }],
    ['unlocked out of order', value => { value.dice[0].unlocked = false; value.dice[1].unlocked = true; }],
    ['sparse physical faces', value => { delete value.dice[0].faces[0]; }],
    ['too many physical faces', value => { value.dice[0].faces.push(2); }],
    ['invalid face', value => { value.dice[0].faces[0] = 7; }],
    ['rolled face absent', value => { value.dice[0].faces = [6,6,6,6,6,6]; value.dice[0].value = 2; }],
    ['pending roll after begin', value => { value.dice[0].value = 0; }],
    ['skill level infinity', value => { value.dice[0].level = Infinity; }],
    ['unbound skill level', value => { value.dice[1].level = 1; }],
    ['duplicate dice identity', value => { value.dice[1].id = value.dice[0].id; }],
    ['too many rerolls', value => { value.rerolls = 4; }],
    ['enemy over-healed', value => { value.enemies[0].hp = 31; }],
    ['no enemies', value => { value.enemies = []; }],
    ['oversized enemy group', value => { value.enemies = Array.from({length:1000}, () => value.enemies[0]); }],
    ['duplicate enemies', value => { value.enemies.push(copy(value.enemies[0])); }],
    ['unknown enemy kind', value => { value.enemies[0].kind = 'dragon'; }],
    ['dead combat target', value => { value.enemies[0].hp = 0; }],
    ['absent target', value => { value.targetId = 'missing'; }],
    ['negative statistics', value => { value.stats.damage = -1; }],
    ['statistics overflow', value => { value.stats.rounds = Number.MAX_VALUE; }],
    ['oversized history', value => { value.history = Array(1000).fill('x'); }],
    ['object history payload', value => { value.history = [{}]; }],
    ['live reward', value => { value.phase = 'reward'; }],
    ['false loss', value => { value.phase = 'lost'; }],
    ['early victory', value => { value.phase = 'won'; }],
    ['unknown root field', value => { value.payload = {}; }],
  ];
  for (const [name,mutate] of mutations) {
    const invalid = copy(state);
    mutate(invalid);
    const before = copy(invalid);
    assert.equal(model.validateAdventure(invalid), false, name);
    assert.deepEqual(invalid, before, name);
    assert.doesNotThrow(() => model.act(invalid, {type:'attack'}), name);
    assert.strictEqual(model.act(invalid, {type:'attack'}).state, invalid, name);
  }
  for (const value of [null,undefined,[],{},42,'saved']) assert.equal(model.validateAdventure(value), false);
  const cycle = {...state}; cycle.hero = cycle;
  assert.equal(model.validateAdventure(cycle), false);
  const oversized = copy(state); oversized.history = ['x'.repeat(100000)];
  assert.equal(model.validateAdventure(oversized), false);
  const getter = copy(state); Object.defineProperty(getter, 'seed', {get(){ throw new Error('bad getter'); }});
  assert.equal(model.validateAdventure(getter), false);
});

test('saved reward choices remain usable after a JSON round trip and forged choices are rejected', () => {
  const reward = JSON.parse(JSON.stringify(rewardState()));
  const before = copy(reward);
  assert.equal(model.validateAdventure(reward), true);
  const choice = reward.choices.find(value => value.kind === 'face');
  const first = model.act(reward, {type:'choose',choiceId:choice.id,index:1});
  const repeated = model.act(copy(reward), {type:'choose',choiceId:choice.id,index:1});
  assert.deepEqual(first, repeated);
  assert.deepEqual(reward, before);
  const invalid = copy(reward);
  invalid.choices[0].id = 'stale-id';
  assert.equal(model.validateAdventure(invalid), false);
  const duplicated = copy(reward);
  duplicated.choices[1] = copy(duplicated.choices[0]);
  assert.equal(model.validateAdventure(duplicated), false);
});

test('restart creates one deterministic visible initial roll and does not reuse previous state or snapshots', () => {
  const state = rewardState(), before = copy(state);
  const restarted = model.act(state, {type:'restart',seed:42});
  const begun = model.act(model.newAdventure(42), {type:'begin'});
  assert.deepEqual(restarted, begun);
  assert.deepEqual(state, before);
  assert.equal(restarted.state.stage, 0);
  assert.equal(restarted.state.hero.hp, 120);
  assert.equal(restarted.events[1].snapshot.enemies[0].hp, 26);
  const recovered = model.act(null, {type:'restart',seed:42});
  assert.deepEqual(recovered, begun);
});
