import {BALANCE,BUILDS,NODES,ENEMY_TYPES,PERKS,emptyPerks} from './config.mjs';
export const SAVE_KEY='qipai-bamboo-demo-v1';
const num=n=>Number.isFinite(n)&&n>=0;
const integer=n=>Number.isInteger(n)&&n>=0;
const build=b=>Object.hasOwn(BUILDS,b);
function validIntent(e,c){
 const i=e.intent;
 if(!i||typeof i.label!=='string')return false;
 if(i.kind==='stunned')return e.kind==='boss'&&e.stance===0&&i.damage===0&&(e.hp===0||c.phase==='resolved');
 if(i.kind==='heavy')return e.kind==='boss'&&i.damage===BALANCE.bossHeavyDamage&&(e.hp===0||c.round%2===0);
 return i.kind==='attack'&&i.damage===ENEMY_TYPES[e.kind].attack&&(e.kind!=='boss'||e.hp===0||c.round%2===1);
}
function validBoundary(r){
 const node=NODES[r.nodeIndex],c=r.combat;
 if(r.flow!=='reward'&&r.choices.length)return false;
 if(r.flow==='intro')return r.nodeIndex===0&&c===null&&r.hero.hp>0;
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
function validCombat(c){
 if(!c||typeof c.swordArrayUsed!=='boolean'||!integer(c.round)||c.round<1||!['roll','pick','resolved'].includes(c.phase))return false;
 if(!Array.isArray(c.dice)||c.dice.length!==5||!c.dice.every(n=>integer(n)&&(c.phase==='roll'?n===0:n>=1&&n<=6)))return false;
 if(!Array.isArray(c.held)||c.held.length!==5||!c.held.every(n=>typeof n==='boolean')||!integer(c.rerolls)||c.rerolls>2||typeof c.targetId!=='string')return false;
 return Array.isArray(c.enemies)&&c.enemies.every(e=>
  e&&typeof e.id==='string'&&Object.hasOwn(ENEMY_TYPES,e.kind)&&typeof e.name==='string'
  &&['hp','maxHp','shield','stance','phase'].every(k=>num(e[k]))&&e.maxHp>0&&e.hp<=e.maxHp
  &&typeof e.summoned==='boolean'&&e.poison&&integer(e.poison.stacks)&&integer(e.poison.turns)&&validIntent(e,c));
}
function valid(r){
 if(!r||r.version!==2||!integer(r.seed)||r.seed>4294967295||!build(r.build)||!integer(r.nodeIndex)||!NODES[r.nodeIndex]||!['intro','battle','reward','event','camp','victory','defeat'].includes(r.flow))return false;
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
 if(r.combat!==null&&!validCombat(r.combat))return false;
 return validBoundary(r);
}
/** Validate a saved state and migrate legacy demo progress without any random draws. */
export function migrateRun(run){
 if(!run||![1,2].includes(run.version))return null;
 const r=structuredClone(run);
 if(r.version===1){
  if(!Array.isArray(r.choices)||r.choices.some(c=>c?.kind!=='skill'))return null;
  r.version=2;r.perks=emptyPerks();r.pendingUpgrade=null;
  if(r.stats)r.stats.upgradeHistory??=[];
  r.choices=r.choices.map(c=>({...c,kind:'bind'}));
 }
 return valid(r)?r:null;
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
