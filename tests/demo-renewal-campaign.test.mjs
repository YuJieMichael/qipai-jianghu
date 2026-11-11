import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT} from '../demo/content.mjs';
const api = await import('../demo/renewal/campaign.mjs').catch(() => null);
const fresh = (seed=17) => {
  assert.ok(api?.newCampaign, 'the independent campaign API is available');
  return api.newCampaign(seed);
};
const copy = value => JSON.parse(JSON.stringify(value));
function start(profile, chapterId=1) {return api.beginCampaignRun(profile,chapterId);}

test('a new campaign has bounded independent original equipment and a useful six-slot loadout', () => {
  const p=fresh(); assert.ok(api.validateCampaign(p));
  assert.match(api.CAMPAIGN_KEY,/campaign/); assert.notEqual(api.CAMPAIGN_KEY,'qipai-jianghu-profile');
  assert.equal(p.inventory.length,4); assert.equal(new Set(p.inventory.map(i=>i.uid)).size,4);
  assert.ok(p.inventory.every(i=>CONTENT.equipment.some(e=>e.id===i.equipmentId && e.rarity==='common')));
  assert.deepEqual(Object.keys(p.equipped).sort(),['amulet','armor','boots','ring','scarf','weapon']);
  assert.deepEqual(api.getCampaignLoadout(p),{attack:2,maxHp:12,armor:1,sword:0,flame:0,guard:0,weapon:'sword'});
  assert.deepEqual(fresh(17),p,'a seed gives a reproducible initial profile');
  assert.equal(api.validateCampaign(fresh(NaN)),true,'bad creation seeds normalize safely');
});

test('a won stage awards exactly one catalog item and repeated or losing receipts are no-ops after reload', () => {
  const initial=fresh(), {campaign:p,runId}=start(initial); const before=copy(p);
  const lose=api.awardBattle(p,{runId,chapterId:1,stage:0,won:false});
  assert.equal(lose.campaign,p);assert.equal(lose.loot,null);
  const reward=api.awardBattle(p,{runId,chapterId:1,stage:0,won:true});
  assert.equal(reward.campaign.inventory.length,5);assert.ok(reward.loot);
  assert.ok(CONTENT.equipment.some(e=>e.id===reward.loot.equipmentId));assert.deepEqual(p,before);
  const restored=copy(reward.campaign);assert.ok(api.validateCampaign(restored));
  const replay=api.awardBattle(restored,{runId,chapterId:1,stage:0,won:true});
  assert.equal(replay.campaign,restored);assert.equal(replay.loot,null);
  const recovered=api.awardBattle(copy(p),{runId,chapterId:1,stage:0,won:true});
  assert.deepEqual(recovered.loot,reward.loot,'an adventure saved before profile reward is recovered deterministically');
});

test('only chapter-one final victory permanently unlocks chapter two and both chapters can be replayed', () => {
  const initial=fresh(),locked=start(initial,2);assert.equal(locked.campaign,initial);assert.equal(locked.runId,null);
  let {campaign:p,runId}=start(initial);
  for(let stage=0;stage<5;stage++)p=api.awardBattle(p,{runId,chapterId:1,stage,won:true}).campaign;
  assert.equal(p.unlockedChapter,1);
  p=api.awardBattle(p,{runId,chapterId:1,stage:5,won:true}).campaign;assert.equal(p.unlockedChapter,2);
  const second=start(copy(p),2);assert.ok(second.runId);assert.notEqual(second.runId,runId);
  assert.equal(second.campaign.unlockedChapter,2);assert.equal(start(second.campaign,1).campaign.unlockedChapter,2);
});

test('pruning old-run receipts never lets a previous adventure claim them again', () => {
  let {campaign:p,runId:old}=start(fresh());
  p=api.awardBattle(p,{runId:old,chapterId:1,stage:0,won:true}).campaign;
  for(let i=0;i<100;i++) {
    const next=start(p);p=next.campaign;
    for(let stage=0;stage<6;stage++)p=api.awardBattle(p,{runId:next.runId,chapterId:1,stage,won:true}).campaign;
    assert.ok(p.receipts.length<=6);assert.ok(p.inventory.length<=120);assert.ok(api.validateCampaign(p));
  }
  const replay=api.awardBattle(copy(p),{runId:old,chapterId:1,stage:0,won:true});
  assert.equal(replay.loot,null);assert.deepEqual(replay.campaign,p);
  assert.ok(p.dust>0,'capacity converts the newly dropped item to materials without discarding owned gear');
});

