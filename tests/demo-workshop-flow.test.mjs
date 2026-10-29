import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,applyProfileAction} from '../demo/profile.mjs';
import {CONTENT} from '../demo/content.mjs';
import {createController} from '../demo/main.mjs';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('controller owns persistent profile and rejects invalid content without replacing it',async()=>{
 const storage=memory(),c=createController({storage,seed:()=>2,now:()=>100000});
 assert.ok(c.profile);assert.ok(storage.getItem('qipai-bamboo-profile-v1'),'first open persists offline start time');const before=structuredClone(c.profile);
 await c.act({type:'profile',value:{type:'content-import',value:'{bad'}});
 assert.deepEqual(c.profile,before);
 await c.act({type:'profile',value:{type:'buy',id:'potion'}});
 assert.equal(c.profile.bag.potion,before.bag.potion+1);assert.ok(c.profile.resources.gold<before.resources.gold);
 c.destroy();const restored=createController({storage,now:()=>100000});assert.equal(restored.profile.bag.potion,before.bag.potion+1);restored.destroy();
});
test('new expedition snapshots edited loadout, auto-rolls, and home/resume preserves decision',async()=>{
 const storage=memory(),c=createController({storage,seed:()=>2,now:()=>100000});
 await c.act({type:'profile',value:{type:'face',die:0,face:1,value:6}});
 await c.act({type:'expedition',value:{build:'guard',mode:'boss',chapter:'bamboo'}});
 assert.equal(c.state.flow,'battle');assert.equal(c.state.combat.phase,'pick');assert.equal(c.state.mode,'boss');assert.ok(c.state.runId);
 assert.equal(c.state.loadout.dice[0].faces[1],6);const boundary=structuredClone(c.state);
 await c.act({type:'profile',value:{type:'face',die:0,face:1,value:1}});assert.deepEqual(c.state,boundary);
 await c.act({type:'home'});assert.equal(c.state.flow,'intro');await c.act({type:'resume'});assert.deepEqual(c.state,boundary);c.destroy();
});
test('creator export/import is JSON data and invalid import preserves the current profile',async()=>{
 let opts;const c=createController({storage:memory(),render:(_run,o)=>opts=o});
 await c.act({type:'profile-export'});assert.equal(opts.hubTab,'editor');assert.equal(JSON.parse(opts.editorText).version,c.profile.version);
 const before=structuredClone(c.profile);await c.act({type:'profile-import',value:'[]'});assert.deepEqual(c.profile,before);
 await c.act({type:'content-export'});assert.ok(JSON.parse(opts.editorText).equipment.length>=40);c.destroy();
});

test('resource timeout settles while its target is alive and resume cannot pay twice',async()=>{
 const storage=memory(),content=structuredClone(CONTENT);content.modes.find(m=>m.id==='resource').turnLimit=1;
 let profile=createProfile(3,100000);profile=applyProfileAction(profile,{type:'content-import',value:JSON.stringify(content)}).profile;
 const c=createController({storage,initialProfile:profile,seed:()=>3,now:()=>100000});
 await c.act({type:'expedition',value:{build:'sword',mode:'resource',chapter:'bamboo'}});
 const gold=c.profile.resources.gold;
 await c.act({type:'use-item',value:'tonic'});await c.act({type:'attack'});
 assert.equal(c.state.flow,'victory');assert.ok(c.state.combat.enemies.some(e=>e.hp>0));
 assert.equal(c.profile.stats.runs,1);assert.equal(c.profile.bag.tonic,profile.bag.tonic-1);assert.ok(c.profile.resources.gold>gold);
 const settled=structuredClone(c.profile);await c.act({type:'home'});await c.act({type:'resume'});assert.deepEqual(c.profile,settled);
 c.destroy();const restored=createController({storage,now:()=>100000});await restored.act({type:'resume'});assert.deepEqual(restored.profile,settled);restored.destroy();
});
