import {nextRandom} from './model.mjs';
export const ROGUE_DEFAULTS={rarityWeights:{common:60,fine:27,rare:11,epic:2},refreshCost:10,maxRefresh:2,maxBans:2,prerequisites:{swordEcho:{perkId:'swordFocus',rank:1},poisonCatalyst:{perkId:'poisonLingering',rank:1},guardRiposte:{perkId:'guardBulwark',rank:1}}};
export const ENCOUNTER_DEFAULTS={choices:[{id:'safe',title:'守心调息',description:'回复 35 气血。',heal:35},{id:'blood-oath',title:'歃血取力',description:'失去 18 气血，攻击 +5；后续敌人攻击 +2，铜钱收益 +20%。',hpCost:18,attack:5,curseId:'blood-oath',goldBonus:20}],curseRules:{'blood-oath':{enemyAttack:2}}};
const copy=structuredClone;
export function draw(run){const next=nextRandom(run.seed);run.seed=next.seed;return next.value;}
export function weighted(run,weights){const entries=Object.entries(weights).filter(([,w])=>Number.isFinite(w)&&w>0),total=entries.reduce((n,[,w])=>n+w,0);let value=draw(run)*total;for(const [id,w]of entries){value-=w;if(value<0)return id;}return entries.at(-1)?.[0]||'common';}
export const choiceKey=c=>c.kind==='perk'?`perk:${c.perkId}`:`bind:${c.build}`;
export function initializeRogue(run,content){
 const expansion=copy(content.expansion);run.expeditionContent={expansion,equipment:copy(content.equipment||[]),skills:copy(content.skills||[]),relics:copy(content.relics||[]),decorations:copy(content.decorations||[])};
 run.rogue={rules:{...copy(ROGUE_DEFAULTS),...copy(expansion.rogue||{})},banned:[],refreshes:0,branches:[],curses:[],purchases:[],goldBonus:0};run.loot=[];
 for(const node of run.route){
  if(node.merchant)node.inventory=[{id:'skill',kind:'skill',title:'武学秘籍',description:'加入局内武学，满足条件自动施展。',price:25,definition:copy(content.skills?.[0])},{id:'relic',kind:'relic',title:'随行遗物',description:'携带遗物，牌型满足时追加伤害。',price:30,definition:copy(content.relics?.[0])},{id:'decoration',kind:'decoration',title:'护骰守纹',description:'第一颗骰子附守纹，每轮增加护盾。',price:20,definition:copy(content.decorations?.find(d=>d.id==='guard')||content.decorations?.[1])}].filter(i=>i.definition);
  if(node.encounter)node.encounterChoices=copy(expansion.encounters?.choices?.length?expansion.encounters.choices:ENCOUNTER_DEFAULTS.choices);
  for(const e of node.enemies){
   if(e.kind==='elite'){e.affix=node.eliteAffix||['fierce','armored','vampiric'][(Number(run.seed)+node.index)%3];if(e.affix==='fierce')e.attack+=4;if(e.affix==='armored')e.shield+=20;}
   if(e.kind==='boss'){e.mechanic??=['assault','ward','ritual'][node.index%3];e.noSummon=true;}
  }
 }
}
export function addBattleLoot(run,node){
 const config=run.expeditionContent,loot=config?.expansion?.loot;if(!loot||!config.equipment.length)return;
 const boss=node.enemies.some(e=>e.kind==='boss'),chance=boss?(loot.bossChance??1):(loot.chance??.32);
 if(draw(run)>=chance)return;
 const exclusive=boss&&loot.bossExclusive?.[run.chapter];let template=config.equipment.find(e=>e.id===exclusive);
 if(!template){const rarity=weighted(run,loot.rarityWeights||{common:1});const pool=config.equipment.filter(e=>e.rarity===rarity);const entries=pool.length?pool:config.equipment;template=entries[Math.floor(draw(run)*entries.length)];}
 const affixes=[],pool=config.expansion.affixes||[],count=Math.min(new Set(pool.map(entry=>entry.key)).size,loot.affixCount?.[template.rarity]??1);let remaining=[...pool];
 for(let i=0;i<count;i++){const index=Math.floor(draw(run)*remaining.length),entry=remaining[index];remaining=remaining.filter(candidate=>candidate.key!==entry.key);affixes.push({key:entry.key,value:Math.floor(entry.min+draw(run)*(entry.max-entry.min+1))});}
 run.loot??=[];run.loot.push({id:`loot-${run.runId}-${node.id}-${run.loot.length}`,templateId:template.id,affixes,source:boss?'boss':node.enemies.some(e=>e.kind==='elite')?'elite':'battle'});
}
export function curseAttack(run){const rules=run.expeditionContent?.expansion?.encounters?.curseRules||ENCOUNTER_DEFAULTS.curseRules;return (run.rogue?.curses||[]).reduce((sum,id)=>sum+(Number(rules[id]?.enemyAttack)||0),0);}
