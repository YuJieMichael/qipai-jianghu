import {newAdventure,act,validateAdventure} from '../demo/renewal/model.mjs';
import {newCampaign,beginCampaignRun,awardBattle,getCampaignLoadout,campaignAction} from '../demo/renewal/campaign.mjs';
const totals=[];
for(const chapterId of [1,2]){
 const result={chapterId,runs:160,clears:0,losses:0,actions:0,bossPhases:0,interrupts:0,minHp:1e6,maxActions:0};
 for(let seed=1;seed<=result.runs;seed++){
  let c=newCampaign(seed);if(chapterId===2)c.unlockedChapter=2;
  const started=beginCampaignRun(c,chapterId);c=started.campaign;
  let s=act(newAdventure(seed,{chapterId,runId:started.runId,loadout:getCampaignLoadout(c)}),{type:'begin'}).state,n=0;
  while(!['won','lost'].includes(s.phase)&&n++<400){
   if(!validateAdventure(s))throw Error(`invalid ${chapterId}:${seed}:${n}`);
   let action;
   if(s.phase==='reward'){
    c=awardBattle(c,{runId:s.runId,chapterId,stage:s.stage,won:true}).campaign;
    for(const item of c.inventory){
     const trial=campaignAction(c,{type:'equip',uid:item.uid});
     const a=getCampaignLoadout(c),b=getCampaignLoadout(trial.campaign);
     if(b.attack+b.armor*2+b.maxHp/8+b.sword+b.guard/2>a.attack+a.armor*2+a.maxHp/8+a.sword+a.guard/2)c=trial.campaign;
    }
    const choice=s.choices.find(c=>c.kind==='vitality'&&s.hero.hp<s.hero.maxHp*.6)??s.choices.find(c=>c.kind==='sword')??s.choices.find(c=>c.kind==='guard')??s.choices[0];
    const idx=choice.kind==='sword'?s.dice.findIndex(d=>d.unlocked&&d.skill==='sword'):s.dice.findIndex(d=>d.unlocked&&!d.skill);
    action={type:'choose',choiceId:choice.id,index:idx<0?0:idx,loadout:getCampaignLoadout(c)};
   }else if(s.rerolls>0){
    const candidates=s.dice.map((d,i)=>({d,i})).filter(v=>v.d.unlocked);candidates.sort((a,b)=>a.d.value-b.d.value);action={type:'reroll',index:candidates[0].i};
   }else action={type:'attack'};
   const step=act(s,action);if(step.state===s)throw Error(`stuck ${chapterId}:${seed}:${JSON.stringify(action)}`);
   result.bossPhases+=step.events.filter(e=>e.type==='phase').length;result.interrupts+=step.events.filter(e=>e.type==='intent'&&/打断/.test(e.text)).length;s=step.state;
  }
  if(!validateAdventure(s))throw Error('invalid final');
  result.clears+=s.phase==='won';result.losses+=s.phase==='lost';result.actions+=n;result.maxActions=Math.max(result.maxActions,n);result.minHp=Math.min(result.minHp,s.hero.hp);
 }
 result.meanActions=+(result.actions/result.runs).toFixed(1);totals.push(result);
}
console.log(JSON.stringify({rule:'Auto-roll/reroll charge only; attack resolves damage. Greedy original equipment; 160 seeded runs/chapter.',totals},null,2));
if(totals.some(r=>r.clears+r.losses!==r.runs))process.exitCode=1;
