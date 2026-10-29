import {BALANCE,BUILDS,emptyPerks} from './config.mjs';

/** Pure uint32 LCG. Seed zero is valid and does not become a stuck state. */
export function nextRandom(seed) {
 const next=(Math.imul(Number(seed)>>>0,1664525)+1013904223)>>>0;
 return {seed:next,value:next/4294967296};
}
export function createRun(build,seed=1,options={}) {
 if(!Object.hasOwn(BUILDS,build)) throw new RangeError('Unknown build');
 const loadout=options.loadout?structuredClone(options.loadout):null;
 if(loadout)loadout.bag={potion:0,reroll:0,antidote:0,tonic:0,...loadout.bag};
 const bonus=id=>Math.max(0,Number(loadout?.effects?.[id])||0);
 const run={version:3,seed:Number(seed)>>>0,build,nodeIndex:0,flow:'intro',
 hero:{id:'hero',name:'无名侠客',hp:BALANCE.heroHp+bonus('maxHp'),maxHp:BALANCE.heroHp+bonus('maxHp'),shield:0,attack:BALANCE.heroAttack+bonus('attack')},
 perks:emptyPerks(),pendingUpgrade:null,
 diceSkills:[{kind:build,level:1},null,null,null,null],upgrades:{},mastery:0,ascended:false,choices:[],combat:null,
 stats:{turns:0,kills:0,damage:0,blocked:0,poisonDamage:0,upgrades:[],upgradeHistory:[]}};
 if(loadout)Object.assign(run,{loadout,bag:structuredClone(loadout.bag||{}),consumed:{},coins:0,settled:false});
 if(options.runId!==undefined)run.runId=options.runId;
 return run;
}
export function evaluateDice(values) {
 const names=['散招','一对','两对','三条','顺子','葫芦','四条','五同'];
 const multipliers=[1,1.5,2,3,4,5,7,10];
 let rank=0;
 if(Array.isArray(values)&&values.length===5&&values.every(v=>Number.isInteger(v)&&v>=1&&v<=6)) {
  const sorted=[...values].sort((a,b)=>a-b);
  const counts=Object.values(values.reduce((m,v)=>(m[v]=(m[v]||0)+1,m),{})).sort((a,b)=>b-a);
  if(counts[0]===5) rank=7;
  else if(counts[0]===4) rank=6;
  else if(counts[0]===3&&counts[1]===2) rank=5;
  else if(sorted.every((v,i)=>i===0||v===sorted[i-1]+1)) rank=4;
  else if(counts[0]===3) rank=3;
  else if(counts[0]===2&&counts[1]===2) rank=2;
  else if(counts[0]===2) rank=1;
 }
 return {rank,name:names[rank],multiplier:multipliers[rank]};
}
export const maxRerolls=run=>Math.min(6,BALANCE.rerolls+Math.max(0,Math.floor(Number(run.loadout?.effects?.extraRerolls)||0)));
export function dieMark(run,index){return run.loadout?.dice?.[index]?.marks?.[run.combat?.faceIndices?.[index]]??null;}
export function evaluateRunDice(run){
 const values=run.combat?.dice||[],wild=values.map((_,i)=>dieMark(run,i)==='wild'?i:-1).filter(i=>i>=0).slice(0,2);
 let best=evaluateDice(values);
 const visit=(index,next)=>{if(index===wild.length){const hand=evaluateDice(next);if(hand.rank>best.rank)best=hand;return;}for(let value=1;value<=6;value++){const copy=[...next];copy[wild[index]]=value;visit(index+1,copy);}};
 if(wild.length)visit(0,[...values]);return best;
}
const phaseIs=(run,phase)=>run?.flow==='battle'&&run.combat?.phase===phase;
function roll(run,reroll) {
 const next=structuredClone(run);
 if(next.loadout)next.combat.faceIndices??=[0,0,0,0,0];
 const selected=new Set(next.combat.held.flatMap((held,i)=>!held?[i]:[]));
 if(reroll)for(const i of [...selected])if(next.loadout?.dice?.[i]?.decorationId==='chain')for(const j of [i-1,i+1])if(j>=0&&j<5)selected.add(j);
 for(let i=0;i<5;i++) if((!reroll||selected.has(i))&&!(reroll&&next.combat.frozen?.[i])) {
  let result=nextRandom(next.seed);next.seed=result.seed;let face=Math.floor(result.value*6);
  const definition=next.loadout?.dice?.[i];
  if(definition?.decorationId==='lucky'){const extra=nextRandom(next.seed);next.seed=extra.seed;const other=Math.floor(extra.value*6);if(definition.faces[other]>definition.faces[face])face=other;}
  next.combat.dice[i]=definition?.faces?.[face]??(face+1);
  if(next.loadout)next.combat.faceIndices[i]=face;
 }
 if(next.loadout)next.combat.frozen=Array.from({length:5},(_,i)=>{const d=next.loadout.dice?.[i];return d?.decorationId==='focus'||(d?.materialId==='frost'&&next.combat.round%2===0);});
 next.combat.phase='pick';
 next.combat.held=[true,true,true,true,true];
 if(reroll) next.combat.rerolls--;
 else next.combat.rerolls=maxRerolls(next);
 return next;
}
export function rollDice(run) {return phaseIs(run,'roll')?roll(run,false):run;}
export function toggleHold(run,index) {
 if(!phaseIs(run,'pick')||!Number.isInteger(index)||index<0||index>=5||run.combat.frozen?.[index]) return run;
 const next=structuredClone(run);next.combat.held[index]=!next.combat.held[index];return next;
}
export function rerollDice(run) {
 return phaseIs(run,'pick')&&run.combat.rerolls>0&&run.combat.held.some(held=>!held)?roll(run,true):run;
}
