import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../demo/main.mjs';
import {createRun} from '../demo/model.mjs';
import {enterNode} from '../demo/journey.mjs';

function memory(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
function playable(){const r=enterNode(createRun('sword',19));r.combat.phase='pick';r.combat.dice=[6,6,6,6,6];r.combat.enemies[0].hp=1;return r;}
test('serialized actions accept only one attack while playback is pending',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);let plays=0;
 const c=createController({initial:playable(),storage:memory(),play:async()=>{plays++;await wait;}});
 const first=c.act({type:'attack'});const second=c.act({type:'attack'});
 assert.equal(c.busy,true);await second;release();await first;
 assert.equal(c.state.stats.kills,1);assert.ok(plays>0);assert.equal(c.busy,false);
 assert.equal(c.state.flow,'reward');c.destroy();
});
test('animation exit cancels remaining updates and saves preattack boundary',async()=>{
 let release;let renders=0;const wait=new Promise(resolve=>release=resolve);const storage=memory();
 const initial=playable();const c=createController({initial,storage,play:()=>wait,render:()=>renders++});
 const playing=c.act({type:'attack'});c.destroy();const atExit=renders;release();await playing;
 assert.equal(renders,atExit);assert.equal(c.state.stats.kills,0);
 const saved=JSON.parse(storage.getItem('qipai-bamboo-demo-v1'));
 assert.deepEqual(saved.combat.dice,initial.combat.dice);assert.equal(saved.seed,initial.seed);
});
test('restore keeps held dice, generated choices and enemy intent',async()=>{
 const storage=memory();const first=createController({initial:playable(),storage});
 await first.act({type:'hold',value:2});const boundary=structuredClone(first.state);first.destroy();
 const resumed=createController({storage});await resumed.act({type:'resume'});
 assert.deepEqual(resumed.state.combat,boundary.combat);assert.equal(resumed.state.seed,boundary.seed);resumed.destroy();
});
test('a failed storage write leaves the game playable with visible notice',async()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('quota');}};let message='';
 const c=createController({storage,render:(_r,opts)=>message=opts.message});
 await c.act({type:'start',value:'guard'});
 assert.equal(c.state.flow,'battle');assert.ok(message.length>0);c.destroy();
});
test('closing the title screen preserves the previous playable checkpoint',()=>{
 const storage=memory();const existing=playable();storage.setItem('qipai-bamboo-demo-v1',JSON.stringify(existing));
 const c=createController({storage});c.destroy();
 assert.deepEqual(JSON.parse(storage.getItem('qipai-bamboo-demo-v1')),existing);
});
