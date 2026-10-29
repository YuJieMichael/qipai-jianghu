import {BALANCE,BUILDS,NODES,PERKS} from './config.mjs';
import {nextRandom} from './model.mjs';
import {startBattle} from './combat.mjs';
const copy=r=>structuredClone(r);
const validIndex = index => Number.isInteger(index)&&index>=0&&index<5;
const bound = (run,build) => run.diceSkills.some(skill=>skill?.kind===build);
const effect = (build,level,run) => build==='sword'?`每道剑气 ${BALANCE.swordDamage*level} 伤害`:build==='guard'?`护盾 ${BALANCE.guardShield*level} 点`:`附加 ${level+(run?.perks?.poisonCatalyst??0)*PERKS.poisonCatalyst.stacksPerRank} 层毒`;
const skillLabel = (skill,run) => skill?`${BUILDS[skill.kind].name} ${skill.level} 级 · ${effect(skill.kind,skill.level,run)}`:'未绑定';
const masteryLabel = (run,build) => `本门领悟 ${Math.min(BALANCE.masteryThreshold,run.mastery)} → ${Math.min(BALANCE.masteryThreshold,run.mastery+(build===run.build?1:0))}；${BALANCE.masteryThreshold} 次解锁${BUILDS[run.build].ascension}。`;
const details = (build,run) => {
 if(build==='sword')return '剑气贯穿全体敌人。';
 if(build==='guard')return '护盾抵挡敌人伤害。';
 const lingering=run.perks?.poisonLingering??0,catalyst=run.perks?.poisonCatalyst??0;
 const damage=BALANCE.poisonDamage+lingering*PERKS.poisonLingering.damagePerRank;
 const turns=BALANCE.poisonTurns+lingering*PERKS.poisonLingering.turnsPerRank;
 const threshold=Math.max(PERKS.poisonCatalyst.minThreshold,BALANCE.poisonThreshold-catalyst*PERKS.poisonCatalyst.thresholdReductionPerRank);
 return `每层毒每回合 ${damage} 伤害，持续 ${turns} 回合；升华后满 ${threshold} 层触发 ${BALANCE.poisonBurstDamage} 伤害毒爆，每次消耗 ${threshold} 层。`;
};

