import {BALANCE,BUILDS,NODES,PERKS} from './config.mjs';
import {nextRandom} from './model.mjs';
import {startBattle} from './combat.mjs';
import {draw,weighted,choiceKey,addBattleLoot} from './rogue.mjs';
const copy=r=>structuredClone(r);
export const getRunNodes=run=>run?.route||NODES;
export const getRunNode=run=>getRunNodes(run)[run.nodeIndex];
const campKey=(run,key)=>run.route?`${key}-${run.nodeIndex}`:key;
const gainCoins=(run,amount)=>{run.coins=(run.coins||0)+Math.floor(amount*(1+Math.max(0,(Number(run.loadout?.effects?.goldBonus)||0)+(run.rogue?.goldBonus||0))/100));};
const validIndex = index => Number.isInteger(index)&&index>=0&&index<5;
const bound = (run,build) => run.diceSkills.some(skill=>skill?.kind===build);
const effect = (build,level,run) => build==='sword'?`每道剑气 ${BALANCE.swordDamage*level} 伤害`:build==='guard'?`护盾 ${BALANCE.guardShield*level+(run?.perks?.guardBulwark??0)*PERKS.guardBulwark.shieldPerRank} 点`:`附加 ${level+(run?.perks?.poisonCatalyst??0)*PERKS.poisonCatalyst.stacksPerRank} 层毒`;
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
 const prerequisites=r.rogue?.rules?.prerequisites||{};
 const perks=Object.values(PERKS).filter(p=>(!prerequisites[p.id]||(r.perks[prerequisites[p.id].perkId]||0)>=prerequisites[p.id].rank)&&bound(r,p.build)&&(r.perks?.[p.id]??0)<p.maxRank).map(p=>({id:`${prefix}-perk-${p.id}`,title:p.name,build:p.build,perkId:p.id,kind:'perk',dieIndex}));
 const sample=pool=>{const random=nextRandom(r.seed);r.seed=random.seed;return pool[Math.floor(random.value*pool.length)];};
 const own=bind(r.build),ownPerks=perks.filter(p=>p.build===r.build);
 const pool=[...perks,...Object.keys(BUILDS).filter(b=>b!==r.build).map(bind)];
 const second=sample(ownPerks.length?ownPerks:pool);
 const third=sample(pool.filter(c=>c.id!==second.id));
 r.choices=[own,second,third];
 if(r.rogue){
  const candidates=[...Object.keys(BUILDS).map(bind),...perks].filter(c=>!r.rogue.banned.includes(choiceKey(c)));
  r.choices=[];
  const guaranteed=candidates.find(c=>c.kind==='bind'&&c.build===r.build);if(guaranteed){r.choices.push({...guaranteed,rarity:'common'});candidates.splice(candidates.indexOf(guaranteed),1);}
  while(r.choices.length<3&&candidates.length){
   const scored=candidates.map(c=>({...c,rarity:c.kind==='perk'?(c.perkId.endsWith('Echo')||c.perkId.endsWith('Catalyst')||c.perkId.endsWith('Riposte')?'epic':'rare'):'common'}));
   const available=Object.fromEntries(Object.entries(r.rogue.rules.rarityWeights).filter(([key])=>scored.some(c=>c.rarity===key)));
   const rarity=weighted(r,available),pool=scored.filter(c=>c.rarity===rarity);const choice=(pool.length?pool:scored)[Math.floor(draw(r)*(pool.length||scored.length))];r.choices.push(choice);candidates.splice(candidates.findIndex(c=>c.id===choice.id),1);
  }
 }
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
 const node=getRunNode(run);if(!node)return run;
 if(run.flow==='battle'&&run.combat)return run;
 if(run.flow==='reward'&&run.choices.length)return run;
 if(node.type==='battle')return startBattle(run,node);
 const r=copy(run);r.combat=null;
 if(node.type==='event'){if(node.treasure&&!r.upgrades[`treasure-${r.nodeIndex}`]){gainCoins(r,node.treasure);r.upgrades[`treasure-${r.nodeIndex}`]=1;}r.flow='event';return r;}
 if(node.type==='camp'){
  if(r.upgrades[campKey(r,'campComplete')]){r.flow='camp';return r;}
  if(!r.upgrades[campKey(r,'campHealed')]){r.hero.hp=Math.min(r.hero.maxHp,r.hero.hp+BALANCE.campHeal);r.upgrades[campKey(r,'campHealed')]=1;}
 }
 return createChoices(r);
}
export function completeBattle(run){
 if(run.flow!=='battle'||!run.combat)return run;
 if(run.hero.hp>0&&run.combat.enemies.some(e=>e.hp>0)&&!run.combat.timedOut)return run;
 const r=copy(run);r.choices=[];
 if(r.route){
  const node=getRunNode(r),remaining=r.combat.enemies.filter(e=>e.hp>0);
  r.results??={completed:false,worldBossDamage:0,worldBossHp:0,towerFloorCompleted:0};
  if(r.mode==='worldboss'){const boss=r.combat.enemies[0];r.results.worldBossDamage=boss.maxHp-boss.hp;r.results.worldBossHp=boss.hp;}
  const partial=['resource','worldboss'].includes(r.mode);
  if(r.hero.hp<=0||(remaining.length&&!partial)){r.flow='defeat';return r;}
  r.completedBattles??=[];
  if(!r.completedBattles.includes(node.id)){
   r.completedBattles.push(node.id);if(!remaining.length)addBattleLoot(r,node);gainCoins(r,(node.coins||0)+(r.mode==='resource'?Math.floor(r.stats.damage/8):r.mode==='worldboss'?Math.floor(r.results.worldBossDamage/10):0));
  }
  if(r.nodeIndex===r.route.length-1){r.flow='victory';r.results.completed=true;if(r.mode==='tower')r.results.towerFloorCompleted=r.floor;return r;}
  r.combat=null;
  if(r.route[r.nodeIndex+1].type==='reward'){r.nodeIndex++;return enterNode(r);}
  if(node.reward)return createChoices(r);
  r.nodeIndex++;r.flow='intro';return enterNode(r);
 }
 if(r.hero.hp<=0){r.flow='defeat';return r;}
 if(r.nodeIndex===8){r.flow='victory';return r;}
 if(r.nodeIndex===0||r.nodeIndex===4)r.nodeIndex++;
 r.combat=null;return createChoices(r);
}
export function advanceNode(run){
 if(run.flow!=='camp'||!run.upgrades[campKey(run,'campComplete')])return run;
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
 if((r.route&&getRunNode(r).type==='camp')||(!r.route&&r.nodeIndex===7)){r.upgrades[campKey(r,'campComplete')]=1;r.flow='camp';return r;}
 r.nodeIndex++;r.flow='intro';return enterNode(r);
}
export function chooseEvent(run,optionId){
 if(run.flow==='event'&&getRunNode(run)?.branchChoices)return chooseBranch(run,['heal','train'].includes(optionId)?0:getRunNode(run).branchChoices.findIndex(c=>c.id===optionId));
 if(run.flow==='event'&&getRunNode(run)?.encounter)return chooseEncounter(run,['heal','train'].includes(optionId)?(getRunNode(run).encounterChoices?.find(c=>!c.hpCost)?.id):optionId);
 if(run.flow==='event'&&getRunNode(run)?.merchant&&run.rogue&&!['heal','train','buy-potion','buy-tonic'].includes(optionId))return chooseMerchant(run,optionId);
 if(run.flow!=='event'||!['heal','train','buy-potion','buy-tonic'].includes(optionId))return run;
 const node=getRunNode(run),purchase=optionId.startsWith('buy-'),price=optionId==='buy-potion'?20:30;
 if(purchase&&(!node.merchant||(run.coins||0)<price))return run;
 const r=copy(run);if(purchase){r.coins-=price;r.bag??={};const item=optionId.slice(4);r.bag[item]=(r.bag[item]||0)+1;}else if(optionId==='heal')r.hero.hp=Math.min(r.hero.maxHp,r.hero.hp+BALANCE.eventHeal);else r.hero.attack+=3;
 r.nodeIndex++;r.flow='intro';return enterNode(r);
}

