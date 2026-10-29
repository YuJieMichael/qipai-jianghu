import {BALANCE,ENEMY_TYPES,PERKS} from './config.mjs';
import {evaluateRunDice,nextRandom,maxRerolls,dieMark} from './model.mjs';
export const COMBAT_RULES=Object.freeze({swordStraightBonus:30,hammerShield:6,hammerBreak:12,markSword:4,markCritChance:10,markFire:5,markLeech:3,markHeal:5,markGuard:4,markColdChance:25,materialFirePerLevel:2,materialFrostChance:5,decorationDamage:2,decorationHeal:2,decorationShield:2,focusDamage:3,fortuneCoins:1});
const clone=x=>structuredClone(x);
const alive=e=>e.hp>0;
const live=r=>r.combat.enemies.filter(alive);
const rank=(r,id)=>r.perks?.[id]??0;
const effect=(r,id)=>Math.max(0,Number(r.loadout?.effects?.[id])||0);
function enemy(definition,id){
 const kind=typeof definition==='string'?definition:definition.kind;
 if(!Object.hasOwn(ENEMY_TYPES,kind))throw new RangeError('Unknown enemy');
 const t={...ENEMY_TYPES[kind],...(typeof definition==='object'?definition:{})};
 return {id,kind,name:t.name,hp:t.hp,maxHp:t.hp,shield:t.shield,poison:{stacks:0,turns:0},stance:t.stance,phase:1,intent:{kind:'attack',damage:t.attack,label:'进攻'},summoned:false,...(typeof definition==='object'?{baseAttack:t.attack,heavyDamage:t.heavyDamage??BALANCE.bossHeavyDamage,baseStance:t.stance,noSummon:!!t.noSummon}:{} )};
}
function intents(r){
 for(const e of live(r)){
  const heavy=e.kind==='boss'&&r.combat.round%2===0;
  if(heavy)e.stance=e.baseStance??BALANCE.bossStance;
  e.intent={kind:heavy?'heavy':'attack',damage:heavy?(e.heavyDamage??BALANCE.bossHeavyDamage):(e.baseAttack??ENEMY_TYPES[e.kind].attack),label:heavy?'蓄力重击':'进攻'};
 }
}
export function startBattle(run,node){
 const r=clone(run);r.flow='battle';r.choices=[];r.pendingUpgrade=null;r.hero.shield=effect(r,'openingShield');
 r.combat={round:1,swordArrayUsed:false,phase:'roll',dice:[0,0,0,0,0],held:[false,false,false,false,false],rerolls:maxRerolls(r),...(r.loadout?{faceIndices:[0,0,0,0,0],frozen:[false,false,false,false,false]}:{}),...(node.turnLimit?{turnLimit:node.turnLimit}:{}),enemies:node.enemies.map((k,i)=>enemy(k,`${node.id||'battle'}-${i}`)),targetId:''};
 r.combat.targetId=live(r)[0]?.id||'';intents(r);return r;
}
export function selectTarget(run,id){
 if(run.flow!=='battle'||!run.combat?.enemies.some(e=>e.id===id&&alive(e))||run.combat.phase==='resolved')return run;
 const r=clone(run);r.combat.targetId=id;return r;
}
function target(r){return live(r).find(e=>e.id===r.combat.targetId)||live(r)[0];}
const triggers=r=>{
 const natural=r.diceSkills.flatMap((s,i)=>s&&((s.kind==='sword'&&r.combat.dice[i]>=4)||(s.kind==='poison'&&r.combat.dice[i]%2===1)||(s.kind==='guard'&&r.combat.dice[i]>=1&&r.combat.dice[i]<=3))?[i]:[]);
 const active=new Set(natural);
 for(const i of natural)if(r.loadout?.dice?.[i]?.decorationId==='chain')for(const j of [i-1,i+1])if(j>=0&&j<5&&r.diceSkills[j])active.add(j);
 return [...active].sort((a,b)=>a-b).map(i=>({...r.diceSkills[i],dieIndex:i}));
};
export function previewAttack(run){
 const combo=evaluateRunDice(run);
 let forecast=null,effects=[],directDamage=0;
 if(run.flow==='battle'&&run.combat?.phase==='pick'){
  const {state,events}=resolveRound(run);directDamage=events.filter(e=>e.type==='strike').reduce((sum,e)=>sum+e.value,0);
  forecast={totalDamage:state.stats.damage-run.stats.damage,poisonDamage:state.stats.poisonDamage-run.stats.poisonDamage,blocked:state.stats.blocked-run.stats.blocked,heroHpAfter:state.hero.hp,heroShieldAfter:state.hero.shield,enemies:state.combat.enemies.map(foe=>({id:foe.id,name:foe.name,hpAfter:foe.hp,shieldAfter:foe.shield,poisonStacksAfter:foe.poison.stacks,poisonTurnsAfter:foe.poison.turns}))};
  effects=events.map(({type,text,value,build,sourceId,targetIds,dieIndex})=>({type,text,value,build,sourceId,targetIds,...(dieIndex===undefined?{}:{dieIndex})}));
 }
 return {combo,directDamage,triggers:run.combat?triggers(run):[],enemyIntents:run.combat?live(run).map(e=>({id:e.id,...e.intent})):[],forecast,effects};
}
export function prepareRound(run){
 if(run.flow!=='battle'||run.combat?.phase!=='resolved'||!run.hero.hp||!live(run).length||run.combat.timedOut)return run;
 const r=clone(run);r.combat.round++;r.combat.phase='roll';r.combat.dice=[0,0,0,0,0];r.combat.held=[false,false,false,false,false];r.combat.rerolls=maxRerolls(r);r.combat.targetId=target(r)?.id||'';intents(r);return r;
}
export function resolveRound(run){
 if(run.flow!=='battle'||run.combat?.phase!=='pick')return {state:run,events:[]};
 const r=clone(run),events=[],announcedEnemies=[...live(r)],rules={...COMBAT_RULES,...run.loadout?.rules};r.combat.phase='resolved';r.stats.turns++;
 const emit=(type,sourceId,targetIds,value,text,build=r.build,dieIndex)=>events.push({id:`${r.nodeIndex}-${r.combat.round}-${events.length}`,type,sourceId,targetIds,value,build,text,...(dieIndex===undefined?{}:{dieIndex}),snapshot:clone(r)});
 const phase=e=>{
  if(e.kind==='boss'&&e.hp>0&&e.hp<=e.maxHp/2&&!e.summoned&&!e.noSummon){
   e.phase=2;e.summoned=true;r.combat.enemies.push(enemy('melee',`${e.id}-aid-1`),enemy('ranged',`${e.id}-aid-2`));emit('phase',e.id,[e.id],0,'守将召来援手');
  }
 };
 const labels={sword:'剑气贯阵',swordFocus:'凝锋',swordEcho:'回响剑阵',swordArray:'万剑归宗',counter:'金刚反击',burst:'毒爆',poisonTick:'毒伤'};
 const hit=(e,amount,type,source='hero',label='',build=r.build,dieIndex)=>{
  if(!alive(e))return;
  amount=Math.max(0,Math.floor(amount));
  const absorbed=Math.min(e.shield,amount);e.shield-=absorbed;
  const hp=Math.min(e.hp,Math.max(0,amount-absorbed));e.hp-=hp;r.stats.damage+=hp;
  if(type==='poisonTick')r.stats.poisonDamage+=hp;
  if(e.stance>0&&hp>0){e.stance=Math.max(0,e.stance-hp);if(e.stance===0&&e.intent.kind==='heavy')e.intent={kind:'stunned',damage:0,label:'破势失衡'};}
  emit(type,source,[e.id],hp,label||labels[type]||'出招',build,dieIndex);
  if(!alive(e)){r.stats.kills++;emit('death',source,[e.id],0,'敌人倒下',build);}
  phase(e);
 };
 const heal=(amount,label='回复气血',dieIndex)=>{if(r.hero.hp<=0||amount<=0)return;const gain=Math.min(r.hero.maxHp-r.hero.hp,Math.floor(amount));r.hero.hp+=gain;if(gain)emit('heal','hero',['hero'],gain,label,r.build,dieIndex);};
 const shield=(amount,label='护体',dieIndex)=>{if(amount<=0)return;const gain=Math.floor(amount+effect(r,'shieldGain'));r.hero.shield+=gain;emit('shield','hero',['hero'],gain,label,'guard',dieIndex);};
 const poison=(amount,dieIndex)=>{const foe=target(r);if(!foe||amount<=0)return;foe.poison.stacks+=Math.floor(amount);foe.poison.turns=BALANCE.poisonTurns;emit('poisonApply','hero',[foe.id],0,'附加毒素','poison',dieIndex);};
 const chance=percent=>{if(percent<=0)return false;const draw=nextRandom(r.seed);r.seed=draw.seed;return draw.value*100<Math.min(100,percent);};
 const combo=evaluateRunDice(r),marks=r.combat.dice.map((_,i)=>dieMark(r,i));
 const critical=chance(Math.min(75,effect(r,'critChance')+marks.filter(m=>m==='crit').length*rules.markCritChance));
 let direct=r.hero.attack*combo.multiplier*(1+effect(r,'comboBonus')/100);
 if(r.loadout?.weaponType==='sword'&&combo.rank===4)direct*=1+rules.swordStraightBonus/100;
 direct+=r.loadout?.dice?.filter(d=>d.decorationId==='focus').length*rules.focusDamage||0;
 if(critical)direct*=1+(r.loadout?.effects?.critDamage??50)/100;
 const e=target(r),directBefore=r.stats.damage;
 if(e){emit('windup','hero',[e.id],0,critical?'会心出招':'凝神出招');for(const foe of r.loadout?.weaponType==='staff'&&combo.rank>=2?[...live(r)]:[e])hit(foe,Math.floor(direct),'strike');}
 if(r.loadout?.weaponType==='hammer'&&combo.rank>=3){shield(rules.hammerShield,'重锤护势');for(const foe of live(r)){foe.stance=Math.max(0,foe.stance-rules.hammerBreak);if(foe.stance===0&&foe.intent.kind==='heavy')foe.intent={kind:'stunned',damage:0,label:'重锤破势'};}}
 heal(Math.floor((r.stats.damage-directBefore)*effect(r,'lifesteal')/100),'汲取气血');

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
   const gain=BALANCE.guardShield*level+rank(r,'guardBulwark')*PERKS.guardBulwark.shieldPerRank+effect(r,'shieldGain');
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
 // Physical marks never follow wild substitutions; each uses its actual face index.
 for(let i=0;i<5;i++){
  const definition=r.loadout?.dice?.[i],mark=marks[i];if(!definition)continue;
  const level=definition.materialLevel||1,foe=target(r);
  if(mark==='sword')for(const enemy of [...live(r)])hit(enemy,rules.markSword,'sword','hero','剑纹','sword',i);
  if(mark==='poison')poison(1,i);
  if(mark==='fire'&&foe)hit(foe,rules.markFire,'burst','hero','火纹',r.build,i);
  if(mark==='leech'&&foe){const before=r.stats.damage;hit(foe,rules.markLeech,'strike','hero','汲取纹',r.build,i);heal(r.stats.damage-before,'汲取纹',i);}
  if(mark==='heal')heal(rules.markHeal,'生息纹',i);
  if(mark==='guard')shield(rules.markGuard,'护身纹',i);
  if(definition.materialId==='jade')heal(level,'玉质生息',i);
  if(definition.materialId==='wood')heal(level-1,'木质生息',i);
  if(definition.materialId==='iron')shield(level,'铁质护身',i);
  if(definition.materialId==='flame'&&foe)hit(foe,level*rules.materialFirePerLevel,'burst','hero','焰质灼烧',r.build,i);
  if(definition.materialId==='thunder')for(const enemy of [...live(r)])hit(enemy,level,'sword','hero','雷质连击',r.build,i);
  if(definition.materialId==='poison')poison(level,i);
  if(definition.decorationId==='blood'&&foe){hit(foe,rules.decorationDamage,'sword','hero','血饰',r.build,i);heal(rules.decorationHeal,'血饰',i);}
  if(definition.decorationId==='guard')shield(rules.decorationShield,'守饰',i);
  if(definition.decorationId==='restore')heal(rules.decorationHeal,'复苏饰',i);
  if(definition.decorationId==='fortune')r.coins=(r.coins||0)+Math.floor(rules.fortuneCoins);
 }
 for(const skill of r.loadout?.skills||[]){
  const active=skill.trigger==='crit'?critical:skill.trigger==='straight'?combo.rank===4:skill.trigger==='triple'?combo.rank>=3:skill.trigger==='pair'?combo.rank>=1:['always','round'].includes(skill.trigger)||triggers(r).some(s=>s.kind===skill.trigger);
  if(!active)continue;const fx=skill.effects||{},foe=target(r);
  if(fx.damage&&foe)hit(foe,fx.damage,'sword','hero',skill.name||'武学');
  heal(fx.heal||0,skill.name);shield(fx.shield||0,skill.name);poison(fx.poison||0);
  if(fx.attack)r.hero.attack+=Math.max(0,fx.attack);
 }
 for(const relic of r.loadout?.relics||[])if(combo.rank>=(relic.handRank||0)){const foe=target(r);if(foe)hit(foe,relic.damage||0,'sword','hero',relic.name||'遗物');}
 const pet=r.loadout?.pet;if(pet){const foe=target(r);if(foe&&pet.damage)hit(foe,pet.damage,'sword','hero',pet.name||'灵兽');heal(pet.heal||0,'灵兽疗愈');shield(pet.shield||0,'灵兽护身');}
 if(effect(r,'fireDamage'))for(const foe of [...live(r)])hit(foe,effect(r,'fireDamage'),'burst','hero','灼烧');
 const frost=r.loadout?.dice?.filter(d=>d.materialId==='frost').reduce((n,d)=>n+(d.materialLevel||1)*rules.materialFrostChance,0)||0;
 if(chance(effect(r,'freezeChance')+frost+marks.filter(m=>m==='cold').length*rules.markColdChance)){const foe=live(r)[0];if(foe)foe.intent={kind:'frozen',damage:0,label:'冻结失去行动'};}
 for(const foe of announcedEnemies){
  if(!alive(foe)||r.hero.hp<=0)continue;
  const original=foe.intent.damage,armor=Math.min(original,effect(r,'armor'));const amount=original-armor;r.stats.blocked+=armor;emit('intent',foe.id,['hero'],0,foe.intent.label);
  const blocked=Math.min(r.hero.shield,amount);r.hero.shield-=blocked;r.stats.blocked+=blocked;
  if(blocked)emit('shield',foe.id,['hero'],-blocked,'护盾抵挡','guard');
  const hp=Math.min(r.hero.hp,amount-blocked);r.hero.hp-=hp;emit('hurt',foe.id,['hero'],hp,'受到攻击');
  const counter=rank(r,'guardRiposte')*PERKS.guardRiposte.damagePerRank+(r.ascended&&r.build==='guard'?BALANCE.guardCounterDamage:0);
  if(blocked>0&&r.hero.hp>0&&counter>0)hit(foe,counter,'counter','hero','','guard');
  if(r.hero.hp>0&&original>0&&effect(r,'thorns'))hit(foe,effect(r,'thorns'),'counter','hero','荆棘反伤','guard');
  if(r.hero.hp===0)emit('death',foe.id,['hero'],0,'侠客倒下');
 }
 for(const foe of [...live(r)]){
  if(foe.poison.stacks>0&&foe.poison.turns>0){
   hit(foe,foe.poison.stacks*(BALANCE.poisonDamage+rank(r,'poisonLingering')*PERKS.poisonLingering.damagePerRank+effect(r,'poisonDamage')),'poisonTick','hero','','poison');
   foe.poison.turns--;if(foe.poison.turns===0)foe.poison.stacks=0;
  }
 }
 heal(effect(r,'regen'),'回合调息');
 if(r.combat.turnLimit&&r.combat.round>=r.combat.turnLimit&&live(r).length)r.combat.timedOut=true;
 r.combat.targetId=target(r)?.id||'';
 if(r.hero.hp<=0||!live(r).length||r.combat.timedOut)emit('finish','hero',[],0,r.hero.hp<=0?'败北':r.combat.timedOut?'回合结束':'获胜');
 return {state:r,events};
}
