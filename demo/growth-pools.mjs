import {BUILDS,PERKS} from './config.mjs';

const builds=Object.keys(BUILDS);
const entries=['bind',...Object.keys(PERKS)];
const chapters=['bamboo','temple','gate','desert','lake','tomb','peak'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const weight=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000;

export const DEFAULT_GROWTH_SELECTION={
 poolWeights:{sword:1,poison:1,guard:1},
 ownBuildBonus:2,
 entryWeights:{bind:1,swordFocus:2,swordEcho:1,poisonLingering:2,poisonCatalyst:1,guardBulwark:2,guardRiposte:1},
 chapterBias:{bamboo:{sword:1},temple:{poison:1},gate:{guard:1},desert:{sword:1},lake:{poison:1},tomb:{guard:1},peak:{}}
};

export function validateGrowthSelection(value){
 if(value===undefined)return {valid:true,errors:[]};
 const errors=[];
 const fail=(path,message)=>errors.push(`${path}: ${message}`);
 if(!plain(value))return {valid:false,errors:['selection: 须为对象']};
 for(const key of Object.keys(value))if(!['poolWeights','ownBuildBonus','entryWeights','chapterBias'].includes(key))fail(`selection.${key}`,'未知字段');
 if(!weight(value.ownBuildBonus))fail('selection.ownBuildBonus','须为 0..1000 的有限非负数');
 const pools=value.poolWeights;
 if(!plain(pools))fail('selection.poolWeights','须为对象');
 else{
  if(builds.some(key=>!Object.hasOwn(pools,key))||Object.keys(pools).some(key=>!builds.includes(key)))fail('selection.poolWeights','须恰含三种流派');
  for(const [key,n]of Object.entries(pools))if(!weight(n))fail(`selection.poolWeights.${key}`,'权重须为 0..1000 的有限非负数');
  if(!Object.values(pools).some(n=>weight(n)&&n>0))fail('selection.poolWeights','至少一个权重须为正数');
 }
 const weights=value.entryWeights;
 if(!plain(weights))fail('selection.entryWeights','须为对象');
 else{
  for(const [key,n]of Object.entries(weights))if(!entries.includes(key)||!weight(n))fail(`selection.entryWeights.${key}`,'未知条目或非法权重');
  if(!Object.values(weights).some(n=>weight(n)&&n>0))fail('selection.entryWeights','至少一个权重须为正数');
 }
 const bias=value.chapterBias;
 if(!plain(bias))fail('selection.chapterBias','须为对象');
 else for(const [chapter,values]of Object.entries(bias)){
  if(!chapters.includes(chapter)||!plain(values)){fail(`selection.chapterBias.${chapter}`,'未知章节或非法偏置');continue;}
  for(const [key,n]of Object.entries(values))if(!builds.includes(key)||!weight(n))fail(`selection.chapterBias.${chapter}.${key}`,'未知流派或非法偏置');
 }
 return {valid:errors.length===0,errors};
}
