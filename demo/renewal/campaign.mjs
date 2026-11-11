import {CONTENT} from '../content.mjs';

/** Separate from both the workshop profile and the current adventure save. */
export const CAMPAIGN_KEY = 'qipai-jianghu-renewal-campaign-v1';
export const CAMPAIGN_SLOTS = Object.freeze(['weapon','ring','armor','boots','scarf','amulet']);
export const CAMPAIGN_FORGE_COST = 24;
const CATALOG = new Map(CONTENT.equipment.map(item => [item.id,item]));
const RARITIES = new Map(CONTENT.rarities.map(item => [item.id,item]));
const INVENTORY_LIMIT = 120, VALUE_LIMIT = 1_000_000_000;
const PROFILE_KEYS = ['version','seed','runSerial','forgeSerial','activeRun','unlockedChapter','inventory','equipped','dust','receipts'];
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const uidOK = value => typeof value === 'string' && value.length <= 64 && /^[a-z][a-z0-9-]{0,63}$/.test(value);
function record(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value,key);
    return descriptor && Object.hasOwn(descriptor,'value');
  });
}
function jsonArray(value,maxLength) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype &&
    value.length <= maxLength && Reflect.ownKeys(value).length === value.length + 1 &&
    Array.from({length:value.length},(_,index)=>Object.getOwnPropertyDescriptor(value,index)).every(descriptor=>descriptor&&Object.hasOwn(descriptor,'value'));
}
function payload(value, allowedKeys) {
  try {
    if(!value || Object.getPrototypeOf(value)!==Object.prototype)return false;
    const keys=Reflect.ownKeys(value);
    return keys.length<=allowedKeys.length&&keys.every(key=>allowedKeys.includes(key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
  } catch {return false;}
}
function emptyLoadout() {return {attack:0,maxHp:0,armor:0,sword:0,flame:0,guard:0,weapon:'sword'};}
const fail = (campaign, message='没有可执行的操作。') => ({campaign,message});
const noAward = (campaign, message='') => ({campaign,loot:null,message});

export function newCampaign(seed=1) {
  const normalizedSeed = Number.isFinite(seed) ? (Math.trunc(seed) >>> 0) || 1 : 1;
  return {
    version:1,seed:normalizedSeed,runSerial:0,forgeSerial:0,activeRun:null,unlockedChapter:1,
    inventory:[
      {uid:'starter-sword',equipmentId:'weapon-sword-1'},
      {uid:'starter-staff',equipmentId:'weapon-staff-1'},
      {uid:'starter-armor',equipmentId:'armor-1'},
      {uid:'starter-boots',equipmentId:'boots-1'},
    ],
    equipped:{weapon:'starter-sword',ring:null,armor:'starter-armor',boots:'starter-boots',scarf:null,amulet:null},
    dust:0,receipts:[],
  };
}

/** Reject unknown fields, derived stats, foreign catalog entries and unbounded JSON. */
export function validateCampaign(value) {
  try {
    if (!record(value,PROFILE_KEYS) || value.version !== 1 || !integer(value.seed,1,0xffffffff) ||
        !integer(value.runSerial,0,VALUE_LIMIT) || !integer(value.forgeSerial,0,VALUE_LIMIT) || ![1,2].includes(value.unlockedChapter) ||
        !integer(value.dust,0,VALUE_LIMIT) || !record(value.equipped,CAMPAIGN_SLOTS) ||
        !jsonArray(value.inventory,INVENTORY_LIMIT) || !jsonArray(value.receipts,6)) return false;
    const inventory = new Map();
    for (const item of value.inventory) {
      if (!record(item,['uid','equipmentId']) || !uidOK(item.uid) || !uidOK(item.equipmentId) || !CATALOG.has(item.equipmentId) || inventory.has(item.uid)) return false;
      inventory.set(item.uid,item);
    }
    for (const slot of CAMPAIGN_SLOTS) {
      const uid = value.equipped[slot];
      if (uid !== null && (!uidOK(uid) || !inventory.has(uid) || CATALOG.get(inventory.get(uid).equipmentId).slot !== slot)) return false;
    }
    if (value.activeRun === null) return value.receipts.length === 0;
    if (!record(value.activeRun,['runId','chapterId']) || value.runSerial < 1 ||
        value.activeRun.runId !== `run-${value.runSerial}` || ![1,2].includes(value.activeRun.chapterId) ||
        value.activeRun.chapterId > value.unlockedChapter) return false;
    const receipts = new Set();
    for (const receipt of value.receipts) {
      if (typeof receipt !== 'string' || receipts.has(receipt) || !Array.from({length:6},(_,stage)=>`${value.activeRun.runId}:${value.activeRun.chapterId}:${stage}`).includes(receipt)) return false;
      receipts.add(receipt);
    }
    return true;
  } catch {return false;}
}

export function beginCampaignRun(profile, chapterId) {
  if (!validateCampaign(profile) || ![1,2].includes(chapterId) || chapterId > profile.unlockedChapter || profile.runSerial >= VALUE_LIMIT) return {campaign:profile,runId:null};
  const runSerial = profile.runSerial + 1, runId = `run-${runSerial}`;
  return {campaign:{...profile,runSerial,activeRun:{runId,chapterId},receipts:[]},runId};
}

// A reward depends solely on the saved run/seed/stage, so save-then-award recovery
// produces the same item. Previous run IDs cannot claim rewards after pruning.
function dropFor(profile, chapterId, stage) {
  let value = (profile.seed ^ Math.imul(profile.runSerial,0x9e3779b9) ^ Math.imul(chapterId,0x85ebca6b) ^ Math.imul(stage+1,0xc2b2ae35)) >>> 0;
  value ^= value << 13;value ^= value >>> 17;value ^= value << 5;value >>>= 0;
  const roll = value % 100;
  const rank = stage === 5 ? (roll < 80 ? 2 : 3) : chapterId === 2 ? (roll < 30 ? 0 : roll < 70 ? 1 : roll < 94 ? 2 : 3) : (roll < 60 ? 0 : roll < 85 ? 1 : roll < 97 ? 2 : 3);
  const pool = CONTENT.equipment.filter(item => RARITIES.get(item.rarity).rank === rank);
  return pool[Math.floor(value/100)%pool.length];
}
export function awardBattle(profile, result) {
  if (!validateCampaign(profile) || !payload(result,['runId','chapterId','stage','won']) || result.won !== true || !integer(result.stage,0,5) ||
      !profile.activeRun || result.runId !== profile.activeRun.runId || result.chapterId !== profile.activeRun.chapterId) return noAward(profile);
  const receipt = `${result.runId}:${result.chapterId}:${result.stage}`;
  if (profile.receipts.includes(receipt)) return noAward(profile);
  const item = dropFor(profile,result.chapterId,result.stage);
  const loot = {uid:`drop-${profile.runSerial}-${result.chapterId}-${result.stage}`,equipmentId:item.id};
  const alreadyOwned = profile.inventory.some(entry=>entry.uid===loot.uid);
  const full = profile.inventory.length >= INVENTORY_LIMIT;
  const unlockedChapter = result.chapterId === 1 && result.stage === 5 ? 2 : profile.unlockedChapter;
  const campaign = {...profile,unlockedChapter,receipts:[...profile.receipts,receipt],
    inventory:full||alreadyOwned ? profile.inventory : [...profile.inventory,loot],
    dust:full&&!alreadyOwned ? Math.min(VALUE_LIMIT,profile.dust+RARITIES.get(item.rarity).salvage) : profile.dust};
  const unlock = profile.unlockedChapter < unlockedChapter ? ' 暮雨山门已解锁。' : '';
  if(alreadyOwned)return {campaign,loot:null,message:unlock.trim()};
  return {campaign,loot,message:`${full ? '背包已满，' : '获得'}${item.name}${full ? `自动分解为${RARITIES.get(item.rarity).salvage}锻尘` : ''}。${unlock}`};
}

export function campaignAction(profile, action) {
  if (!validateCampaign(profile) || !payload(action,['type','uid','slot'])) return fail(profile);
  if (action.type === 'forge') {
    if(profile.inventory.length>=INVENTORY_LIMIT)return fail(profile,'行囊已满，请先分解闲置装备。');
    if(profile.dust<CAMPAIGN_FORGE_COST)return fail(profile,`锻尘不足，需要${CAMPAIGN_FORGE_COST}锻尘。`);
    if(profile.forgeSerial>=VALUE_LIMIT)return fail(profile,'铸装次数已达上限。');
    let forgeSerial=profile.forgeSerial+1;
    while(forgeSerial<=VALUE_LIMIT&&profile.inventory.some(item=>item.uid===`forge-${forgeSerial}`))forgeSerial++;
    if(forgeSerial>VALUE_LIMIT)return fail(profile,'铸装次数已达上限。');
    let value=(profile.seed^Math.imul(forgeSerial,0x27d4eb2d)^Math.imul(profile.unlockedChapter,0x165667b1))>>>0;
    value^=value<<13;value^=value>>>17;value^=value<<5;value>>>=0;
    const rank=value%100<70?1:value%100<95?2:3;
    const pool=CONTENT.equipment.filter(item=>RARITIES.get(item.rarity).rank===rank),item=pool[Math.floor(value/100)%pool.length];
    return {campaign:{...profile,forgeSerial,dust:profile.dust-CAMPAIGN_FORGE_COST,inventory:[...profile.inventory,{uid:`forge-${forgeSerial}`,equipmentId:item.id}]},message:`消耗${CAMPAIGN_FORGE_COST}锻尘，铸得${item.name}（${RARITIES.get(item.rarity).name}）。下场战斗穿戴后生效。`};
  }
  if (action.type === 'unequip') {
    if (!CAMPAIGN_SLOTS.includes(action.slot) || profile.equipped[action.slot] === null) return fail(profile);
    return {campaign:{...profile,equipped:{...profile.equipped,[action.slot]:null}},message:'已卸下，下场战斗生效。'};
  }
  const owned = profile.inventory.find(item => item.uid === action.uid);
  if (!owned) return fail(profile,'未找到这件装备。');
  const item = CATALOG.get(owned.equipmentId);
  if (action.type === 'equip') {
    if (profile.equipped[item.slot] === owned.uid) return fail(profile,'已经穿戴这件装备。');
    return {campaign:{...profile,equipped:{...profile.equipped,[item.slot]:owned.uid}},message:`已穿戴${item.name}，下场战斗生效。`};
  }
  if (action.type === 'salvage') {
    if (Object.values(profile.equipped).includes(owned.uid)) return fail(profile,'穿戴中的装备不可分解，请先卸下。');
    const dust = RARITIES.get(item.rarity).salvage;
    return {campaign:{...profile,inventory:profile.inventory.filter(entry=>entry.uid!==owned.uid),dust:Math.min(VALUE_LIMIT,profile.dust+dust)},message:`已分解${item.name}，获得${dust}锻尘。`};
  }
  return fail(profile);
}

/** Only these capped integer bonuses cross into the current adventure model. */
export function getCampaignLoadout(profile) {
  const loadout = emptyLoadout();
  if (!validateCampaign(profile)) return loadout;
  for (const slot of CAMPAIGN_SLOTS) {
    const owned = profile.inventory.find(item => item.uid === profile.equipped[slot]);
    const item = owned && CATALOG.get(owned.equipmentId);
    if (!item) continue;
    for (const key of ['attack','maxHp','armor']) loadout[key] += item.effects[key] ?? 0;
    loadout.sword += item.effects.critChance ?? 0;
    loadout.flame += item.effects.fireDamage ?? 0;
    loadout.guard += (item.effects.shieldGain ?? 0)+(item.effects.openingShield ?? 0);
    if (slot === 'weapon') loadout.weapon = item.weaponType;
  }
  for (const [key,cap] of Object.entries({attack:30,maxHp:120,armor:12,sword:12,flame:12,guard:24})) loadout[key] = Math.max(0,Math.min(cap,Math.trunc(loadout[key])));
  return loadout;
}
