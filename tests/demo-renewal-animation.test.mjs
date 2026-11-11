import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventureScene} from '../demo/renewal/scene.mjs';

// Canvas/image scheduling are the browser boundary; the actual renderer and
// event/snapshot sequencing run unchanged. Source rectangles expose real poses.
function harness(t, {trim = false, width = 360, height = 800} = {}) {
  const keys = ['Image','document','performance','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'];
  const originals = Object.fromEntries(keys.map(key => [key,globalThis[key]]));
  const frames = new Map(), timers = new Map(), images = [], calls = [], scenes = [];
  let now = 0, id = 0, alpha = 1, stack = [];
  const context = new Proxy({
    get globalAlpha() {return alpha;}, set globalAlpha(value) {alpha = value;},
    save() {stack.push(alpha);}, restore() {alpha = stack.pop() ?? 1;},
    createLinearGradient() {return {addColorStop() {}};}, measureText(text) {return {width:String(text).length * 14};},
  }, {get(object,key) {return key in object ? object[key] : (...args) => {for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value)); calls.push({type:key,args,alpha});};}});
  globalThis.Image = class {constructor() {images.push(this);} set src(url) {this.url = url;} get src() {return this.url;}};
  globalThis.performance = {now:()=>now};
  globalThis.requestAnimationFrame = callback => {frames.set(++id,callback); return id;};
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  globalThis.setTimeout = (callback,delay) => {timers.set(++id,{callback,delay}); return id;};
  globalThis.clearTimeout = key => timers.delete(key);
  globalThis.document = trim ? {createElement() {let sourceY=0; return {getContext() {return {
    clearRect() {}, drawImage(_image,_x,y) {sourceY=y;},
    getImageData(_x,_y,w,h) {const data=new Uint8ClampedArray(w*h*4); const drawnHeight=sourceY >= 975 ? 105 : 165;
      for(let y=Math.max(0,h-25-drawnHeight);y<h-25;y++) for(let x=30;x<w-30;x++) data[(y*w+x)*4+3]=255;
      return {data};},
  };}};}} : undefined;
  t.after(()=>{for(const scene of scenes)scene.destroy(); for(const key of keys)globalThis[key]=originals[key];});
  return {calls,images,timers,frames,
    create(options={}) {const scene=createAdventureScene({getContext:()=>context,getBoundingClientRect:()=>({width,height,top:0})},options); scenes.push(scene);return scene;},
    load({failActions=false,failRain=false,failAll=false}={}) {for(const image of images) {if(failAll || failActions && /characters-actions/.test(image.url) || failRain && /rain-temple/.test(image.url)) image.onerror?.(); else {const action=/characters-actions/.test(image.url), legacy=/characters-polished/.test(image.url);image.naturalWidth=action?1254:legacy?2172:1024; image.naturalHeight=action?1254:legacy?724:1536;image.onload?.();}}},
    frame(ms=0) {now+=ms;calls.length=0;const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(now);},
    async complete() {const [key,timer]=timers.entries().next().value || [];assert.ok(timer);timers.delete(key);now+=timer.delay;timer.callback();await Promise.resolve();},
  };
}
const state = (chapterId=1) => ({version:2,chapterId,runId:'test',stage:0,seed:1,phase:'battle',hero:{hp:20,maxHp:20,shield:0},enemies:[{id:'a',kind:'bandit',hp:12},{id:'b',kind:'archer',hp:12},{id:'c',kind:'boss',hp:30}],targetId:'a'});
const actors = h => h.calls.filter(call=>call.type==='drawImage' && /characters/.test(call.args[0].url));
const hero = h => actors(h).at(-1);
const labels = h => h.calls.filter(call=>call.type==='fillText').map(call=>call.args[0]);

// Returning to a single static row would hide attack/recoil/death distinctions.
test('actual attack hurt and defeated source rows follow the event actor and settle snapshots in order',async t=>{
  const h=harness(t),scene=h.create();h.load();await scene.ready;scene.update(state());h.frame();assert.equal(hero(h).args[2],0);
  const after=state(),seen=[]; after.enemies[0].hp=0;
  const playing=scene.play([
    {type:'attack',source:'hero',target:'a',amount:12,snapshot:after},
    {type:'hurt',source:'b',target:'hero',amount:2,snapshot:after},
    {type:'death',source:'hero',target:'a',snapshot:after},
  ],{onFrame:snapshot=>seen.push(snapshot)});
  h.frame(180);assert.equal(hero(h).args[2],415,'hero paints attack drawing');assert.equal(actors(h)[0].args[2],690,'struck enemy paints recoil drawing');assert.equal(seen.length,0);
  await h.complete();h.frame(160);assert.equal(hero(h).args[2],690,'hero paints hurt drawing');assert.equal(actors(h)[1].args[2],415,'enemy paints attack drawing');
  await h.complete();h.frame(80);assert.equal(actors(h)[0].args[2],975,'death paints collapsed drawing before hiding it');
  await h.complete();await playing;assert.equal(seen.length,3);h.frame();assert.equal(actors(h).length,3);
});

