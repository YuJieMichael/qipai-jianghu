import {NODES,ENEMY_TYPES,BALANCE} from './config.mjs';
import {CONTENT} from './content.mjs';
import {createRun} from './model.mjs';
export {getRunNode,getRunNodes} from './journey.mjs';

const MODES=['campaign','boss','tower','dungeon','arena','bounty','escort','worldboss','tournament','resource','totem'];
const copy=value=>structuredClone(value);
const positive=(value,fallback)=>Number.isFinite(value)&&value>0?value:fallback;
/** Resolve content into a saved route. Later content edits cannot alter this expedition. */
export function createExpedition(build,seed=1,{runId,loadout,mode='campaign',chapter='bamboo',floor=1,worldBossHp,content=CONTENT}={}){
 if(!MODES.includes(mode))throw new RangeError('Unknown expedition mode');
 const chapterDef=content.chapters?.find(c=>c.id===chapter)||CONTENT.chapters.find(c=>c.id===chapter);
 if(!chapterDef)throw new RangeError('Unknown chapter');
 const modeDef=content.modes?.find(c=>c.id===mode)||CONTENT.modes.find(c=>c.id===mode);
 const turnLimit=Math.max(1,Math.min(1000,Math.floor(positive(modeDef.turnLimit,30))));
 const level=Math.max(1,Math.min(1000,Math.floor(positive(floor,1))));
 const hpScale=positive(chapterDef.hpScale,1)*positive(modeDef.hpScale,1)*(mode==='tower'?1+(level-1)*.12:1);
 const attackScale=positive(chapterDef.attackScale,1)*positive(modeDef.attackScale,1)*(mode==='tower'?1+(level-1)*.08:1);
 const routeEnemy=(kind,extra={})=>{const base=ENEMY_TYPES[kind];return {kind,name:base.name,hp:Math.ceil(base.hp*hpScale),attack:Math.ceil(base.attack*attackScale),shield:Math.ceil(base.shield*hpScale),stance:Math.ceil(base.stance*hpScale),heavyDamage:Math.ceil(BALANCE.bossHeavyDamage*attackScale),...extra};};
 const battle=(id,name,kinds,extra={})=>({id,index:0,type:'battle',name,scene:'gate',reward:false,coins:15,enemies:kinds.map(k=>typeof k==='string'?routeEnemy(k):k),turnLimit,...extra});
 const event=(id,name,extra={})=>({id,index:0,type:'event',name,scene:'temple',enemies:[],reward:false,...extra});
 let route;
 switch(mode){
  case 'campaign':route=NODES.map(n=>({...copy(n),enemies:n.enemies.map(k=>routeEnemy(k)),coins:n.type==='battle'?15:0,...(n.type==='battle'?{turnLimit}:{}),...(n.type==='event'?{merchant:true,options:['heal','train','buy-potion','buy-tonic']}: {})}));break;
  case 'boss':route=[battle('boss-trial','守将试炼',['boss'],{coins:35})];break;
  case 'tower':route=[battle(`tower-${level}`,`通天塔 · 第 ${level} 层`,[level%5===0?'boss':level%2===0?'shield':'elite'],{coins:20+level*3})];break;
  case 'dungeon':route=[battle('room-1','秘境一室',['melee'],{reward:true}),event('room-2','秘境宝箱',{treasure:25}),battle('room-3','秘境三室',['ranged','shield'],{reward:true}),{id:'room-4',index:3,type:'reward',name:'石壁传承',scene:'temple',enemies:[],reward:false},battle('room-5','秘境五室',['elite'],{reward:true}),event('room-6','秘境行商',{merchant:true,options:['heal','train','buy-potion','buy-tonic']}),{id:'room-7',index:6,type:'camp',name:'秘境营火',scene:'gate',enemies:[],reward:true},battle('room-8','秘境深处',['boss'],{coins:40})];break;
  case 'arena':route=[battle('arena-practice','本地论剑 · 镜像剑客',[routeEnemy('elite',{name:'演武剑客',hp:Math.ceil(150*hpScale),attack:Math.ceil(12*attackScale),shield:12})],{coins:25})];break;
  case 'bounty':route=[battle('bounty-trail','悬赏 · 追踪刀客',['ranged','melee'],{reward:true}),battle('bounty-capture','悬赏 · 擒获魁首',['elite','ranged'],{coins:40})];break;
  case 'escort':route=[battle('escort-1','押镖 · 林道',['melee','ranged'],{reward:true}),battle('escort-2','押镖 · 石桥',['shield','melee'],{reward:true}),battle('escort-3','押镖 · 山口',['elite','shield'],{coins:60})];break;
  case 'worldboss':route=[battle('world-boss','本地世界首领',[routeEnemy('boss',{name:'蚀月巨像',hp:Math.ceil(positive(worldBossHp,positive(loadout?.progression?.worldBossHp,content.economy?.worldBossHp||4000))),attack:12,heavyDamage:12,noSummon:true})],{coins:10})];break;
  case 'tournament':route=Array.from({length:4},(_,i)=>battle(`tournament-${i+1}`,`武林大会 · 第 ${i+1} 轮`,i===3?['boss']:i===2?['elite','shield']:i===1?['ranged','shield']:['melee'],{reward:i<3,coins:20+i*10}));break;
  case 'resource':route=[battle('resource-vault','资源挑战 · 铜钱傀儡',[routeEnemy('shield',{name:'聚宝傀儡',hp:100000,attack:2,shield:0,noSummon:true})],{coins:10})];break;
  case 'totem':route=[battle('totem-seal','图腾挑战 · 冰火护阵',[routeEnemy('elite',{name:'玄冰图腾',attack:8,shield:30}),routeEnemy('ranged',{name:'赤焰图腾',attack:12})],{coins:45,modifier:'冰火双阵'})];break;
 }
 if(mode==='totem'){const cycle=(Number(seed)>>>0)%3;const modifiers=['坚壳 · 护盾 +15','烈焰 · 攻击 +4','残阵 · 气血 -20%'];route[0].modifier=modifiers[cycle];for(const foe of route[0].enemies){if(cycle===0)foe.shield+=15;if(cycle===1)foe.attack+=4;if(cycle===2)foe.hp=Math.ceil(foe.hp*.8);}}
 route=route.map((node,index)=>({...node,index,hpScale,attackScale}));
 const r=createRun(build,seed,{runId:runId??`local-${mode}-${Number(seed)>>>0}`,loadout});
 Object.assign(r,{mode,chapter,floor:level,route,coins:0,bag:{potion:0,reroll:0,antidote:0,tonic:0,...copy(r.loadout?.bag||{})},consumed:{},settled:false,
  results:{completed:false,worldBossDamage:0,worldBossHp:mode==='worldboss'?route[0].enemies[0].hp:0,towerFloorCompleted:0},
  reward:copy(mode==='campaign'?chapterDef.reward:modeDef.reward),completedBattles:[]});
 if(mode==='tower'&&Number.isFinite(loadout?.progression?.towerHp)&&loadout.progression.towerHp>0)r.hero.hp=Math.min(r.hero.maxHp,loadout.progression.towerHp);
 return r;
}
/** In-run items consume only the expedition snapshot; profile settles consumed counts once. */
export function useRunItem(run,id){
 if(run.flow!=='battle'||run.combat?.phase!=='pick'||!['potion','reroll','antidote','tonic'].includes(id)||!(run.bag?.[id]>0)||run.hero.hp<=0)return run;
 if(id==='reroll'&&run.combat.rerolls>=6)return run;
 if(id==='potion'&&run.hero.hp>=run.hero.maxHp)return run;
 const r=copy(run);r.bag[id]--;r.consumed??={};r.consumed[id]=(r.consumed[id]||0)+1;
 if(id==='potion')r.hero.hp=Math.min(r.hero.maxHp,r.hero.hp+35);
 if(id==='reroll')r.combat.rerolls++;
 if(id==='antidote'){r.hero.hp=Math.min(r.hero.maxHp,r.hero.hp+15);r.hero.shield+=5;if(r.hero.poison)r.hero.poison={stacks:0,turns:0};}
 if(id==='tonic')r.hero.attack+=3;
 return r;
}
