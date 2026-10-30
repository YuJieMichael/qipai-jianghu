import test from 'node:test';
import assert from 'node:assert/strict';

const sceneModule = await import('../demo/renewal/scene.mjs').catch(() => ({}));

function harness(t) {
  const keys = ['document', 'Image', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'];
  const originals = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  let now = 0, next = 0;
  const frames = new Map(), timers = new Map(), images = [], calls = [], scenes = [];
  let alpha = 1, fillStyle, strokeStyle, path = [], stack = [];
  const gradient = {addColorStop() {}};
  const context = new Proxy({
    get globalAlpha() { return alpha; }, set globalAlpha(value) { alpha = value; },
    get fillStyle() { return fillStyle; }, set fillStyle(value) { fillStyle = value; },
    get strokeStyle() { return strokeStyle; }, set strokeStyle(value) { strokeStyle = value; },
    save() { stack.push({alpha, fillStyle, strokeStyle}); calls.push({type: 'save'}); },
    restore() { ({alpha, fillStyle, strokeStyle} = stack.pop() || {alpha: 1}); calls.push({type: 'restore'}); },
    beginPath() { path = []; calls.push({type: 'beginPath'}); },
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    measureText: text => ({width: String(text).length * 15}),
  }, {get(object, key) {
    if (key in object) return object[key];
    return (...args) => {
      for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} received ${value}`);
      if (['ellipse', 'moveTo', 'lineTo', 'closePath'].includes(key)) path.push({type: key, args});
      calls.push({type: key, args, alpha, fillStyle, strokeStyle, path: [...path]});
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
const rgb = color => /^#[\da-f]{6}/i.test(color || '') ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)) : [0, 0, 0];
const warm = color => { const [r, g, b] = rgb(color); return r > 200 && g > 70 && g < 225 && b < g * .8; };
const blue = color => { const [r, g, b] = rgb(color); return b > r * 1.1 && g > r * 1.05; };
const paintedEllipses = (h, type, color) => h.calls.filter(call => call.type === type && color(type === 'stroke' ? call.strokeStyle : call.fillStyle))
  .flatMap(call => call.path.filter(segment => segment.type === 'ellipse').map(segment => ({args: segment.args, alpha: call.alpha})));

// A flame event must paint a single warm projectile toward its chosen foe and warm damage at impact.
test('flame paints an orange gold projectile and local target sparks before applying its snapshot', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  const before = state([{id: 'a', kind: 'bandit', hp: 12}, {id: 'b', kind: 'archer', hp: 12}]);
  const after = structuredClone(before); after.enemies[1].hp = 6;
  scene.update(before); const seen = [];
  const playing = scene.play([{type: 'flame', source: 'hero', target: 'b', amount: 6, dieIndex: 0, snapshot: after}], {onFrame: snapshot => seen.push(snapshot)});
  h.frame(65);
  assert.ok(paintedEllipses(h, 'fill', warm).some(({args: [x, y, rx]}) => x > 195 && x < 281 && y > 300 && y < 500 && rx < 22), 'one small orange fire core travels to the selected enemy');
  assert.deepEqual(seen, [], 'projectile does not expose the next model state');
  h.frame(110);
  assert.ok(paintedEllipses(h, 'stroke', warm).some(({args: [x, y, rx]}) => Math.abs(x - 280.8) < 1 && Math.abs(y - 278.96) < 15 && rx < 50), 'impact stays local to the selected target');
  const damage = h.calls.find(call => call.type === 'fillText' && call.args[0] === '−6');
  assert.ok(damage && warm(damage.fillStyle), 'flame damage is negative and warm colored');
  assert.ok(!h.calls.some(call => call.type === 'fillRect' && call.args[0] === 0 && call.args[1] === 0 && call.args[2] >= 390 && call.args[3] >= 844), 'flame never flashes the whole battlefield');
  await h.complete(); await playing; assert.deepEqual(seen, [after]);
});

// A guard event adds a readable positive shield amount and leaves a quiet shield only after its snapshot settles.
test('guard paints a blue gold body ring and positive shield readout then retains a quiet shield', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  const before = state(), after = structuredClone(before); after.hero.shield = 6;
  scene.update(before); h.frame(); assert.equal(paintedEllipses(h, 'stroke', blue).length, 0);
  const playing = scene.play([{type: 'guard', source: 'hero', target: 'hero', amount: 6, dieIndex: 0, snapshot: after}]);
  h.frame(150);
  assert.ok(paintedEllipses(h, 'stroke', blue).some(({args: [x, y, rx, ry]}) => x === 195 && y > 470 && y < 515 && rx > 25 && rx < 85 && ry > 45 && ry < 110), 'shield ring surrounds the hero rather than the whole screen');
  const readout = h.calls.find(call => call.type === 'fillText' && call.args[0] === '护盾 +6');
  assert.ok(readout && blue(readout.fillStyle), 'shield growth has its own positive blue readout');
  assert.ok(paintedEllipses(h, 'stroke', warm).length > 0, 'the shield has a fine gold rim');
  await h.complete(); await playing; h.frame();
  const resting = paintedEllipses(h, 'stroke', blue);
  assert.ok(resting.length > 0 && resting.every(call => call.alpha <= .4), 'a remaining shield is visible without an action flash');
  scene.update(before); h.frame(); assert.equal(paintedEllipses(h, 'stroke', blue).length, 0, 'spent shield disappears');
});

// The shield cap can produce a guard event with no increase; presenting +0 implies a gain that did not happen.
test('guard at the shield cap reports a full shield without a false positive increase', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  const full = state(); full.hero.shield = 60; scene.update(full);
  const playing = scene.play([{type: 'guard', source: 'hero', target: 'hero', amount: 0, snapshot: full}]);
  h.frame(150); assert.ok(labels(h).includes('护盾已满')); assert.ok(!labels(h).includes('护盾 +0'));
  await h.complete(); await playing;
});

// Filtering nonpositive damage must not hide a successful full block or mislabel it as healing.
test('fully blocked hurt displays a blue block amount without zero damage or a damage jolt', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  const before = state(); before.hero.shield = 7;
  const after = structuredClone(before); after.hero.shield = 0;
  scene.update(before, {reducedMotion: true}); h.frame(); const heroAtRest = spriteCalls(h).find(call => call.args[1] === 0).args.slice(5);
  const playing = scene.play([{type: 'hurt', source: 'a', target: 'hero', amount: 0, blocked: 7, snapshot: after}]);
  h.frame(150);
  const blocked = h.calls.find(call => call.type === 'fillText' && call.args[0] === '格挡 7');
  assert.ok(blocked && blue(blocked.fillStyle));
  assert.ok(!labels(h).some(label => /[−+]0/.test(label)), 'full block does not display fake zero damage');
  const hero = spriteCalls(h).find(call => call.args[1] === 0);
  assert.ok(Math.abs((hero.args[5] + hero.args[7] / 2) - (heroAtRest[0] + heroAtRest[2] / 2)) < .001, 'full block does not knock the hero sideways');
  assert.equal(h.calls.filter(call => call.type === 'scale').length, 0, 'full block avoids the damage camera pulse');
  await h.complete(); await playing;
});

// Partial absorption must show both shield use and actual HP loss as separate values.
test('partially blocked hurt paints both actual health loss and a separate blue block amount', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready; scene.update(state());
  const playing = scene.play([{type: 'hurt', source: 'a', target: 'hero', amount: 3, blocked: 4, snapshot: state()}]);
  h.frame(150);
  const damage = h.calls.find(call => call.type === 'fillText' && call.args[0] === '−3');
  const blocked = h.calls.find(call => call.type === 'fillText' && call.args[0] === '格挡 4');
  assert.ok(damage && blocked && blue(blocked.fillStyle));
  assert.ok(Math.abs(damage.args[2] - blocked.args[2]) >= 25, 'block and HP loss do not overlap');
  await h.complete(); await playing;
});

// Reduced motion retains local fire/shield/block cues but removes travel, camera movement, and shield breathing.
test('reduced motion keeps new skill feedback local and the resting shield stationary', async t => {
  const h = harness(t), scene = h.create(); h.load(); await scene.ready;
  const shielded = state(); shielded.hero.shield = 8;
  scene.update(shielded, {reducedMotion: true}); h.frame();
  const rings = paintedEllipses(h, 'stroke', blue).map(call => call.args);
  h.frame(1000); assert.deepEqual(paintedEllipses(h, 'stroke', blue).map(call => call.args), rings);
  const seen = [];
  const playing = scene.play([
    {type: 'flame', source: 'hero', target: 'a', amount: 6, snapshot: shielded},
    {type: 'guard', source: 'hero', target: 'hero', amount: 4, snapshot: shielded},
    {type: 'hurt', source: 'a', target: 'hero', amount: 0, blocked: 7, snapshot: shielded},
  ], {reducedMotion: true, onFrame: snapshot => seen.push(snapshot)});
  h.frame(120);
  assert.ok(labels(h).includes('−6'));
  assert.ok(paintedEllipses(h, 'stroke', warm).length > 0, 'fire still marks the target in reduced motion');
  assert.ok(!paintedEllipses(h, 'fill', warm).some(({args: [, y]}) => y > 330 && y < 470), 'no fireball flies between the actors');
  assert.equal(h.calls.filter(call => ['translate', 'scale'].includes(call.type)).length, 0);
  await h.complete(); h.frame(120); assert.ok(labels(h).includes('护盾 +4'));
  await h.complete(); h.frame(120); assert.ok(labels(h).includes('格挡 7'));
  await h.complete(); await playing; assert.equal(seen.length, 3);
});

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
