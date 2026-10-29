import {BUILDS,NODES,ENEMY_TYPES} from './config.mjs';
export const SAVE_KEY='qipai-bamboo-demo-v1';
const num=n=>Number.isFinite(n)&&n>=0;
const integer=n=>Number.isInteger(n)&&n>=0;
const build=b=>Object.hasOwn(BUILDS,b);
function valid(r){
 if(!r||r.version!==1||!integer(r.seed)||r.seed>4294967295||!build(r.build)||!integer(r.nodeIndex)||!NODES[r.nodeIndex]||!['intro','battle','reward','event','camp','victory','defeat'].includes(r.flow))return false;
 if(!r.hero||!['hp','maxHp','shield','attack'].every(k=>num(r.hero[k]))||r.hero.maxHp<=0||r.hero.hp>r.hero.maxHp)return false;
 if(!Array.isArray(r.diceSkills)||r.diceSkills.length!==5||!r.diceSkills.every(s=>s===null||(s&&build(s.kind)&&integer(s.level)&&s.level>=1)))return false;
 if(!r.upgrades||typeof r.upgrades!=='object'||Array.isArray(r.upgrades)||!Object.values(r.upgrades).every(integer)||!integer(r.mastery)||typeof r.ascended!=='boolean')return false;
 if(!r.stats||!['turns','kills','damage','blocked','poisonDamage'].every(k=>num(r.stats[k]))||!Array.isArray(r.stats.upgrades)||!r.stats.upgrades.every(s=>typeof s==='string'))return false;
 if(!Array.isArray(r.choices)||!r.choices.every(c=>c&&['id','title','description','before','after','kind'].every(k=>typeof c[k]==='string')&&build(c.build)&&integer(c.dieIndex)&&c.dieIndex<5))return false;
 if(r.flow==='reward'&&r.choices.length!==3)return false;
 if(r.combat!==null){const c=r.combat;if(!c||!integer(c.round)||c.round<1||!['roll','pick','resolved'].includes(c.phase)||!Array.isArray(c.dice)||c.dice.length!==5||!c.dice.every(n=>integer(n)&&n<=6)||!Array.isArray(c.held)||c.held.length!==5||!c.held.every(n=>typeof n==='boolean')||!integer(c.rerolls)||c.rerolls>2||typeof c.targetId!=='string'||!Array.isArray(c.enemies)||!c.enemies.every(e=>e&&typeof e.id==='string'&&Object.hasOwn(ENEMY_TYPES,e.kind)&&typeof e.name==='string'&&['hp','maxHp','shield','stance','phase'].every(k=>num(e[k]))&&e.maxHp>0&&e.hp<=e.maxHp&&typeof e.summoned==='boolean'&&e.poison&&integer(e.poison.stacks)&&integer(e.poison.turns)&&e.intent&&typeof e.intent.kind==='string'&&typeof e.intent.label==='string'&&num(e.intent.damage)))return false;}
 return r.flow!=='battle'||r.combat!==null;
}
export function saveRun(storage,run){try{if(!valid(run))return {ok:false,message:'进度格式异常，未能保存；仍可继续游玩。'};storage.setItem(SAVE_KEY,JSON.stringify(run));return {ok:true,message:''};}catch{return {ok:false,message:'浏览器无法保存进度；本次仍可继续游玩。'};}}
export function loadRun(storage){try{const text=storage.getItem(SAVE_KEY);if(text===null)return {run:null,message:''};const run=JSON.parse(text);if(!valid(run))return {run:null,message:'示范进度损坏或版本不兼容，请开启新局。'};return {run,message:''};}catch{return {run:null,message:'无法读取示范进度，请开启新局。'};}}
