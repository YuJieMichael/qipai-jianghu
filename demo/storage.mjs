import {BALANCE,BUILDS,NODES,ENEMY_TYPES,PERKS,emptyPerks} from './config.mjs';
export const SAVE_KEY='qipai-bamboo-demo-v1';
const num=n=>Number.isFinite(n)&&n>=0;
const integer=n=>Number.isInteger(n)&&n>=0;
const build=b=>Object.hasOwn(BUILDS,b);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const counts=value=>object(value)&&Object.values(value).every(integer);
const numbers=value=>object(value)&&Object.values(value).every(num);
const itemIds=['potion','reroll','antidote','tonic'];
const items=(value,partial=false)=>counts(value)&&Object.keys(value).every(id=>itemIds.includes(id))&&(partial||itemIds.every(id=>Object.hasOwn(value,id)));
const effects=['attack','maxHp','armor','critChance','critDamage','lifesteal','poisonDamage','shieldGain','extraRerolls','openingShield','regen','thorns','fireDamage','freezeChance','comboBonus','goldBonus'];
const materials=['wood','jade','iron','flame','frost','thunder','poison'];
const decorations=['plain','lucky','chain','blood','guard','focus','restore','fortune'];
const marks=[null,'sword','crit','poison','fire','cold','leech','heal','guard','wild'];
const modes=['campaign','boss','tower','dungeon','arena','bounty','escort','worldboss','tournament','resource','totem'];
function validLoadout(l){
 if(!object(l)||!numbers(l.effects)||!Object.keys(l.effects).every(k=>effects.includes(k)))return false;
 if(l.weaponType!==undefined&&!['sword','staff','hammer'].includes(l.weaponType))return false;
 if(l.dice!==undefined&&(!Array.isArray(l.dice)||l.dice.length!==5||!l.dice.every(d=>object(d)&&Array.isArray(d.faces)&&d.faces.length===6&&d.faces.every(v=>integer(v)&&v>=1&&v<=6)&&Array.isArray(d.marks)&&d.marks.length===6&&d.marks.every(m=>marks.includes(m))&&materials.includes(d.materialId)&&integer(d.materialLevel)&&d.materialLevel>=1&&d.materialLevel<=5&&decorations.includes(d.decorationId))))return false;
 if(l.skills!==undefined&&(!Array.isArray(l.skills)||l.skills.length>4||!l.skills.every(s=>object(s)&&typeof s.id==='string'&&['always','pair','straight','triple','round','crit','sword','poison','guard'].includes(s.trigger)&&numbers(s.effects)&&Object.keys(s.effects).every(k=>['damage','heal','shield','poison','attack'].includes(k)))))return false;
 if(l.relics!==undefined&&(!Array.isArray(l.relics)||l.relics.length>3||!l.relics.every(r=>object(r)&&integer(r.handRank)&&r.handRank<=7&&num(r.damage))))return false;
 if(l.pet!==undefined&&l.pet!==null&&(!object(l.pet)||!['damage','heal','shield'].every(k=>num(l.pet[k]))))return false;
 if(l.rules!==undefined&&!numbers(l.rules))return false;
 if(l.bag!==undefined&&!items(l.bag))return false;
 if(l.progression!==undefined&&!numbers(l.progression))return false;
 return l.contentVersion===undefined||l.contentVersion===1;
}
function validRoute(r){
 if(!Array.isArray(r.route)||r.route.length<1||r.route.length>100||!modes.includes(r.mode)||typeof r.chapter!=='string'||!integer(r.floor)||r.floor<1||!(typeof r.runId==='string'||(Number.isSafeInteger(r.runId)&&r.runId>=1))||!integer(r.coins)||!items(r.bag)||!items(r.consumed,true)||typeof r.settled!=='boolean')return false;
 if(!Array.isArray(r.completedBattles)||new Set(r.completedBattles).size!==r.completedBattles.length||!r.completedBattles.every(id=>r.route.some(n=>n.id===id&&n.type==='battle')))return false;
 if(!object(r.results)||typeof r.results.completed!=='boolean'||!['worldBossDamage','worldBossHp','towerFloorCompleted'].every(k=>num(r.results[k]))||!numbers(r.reward))return false;
 if(new Set(r.route.map(n=>n?.id)).size!==r.route.length)return false;
 return r.route.every((n,i)=>object(n)&&typeof n.id==='string'&&n.index===i&&['battle','reward','event','camp'].includes(n.type)&&typeof n.name==='string'&&['bamboo','temple','gate'].includes(n.scene)&&typeof n.reward==='boolean'&&num(n.hpScale)&&num(n.attackScale)&&Array.isArray(n.enemies)&&(n.type!=='battle'||(n.enemies.length>0&&integer(n.turnLimit)&&n.turnLimit>=1))&&n.enemies.every(e=>object(e)&&Object.hasOwn(ENEMY_TYPES,e.kind)&&['hp','attack','shield','stance','heavyDamage'].every(k=>num(e[k]))&&e.hp>0));
}
function validIntent(e,c){
 const i=e.intent;
 if(!i||typeof i.label!=='string')return false;
 if(i.kind==='frozen')return i.damage===0&&(e.hp===0||c.phase==='resolved');
 if(i.kind==='stunned')return e.kind==='boss'&&e.stance===0&&i.damage===0&&(e.hp===0||c.phase==='resolved');
 if(i.kind==='heavy')return e.kind==='boss'&&i.damage===(e.heavyDamage??BALANCE.bossHeavyDamage)&&(e.hp===0||c.round%2===0);
 return i.kind==='attack'&&i.damage===(e.baseAttack??ENEMY_TYPES[e.kind].attack)&&(e.kind!=='boss'||e.hp===0||c.round%2===1);
}
function validBoundary(r){
 const node=(r.route||NODES)[r.nodeIndex],c=r.combat;
 if(r.flow!=='reward'&&r.choices.length)return false;
 if(r.flow==='intro')return r.nodeIndex===0&&c===null&&r.hero.hp>0;
 if(r.route){
  if(['reward','event','camp'].includes(r.flow)){
   if(c!==null||r.hero.hp<=0)return false;
   if(r.flow==='event')return node.type==='event';
   if(r.flow==='camp')return node.type==='camp'&&r.upgrades[`campComplete-${r.nodeIndex}`]===1&&r.upgrades[`campHealed-${r.nodeIndex}`]===1;
   return node.type==='reward'||node.type==='camp'||(node.type==='battle'&&node.reward);
  }
  if(node.type!=='battle'||!c)return false;
  if(r.flow==='victory')return r.nodeIndex===r.route.length-1&&r.results.completed&&r.hero.hp>0&&c.phase==='resolved'&&(c.enemies.every(e=>e.hp===0)||(['resource','worldboss'].includes(r.mode)&&c.timedOut===true));
  if(r.flow==='defeat')return c.phase==='resolved'&&(r.hero.hp===0||c.timedOut===true);
  return r.flow==='battle'&&((r.hero.hp>0&&c.enemies.some(e=>e.hp>0))||c.phase==='resolved');
 }
 if(['reward','event','camp'].includes(r.flow)){
  if(c!==null||r.hero.hp<=0)return false;
  if(r.flow==='event')return node.type==='event';
  if(r.flow==='camp')return node.type==='camp'&&r.upgrades.campComplete===1&&r.upgrades.campHealed===1;
  return [1,2,5,6,7].includes(r.nodeIndex)&&(r.nodeIndex!==7||(r.upgrades.campHealed===1&&!r.upgrades.campComplete));
 }
 if(node.type!=='battle'||!c)return false;
 const living=c.enemies.filter(e=>e.hp>0);
 if(r.flow==='victory')return r.nodeIndex===8&&r.hero.hp>0&&living.length===0&&c.phase==='resolved';
 if(r.flow==='defeat')return r.hero.hp===0&&c.phase==='resolved';
 if(r.flow==='battle')return (r.hero.hp>0&&living.length>0)||c.phase==='resolved';
 return false;
}
function validHistoryEntry(h){
 if(!h||!['id','title','before','after'].every(k=>typeof h[k]==='string')||!build(h.build))return false;
 if(h.kind==='bind')return integer(h.dieIndex)&&h.dieIndex<5&&h.perkId===null;
 return h.kind==='perk'&&h.dieIndex===null&&PERKS[h.perkId]?.build===h.build;
}
function validChoice(c,r){
 if(!c||!['id','title','description','before','after'].every(k=>typeof c[k]==='string')||!build(c.build)||!integer(c.dieIndex)||c.dieIndex>=5)return false;
 if(c.kind==='bind')return true;
 const perk=PERKS[c.perkId];
 return c.kind==='perk'&&perk&&perk.build===c.build&&r.perks[c.perkId]<perk.maxRank&&r.diceSkills.some(s=>s?.kind===c.build);
}
function validCombat(c,r){
 if(!c||!Array.isArray(c.enemies)||typeof c.swordArrayUsed!=='boolean'||!integer(c.round)||c.round<1||!['roll','pick','resolved'].includes(c.phase))return false;
 if(!Array.isArray(c.dice)||c.dice.length!==5||!c.dice.every(n=>integer(n)&&(c.phase==='roll'?n===0:n>=1&&n<=6)))return false;
 if(!Array.isArray(c.held)||c.held.length!==5||!c.held.every(n=>typeof n==='boolean')||!integer(c.rerolls)||c.rerolls>6||typeof c.targetId!=='string')return false;
 if(c.faceIndices!==undefined&&(!Array.isArray(c.faceIndices)||c.faceIndices.length!==5||!c.faceIndices.every(n=>integer(n)&&n<6)))return false;
 if(c.frozen!==undefined&&(!Array.isArray(c.frozen)||c.frozen.length!==5||!c.frozen.every(n=>typeof n==='boolean')))return false;
 if(r.loadout?.dice&&(c.faceIndices===undefined||c.frozen===undefined||(c.phase!=='roll'&&!c.dice.every((value,i)=>value===r.loadout.dice[i].faces[c.faceIndices[i]]))))return false;
 if(r.loadout?.dice&&c.phase!=='roll'&&!c.frozen.every((frozen,i)=>frozen===(r.loadout.dice[i].decorationId==='focus'||(r.loadout.dice[i].materialId==='frost'&&c.round%2===0))))return false;
 if(c.turnLimit!==undefined&&(!integer(c.turnLimit)||c.turnLimit<1))return false;
 if(c.timedOut!==undefined&&(typeof c.timedOut!=='boolean'||!c.turnLimit||c.round<c.turnLimit||c.phase!=='resolved'))return false;
 if(r.route){
  const node=r.route[r.nodeIndex];if(c.turnLimit!==node.turnLimit)return false;
  for(const e of c.enemies){
   if(!e||typeof e.id!=='string')return false;
   const i=node.enemies.findIndex((_,i)=>e.id===`${node.id}-${i}`),d=node.enemies[i];
   if(d){if(e.kind!==d.kind||e.baseAttack!==d.attack||e.heavyDamage!==d.heavyDamage||e.baseStance!==d.stance||e.maxHp!==d.hp||e.noSummon!==!!d.noSummon)return false;continue;}
   const parent=c.enemies.find(b=>b.kind==='boss'&&b.summoned&&[`${b.id}-aid-1`,`${b.id}-aid-2`].includes(e.id));
   const expected=e.id.endsWith('-aid-1')?'melee':'ranged';
   if(!parent||e.kind!==expected||e.maxHp!==ENEMY_TYPES[expected].hp||e.baseAttack!==undefined)return false;
  }
 }
 return Array.isArray(c.enemies)&&c.enemies.length>0&&new Set(c.enemies.map(e=>e.id)).size===c.enemies.length&&c.enemies.every(e=>
  e&&typeof e.id==='string'&&Object.hasOwn(ENEMY_TYPES,e.kind)&&typeof e.name==='string'
  &&['hp','maxHp','shield','stance','phase'].every(k=>num(e[k]))&&e.maxHp>0&&e.hp<=e.maxHp
  &&['baseAttack','heavyDamage','baseStance'].every(k=>e[k]===undefined||num(e[k]))&&(e.noSummon===undefined||typeof e.noSummon==='boolean')
  &&typeof e.summoned==='boolean'&&e.poison&&integer(e.poison.stacks)&&integer(e.poison.turns)&&validIntent(e,c));
}
function valid(r){
 if(!r||r.version!==3||!integer(r.seed)||r.seed>4294967295||!build(r.build)||!integer(r.nodeIndex)||!(r.route||NODES)[r.nodeIndex]||!['intro','battle','reward','event','camp','victory','defeat'].includes(r.flow))return false;
 if(r.route!==undefined&&!validRoute(r))return false;
 if(r.loadout!==undefined&&!validLoadout(r.loadout))return false;
 if(r.bag!==undefined&&!items(r.bag))return false;
 if(r.consumed!==undefined&&!items(r.consumed,true))return false;
 if(r.loadout?.bag&&r.bag&&!itemIds.every(id=>r.bag[id]+(r.consumed?.[id]||0)>=r.loadout.bag[id]))return false;
 if(r.coins!==undefined&&!integer(r.coins))return false;
 if(r.settled!==undefined&&typeof r.settled!=='boolean')return false;
 if(!r.hero||!['hp','maxHp','shield','attack'].every(k=>num(r.hero[k]))||r.hero.maxHp<=0||r.hero.hp>r.hero.maxHp)return false;
 if(!Array.isArray(r.diceSkills)||r.diceSkills.length!==5||!r.diceSkills.every(s=>s===null||(s&&build(s.kind)&&integer(s.level)&&s.level>=1)))return false;
 if(!r.upgrades||typeof r.upgrades!=='object'||Array.isArray(r.upgrades)||!Object.values(r.upgrades).every(integer)||!integer(r.mastery)||typeof r.ascended!=='boolean')return false;
 if(!r.stats||!['turns','kills','damage','blocked','poisonDamage'].every(k=>num(r.stats[k]))||!Array.isArray(r.stats.upgrades)||!r.stats.upgrades.every(s=>typeof s==='string'))return false;
 if(!r.perks||typeof r.perks!=='object'||Array.isArray(r.perks)||Object.keys(r.perks).length!==Object.keys(PERKS).length||!Object.keys(PERKS).every(id=>integer(r.perks[id])&&r.perks[id]<=PERKS[id].maxRank))return false;
 if(r.stats.upgradeHistory!==undefined&&(!Array.isArray(r.stats.upgradeHistory)||!r.stats.upgradeHistory.every(validHistoryEntry)))return false;
 if(!Array.isArray(r.choices)||!r.choices.every(c=>validChoice(c,r)))return false;
 if(new Set(r.choices.map(c=>c.id)).size!==r.choices.length||new Set(r.choices.filter(c=>c.kind==='perk').map(c=>c.perkId)).size!==r.choices.filter(c=>c.kind==='perk').length)return false;
 if(r.pendingUpgrade!==null){
  const pending=r.pendingUpgrade;
  if(!pending||r.flow!=='reward'||typeof pending.choiceId!=='string')return false;
  const choice=r.choices.find(c=>c.id===pending.choiceId);
  if(!choice||(pending.dieIndex!==null&&(!integer(pending.dieIndex)||pending.dieIndex>=5))||(choice.kind==='perk'&&pending.dieIndex!==null))return false;
 }
 if(r.flow==='reward'&&r.choices.length!==3)return false;
 if(r.combat!==null&&!validCombat(r.combat,r))return false;
 return validBoundary(r);
}
/** Validate a saved state and migrate legacy demo progress without any random draws. */
export function migrateRun(run){
 try{
 if(!run||![1,2,3].includes(run.version))return null;
 const r=structuredClone(run);
 if(r.version===1){
  if(!Array.isArray(r.choices)||r.choices.some(c=>c?.kind!=='skill'))return null;
  r.version=2;r.perks=emptyPerks();r.pendingUpgrade=null;
  if(r.stats)r.stats.upgradeHistory??=[];
  r.choices=r.choices.map(c=>({...c,kind:'bind'}));
 }
 if(r.version===2)r.version=3;
 return valid(r)?r:null;
 }catch{return null;}
}
export function saveRun(storage,run){
 try{
  const saved=migrateRun(run);
  if(!saved)return {ok:false,message:'进度格式异常，未能保存；仍可继续游玩。'};
  storage.setItem(SAVE_KEY,JSON.stringify(saved));return {ok:true,message:''};
 }catch{return {ok:false,message:'浏览器无法保存进度；本次仍可继续游玩。'};}
}
export function loadRun(storage){
 try{
  const text=storage.getItem(SAVE_KEY);if(text===null)return {run:null,message:''};
  const run=migrateRun(JSON.parse(text));
  if(!run)return {run:null,message:'示范进度损坏或版本不兼容，请开启新局。'};
  return {run,message:''};
 }catch{return {run:null,message:'无法读取示范进度，请开启新局。'};}
}
