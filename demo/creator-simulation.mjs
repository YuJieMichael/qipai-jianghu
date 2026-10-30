import {getContent} from './content.mjs';
import {deriveLoadout} from './profile.mjs';
import {createExpedition} from './adventures.mjs';
import {rollDice,toggleHold,rerollDice} from './model.mjs';
import {prepareRound,selectTarget,resolveRound} from './combat.mjs';
import {enterNode,completeBattle,chooseUpgrade,chooseEvent,advanceNode,getJourneyOptions,chooseBranch,chooseEncounter,chooseMerchant} from './journey.mjs';
import {migrateRun} from './storage.mjs';
/** A bounded diagnostic using the real reducers, with no storage or profile side effects. */
export function simulateConfiguration(profile,{build='sword',mode='boss',chapter='bamboo',count=3}={}){
 if(!Number.isInteger(count)||count<1||count>10)throw Error('模拟局数须为 1–10。');
 const content=getContent(profile);if(!['sword','poison','guard'].includes(build)||!content.modes.some(r=>r.id===mode)||!content.chapters.some(r=>r.id===chapter))throw Error('模拟配置无效。');
 const records=[];
 for(let seed=1;seed<=count;seed++){
  let run=enterNode(createExpedition(build,seed,{runId:`simulation-${seed}`,loadout:deriveLoadout(profile),mode,chapter,content})),steps=0;
  while(!['victory','defeat'].includes(run.flow)){
   if(++steps>2000)throw Error('模拟未能在限定步数内结束。');
   if(!migrateRun(run))throw Error(`模拟保存边界无效：${run.flow}`);
   const before=run;
   if(run.flow==='battle'){
    if(run.combat.phase==='resolved')run=prepareRound(run);run=rollDice(run);
    while(run.combat.rerolls>0){for(let i=0;i<5;i++){if(run.combat.frozen?.[i])continue;const kind=run.diceSkills[i]?.kind||build,v=run.combat.dice[i],keep=kind==='sword'?v>=4:kind==='poison'?v%2===1:v<=3;if(run.combat.held[i]!==keep)run=toggleHold(run,i);}if(run.combat.held.every(Boolean))break;const next=rerollDice(run);if(next===run)break;run=next;}
    const target=[...run.combat.enemies].filter(e=>e.hp>0).sort((a,b)=>a.hp-b.hp)[0];if(target)run=selectTarget(run,target.id);run=completeBattle(resolveRound(run).state);
   }else if(run.flow==='reward'){const choice=run.choices.find(c=>c.build===build&&c.kind==='bind')||run.choices[0];const empty=run.diceSkills.findIndex(s=>s===null);run=chooseUpgrade(run,choice.id,empty>=0?empty:0);}
   else if(run.flow==='event'){const view=getJourneyOptions(run);run=view.kind==='branch'?chooseBranch(run,0):view.kind==='merchant'?chooseMerchant(run,'leave'):view.kind==='encounter'?chooseEncounter(run,view.choices.find(c=>!c.disabled)?.id):chooseEvent(run,'heal');}
   else if(run.flow==='camp')run=enterNode(advanceNode(run));else run=enterNode(run);
   if(run===before)throw Error('模拟流程没有继续推进。');
  }
  if(!migrateRun(run))throw Error('模拟终局存档校验失败。');
  records.push({种子:seed,结果:run.flow==='victory'?'通关':'战败',回合:run.stats.turns,气血:run.hero.hp,伤害:run.stats.damage,掉落:run.loot?.length||0});
 }
 return {局数:count,通关:records.filter(r=>r.结果==='通关').length,战败:records.filter(r=>r.结果==='战败').length,平均回合:Number((records.reduce((n,r)=>n+r.回合,0)/count).toFixed(1)),详情:records};
}