test('equipment actions compare by catalog, support six slots, protect worn items and never hold hero health', () => {
  const p=fresh(),before=copy(p);const staff=p.inventory.find(i=>i.equipmentId==='weapon-staff-1');
  const equipped=api.campaignAction(p,{type:'equip',uid:staff.uid});
  assert.notEqual(equipped.campaign,p);assert.equal(api.getCampaignLoadout(equipped.campaign).weapon,'staff');
  assert.deepEqual(p,before);assert.equal('hp' in equipped.campaign,false);
  const protectedItem=api.campaignAction(equipped.campaign,{type:'salvage',uid:staff.uid});assert.equal(protectedItem.campaign,equipped.campaign);
  const removed=api.campaignAction(equipped.campaign,{type:'unequip',slot:'weapon'}).campaign;
  assert.equal(api.getCampaignLoadout(removed).attack,0);assert.equal(api.getCampaignLoadout(removed).weapon,'sword');
  const salvaged=api.campaignAction(removed,{type:'salvage',uid:staff.uid}).campaign;
  assert.equal(salvaged.inventory.length,3);assert.equal(salvaged.dust,8);assert.ok(api.validateCampaign(salvaged));
  assert.equal(api.campaignAction(salvaged,{type:'salvage',uid:staff.uid}).campaign,salvaged);
  assert.equal(api.campaignAction(p,{type:'equip',uid:p.equipped.weapon}).campaign,p);
});

test('strict profile validation rejects hostile ids, oversized data, forged receipts and impossible equipment', () => {
  const p=fresh();
  const invalid=[null,[],{},'{}', {...p,seed:Infinity}, {...p,dust:-1}, {...p,dust:1e30}, {...p,extra:'no'}, {...p,inventory:Array(121).fill(p.inventory[0])}, {...p,inventory:[...p.inventory,p.inventory[0]]}, {...p,inventory:[{uid:'<script>',equipmentId:'weapon-sword-1'}]}, {...p,equipped:{...p.equipped,ring:p.equipped.weapon}}, {...p,receipts:['run-1:1:0']}, {...p,activeRun:{runId:'run-2',chapterId:2}}];
  for(const value of invalid)assert.equal(api.validateCampaign(value),false);
  const getter={...p};Object.defineProperty(getter,'seed',{get(){throw Error('hostile');},enumerable:true});
  assert.equal(api.validateCampaign(getter),false);
  assert.deepEqual(api.getCampaignLoadout({inventory:[],equipped:{attack:1e30}}),{attack:0,maxHp:0,armor:0,sword:0,flame:0,guard:0,weapon:'sword'});
});

test('award and action boundaries reject invalid inputs without mutation or throw', () => {
  const {campaign:p,runId}=start(fresh());
  for(const payload of [null,{}, {runId,chapterId:1,stage:-1,won:true}, {runId,chapterId:1,stage:6,won:true}, {runId,chapterId:1,stage:0,won:1}, {runId:'forged',chapterId:1,stage:0,won:true}, {runId,chapterId:2,stage:0,won:true}]) {
    const r=api.awardBattle(p,payload);assert.equal(r.campaign,p);assert.equal(r.loot,null);
  }
  for(const action of [null,{}, {type:'equip',uid:'missing'}, {type:'unequip',slot:'ring'}, {type:'unequip',slot:'__proto__'}, {type:'salvage',uid:p.equipped.armor}])assert.equal(api.campaignAction(p,action).campaign,p);
});

test('every original slot contributes a bounded model buff and final victories always drop rare gear or better',()=>{
  let p=fresh();p={...p,inventory:CONTENT.equipment.map((item,index)=>({uid:`fixture-${index}`,equipmentId:item.id})),equipped:{weapon:'fixture-7',ring:'fixture-15',armor:'fixture-23',boots:'fixture-31',scarf:'fixture-39',amulet:'fixture-47'}};
  assert.ok(api.validateCampaign(p));
  assert.deepEqual(api.getCampaignLoadout(p),{attack:8,maxHp:36,armor:4,sword:4,flame:0,guard:17,weapon:'staff'});
  for(let seed=1;seed<=20;seed++) {
    const started=start(fresh(seed));const result=api.awardBattle(started.campaign,{runId:started.runId,chapterId:1,stage:5,won:true});
    const item=CONTENT.equipment.find(item=>item.id===result.loot.equipmentId);assert.ok(['rare','epic'].includes(item.rarity));
  }
});