/** Normalized display descriptors; reading them never changes the seed. */
export function getJourneyOptions(run){
 const node=getRunNode(run),base={kind:'none',title:node?.name||'',description:node?.description||'',choices:[],refresh:{available:false,cost:0,remaining:0},bans:{remaining:0}};
 if(run.flow==='reward')return {...base,kind:'growth',choices:run.choices.map(c=>({...c})),refresh:{available:!!run.rogue&&run.rogue.refreshes<run.rogue.rules.maxRefresh&&(run.coins||0)>=run.rogue.rules.refreshCost,cost:run.rogue?.rules.refreshCost||0,remaining:Math.max(0,(run.rogue?.rules.maxRefresh||0)-(run.rogue?.refreshes||0))},bans:{remaining:Math.max(0,(run.rogue?.rules.maxBans||0)-(run.rogue?.banned.length||0))}};
 if(run.flow!=='event')return base;
 if(node.branchChoices)return {...base,kind:'branch',choices:node.branchChoices.map(c=>({...c}))};
 if(node.encounter)return {...base,kind:'encounter',choices:(node.encounterChoices||[]).map(c=>({...c,title:c.title||c.id,description:c.description||'',disabled:run.hero.hp<=(c.hpCost||0)||(run.coins||0)<(c.coinCost||0),reason:run.hero.hp<=(c.hpCost||0)?'气血不足':(run.coins||0)<(c.coinCost||0)?'铜钱不足':''}))};
 if(node.merchant&&run.rogue)return {...base,kind:'merchant',choices:[...(node.inventory||[]).map(c=>({...c,disabled:run.rogue.purchases.includes(`${node.id}:${c.id}`)||(run.coins||0)<c.price,reason:run.rogue.purchases.includes(`${node.id}:${c.id}`)?'已购':(run.coins||0)<c.price?'铜钱不足':''})),{id:'leave',title:'离开行商',description:'继续前行。'}]};
 return {...base,kind:'legacy',choices:[{id:'heal',title:'回复气血',description:'回复35气血'},{id:'train',title:'磨练武艺',description:'攻击+3'}]};
}
export function refreshChoices(run){
 if(run.flow!=='reward'||!run.rogue||run.rogue.refreshes>=run.rogue.rules.maxRefresh||(run.coins||0)<run.rogue.rules.refreshCost)return run;
 const r=copy(run);r.coins-=r.rogue.rules.refreshCost;r.rogue.refreshes++;r.choices=[];r.pendingUpgrade=null;return createChoices(r);
}
export function banChoice(run,id){
 const choice=run.choices?.find(c=>c.id===id);if(run.flow!=='reward'||!run.rogue||!choice||run.rogue.banned.length>=run.rogue.rules.maxBans)return run;
 // Keep at least three selectable branches after a ban.
 const key=choiceKey(choice),r=copy(run);r.rogue.banned.push(key);r.choices=[];r.pendingUpgrade=null;const next=createChoices(r);return next.choices.length===3?next:run;
}
const leaveEvent=r=>{r.nodeIndex++;r.flow='intro';return enterNode(r);};
export function chooseBranch(run,index){
 const node=getRunNode(run),choice=node?.branchChoices?.[index];if(run.flow!=='event'||!run.rogue||!Number.isInteger(index)||!choice)return run;
 const r=copy(run),next=r.route.slice(r.nodeIndex+1).find(n=>n.type==='battle');if(!next)return run;
 for(const e of next.enemies){e.hp=Math.ceil(e.hp*(choice.hpScale||1));e.attack=Math.ceil(e.attack*(choice.attackScale||1));e.heavyDamage=Math.ceil(e.heavyDamage*(choice.attackScale||1));}
 next.coins=(next.coins||0)+(choice.coins||0);r.rogue.branches.push({nodeId:node.id,choiceId:choice.id});return leaveEvent(r);
}
export function chooseEncounter(run,id){
 const node=getRunNode(run),choice=node?.encounterChoices?.find(c=>c.id===id);if(run.flow!=='event'||!run.rogue||!node.encounter||!choice||run.hero.hp<=(choice.hpCost||0)||(run.coins||0)<(choice.coinCost||0))return run;
 const r=copy(run);r.hero.hp-=choice.hpCost||0;r.coins-=choice.coinCost||0;r.hero.hp=Math.min(r.hero.maxHp,r.hero.hp+(choice.heal||0));r.hero.attack+=choice.attack||0;r.coins+=choice.coins||0;r.rogue.goldBonus+=choice.goldBonus||0;if(choice.curseId&&!r.rogue.curses.includes(choice.curseId))r.rogue.curses.push(choice.curseId);return leaveEvent(r);
}
export function chooseMerchant(run,id){
 const node=getRunNode(run);if(run.flow!=='event'||!node?.merchant||!run.rogue)return run;
 if(id==='leave')return leaveEvent(copy(run));
 const item=node.inventory?.find(i=>i.id===id),key=`${node.id}:${id}`;if(!item||run.rogue.purchases.includes(key)||(run.coins||0)<item.price)return run;
 const r=copy(run);r.loadout??={effects:{}};
 if(item.kind==='skill'){r.loadout.skills??=[];if(r.loadout.skills.length>=4)return run;r.loadout.skills.push(copy(item.definition));}
 else if(item.kind==='relic'){r.loadout.relics??=[];if(r.loadout.relics.length>=3)return run;r.loadout.relics.push(copy(item.definition));}
 else if(item.kind==='decoration'){r.loadout.dice??=Array.from({length:5},()=>({faces:[1,2,3,4,5,6],marks:Array(6).fill(null),materialId:'wood',materialLevel:1,decorationId:'plain'}));r.loadout.dice[0].decorationId=item.definition.id;}
 else return run;
 r.coins-=item.price;r.rogue.purchases.push(key);return r;
}
