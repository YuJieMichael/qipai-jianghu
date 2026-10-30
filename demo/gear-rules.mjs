/** Original equipment progression. Content is injected to keep this module dependency-free. */
export const DEFAULT_GEAR_PROGRESSION={
 cumulativeFactors:[0,1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30],
 rarityCaps:{common:10,fine:14,rare:18,epic:20},qualityCapBonus:4,
 percentRules:[{quality:1,effects:{attack:5}},{quality:2,effects:{maxHp:5}},{quality:3,effects:{attack:5,armor:5}}]
};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys)=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>own(v,k));
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const dense=(v,min,max)=>Array.isArray(v)&&v.length>=min&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>own(v,i)).every(Boolean);
const percentBase=()=>({attack:0,maxHp:0,armor:0});
const round=n=>Math.round(n*100)/100;
const rounded=effects=>Object.fromEntries(Object.entries(effects).map(([k,n])=>[k,round(n)]));
function add(out,effects,factor=1){for(const [key,value]of Object.entries(effects??{}))out[key]=(own(out,key)?out[key]:0)+value*factor;}
export function validateGearProgression(value){
 const errors=[],fail=message=>errors.push(`gear.progression: ${message}`);
 if(value===undefined)return {valid:true,errors};
 if(!exact(value,['cumulativeFactors','rarityCaps','qualityCapBonus','percentRules']))return {valid:false,errors:['gear.progression: 字段须完整且不得含未知键。']};
 const factors=value.cumulativeFactors;
 if(!dense(factors,2,101)||factors[0]!==0||factors.some((n,i)=>!number(n,0,1000)||i>0&&n<factors[i-1]))fail('累计系数须从 0 开始、非递减且位于 0..1000。');
 if(!exact(value.rarityCaps,['common','fine','rare','epic'])||Object.values(value.rarityCaps).some(n=>!integer(n,1,100)))fail('稀有度上限须为四个 1..100 整数。');
 if(!integer(value.qualityCapBonus,0,100))fail('品质上限加成须为 0..100 整数。');
 if(!dense(value.percentRules,0,10))fail('百分比规则须为最多十条的数组。');
 else for(const rule of value.percentRules){
  if(!exact(rule,['quality','effects'])||!integer(rule.quality,1,10)){fail('百分比规则品质须为 1..10 整数。');continue;}
  if(!object(rule.effects)||!Reflect.ownKeys(rule.effects).length||Reflect.ownKeys(rule.effects).some(k=>!['attack','maxHp','armor'].includes(k)||!number(rule.effects[k],0,100)))fail('百分比效果仅支持非空的攻击、气血、护甲，数值须为 0..100。');
 }
 return {valid:errors.length===0,errors};
}
function progression(content){const value=content.expansion?.gear?.progression;const check=validateGearProgression(value);if(!check.valid)throw new Error(check.errors[0]);return value;}
function equipped(profile,content,slotId){const item=profile.inventory.find(i=>i.uid===profile.equipped[slotId]);const template=item?content.equipment.find(t=>t.id===item.templateId):null;return {item,template,quality:item?(profile.expansion?.gear?.[item.uid]?.quality??0):0};}
function factorAt(rules,level){
 if(!rules)return level;
 const rows=rules.cumulativeFactors,last=rows.length-1;
 return level<=last?rows[level]:rows[last]+(level-last)*(rows[last]-rows[last-1]);
}
function itemPercents(rules,quality){const effects=percentBase();for(const rule of rules?.percentRules??[])if(quality>=rule.quality)add(effects,rule.effects);return effects;}
function slotEffects(content,slotId,level,rules,active){const effects={};if(active)add(effects,content.workshopRules?.slotEffects?.[slotId],factorAt(rules,level));return effects;}
export function getSlotProgression(profile,content,slotId){
 if(!content.slots.some(s=>s.id===slotId))throw new Error('没有找到所选槽位。');
 const rules=progression(content),{item,template,quality}=equipped(profile,content,slotId),storedLevel=profile.slotLevels[slotId]??0;
 const cap=rules&&template?Math.min(content.economy.maxEnhance,rules.rarityCaps[template.rarity]+quality*rules.qualityCapBonus):content.economy.maxEnhance;
 const effectiveLevel=Math.min(storedLevel,cap),active=Boolean(item&&template);
 const cumulativeEffects=slotEffects(content,slotId,effectiveLevel,rules,active);
 const nextCost=storedLevel<cap?{gold:content.economy.enhanceGold*(storedLevel+1),dust:content.economy.enhanceDust*(storedLevel+1)}:null;
 const reason=storedLevel>=cap?'强化已到上限。':Object.entries(nextCost).some(([key,n])=>(profile.resources[key]??0)<n)?'资源不足，操作未执行。':null;
 let nextEffects=null;
 if(!reason){nextEffects=slotEffects(content,slotId,Math.min(storedLevel+1,cap),rules,active);add(nextEffects,cumulativeEffects,-1);}
 return {storedLevel,effectiveLevel,cap,cumulativeEffects:rounded(cumulativeEffects),nextCost,nextEffects:nextEffects===null?null:rounded(nextEffects),canEnhance:reason===null,reason,percentBonuses:active?itemPercents(rules,quality):percentBase(),refund:storedLevel>0?{gold:Math.floor(content.economy.enhanceGold*storedLevel*content.economy.downgradeGoldRefund),dust:content.economy.enhanceDust*storedLevel}:null};
}
export function deriveEquipment(profile,content,{roundResults=true}={}){
 const flatEffects={},percentBonuses=percentBase(),slots={},g=content.expansion?.gear;
 for(const slot of content.slots){
  const info=getSlotProgression(profile,content,slot.id);slots[slot.id]=info;
  const {item,template,quality}=equipped(profile,content,slot.id);if(!item||!template)continue;
  add(flatEffects,template.effects,1+(item.fusionLevel??0)*content.economy.fusionBonus);
  add(flatEffects,item.refine?.effects);for(const gem of item.gems??[])add(flatEffects,content.gems.find(g=>g.id===gem)?.effects);
  add(flatEffects,slotEffects(content,slot.id,info.effectiveLevel,progression(content),true));add(flatEffects,template.effects,quality*(g?.qualityBonus??0));
  for(const affix of profile.expansion?.gear?.[item.uid]?.affixes??[])add(flatEffects,{[affix.key]:affix.value});
  for(const passive of g?.passiveRules??[])if(quality>=passive.quality)add(flatEffects,passive.effects);
  add(percentBonuses,info.percentBonuses);
 }
 const effects={...flatEffects};for(const key of Object.keys(percentBonuses))if(own(effects,key))effects[key]*=1+percentBonuses[key]/100;
 return {effects:roundResults?rounded(effects):effects,flatEffects:roundResults?rounded(flatEffects):flatEffects,percentBonuses,slots};
}
