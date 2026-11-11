import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventureController} from '../demo/renewal/controller.mjs';
import {newAdventure,act,SAVE_KEY} from '../demo/renewal/model.mjs';
import {CAMPAIGN_KEY,newCampaign,beginCampaignRun} from '../demo/renewal/campaign.mjs';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const scene=()=>({ready:Promise.resolve(),update(){},async play(events,{onFrame}){for(const e of events)onFrame(e.snapshot);},destroy(){}});
async function controller(storage,initial){const c=createAdventureController({storage,initial,scene:scene(),seed:()=>1});await c.ready;return c;}
function victory(stage=0,chapterId=1){let s=act(newAdventure(1,{chapterId,runId:'run-1'}),{type:'begin'}).state;
 for(let i=0;i<=stage;i++){
  s.hero.attack=10000;while(s.phase==='battle')s=act(s,{type:'attack'}).state;
  if(i<stage)s=act(s,{type:'choose',choiceId:`s${i}-vitality`}).state;
 }return s;
}
test('crash between combat save and drop save recovers one deterministic receipt without replay',async()=>{
 const storage=memory(),started=beginCampaignRun(newCampaign(42),1),saved=victory();
 storage.setItem(CAMPAIGN_KEY,JSON.stringify(started.campaign));storage.setItem(SAVE_KEY,JSON.stringify(saved));
 const c=await controller(storage);assert.equal(c.campaign.inventory.length,5);assert.equal(c.campaign.receipts.length,1);
 assert.equal(c.state.hero.hp,saved.hero.hp);assert.equal(c.state.phase,'reward');const profile=JSON.stringify(c.campaign);c.destroy();
 const restored=await controller(storage);assert.equal(JSON.stringify(restored.campaign),profile);assert.deepEqual(restored.state,saved);restored.destroy();
});
test('inventory is a modal decision, equipment waits for next battle and swap does not heal',async()=>{
 const storage=memory(),started=beginCampaignRun(newCampaign(42),1),saved=victory();saved.hero.hp=72;
 storage.setItem(CAMPAIGN_KEY,JSON.stringify(started.campaign));
 const c=await controller(storage,saved),before=structuredClone(c.state);
 await c.act({type:'inventory'});await c.act({type:'attack'});assert.deepEqual(c.state,before);
 await c.act({type:'gear-equip',uid:'starter-staff'});assert.deepEqual(c.state.loadout,before.loadout);assert.equal(c.state.hero.hp,72);
 await c.act({type:'campaign-close'});await c.act({type:'choose',choiceId:'s0-face',index:0});
 assert.equal(c.state.loadout.weapon,'staff');assert.equal(c.state.hero.hp,72);assert.equal(c.state.stage,1);c.destroy();
});
test('chapter2 stays locked until boss victory then starts and persists a distinct run',async()=>{
 const storage=memory(),started=beginCampaignRun(newCampaign(42),1);
 storage.setItem(CAMPAIGN_KEY,JSON.stringify(started.campaign));
 const locked=await controller(storage);const before=structuredClone(locked.state);
 await locked.act({type:'chapters'});await locked.act({type:'chapter-start',chapterId:2});assert.deepEqual(locked.state,before);locked.destroy();
 storage.setItem(CAMPAIGN_KEY,JSON.stringify(started.campaign));storage.setItem(SAVE_KEY,JSON.stringify(victory(5)));
 const c=await controller(storage);assert.equal(c.campaign.unlockedChapter,2);
 await c.act({type:'chapters'});await c.act({type:'chapter-start',chapterId:2});assert.equal(c.state.chapterId,2);assert.equal(c.state.stage,0);
 assert.equal(c.state.runId,'run-2');assert.equal(c.state.charges,0);assert.equal(c.state.enemies[0].hp,c.state.enemies[0].maxHp);
 const next=structuredClone(c.state);c.destroy();const restored=await controller(storage);assert.deepEqual(restored.state,next);restored.destroy();
});

