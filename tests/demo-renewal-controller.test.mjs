import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventureController} from '../demo/renewal/controller.mjs';
import {SAVE_KEY} from '../demo/renewal/model.mjs';

function memory(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function presentation(){return {ready:Promise.resolve(),update(){},async play(events,{onFrame}){for(const event of events)onFrame(event.snapshot);},destroy(){}};}

test('fresh entry automatically rolls once, records immediate sword damage and restores without rolling again',async()=>{
 const storage=memory(),scene=presentation(),views=[];
 const c=createAdventureController({storage,scene,seed:()=>1,render:(state,opts)=>views.push({state:structuredClone(state),busy:opts.busy})});
 await c.ready;
 assert.equal(c.state.dice[0].value,2);assert.equal(c.state.enemies[0].hp,26);assert.equal(c.busy,false);
 const saved=storage.getItem(SAVE_KEY);assert.deepEqual(JSON.parse(saved),c.state);c.destroy();
 const restored=createAdventureController({storage,scene:presentation()});await restored.ready;
 assert.equal(storage.getItem(SAVE_KEY),saved);assert.equal(restored.state.enemies[0].hp,26);assert.equal(restored.state.seed,1015568748);
 assert.ok(views.some(view=>view.busy));restored.destroy();
});

test('pending playback locks duplicate attacks and only saves complete model decisions',async()=>{
 const storage=memory(),scene=presentation(),c=createAdventureController({storage,scene,seed:()=>1});await c.ready;
 let release,reached;const gate=new Promise(resolve=>release=resolve),arrived=new Promise(resolve=>reached=resolve);
 scene.play=async(events,{onFrame})=>{onFrame(events[0].snapshot);reached();await gate;onFrame(events.at(-1).snapshot);};
 const playing=c.act({type:'attack'});await arrived;assert.equal(c.busy,true);
 const final=structuredClone(c.state),saved=storage.getItem(SAVE_KEY);
 await c.act({type:'attack'});await c.act({type:'reroll',index:0});await c.act({type:'restart'});
 assert.deepEqual(c.state,final);assert.equal(storage.getItem(SAVE_KEY),saved);
 release();await playing;assert.equal(c.busy,false);assert.deepEqual(JSON.parse(saved),c.state);assert.equal(c.state.round,2);c.destroy();
});

test('pause prevents model actions and retains the exact pending dice on resume',async()=>{
 const c=createAdventureController({storage:memory(),scene:presentation(),seed:()=>1});await c.ready;
 const before=structuredClone(c.state);await c.act({type:'pause'});assert.equal(c.paused,true);
 await c.act({type:'attack'});assert.deepEqual(c.state,before);await c.act({type:'resume'});assert.equal(c.paused,false);
 await c.act({type:'reroll',index:0});assert.equal(c.state.rerolls,2);c.destroy();
});

test('corrupt save and unavailable browser storage still produce a playable first decision',async()=>{
 const storage=memory();storage.setItem(SAVE_KEY,'{"version":1,"hero":null}');let notice='';
 const c=createAdventureController({storage,scene:presentation(),seed:()=>1,render:(_state,opts)=>notice=opts.message});await c.ready;
 assert.equal(c.state.hero.hp,120);assert.equal(c.state.enemies[0].hp,26);assert.ok(notice.includes('存档'));c.destroy();
 const unavailable={getItem(){throw Error('disabled');},setItem(){throw Error('full');}};
 const other=createAdventureController({storage:unavailable,scene:presentation(),seed:()=>1});await other.ready;
 await other.act({type:'reroll',index:0});assert.equal(other.state.enemies[0].hp,22);other.destroy();
});

test('destroy during playback ignores late snapshots and releases its scene',async()=>{
 const scene=presentation(),views=[];let destroyed=0;scene.destroy=()=>destroyed++;
 const c=createAdventureController({storage:memory(),scene,seed:()=>1,render:state=>views.push(state)});await c.ready;
 let release,enter;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>enter=resolve);
 scene.play=async(events,{onFrame})=>{enter();await gate;onFrame(events.at(-1).snapshot);};
 const playing=c.act({type:'attack'});await started;c.destroy();const count=views.length;release();await playing;
 assert.equal(views.length,count);assert.equal(destroyed,1);await c.act({type:'restart'});assert.equal(views.length,count);
});

test('presentation failure exposes the already saved correct result and permits the next action',async()=>{
 const storage=memory(),scene=presentation();let message='';
 const c=createAdventureController({storage,scene,seed:()=>1,render:(_state,opts)=>message=opts.message});await c.ready;
 scene.play=async()=>{throw Error('canvas unavailable');};await c.act({type:'reroll',index:0});
 assert.equal(c.state.enemies[0].hp,22);assert.equal(c.busy,false);assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEY)),c.state);assert.ok(message);
 scene.play=presentation().play;await c.act({type:'reroll',index:0});assert.equal(c.state.enemies[0].hp,18);c.destroy();
});

test('a stalled texture request cannot keep the playable fallback and settings locked indefinitely',async()=>{
 const scene=presentation();scene.ready=new Promise(()=>{});
 const c=createAdventureController({storage:memory(),scene,seed:()=>1});
 await Promise.race([c.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('texture readiness never released input')),5500))]);
 assert.equal(c.busy,false);assert.equal(c.state.enemies[0].hp,26);
 await c.act({type:'pause'});assert.equal(c.paused,true);await c.act({type:'resume'});
 await c.act({type:'reroll',index:0});assert.equal(c.state.enemies[0].hp,22);c.destroy();
});
