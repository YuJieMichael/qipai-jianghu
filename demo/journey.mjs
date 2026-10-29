import {BALANCE,BUILDS,NODES} from './config.mjs';
import {startBattle} from './combat.mjs';
const copy=r=>structuredClone(r);
export function createChoices(run){
 if(run.choices.length)return run;
 const r=copy(run),slot=r.diceSkills.findIndex(s=>s===null),dieIndex=slot<0?0:slot;
 const builds=[r.build,...Object.keys(BUILDS).filter(b=>b!==r.build)];
 r.flow='reward';r.choices=builds.map(build=>{const old=r.diceSkills[dieIndex],level=old?.kind===build?old.level+1:1;return {id:`growth-${r.nodeIndex}-${r.stats.upgrades.length}-${build}`,title:`${BUILDS[build].name}·${slot<0?'精修':'传承'}`,description:`第 ${dieIndex+1} 颗骰子绑定${BUILDS[build].name}。${build===r.build?`本门领悟 ${Math.min(3,r.mastery)} → ${Math.min(3,r.mastery+1)}；三次解锁${BUILDS[build].ascension}。`:BUILDS[build].description}`,before:old?`${BUILDS[old.kind].name} ${old.level} 级`:'未绑定',after:`${BUILDS[build].name} ${level} 级`,build,dieIndex,kind:'skill'};});return r;
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
export function chooseUpgrade(run,id){
 if(run.flow!=='reward')return run;const choice=run.choices.find(c=>c.id===id);if(!choice)return run;
 const r=copy(run),old=r.diceSkills[choice.dieIndex];r.diceSkills[choice.dieIndex]={kind:choice.build,level:old?.kind===choice.build?old.level+1:1};
 r.upgrades[choice.build]=(r.upgrades[choice.build]||0)+1;r.stats.upgrades.push(id);
 if(choice.build===r.build)r.mastery++;
 r.ascended=r.mastery>=BALANCE.masteryThreshold;r.choices=[];
 if(r.nodeIndex===7){r.upgrades.campComplete=1;r.flow='camp';return r;}
 r.nodeIndex++;r.flow='intro';return enterNode(r);
}
export function chooseEvent(run,optionId){
 if(run.flow!=='event'||!['heal','train'].includes(optionId))return run;
 const r=copy(run);if(optionId==='heal')r.hero.hp=Math.min(r.hero.maxHp,r.hero.hp+BALANCE.eventHeal);else r.hero.attack+=3;
 r.nodeIndex++;r.flow='intro';return enterNode(r);
}