test('legacy migration crash after identity checkpoint catches up every proven victory exactly once',async()=>{
 const storage=memory(),started=beginCampaignRun(newCampaign(42),1),saved=victory(2);
 storage.setItem(CAMPAIGN_KEY,JSON.stringify(started.campaign));storage.setItem(SAVE_KEY,JSON.stringify(saved));
 const c=await controller(storage);assert.equal(c.campaign.receipts.length,3);assert.equal(c.campaign.inventory.length,7);c.destroy();
 const restored=await controller(storage);assert.equal(restored.campaign.receipts.length,3);assert.equal(restored.campaign.inventory.length,7);restored.destroy();
});
test('missing profile can recover from valid adventure proof without freezing future rewards',async()=>{
 const storage=memory(),saved=victory(5);storage.setItem(SAVE_KEY,JSON.stringify(saved));
 const c=await controller(storage);assert.equal(c.campaign.receipts.length,6);assert.equal(c.campaign.unlockedChapter,2);
 assert.equal(c.state.hero.hp,saved.hero.hp);assert.equal(c.state.phase,'won');c.destroy();
 const restored=await controller(storage);assert.equal(restored.campaign.inventory.length,10);restored.destroy();
});

test('failed profile save then next-battle reload or loss still recovers earlier victories',async()=>{
 for(const phase of ['battle','lost']){
  const base=memory(),started=beginCampaignRun(newCampaign(42),1);base.setItem(CAMPAIGN_KEY,JSON.stringify(started.campaign));
  let rejectProfile=true;const storage={getItem:base.getItem,setItem(k,v){if(k===CAMPAIGN_KEY&&rejectProfile)throw Error('full');base.setItem(k,v);}};
  const c=await controller(storage,victory());assert.equal(c.campaign.receipts.length,1);
  await c.act({type:'choose',choiceId:'s0-face',index:0});let saved=structuredClone(c.state);c.destroy();
  if(phase==='lost'){saved.phase='lost';saved.hero.hp=0;base.setItem(SAVE_KEY,JSON.stringify(saved));}
  rejectProfile=false;const recovered=await controller(storage);assert.equal(recovered.state.phase,phase);assert.equal(recovered.state.stage,1);
  assert.equal(recovered.campaign.receipts.length,1);assert.equal(recovered.campaign.inventory.length,5);recovered.destroy();
 }
});

test('new-run journal repairs a campaign ahead of an adventure after interrupted restart',async()=>{
 const base=memory();const c=await controller(base);const old=structuredClone(c.state);c.destroy();
 let failAdventure=false;const storage={getItem:base.getItem,setItem(k,v){if(k===SAVE_KEY&&failAdventure)throw Error('full');base.setItem(k,v);}};
 const r=await controller(storage);failAdventure=true;await r.act({type:'restart'});assert.equal(r.state.runId,'run-2');r.destroy();
 assert.equal(JSON.parse(base.getItem(SAVE_KEY)).runId,old.runId);
 failAdventure=false;const recovered=await controller(storage);assert.equal(recovered.state.runId,'run-2');
 assert.equal(recovered.campaign.activeRun.runId,'run-2');assert.equal(recovered.state.stage,0);assert.equal(recovered.campaign.receipts.length,0);recovered.destroy();
 const again=await controller(storage);assert.equal(again.state.runId,'run-2');assert.equal(again.campaign.runSerial,2);again.destroy();
});
test('new-run journal repairs an adventure ahead of campaign without rolling back later combat',async()=>{
 const base=memory();const first=await controller(base);first.destroy();let failProfile=true;
 const storage={getItem:base.getItem,setItem(k,v){if(k===CAMPAIGN_KEY&&failProfile)throw Error('full');base.setItem(k,v);}};
 const c=await controller(storage);await c.act({type:'restart'});await c.act({type:'reroll',index:0});const saved=structuredClone(c.state);c.destroy();
 assert.equal(JSON.parse(base.getItem(CAMPAIGN_KEY)).runSerial,1);
 failProfile=false;const recovered=await controller(storage);assert.deepEqual(recovered.state,saved);assert.equal(recovered.campaign.activeRun.runId,saved.runId);recovered.destroy();
});
