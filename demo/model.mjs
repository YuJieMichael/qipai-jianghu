import {BALANCE,BUILDS} from './config.mjs';

/** Pure uint32 LCG. Seed zero is valid and does not become a stuck state. */
export function nextRandom(seed) {
 const next=(Math.imul(Number(seed)>>>0,1664525)+1013904223)>>>0;
 return {seed:next,value:next/4294967296};
}
export function createRun(build,seed=1) {
 if(!Object.hasOwn(BUILDS,build)) throw new RangeError('Unknown build');
 return {version:1,seed:Number(seed)>>>0,build,nodeIndex:0,flow:'intro',
 hero:{id:'hero',name:'无名侠客',hp:BALANCE.heroHp,maxHp:BALANCE.heroHp,shield:0,attack:BALANCE.heroAttack},
 diceSkills:[{kind:build,level:1},null,null,null,null],upgrades:{},mastery:0,ascended:false,choices:[],combat:null,
 stats:{turns:0,kills:0,damage:0,blocked:0,poisonDamage:0,upgrades:[]}};
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
const phaseIs=(run,phase)=>run?.flow==='battle'&&run.combat?.phase===phase;
function roll(run,reroll) {
 const next=structuredClone(run);
 for(let i=0;i<5;i++) if(!reroll||!next.combat.held[i]) {
  const result=nextRandom(next.seed);next.seed=result.seed;next.combat.dice[i]=1+Math.floor(result.value*6);
 }
 next.combat.phase='pick';
 next.combat.held=[true,true,true,true,true];
 if(reroll) next.combat.rerolls--;
 else next.combat.rerolls=BALANCE.rerolls;
 return next;
}
export function rollDice(run) {return phaseIs(run,'roll')?roll(run,false):run;}
export function toggleHold(run,index) {
 if(!phaseIs(run,'pick')||!Number.isInteger(index)||index<0||index>=5) return run;
 const next=structuredClone(run);next.combat.held[index]=!next.combat.held[index];return next;
}
export function rerollDice(run) {
 return phaseIs(run,'pick')&&run.combat.rerolls>0&&run.combat.held.some(held=>!held)?roll(run,true):run;
}
