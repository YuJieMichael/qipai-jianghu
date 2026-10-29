import {BALANCE,ENEMY_TYPES,PERKS} from './config.mjs';
import {evaluateDice} from './model.mjs';
const clone=x=>structuredClone(x);
const alive=e=>e.hp>0;
const live=r=>r.combat.enemies.filter(alive);
const rank=(r,id)=>r.perks?.[id]??0;
function enemy(kind,id){
 const t=ENEMY_TYPES[kind];if(!t)throw new RangeError('Unknown enemy');
 return {id,kind,name:t.name,hp:t.hp,maxHp:t.hp,shield:t.shield,poison:{stacks:0,turns:0},stance:t.stance,phase:1,intent:{kind:'attack',damage:t.attack,label:'进攻'},summoned:false};
}
function intents(r){
 for(const e of live(r)){
  const heavy=e.kind==='boss'&&r.combat.round%2===0;
  if(heavy)e.stance=BALANCE.bossStance;
  e.intent={kind:heavy?'heavy':'attack',damage:heavy?BALANCE.bossHeavyDamage:ENEMY_TYPES[e.kind].attack,label:heavy?'蓄力重击':'进攻'};
 }
}
export function startBattle(run,node){
 const r=clone(run);r.flow='battle';r.choices=[];r.pendingUpgrade=null;r.hero.shield=0;
 r.combat={round:1,swordArrayUsed:false,phase:'roll',dice:[0,0,0,0,0],held:[false,false,false,false,false],rerolls:BALANCE.rerolls,enemies:node.enemies.map((k,i)=>enemy(k,`${node.id||'battle'}-${i}`)),targetId:''};
 r.combat.targetId=live(r)[0]?.id||'';intents(r);return r;
}
export function selectTarget(run,id){
 if(run.flow!=='battle'||!run.combat?.enemies.some(e=>e.id===id&&alive(e))||run.combat.phase==='resolved')return run;
 const r=clone(run);r.combat.targetId=id;return r;
}
function target(r){return live(r).find(e=>e.id===r.combat.targetId)||live(r)[0];}
const triggers=r=>r.diceSkills.flatMap((s,i)=>s&&((s.kind==='sword'&&r.combat.dice[i]>=4)||(s.kind==='poison'&&r.combat.dice[i]%2===1)||(s.kind==='guard'&&r.combat.dice[i]>=1&&r.combat.dice[i]<=3))?[{...s,dieIndex:i}]:[]);
export function previewAttack(run){
 const combo=evaluateDice(run.combat?.dice),e=run.combat&&target(run);
 let forecast=null,effects=[];
 if(run.flow==='battle'&&run.combat?.phase==='pick'){
  const {state,events}=resolveRound(run);
  forecast={totalDamage:state.stats.damage-run.stats.damage,poisonDamage:state.stats.poisonDamage-run.stats.poisonDamage,blocked:state.stats.blocked-run.stats.blocked,heroHpAfter:state.hero.hp,heroShieldAfter:state.hero.shield,enemies:state.combat.enemies.map(foe=>({id:foe.id,name:foe.name,hpAfter:foe.hp,shieldAfter:foe.shield,poisonStacksAfter:foe.poison.stacks,poisonTurnsAfter:foe.poison.turns}))};
  effects=events.map(({type,text,value,build,sourceId,targetIds,dieIndex})=>({type,text,value,build,sourceId,targetIds,...(dieIndex===undefined?{}:{dieIndex})}));
 }
 return {combo,directDamage:e?Math.min(e.hp,Math.max(0,Math.floor(run.hero.attack*combo.multiplier)-e.shield)):0,triggers:run.combat?triggers(run):[],enemyIntents:run.combat?live(run).map(e=>({id:e.id,...e.intent})):[],forecast,effects};
}
export function prepareRound(run){
 if(run.flow!=='battle'||run.combat?.phase!=='resolved'||!run.hero.hp||!live(run).length)return run;
 const r=clone(run);r.combat.round++;r.combat.phase='roll';r.combat.dice=[0,0,0,0,0];r.combat.held=[false,false,false,false,false];r.combat.rerolls=BALANCE.rerolls;r.combat.targetId=target(r)?.id||'';intents(r);return r;
}
export function resolveRound(run){
 if(run.flow!=='battle'||run.combat?.phase!=='pick')return {state:run,events:[]};
 const r=clone(run),events=[],announcedEnemies=[...live(r)];r.combat.phase='resolved';r.stats.turns++;
 const emit=(type,sourceId,targetIds,value,text,build=r.build,dieIndex)=>events.push({id:`${r.nodeIndex}-${r.combat.round}-${events.length}`,type,sourceId,targetIds,value,build,text,...(dieIndex===undefined?{}:{dieIndex}),snapshot:clone(r)});
 const phase=e=>{
  if(e.kind==='boss'&&e.hp>0&&e.hp<=e.maxHp/2&&!e.summoned){
   e.phase=2;e.summoned=true;r.combat.enemies.push(enemy('melee',`${e.id}-aid-1`),enemy('ranged',`${e.id}-aid-2`));emit('phase',e.id,[e.id],0,'守将召来援手');
  }
 };
 const labels={sword:'剑气贯阵',swordFocus:'凝锋',swordEcho:'回响剑阵',swordArray:'万剑归宗',counter:'金刚反击',burst:'毒爆',poisonTick:'毒伤'};
 const hit=(e,amount,type,source='hero',label='',build=r.build,dieIndex)=>{
  if(!alive(e))return;
  const absorbed=Math.min(e.shield,amount);e.shield-=absorbed;
  const hp=Math.min(e.hp,Math.max(0,amount-absorbed));e.hp-=hp;r.stats.damage+=hp;
  if(type==='poisonTick')r.stats.poisonDamage+=hp;
  if(e.stance>0&&hp>0){e.stance=Math.max(0,e.stance-hp);if(e.stance===0&&e.intent.kind==='heavy')e.intent={kind:'stunned',damage:0,label:'破势失衡'};}
  emit(type,source,[e.id],hp,label||labels[type]||'出招',build,dieIndex);
  if(!alive(e)){r.stats.kills++;emit('death',source,[e.id],0,'敌人倒下',build);}
  phase(e);
 };
 const e=target(r);
 if(e){emit('windup','hero',[e.id],0,'凝神出招');hit(e,Math.floor(r.hero.attack*evaluateDice(r.combat.dice).multiplier),'strike');}
 let swordCount=0;
 for(const s of triggers(r)){
  const level=s.level||1;
  if(s.kind==='sword'){
   swordCount++;
   for(const foe of [...live(r)])hit(foe,BALANCE.swordDamage*level,'sword','hero','','sword',s.dieIndex);
   const focus=rank(r,'swordFocus')*PERKS.swordFocus.damagePerRank,foe=target(r);
   if(focus&&foe)hit(foe,focus,'swordFocus','hero','','sword',s.dieIndex);
   const echo=rank(r,'swordEcho')*PERKS.swordEcho.damagePerRank;
   if(echo&&swordCount%2===0)for(const foe of [...live(r)])hit(foe,echo,'swordEcho','hero','','sword',s.dieIndex);
  }else if(s.kind==='guard'){
   const gain=BALANCE.guardShield*level+rank(r,'guardBulwark')*PERKS.guardBulwark.shieldPerRank;
   r.hero.shield+=gain;emit('shield','hero',['hero'],gain,'金刚护体','guard',s.dieIndex);
  }else{
   const foe=target(r);
   if(foe){
    foe.poison.stacks+=level+rank(r,'poisonCatalyst')*PERKS.poisonCatalyst.stacksPerRank;
    foe.poison.turns=BALANCE.poisonTurns+rank(r,'poisonLingering')*PERKS.poisonLingering.turnsPerRank;
    emit('poisonApply','hero',[foe.id],0,'毒针附着','poison',s.dieIndex);
    const threshold=Math.max(PERKS.poisonCatalyst.minThreshold,BALANCE.poisonThreshold-rank(r,'poisonCatalyst')*PERKS.poisonCatalyst.thresholdReductionPerRank);
    if(r.ascended&&r.build==='poison'&&foe.poison.stacks>=threshold&&alive(foe)){
     foe.poison.stacks-=threshold;hit(foe,BALANCE.poisonBurstDamage,'burst','hero','','poison',s.dieIndex);
    }
   }
  }
 }
 if(r.ascended&&r.build==='sword'&&!r.combat.swordArrayUsed&&r.combat.dice.filter(v=>v>=4).length>=3){
  r.combat.swordArrayUsed=true;emit('ascension','hero',live(r).map(e=>e.id),0,'万剑归宗·起阵','sword');
  for(const foe of [...live(r)])hit(foe,BALANCE.swordDamage,'swordArray','hero','万剑归宗','sword');
 }
 for(const foe of announcedEnemies){
  if(!alive(foe)||r.hero.hp<=0)continue;
  const amount=foe.intent.damage;emit('intent',foe.id,['hero'],0,foe.intent.label);
  const blocked=Math.min(r.hero.shield,amount);r.hero.shield-=blocked;r.stats.blocked+=blocked;
  if(blocked)emit('shield',foe.id,['hero'],-blocked,'护盾抵挡','guard');
  const hp=Math.min(r.hero.hp,amount-blocked);r.hero.hp-=hp;emit('hurt',foe.id,['hero'],hp,'受到攻击');
  const counter=rank(r,'guardRiposte')*PERKS.guardRiposte.damagePerRank+(r.ascended&&r.build==='guard'?BALANCE.guardCounterDamage:0);
  if(blocked>0&&r.hero.hp>0&&counter>0)hit(foe,counter,'counter','hero','','guard');
  if(r.hero.hp===0)emit('death',foe.id,['hero'],0,'侠客倒下');
 }
 for(const foe of [...live(r)]){
  if(foe.poison.stacks>0&&foe.poison.turns>0){
   hit(foe,foe.poison.stacks*(BALANCE.poisonDamage+rank(r,'poisonLingering')*PERKS.poisonLingering.damagePerRank),'poisonTick','hero','','poison');
   foe.poison.turns--;if(foe.poison.turns===0)foe.poison.stacks=0;
  }
 }
 r.combat.targetId=target(r)?.id||'';
 if(r.hero.hp<=0||!live(r).length)emit('finish','hero',[],0,r.hero.hp<=0?'败北':'获胜');
 return {state:r,events};
}