test('hostile accessor payloads and inflated array properties cannot escape bounded JSON validation',()=>{
  const {campaign:p,runId}=start(fresh()),poison={};Object.defineProperty(poison,'type',{get(){throw Error('must not execute');},enumerable:true});
  assert.doesNotThrow(()=>api.campaignAction(p,poison));assert.equal(api.campaignAction(p,poison).campaign,p);
  const outcome={runId,chapterId:1,stage:0};Object.defineProperty(outcome,'won',{get(){throw Error('must not execute');},enumerable:true});
  assert.doesNotThrow(()=>api.awardBattle(p,outcome));assert.equal(api.awardBattle(p,outcome).campaign,p);
  const oversized=copy(p);oversized.inventory.extra='x'.repeat(100_000);assert.equal(api.validateCampaign(oversized),false);
  const wrapped=copy(p);Object.setPrototypeOf(wrapped.inventory,{[Symbol.iterator]:function*(){yield* p.inventory;}});assert.equal(api.validateCampaign(wrapped),false);
});

test('forging spends 24 dust once, awards deterministic fine-or-better original gear and uses unique bounded ids',()=>{
  const p={...fresh(51),dust:24},before=copy(p),r=api.campaignAction(p,{type:'forge'});
  assert.notEqual(r.campaign,p);assert.deepEqual(p,before);assert.equal(r.campaign.dust,0);assert.equal(r.campaign.inventory.length,5);assert.equal(r.campaign.forgeSerial,1);
  const added=r.campaign.inventory.at(-1),item=CONTENT.equipment.find(i=>i.id===added.equipmentId);assert.ok(['fine','rare','epic'].includes(item.rarity));
  assert.deepEqual(api.campaignAction(copy(p),{type:'forge'}).campaign,r.campaign,'reload does not reroll a paid forge result');
  assert.equal(api.campaignAction(r.campaign,{type:'forge'}).campaign,r.campaign,'insufficient balance is not charged twice');
  const again=api.campaignAction({...r.campaign,dust:24},{type:'forge'}).campaign;assert.equal(again.forgeSerial,2);assert.notEqual(again.inventory.at(-1).uid,added.uid);assert.ok(api.validateCampaign(again));
  assert.equal(api.validateCampaign({...p,forgeSerial:Infinity}),false);assert.equal(api.validateCampaign({...p,forgeSerial:-1}),false);
});

test('a full inventory or exhausted forge counter preserves the entire balance and profile',()=>{
  let p=fresh();p={...p,dust:50,inventory:Array.from({length:120},(_,index)=>({uid:`owned-${index}`,equipmentId:'weapon-sword-1'})),equipped:Object.fromEntries(Object.keys(p.equipped).map(slot=>[slot,null]))};
  assert.ok(api.validateCampaign(p));assert.equal(api.campaignAction(p,{type:'forge'}).campaign,p);assert.equal(p.dust,50);
  const maximum={...fresh(),dust:24,forgeSerial:1_000_000_000};assert.ok(api.validateCampaign(maximum));assert.equal(api.campaignAction(maximum,{type:'forge'}).campaign,maximum);
});

test('accepted profiles with an existing mint id never produce duplicate inventory ids',()=>{
  let p={...fresh(),dust:24};p.inventory=[...p.inventory,{uid:'forge-1',equipmentId:'ring-1'}];assert.ok(api.validateCampaign(p));
  const forged=api.campaignAction(p,{type:'forge'}).campaign;assert.ok(api.validateCampaign(forged));assert.equal(new Set(forged.inventory.map(i=>i.uid)).size,forged.inventory.length);
  const startResult=start(fresh());p={...startResult.campaign,inventory:[...startResult.campaign.inventory,{uid:'drop-1-1-0',equipmentId:'ring-1'}]};assert.ok(api.validateCampaign(p));
  const awarded=api.awardBattle(p,{runId:startResult.runId,chapterId:1,stage:0,won:true}).campaign;
  assert.ok(api.validateCampaign(awarded));assert.equal(awarded.inventory.length,5,'a previously present deterministic mint is not duplicated');assert.equal(awarded.receipts.length,1);
});
