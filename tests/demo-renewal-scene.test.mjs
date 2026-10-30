import test from 'node:test';
import assert from 'node:assert/strict';

const sceneModule = await import('../demo/renewal/scene.mjs').catch(() => ({}));

function harness(t) {
  const keys = ['document', 'Image', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'];
  const originals = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  let now = 0, next = 0;
  const frames = new Map(), timers = new Map(), images = [], calls = [], scenes = [];
  let alpha = 1, fillStyle, stack = [];
  const gradient = {addColorStop() {}};
  const context = new Proxy({
    get globalAlpha() { return alpha; }, set globalAlpha(value) { alpha = value; },
    get fillStyle() { return fillStyle; }, set fillStyle(value) { fillStyle = value; },
    save() { stack.push({alpha, fillStyle}); calls.push({type: 'save'}); },
    restore() { ({alpha, fillStyle} = stack.pop() || {alpha: 1}); calls.push({type: 'restore'}); },
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    measureText: text => ({width: String(text).length * 15}),
  }, {get(object, key) {
    if (key in object) return object[key];
    return (...args) => {
      for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} received ${value}`);
      calls.push({type: key, args, alpha, fillStyle});
    };
  }});
  globalThis.Image = class {
    constructor() { this.naturalWidth = 0; this.naturalHeight = 0; images.push(this); }
    set src(value) { this.url = value; }
    get src() { return this.url; }
  };
  globalThis.performance = {now: () => now};
  globalThis.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.setTimeout = (callback, delay) => { timers.set(++next, {callback, delay}); return next; };
  globalThis.clearTimeout = id => timers.delete(id);
  t.after(() => { for (const scene of scenes) scene.destroy(); for (const key of keys) globalThis[key] = originals[key]; });
  return {
    calls, frames, timers, images,
    enableTrimming() {
      globalThis.document = {createElement(type) {
        assert.equal(type, 'canvas');
        return {getContext() { return {drawImage() {}, getImageData(_x, _y, width, height) {
          const data = new Uint8ClampedArray(width * height * 4);
          for (let y = 30; y < height - 30; y++) for (let x = 40; x < width - 40; x++) data[(y * width + x) * 4 + 3] = 255;
          return {data};
        }}; }};
      }};
    },
    create({width = 390, height = 844, heroHealthTop} = {}) {
      assert.equal(typeof sceneModule.createAdventureScene, 'function', 'portrait adventure scene factory exists');
      const scene = sceneModule.createAdventureScene({width: 0, height: 0, getContext: () => context,
        getBoundingClientRect: () => ({width, height, top: 0}),
        parentElement: heroHealthTop === undefined ? null : {querySelector: selector => selector === '.renewal-hero-health' ? {getBoundingClientRect: () => ({top: heroHealthTop})} : null}}, {backgroundUrl: 'forest.png', spritesUrl: 'characters.png'});
      scenes.push(scene); return scene;
    },
    load(failed = false) {
      for (const image of images) {
        if (failed) image.onerror?.(new Error('offline'));
        else { image.naturalWidth = image.url === 'characters.png' ? 1600 : 1024; image.naturalHeight = image.url === 'characters.png' ? 600 : 1536; image.onload?.(); }
      }
    },
    frame(ms = 0) {
      now += ms; calls.length = 0;
      const callbacks = [...frames.values()]; frames.clear();
      for (const callback of callbacks) callback(now);
    },
    async complete() {
      const entry = timers.entries().next().value;
      assert.ok(entry, 'an active presentation has a completion timer');
      const [id, timer] = entry; timers.delete(id); now += timer.delay; timer.callback();
      await Promise.resolve(); await Promise.resolve();
    },
  };
}

const state = (enemies = [{id: 'a', kind: 'bandit', hp: 12, maxHp: 12}]) => ({
  version: 1, seed: 1, stage: 0, phase: 'battle', round: 1,
  hero: {hp: 20, maxHp: 20, attack: 5, shield: 0}, enemies, targetId: enemies[0]?.id,
  dice: [{id: 'd1', unlocked: true, faces: [1, 2, 3, 4, 5, 6], value: 2, skill: 'sword', level: 1}],
});
const spriteCalls = h => h.calls.filter(call => call.type === 'drawImage' && call.args[0].url === 'characters.png');
const labels = h => h.calls.filter(call => call.type === 'fillText').map(call => call.args[0]);

// Applying independent X/Y viewport scales to a sprite must not squash its face or weapon.
test('character images keep their source proportions on wide, tall and compact screens', async t => {
  const h = harness(t);
  for (const viewport of [{width: 460, height: 720}, {width: 360, height: 800}, {width: 390, height: 844}, {width: 360, height: 615}]) {
    const scene = h.create(viewport); h.load(); await scene.ready;
    scene.update(state(), {reducedMotion: true}); h.frame();
    const transform = h.calls.find(call => call.type === 'setTransform').args;
    const actors = spriteCalls(h);
    assert.equal(actors.length, 2, 'hero and enemy images are painted');
    for (const call of actors) {
      const [, , , sw, sh, , , dw, dh] = call.args;
      const renderedRatio = dw * transform[0] / (dh * transform[3]);
      assert.ok(Math.abs(renderedRatio - sw / sh) < .000001, `${viewport.width}×${viewport.height}: ${renderedRatio} differs from ${sw / sh}`);
    }
    scene.destroy();
  }
});

// Removing image rendering or returning to a side-view actor layout breaks this test.
test('loaded forest and four-column sprites draw a portrait encounter above the hero', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  scene.update(state([{id: 'a', kind: 'bandit', hp: 10}, {id: 'b', kind: 'archer', hp: 10}, {id: 'c', kind: 'boss', hp: 10}]));
  h.frame();
  const background = h.calls.find(call => call.type === 'drawImage' && call.args[0].url === 'forest.png');
  assert.ok(background, 'actual forest image is painted');
  const actors = spriteCalls(h);
  assert.equal(actors.length, 4);
  for (const [index, call] of actors.entries()) {
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = call.args;
    assert.equal(sx, [400, 800, 1200, 0][index]);
    assert.equal(sy, 0); assert.equal(sw, 400); assert.equal(sh, 600);
    const expected = index === 3 ? [.5, .60] : [[.24, .34], [.5, .34], [.76, .34]][index];
    assert.ok(Math.abs((dx + dw / 2) / 390 - expected[0]) < .01);
    assert.ok(Math.abs((dy + dh / 2) / 844 - expected[1]) < .01);
  }
});

// Applying final state first, reordering callbacks, or skipping death completion breaks this test.
test('multi-hit snapshots finish in order and reward waits for the final death', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  const before = state(), hit = state([{id: 'a', kind: 'bandit', hp: 7, maxHp: 12}]), lethal = state([{id: 'a', kind: 'bandit', hp: 0, maxHp: 12}]);
  const reward = {...structuredClone(lethal), phase: 'reward'};
  scene.update(before);
  const seen = [], events = [
    {type: 'sword', source: 'hero', target: 'a', amount: 5, snapshot: hit},
    {type: 'attack', source: 'hero', target: 'a', amount: 7, snapshot: lethal},
    {type: 'death', source: 'hero', target: 'a', snapshot: lethal},
    {type: 'reward', source: 'hero', snapshot: reward},
  ];
  const pending = scene.play(events, {onFrame: snapshot => seen.push(snapshot)});
  h.frame(160);
  assert.ok(labels(h).includes('−5'), 'sword hit has a readable damage number');
  assert.equal(seen.length, 0, 'no future snapshot leaks before the first hit completes');
  await h.complete(); assert.deepEqual(seen, [hit]);
  h.frame(140); assert.ok(labels(h).includes('−7'));
  await h.complete(); assert.deepEqual(seen, [hit, lethal]);
  h.frame(0); assert.ok(spriteCalls(h).find(call => call.args[1] === 400).alpha > .9, 'lethal hit stays visible until death begins');
  h.frame(150); const dying = spriteCalls(h).find(call => call.args[1] === 400); assert.ok(dying.alpha > 0 && dying.alpha < 1, 'death dissolves rather than disappearing before its turn');
  await h.complete(); assert.deepEqual(seen, [hit, lethal, lethal]);
  h.frame(); assert.equal(spriteCalls(h).filter(call => call.args[1] === 400).length, 0);
  await h.complete(); await pending;
  assert.deepEqual(seen, [hit, lethal, lethal, reward]);
  assert.equal(h.timers.size, 0);
});

// Keeping old timers/callbacks alive after teardown breaks this test.
test('destroy cancels an in-progress sequence, resolves its promise, and suppresses old callbacks', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready; scene.update(state());
  const seen = [], pending = scene.play([{type: 'sword', source: 'hero', target: 'a', amount: 8, snapshot: state()}], {onFrame: snapshot => seen.push(snapshot)});
  h.frame(90); scene.destroy(); await pending;
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0); assert.deepEqual(seen, []);
  await scene.play([{type: 'reward', snapshot: state()}], {onFrame: snapshot => seen.push(snapshot)});
  scene.update(state()); assert.deepEqual(seen, []);
});

// Removing local hit feedback or retaining camera/lunge/flash in reduced motion breaks this test.
test('reduced motion keeps actors and camera still while preserving damage and sequence', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready; scene.update(state());
  const seen = [], hit = state([{id: 'a', kind: 'bandit', hp: 4, maxHp: 12}]);
  const pending = scene.play([{type: 'attack', source: 'hero', target: 'a', amount: 8, snapshot: hit}], {reducedMotion: true, onFrame: snapshot => seen.push(snapshot)});
  h.frame(120);
  assert.ok(labels(h).includes('−8'));
  const hero = spriteCalls(h).find(call => call.args[1] === 0);
  assert.ok(Math.abs((hero.args[6] + hero.args[8] / 2) / 844 - .60) < .001);
  for (const call of h.calls.filter(call => call.type === 'scale')) assert.deepEqual(call.args, [1, 1]);
  for (const call of h.calls.filter(call => call.type === 'translate')) assert.ok(Math.abs(call.args[0]) < .001 && Math.abs(call.args[1]) < .001, 'camera and lunge remain at rest');
  assert.ok(!h.calls.some(call => call.type === 'fillRect' && call.args[0] === 0 && call.args[1] === 0 && call.fillStyle === '#ffffff'), 'no full-stage flash');
  await h.complete(); await pending; assert.deepEqual(seen, [hit]);
});

// Awaiting failed textures forever would block both this ready and playback.
test('failed images settle ready and fallback canvas remains playable', async t => {
  const h = harness(t), scene = h.create(); h.load(true); await scene.ready; scene.update(state());
  h.frame(); assert.ok(h.calls.some(call => call.type === 'fill'));
  const seen = [], pending = scene.play([{type: 'hurt', source: 'a', target: 'hero', amount: 3, snapshot: state()}], {onFrame: snapshot => seen.push(snapshot)});
  await h.complete(); await pending; assert.equal(seen.length, 1);
});

// Ignoring the setting outside play would leave restored/menu-idle actors pulsing.
test('update applies reduced motion before any playback and keeps idle sprites stationary', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  scene.update(state(), {reducedMotion: true});
  h.frame(1000); const first = spriteCalls(h).map(call => call.args.slice(5));
  h.frame(1000); assert.deepEqual(spriteCalls(h).map(call => call.args.slice(5)), first);
});

// Letting a completed RAF and its timer both advance would replay/skip snapshots.
test('RAF completion calls each event once and replacement playback cancels its predecessor', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready; scene.update(state());
  const old = [], fresh = [];
  const replaced = scene.play([{type: 'sword', source: 'hero', target: 'a', amount: 1, snapshot: state()}], {onFrame: snapshot => old.push(snapshot)});
  const final = state();
  const current = scene.play([{type: 'attack', source: 'hero', target: 'a', amount: 2, snapshot: final}], {onFrame: snapshot => fresh.push(snapshot)});
  await replaced; assert.deepEqual(old, []);
  h.frame(400); await current;
  assert.deepEqual(fresh, [final]); assert.equal(h.timers.size, 0);
  h.frame(400); assert.deepEqual(fresh, [final]);
});

// Texture listeners must not retain a destroyed scene or leave ready pending.
test('destroy before textures arrive settles readiness and detaches load callbacks', async t => {
  const h = harness(t), scene = h.create(); scene.destroy(); await scene.ready;
  for (const image of h.images) { assert.equal(image.onload, null); assert.equal(image.onerror, null); }
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
});

// The model's seed advances on every roll; treating it as encounter identity resurrects dead foes.
test('a later random roll does not resurrect an enemy whose death finished', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  const before = state([{id: 'a', kind: 'bandit', hp: 0, maxHp: 12}, {id: 'b', kind: 'archer', hp: 10, maxHp: 10}]);
  scene.update({...structuredClone(before), enemies: before.enemies.map(enemy => ({...enemy, hp: 10}))});
  const after = {...structuredClone(before), seed: 5678};
  const pending = scene.play([
    {type: 'death', source: 'hero', target: 'a', snapshot: before},
    {type: 'roll', source: 'hero', dieIndex: 0, amount: 5, snapshot: after},
  ]);
  await h.complete(); await h.complete(); await pending; h.frame();
  assert.equal(spriteCalls(h).filter(call => call.args[1] === 400).length, 0, 'completed death survives random state changes');
  assert.equal(spriteCalls(h).length, 2, 'remaining enemy and hero stay visible');
});

// Transparent padding must not shrink one character or shift its encounter anchor.
test('sprite cells trim alpha padding while retaining their portrait anchor', async t => {
  const h = harness(t); h.enableTrimming(); const scene = h.create(); h.load(); await scene.ready; scene.update(state()); h.frame();
  const enemy = spriteCalls(h).find(call => call.args[1] >= 400), hero = spriteCalls(h).find(call => call.args[1] < 400);
  assert.deepEqual(enemy.args.slice(1, 5), [440, 30, 320, 540]);
  assert.deepEqual(hero.args.slice(1, 5), [40, 30, 320, 540]);
  assert.ok(Math.abs((hero.args[5] + hero.args[7] / 2) / 390 - .5) < .001);
  assert.ok(Math.abs((hero.args[6] + hero.args[8] / 2) / 844 - .60) < .001);
});

// On short screens a fixed .60 hero anchor would collide with its health HUD/deck.
test('short-screen actors fit between the enemy row and the measured hero health HUD', async t => {
  const h = harness(t), scene = h.create({height: 615, heroHealthTop: 363}); h.load(); await scene.ready; scene.update(state(), {reducedMotion: true}); h.frame();
  const hero = spriteCalls(h).find(call => call.args[1] === 0), enemy = spriteCalls(h).find(call => call.args[1] === 400);
  const heroTop = hero.args[6] / 844 * 615, heroBottom = (hero.args[6] + hero.args[8]) / 844 * 615;
  const enemyBottom = (enemy.args[6] + enemy.args[8]) / 844 * 615;
  assert.ok(heroBottom <= 355.01, 'hero ends at least eight pixels above health HUD');
  assert.ok(heroTop > enemyBottom + 10, 'short-screen hero still has space below enemies');
});

// Tall-screen health cards need headroom, while compact screens keep the enemy row higher.
test('enemy centers reserve health-card space in both normal and compact portrait layouts', async t => {
  const h = harness(t);
  const normal = h.create(); h.load(); await normal.ready; normal.update(state(), {reducedMotion: true}); h.frame();
  const tallEnemy = spriteCalls(h).find(call => call.args[1] === 400);
  assert.ok(Math.abs((tallEnemy.args[6] + tallEnemy.args[8] / 2) / 844 - .34) < .001);
  normal.destroy();
  const compact = h.create({height: 615, heroHealthTop: 363}); h.load(); await compact.ready; compact.update(state(), {reducedMotion: true}); h.frame();
  const shortEnemy = spriteCalls(h).find(call => call.args[1] === 400);
  assert.ok(Math.abs((shortEnemy.args[6] + shortEnemy.args[8] / 2) / 844 - .29) < .001);
});
