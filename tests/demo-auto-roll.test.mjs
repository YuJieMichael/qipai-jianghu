import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../demo/main.mjs';
import {createRun} from '../demo/model.mjs';
import {enterNode} from '../demo/journey.mjs';
import {SAVE_KEY} from '../demo/storage.mjs';

function memory(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
function waitingBattle(){return enterNode(createRun('guard',2));}
function decision(){
 const run=waitingBattle();run.combat.phase='pick';run.combat.dice=[1,2,3,4,6];run.combat.held=[true,false,true,false,true];run.combat.rerolls=1;
 run.combat.enemies[0].hp=100;run.combat.enemies[0].maxHp=100;return run;
}
const savedRun=storage=>JSON.parse(storage.getItem(SAVE_KEY));
function assertOpening(run){
 assert.equal(run.flow,'battle');assert.equal(run.combat.phase,'pick');assert.deepEqual(run.combat.dice,[2,3,2,5,5]);
 assert.equal(run.seed,3079534013);assert.deepEqual(run.combat.held,[true,true,true,true,true]);assert.equal(run.combat.rerolls,2);assert.equal(run.stats.turns,0);
}

test('constructing a battle rolls once before its first view and saves the decision',()=>{
 const initial=waitingBattle(),storage=memory(),views=[];
 const controller=createController({initial,storage,render:run=>views.push(structuredClone(run))});
 assertOpening(controller.state);assert.equal(views.length,1);assert.deepEqual(views[0],controller.state);assert.deepEqual(savedRun(storage),controller.state);
 assert.equal(initial.combat.phase,'roll');assert.deepEqual(initial.combat.dice,[0,0,0,0,0]);assert.equal(initial.seed,2);controller.destroy();
});

test('start and retry expose rolled decisions while attacks remain manual',async()=>{
 const storage=memory();let plays=0;
 const controller=createController({storage,seed:()=>2,play:async()=>plays++});
 await controller.act({type:'start',value:'poison'});assertOpening(controller.state);assert.equal(controller.state.build,'poison');
 await controller.act({type:'hold',value:0});await controller.act({type:'reroll'});
 await controller.act({type:'retry'});assertOpening(controller.state);assert.equal(controller.state.build,'poison');
 assert.equal(plays,0);assert.deepEqual(savedRun(storage),controller.state);controller.destroy();
});

for(const version of [1,2])test(`resuming version ${version} waiting dice rolls once and checkpoints the result`,async()=>{
 const storage=memory(),waiting=waitingBattle();waiting.version=version;
 if(version===1){delete waiting.perks;delete waiting.pendingUpgrade;delete waiting.stats.upgradeHistory;}
 storage.setItem(SAVE_KEY,JSON.stringify(waiting));
 const controller=createController({storage});await controller.act({type:'resume'});assertOpening(controller.state);
 const boundary=structuredClone(controller.state);assert.equal(boundary.version,3);assert.deepEqual(savedRun(storage),boundary);
 await controller.act({type:'resume'});assert.deepEqual(controller.state,boundary);controller.destroy();
});

test('resuming a selected decision and a legacy roll action preserve its exact dice and seed',async()=>{
 const storage=memory(),boundary=decision();storage.setItem(SAVE_KEY,JSON.stringify(boundary));
 const controller=createController({storage});await controller.act({type:'resume'});assert.deepEqual(controller.state,boundary);
 const selected=controller.state;await controller.act({type:'roll'});assert.equal(controller.state,selected);assert.deepEqual(savedRun(storage),boundary);
 controller.destroy();
});

test('the next round rolls only after its final playback event and saves the new decision',async()=>{
 let releaseFinal,reachFinal;const finalPlayback=new Promise(resolve=>releaseFinal=resolve),atFinal=new Promise(resolve=>reachFinal=resolve);
 const storage=memory(),views=[];let plays=0;
 const controller=createController({initial:decision(),storage,render:run=>views.push(structuredClone(run)),play:async(_event,context)=>{
  plays++;if(context.eventIndex===context.events.length-1){reachFinal();await finalPlayback;}
 }});
 const boundary=structuredClone(controller.state),playing=controller.act({type:'attack'});await atFinal;
 assert.equal(controller.busy,true);assert.deepEqual(controller.state,boundary);assert.deepEqual(savedRun(storage),boundary);
 assert.ok(views.every(run=>run.combat.round===1&&run.seed===2&&JSON.stringify(run.combat.dice)==='[1,2,3,4,6]'));
 for(const action of [{type:'roll'},{type:'reroll'},{type:'hold',value:0},{type:'attack'}])await controller.act(action);
 assert.deepEqual(controller.state,boundary);releaseFinal();await playing;
 assert.equal(controller.busy,false);assert.equal(controller.state.flow,'battle');assert.equal(controller.state.combat.phase,'pick');assert.equal(controller.state.combat.round,2);
 assert.deepEqual(controller.state.combat.dice,[2,3,2,5,5]);assert.equal(controller.state.seed,3079534013);assert.equal(controller.state.combat.rerolls,2);assert.deepEqual(controller.state.combat.held,[true,true,true,true,true]);
 assert.equal(controller.state.stats.turns,1);assert.equal(views.filter(run=>run.combat.round===2).length,1);assert.deepEqual(savedRun(storage),controller.state);
 const playCount=plays,nextDecision=structuredClone(controller.state);await new Promise(resolve=>setImmediate(resolve));assert.equal(plays,playCount);assert.deepEqual(controller.state,nextDecision);controller.destroy();
});

for(const cancel of ['exit','destroy'])test(`${cancel} during a surviving round never exposes or saves future dice`,async()=>{
 let release;const waiting=new Promise(resolve=>release=resolve),storage=memory(),views=[];
 const controller=createController({initial:decision(),storage,render:run=>views.push(structuredClone(run)),play:()=>waiting});
 const boundary=structuredClone(controller.state),playing=controller.act({type:'attack'});
 if(cancel==='exit')await controller.act({type:'exit'});else controller.destroy();
 const viewCount=views.length;release();await playing;
 assert.equal(views.length,viewCount);assert.deepEqual(controller.state,boundary);assert.deepEqual(savedRun(storage),boundary);controller.destroy();
});

test('interrupted playback from an automatic opening keeps the rolled preattack decision',async t=>{
 const storage=memory();let notice='';const failure=Error('playback interrupted');
 t.mock.method(console,'error',()=>{});
 const controller=createController({initial:waitingBattle(),storage,render:(_run,options)=>notice=options.message,play:async()=>{throw failure;}});
 const boundary=structuredClone(controller.state);await controller.act({type:'attack'});
 assert.equal(controller.state.combat.phase,'pick');assert.equal(controller.busy,false);assert.deepEqual(controller.state,boundary);assert.deepEqual(savedRun(storage),boundary);assert.ok(notice.includes('播放中断'));controller.destroy();
});