// A new chapter can reuse actor IDs and stage without resurrecting/hiding stale foes.
test('chapter two uses rain temple and replaying the same encounter clears completed deaths',async t=>{
  const h=harness(t),scene=h.create();h.load();await scene.ready;scene.update(state(1));h.frame();assert.ok(h.calls.some(call=>call.type==='drawImage' && /forest-path/.test(call.args[0].url)));
  const killed=state(1);killed.enemies[0].hp=0;const dying=scene.play([{type:'death',target:'a',snapshot:killed}]);await h.complete();await dying;h.frame();assert.equal(actors(h).length,3);
  scene.update(state(2));h.frame();assert.equal(actors(h).length,4);assert.ok(h.calls.some(call=>call.type==='drawImage' && /rain-temple/.test(call.args[0].url)));
});
test('switching chapters during playback cancels the old snapshot even when stage and actor IDs match',async t=>{
  const h=harness(t),scene=h.create();h.load();await scene.ready;scene.update(state(1));const seen=[];
  const playing=scene.play([{type:'attack',source:'hero',target:'a',amount:2,snapshot:state(1)}],{onFrame:s=>seen.push(s)});
  scene.update(state(2));await playing;assert.equal(h.timers.size,0);h.frame(400);assert.deepEqual(seen,[]);assert.ok(h.calls.some(call=>call.type==='drawImage' && /rain-temple/.test(call.args[0].url)));
});

// Motion reduction retains static visual states, foot registration and proper proportions.
test('action poses keep feet anchored and all three enemy lanes proportional in reduced motion',async t=>{
  const h=harness(t,{trim:true}),scene=h.create();h.load();await scene.ready;scene.update(state(),{reducedMotion:true});h.frame();const resting=hero(h),bottom=resting.args[6]+resting.args[8];
  const playing=scene.play([{type:'death',target:'hero',snapshot:state()}],{reducedMotion:true});h.frame(80);const down=hero(h);assert.ok(down.args[8]<resting.args[8],'kneeling drawing keeps its shorter natural height');assert.ok(Math.abs(down.args[6]+down.args[8]-bottom)<.001,'feet retain the idle baseline');assert.equal(down.alpha,1,'reduced-motion defeated drawing is readable throughout the event');
  const transform=h.calls.find(call=>call.type==='setTransform').args;for(const call of actors(h)) {assert.ok(Math.abs(call.args[7]*transform[0]/(call.args[8]*transform[3])-call.args[3]/call.args[4])<1e-6);}
  for(const call of actors(h).slice(0,3))assert.ok(call.args[7]*transform[0]<=82.81,'complete pose fits its target lane');
  assert.equal(h.calls.filter(call=>call.type==='scale' || call.type==='translate').length,0);
  await h.complete();await playing;
});

// Treating charge as a sword hit would falsely imply damage before attack.
test('charge uses local accumulation text while boss intent and phase stay bounded and readable',async t=>{
  const h=harness(t),scene=h.create();h.load();await scene.ready;scene.update(state());
  const playing=scene.play([{type:'charge',source:'hero',target:'hero',amount:3,layers:7,text:'剑气 +3 · 共7层',snapshot:state()},{type:'intent',target:'c',text:'蓄力重击',snapshot:state()},{type:'phase',target:'c',text:'第二阶段',snapshot:state()}],{reducedMotion:true});
  h.frame(120);assert.ok(labels(h).includes('剑气 +3 · 共7层'));assert.ok(!labels(h).some(label=>/^−/.test(label)));assert.equal(hero(h).args[2],0);assert.equal(h.calls.filter(call=>call.type==='scale' || call.type==='translate').length,0);assert.equal(h.calls.filter(call=>call.type==='lineTo').length,0,'charge never launches a sword or paints impact rays');assert.ok([...h.timers.values()].every(timer=>timer.delay>0&&timer.delay<=340));
  await h.complete();h.frame(120);assert.ok(labels(h).includes('蓄力重击'));await h.complete();h.frame(120);assert.ok(labels(h).includes('第二阶段'));await h.complete();await playing;
});

// Unavailable action textures must preserve the existing sprite and readiness contract.
test('failed actions fall back to polished sprites and failed chapter background falls back to forest',async t=>{
  const h=harness(t),scene=h.create();h.load({failActions:true,failRain:true});await scene.ready;scene.update(state(2));h.frame();assert.ok(actors(h).every(call=>/characters-polished/.test(call.args[0].url)));assert.ok(h.calls.some(call=>call.type==='drawImage'&&/forest-path/.test(call.args[0].url)));
  const playing=scene.play([{type:'attack',source:'hero',target:'a',amount:1,snapshot:state(2)}]);await h.complete();await playing;
});
test('destroy cancels all new image listeners and a pending presentation without callbacks',async t=>{
  const h=harness(t),scene=h.create();const seen=[];const playing=scene.play([{type:'intent',target:'c',text:'蓄力',snapshot:state()}],{onFrame:s=>seen.push(s)});scene.destroy();await scene.ready;await playing;
  assert.deepEqual(seen,[]);assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);for(const image of h.images){assert.equal(image.onload,null);assert.equal(image.onerror,null);}
});
