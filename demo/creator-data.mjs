import {validateContent} from './content.mjs';
const forbidden=new Set(['__proto__','prototype','constructor']);
/** Apply a visual form as one validated transaction; a failed form keeps its source. */
export function patchContent(content,changes){
 const copy=structuredClone(content),errors=[];
 if(!Array.isArray(changes)||changes.length>1500)return {valid:false,content,errors:['编辑字段数量无效。']};
 for(const edit of changes){
  if(!Array.isArray(edit?.path)||!edit.path.length||edit.path.length>12||edit.path.some(k=>typeof k!=='string'||forbidden.has(k))){errors.push('编辑路径无效。');continue;}
  let target=copy;for(const key of edit.path.slice(0,-1)){if(!target||typeof target!=='object'||!Object.hasOwn(target,key)){target=null;break;}target=target[key];}
  const key=edit.path.at(-1);if(!target||typeof target!=='object'||!Object.hasOwn(target,key)){errors.push('编辑字段已经不存在，请重新打开条目。');continue;}
  let value=edit.value;
  if(edit.kind==='number'){if(typeof value==='string'&&!value.trim()){errors.push('数值不能为空。');continue;}value=Number(value);if(!Number.isFinite(value)){errors.push('请输入有效数字。');continue;}}
  else if(edit.kind==='boolean'){if(![true,false,'true','false'].includes(value)){errors.push('开关值无效。');continue;}value=value===true||value==='true';}
  else if(edit.kind==='string'){if(typeof value!=='string'){errors.push('文本值无效。');continue;}}
  else{errors.push('编辑字段类型无效。');continue;}
  if(typeof target[key]!==typeof value){errors.push('字段类型不能改变。');continue;}target[key]=value;
 }
 if(errors.length)return {valid:false,content,errors};
 const checked=validateContent(copy);return checked.valid?{valid:true,content:checked.content,errors:[]}:{valid:false,content,errors:checked.errors};
}
export function lootProbabilities(content){
 const loot=content.expansion?.loot||{},weights=loot.rarityWeights||{common:1};
 const available=content.rarities.map(r=>({...r,count:content.equipment.filter(e=>e.rarity===r.id).length})).filter(r=>r.count);
 let entries=Object.entries(weights).filter(([,w])=>Number.isFinite(w)&&w>0),total=entries.reduce((n,[,w])=>n+w,0);
 if(!total){entries=[['common',1]];total=1;}
 const probabilities=new Map(available.map(r=>[r.id,0]));
 for(const [id,weight] of entries){
  if(probabilities.has(id))probabilities.set(id,probabilities.get(id)+weight/total);
  else for(const r of available)probabilities.set(r.id,probabilities.get(r.id)+weight/total*r.count/content.equipment.length);
 }
 const uniqueKeys=Array.isArray(content.expansion?.affixes)?new Set(content.expansion.affixes.map(a=>a.key)).size:Infinity;
 return available.map(r=>({id:r.id,name:r.name,probability:probabilities.get(r.id),battleChance:probabilities.get(r.id)*(loot.chance||0),affixes:Math.min(loot.affixCount?.[r.id]??1,content.expansion?.gear?.maxAffixes??4,uniqueKeys)}));
}