/** Pure display preview; a bind must always supply its target explicitly. */
export function previewUpgrade(run,id,index){
 const invalid=reason=>({valid:false,before:'',after:'',description:'',reason});
 const choice=run?.flow==='reward'&&run.choices.find(c=>c.id===id);
 if(!choice)return invalid('成长牌不可用');
 if(choice.kind==='perk'){
  const perk=PERKS[choice.perkId],rank=run.perks?.[choice.perkId];
  if(!perk||perk.build!==choice.build||!bound(run,perk.build))return invalid('需要至少一颗对应流派绑定骰');
  if(!Number.isInteger(rank)||rank<0||rank>=perk.maxRank)return invalid('分支已满级');
  return {valid:true,before:`${perk.name} ${rank} 级`,after:`${perk.name} ${rank+1} 级`,description:`${perk.description}${masteryLabel(run,choice.build)}`,reason:''};
 }
 if(!['bind','skill'].includes(choice.kind)||!BUILDS[choice.build])return invalid('成长牌不可用');
 if(!validIndex(index))return invalid('请选择目标骰子');
 const old=run.diceSkills[index],level=old?.kind===choice.build?old.level+1:1;
 return {valid:true,before:skillLabel(old,run),after:skillLabel({kind:choice.build,level},run),description:`第 ${index+1} 颗骰子：${BUILDS[choice.build].trigger}触发，${effect(choice.build,level,run)}。${details(choice.build,run)}${masteryLabel(run,choice.build)}`,reason:''};
}
export function createChoices(run){
 if(run.choices.length)return run;
 const r=copy(run),slot=r.diceSkills.findIndex(s=>s===null),dieIndex=slot<0?0:slot;
 r.flow='reward';r.pendingUpgrade=null;
 const prefix=`growth-${r.nodeIndex}-${r.stats.upgrades.length}`;
 const bind=build=>({id:`${prefix}-bind-${build}`,title:`${BUILDS[build].name}·${slot<0?'精修':'传承'}`,build,dieIndex,kind:'bind'});
 const perks=Object.values(PERKS).filter(p=>bound(r,p.build)&&(r.perks?.[p.id]??0)<p.maxRank).map(p=>({id:`${prefix}-perk-${p.id}`,title:p.name,build:p.build,perkId:p.id,kind:'perk',dieIndex}));
 const sample=pool=>{const random=nextRandom(r.seed);r.seed=random.seed;return pool[Math.floor(random.value*pool.length)];};
 const own=bind(r.build),ownPerks=perks.filter(p=>p.build===r.build);
 const pool=[...perks,...Object.keys(BUILDS).filter(b=>b!==r.build).map(bind)];
 const second=sample(ownPerks.length?ownPerks:pool);
 const third=sample(pool.filter(c=>c.id!==second.id));
 r.choices=[own,second,third];
 r.choices=r.choices.map(c=>{const p=previewUpgrade(r,c.id,c.dieIndex);return {...c,before:p.before,after:p.after,description:p.description};});
 return r;
}
export function selectUpgrade(run,id){
 if(run.flow!=='reward'||!run.choices.some(c=>c.id===id))return run;
 const r=copy(run);r.pendingUpgrade={choiceId:id,dieIndex:null};return r;
}
export function selectUpgradeTarget(run,index){
 if(!validIndex(index)||!run.pendingUpgrade||run.flow!=='reward')return run;
 const choice=run.choices.find(c=>c.id===run.pendingUpgrade.choiceId);
 if(!choice||choice.kind==='perk')return run;
 const r=copy(run);r.pendingUpgrade.dieIndex=index;return r;
}
export function cancelUpgrade(run){
 if(!run.pendingUpgrade)return run;
 const r=copy(run);r.pendingUpgrade=null;return r;
}
export function enterNode(run){
 const node=NODES[run.nodeIndex];if(!node)return run;
 if(run.flow==='battle'&&run.combat)return run;
 if(run.flow==='reward'&&run.choices.length)return run;
 if(node.type==='battle')return startBattle(run,node);
 const r=copy(run);r.combat=null;
 if(node.type==='event'){r.flow='event';return r;}
 if(node.type==='camp'){
  if(r.upgrades.campComplete){r.flow='camp';return r;}
  if(!r.upgrades.campHealed){r.hero.hp=Math.min(r.hero.maxHp,r.hero.hp+BALANCE.campHeal);r.upgrades.campHealed=1;}
 }
 return createChoices(r);
}
export function completeBattle(run){
 if(run.flow!=='battle'||!run.combat)return run;
 if(run.hero.hp>0&&run.combat.enemies.some(e=>e.hp>0))return run;
 const r=copy(run);r.choices=[];
 if(r.hero.hp<=0){r.flow='defeat';return r;}
 if(r.nodeIndex===8){r.flow='victory';return r;}
 if(r.nodeIndex===0||r.nodeIndex===4)r.nodeIndex++;
 r.combat=null;return createChoices(r);
}
export function advanceNode(run){
 if(run.flow!=='camp'||!run.upgrades.campComplete)return run;
 const r=copy(run);r.nodeIndex++;r.flow='intro';return enterNode(r);
}
export function chooseUpgrade(run,id,index){
 if(run.flow!=='reward')return run;
 const choice=run.choices.find(c=>c.id===id);if(!choice)return run;
 // Pending selections require their own explicit target; legacy callers retain suggested-slot fallback.
 if(run.pendingUpgrade&&run.pendingUpgrade.choiceId!==id)return run;
 const dieIndex=run.pendingUpgrade?run.pendingUpgrade.dieIndex:(index===undefined?choice.dieIndex:index);
 const preview=previewUpgrade(run,id,dieIndex);
 if(!preview.valid)return run;
 const r=copy(run);
 if(choice.kind==='perk')r.perks[choice.perkId]++;
 else {const old=r.diceSkills[dieIndex];r.diceSkills[dieIndex]={kind:choice.build,level:old?.kind===choice.build?old.level+1:1};}
 r.upgrades[choice.build]=(r.upgrades[choice.build]||0)+1;r.stats.upgrades.push(id);
 r.stats.upgradeHistory??=[];
 r.stats.upgradeHistory.push({id,title:choice.title,build:choice.build,kind:choice.kind==='perk'?'perk':'bind',dieIndex:choice.kind==='perk'?null:dieIndex,perkId:choice.perkId??null,before:preview.before,after:preview.after});
 if(choice.build===r.build)r.mastery++;
 r.ascended=r.mastery>=BALANCE.masteryThreshold;r.choices=[];r.pendingUpgrade=null;
 if(r.nodeIndex===7){r.upgrades.campComplete=1;r.flow='camp';return r;}
 r.nodeIndex++;r.flow='intro';return enterNode(r);
}
export function chooseEvent(run,optionId){
 if(run.flow!=='event'||!['heal','train'].includes(optionId))return run;
 const r=copy(run);if(optionId==='heal')r.hero.hp=Math.min(r.hero.maxHp,r.hero.hp+BALANCE.eventHeal);else r.hero.attack+=3;
 r.nodeIndex++;r.flow='intro';return enterNode(r);
}
