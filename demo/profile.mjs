import {CONTENT,getContent,validateContent,EFFECT_KEYS} from './content.mjs';
import {ensureExpansion,EXPANSION_ACTIONS,isExpansionAction,observeExpansion,guardLegacyExpansion,runExpansionAction,addExpansionEffects,receiveExpansionLoot,expansionView,validateExpansionState} from './expansion-profile.mjs';
export {ensureExpansion,EXPANSION_ACTIONS};
export function getExpansionView(profile,options){return expansionView(profile,options,deriveLoadout);}
export const PROFILE_KEY='qipai-bamboo-profile-v1';
const CURRENCIES=['gold','dust','essence','insight'];
const RUN_ITEMS=['potion','reroll','antidote','tonic'];
const BAG_ITEMS=[...RUN_ITEMS,'herb','ore','hide','gift','food'];
const clone=value=>structuredClone(value);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const find=(c,key,id)=>c[key]?.find(row=>row.id===id);
const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const effectBase=()=>Object.fromEntries(EFFECT_KEYS.map(key=>[key,key==='critDamage'?50:0]));
function addEffects(out,effects,factor=1){for(const [key,n]of Object.entries(effects??{}))if(own(out,key))out[key]+=n*factor;}
function rng(p){p.seed=(Math.imul(p.seed,1664525)+1013904223)>>>0;return p.seed/4294967296;}
function fail(message){throw new Error(message);}
function requireEntry(c,key,id){const entry=find(c,key,id);if(!entry)fail('没有找到所选条目。');return entry;}
function scaleCost(cost,factor=1){return Object.fromEntries(Object.entries(cost??{}).map(([key,n])=>[key,Math.ceil(n*factor)]));}
function pay(p,cost){for(const [key,n]of Object.entries(cost??{}))if(!CURRENCIES.includes(key)||!integer(n)||p.resources[key]<n)fail('资源不足，操作未执行。');for(const [key,n]of Object.entries(cost??{}))p.resources[key]-=n;}
function reward(p,amount){for(const [key,n]of Object.entries(amount??{})){if(!CURRENCIES.includes(key)||!integer(n))fail('奖励配置错误。');p.resources[key]+=n;if(!integer(p.resources[key]))fail('资源超过保存上限。');}}
function addItem(p,templateId){const item={uid:`item-${p.nextUid++}`,templateId,refine:{effects:{}},gems:[],locked:false,fusionLevel:0};p.inventory.push(item);return item;}
function itemByUid(p,uid){const item=p.inventory.find(i=>i.uid===uid);if(!item)fail('装备不存在。');return item;}
function destructible(p,item){if(item.locked)fail('装备已锁定，请先解锁。');if(Object.values(p.equipped).includes(item.uid))fail('请先卸下装备。');if(item.pendingRefine)fail('请先接受或取消洗练候选。');}
function dieAt(p,index){if(!integer(index,0,4))fail('骰子编号须为 0..4。');return p.dice[index];}
function faceAt(p,die,face){const d=dieAt(p,die);if(!integer(face,0,5))fail('物理面编号须为 0..5。');return d;}
function output(p,c,out){if(out.bag)for(const [id,n]of Object.entries(out.bag)){if(!BAG_ITEMS.includes(id)||!integer(n,1))fail('物品配置错误。');p.bag[id]+=n;}if(out.gemId){requireEntry(c,'gems',out.gemId);p.gems[out.gemId]=(p.gems[out.gemId]??0)+1;}if(out.equipmentId){requireEntry(c,'equipment',out.equipmentId);addItem(p,out.equipmentId);}}
function levelUp(p,entry,map){const old=map[entry.id]??0;if(old>=entry.maxLevel)fail('已经达到等级上限。');pay(p,scaleCost(entry.cost,old+1));map[entry.id]=old+1;}
function toggle(list,id,max){const at=list.indexOf(id);if(at>=0)list.splice(at,1);else{if(list.length>=max)fail(`最多装配 ${max} 项。`);list.push(id);}}
export function createProfile(seed=1,now=Date.now()){
 const p={version:1,seed:integer(seed,0,4294967295)?seed:1,nextRunId:1,nextUid:1,resources:{gold:1000,dust:120,essence:20,insight:6},inventory:[],equipped:{},slotLevels:Object.fromEntries(CONTENT.slots.map(s=>[s.id,0])),dice:Array.from({length:5},()=>({faces:[1,2,3,4,5,6],marks:[null,null,null,null,null,null],materialId:'wood',materialLevel:1,decorationId:'plain'})),sectId:'bamboo',skills:['bamboo-strike'],talents:{},relics:{equipped:[],levels:Object.fromEntries(CONTENT.relics.map(r=>[r.id,1])),refines:{},pending:{},infusions:{}},runes:{slots:[null,null,null,null,null],levels:Object.fromEntries(CONTENT.runes.map(r=>[r.id,1])),planIndex:0,plans:Array.from({length:3},()=>[null,null,null,null,null])},pet:null,petLevels:Object.fromEntries(CONTENT.pets.map(r=>[r.id,1])),souls:[],title:null,training:{},meridians:{},companions:Object.fromEntries(CONTENT.companions.map(v=>[v.id,{affinity:0}])),apprentices:{},bag:{potion:3,reroll:2,antidote:2,tonic:1,herb:5,ore:5,hide:3,gift:3,food:3},gems:Object.fromEntries(CONTENT.gems.map(g=>[g.id,3])),stats:{runs:0,clears:0,kills:0,turns:0,enhances:0,purchases:0,gathers:0,training:0,crafts:0,draws:0,dailyClaims:0,sweeps:0,gifts:0},chapterStars:{},claimed:[],settledRunIds:[],contentOverrides:null,progression:{towerFloor:1,towerHp:180,worldBossHp:CONTENT.economy.worldBossHp,modes:{}},drawsSinceRare:0,offlineAt:integer(now)?now:0,createdAt:integer(now)?now:0};
 for(const template of CONTENT.equipment){const item=addItem(p,template.id);if(!p.equipped[template.slot])p.equipped[template.slot]=item.uid;}
 addItem(p,'weapon-sword-1');addItem(p,'weapon-sword-1');p.expansion=ensureExpansion(p);observeExpansion(p,CONTENT,now);return p;
}
export function deriveLoadout(profile){
 const c=getContent(profile),effects=effectBase(),setCounts={},rules=c.workshopRules??CONTENT.workshopRules;
 addEffects(effects,find(c,'sects',profile.sectId)?.effects);
 for(const slot of c.slots){const item=profile.inventory.find(i=>i.uid===profile.equipped[slot.id]);if(!item)continue;const template=find(c,'equipment',item.templateId);if(!template)continue;addEffects(effects,template.effects,1+(item.fusionLevel??0)*c.economy.fusionBonus);addEffects(effects,item.refine?.effects);for(const gemId of item.gems)addEffects(effects,find(c,'gems',gemId)?.effects);setCounts[template.setId]=(setCounts[template.setId]??0)+1;
  const level=profile.slotLevels[slot.id]??0;addEffects(effects,rules.slotEffects[slot.id],level);
 }
 for(const set of c.sets)if((setCounts[set.id]??0)>=set.pieces)addEffects(effects,set.effects);
 for(const [map,key]of [[profile.talents,'talents'],[profile.training,'training'],[profile.meridians,'meridians']])for(const [id,level]of Object.entries(map))addEffects(effects,find(c,key,id)?.effects,level);
 for(const id of profile.souls)addEffects(effects,find(c,'souls',id)?.effects);
 if(profile.title)addEffects(effects,find(c,'titles',profile.title)?.effects);
 const families={};for(const id of profile.runes.slots){if(!id)continue;const rune=find(c,'runes',id);if(!rune)continue;addEffects(effects,rune.effects,profile.runes.levels[id]??1);families[rune.family]=(families[rune.family]??0)+1;}
 for(const [family,count]of Object.entries(families))if(count>=c.economy.runeResonancePieces)addEffects(effects,rules.runeResonance[family]);
 const relics=profile.relics.equipped.map(id=>{const r=find(c,'relics',id);if(!r)return null;const infused=profile.relics.infusions[id]??0;addEffects(effects,r.effects,1+infused*c.economy.relicInfuseEffectScale);const refined=profile.relics.refines[id];addEffects(effects,refined?.effects);return {id:r.id,name:r.name,handRank:r.handRank,damage:r.damage+infused*c.economy.relicInfuseDamage+(refined?.damage??0)};}).filter(Boolean);
 if(relics.length>=c.economy.relicResonancePieces)addEffects(effects,rules.relicResonance);
 for(const [id,companion]of Object.entries(profile.companions))addEffects(effects,find(c,'companions',id)?.effects,Math.floor(companion.affinity/c.economy.companionAffinityStep));
 for(const [id,apprentice]of Object.entries(profile.apprentices))addEffects(effects,find(c,'companions',id)?.effects,apprentice.level);
 let pet=null;if(profile.pet){const entry=find(c,'pets',profile.pet);if(entry){const level=profile.petLevels[entry.id]??1;pet={id:entry.id,name:entry.name,damage:entry.damage*level,heal:entry.heal*level,shield:entry.shield*level};}}
 const weapon=profile.inventory.find(i=>i.uid===profile.equipped.weapon);const template=weapon?find(c,'equipment',weapon.templateId):null;
 addExpansionEffects(profile,c,effects);
 for(const key of EFFECT_KEYS)effects[key]=Math.round(effects[key]*100)/100;
 effects.extraRerolls=Math.min(4,Math.floor(effects.extraRerolls));effects.critChance=Math.min(75,effects.critChance);effects.freezeChance=Math.min(75,effects.freezeChance);effects.lifesteal=Math.min(75,effects.lifesteal);
 return {label:`${find(c,'sects',profile.sectId)?.name??'江湖'} · ${template?.name??'徒手'}`,sectId:profile.sectId,weaponType:template?.weaponType??'sword',effects,dice:clone(profile.dice),skills:profile.skills.map(id=>find(c,'skills',id)).filter(Boolean).map(({id,name,trigger,effects})=>({id,name,trigger,effects:clone(effects)})),pet,relics,bag:Object.fromEntries(RUN_ITEMS.map(id=>[id,profile.bag[id]??0])),progression:{towerFloor:profile.progression.towerFloor,towerHp:profile.progression.towerHp,worldBossHp:profile.progression.worldBossHp},contentVersion:c.version,rules:clone(c.combatRules??CONTENT.combatRules)};
}
export function applyProfileAction(profile,action,{now=Date.now()}={}){
 if(!object(action)||typeof action.type!=='string')return {profile,message:'操作格式不正确。'};
 if(!integer(now))return {profile,message:'时间须为非负整数。'};
 const validation=validateProfile(profile);if(!validation.valid)return {profile,message:`档案错误：${validation.errors[0]}`};
 const p=validation.profile,c=getContent(p);let message='操作完成。';
 try{
  observeExpansion(p,c,now);guardLegacyExpansion(p,action);
  const {type,id,uid}=action;
  if(isExpansionAction(type)){message=runExpansionAction(p,c,action,{now,pay:(cost,factor=1)=>pay(p,scaleCost(cost,factor)),reward:(amount,factor=1)=>reward(p,scaleCost(amount,factor)),random:()=>rng(p),addItem:templateId=>addItem(p,templateId)});
  }else if(['equip','unequip','enhance','downgrade','salvage','fuse','refine','refine-accept','refine-cancel','socket','unsocket','lock'].includes(type)){
   const item=uid===undefined?null:itemByUid(p,uid);
   if(type==='equip'){if(!item)fail('请选择装备。');const template=requireEntry(c,'equipment',item.templateId);p.equipped[template.slot]=uid;message=`已装备${template.name}。`;}
   if(type==='unequip'){requireEntry(c,'slots',action.slot);if(!p.equipped[action.slot])fail('该槽位没有装备。');delete p.equipped[action.slot];}
   if(type==='enhance'||type==='downgrade'){requireEntry(c,'slots',action.slot);const level=p.slotLevels[action.slot];if(type==='enhance'){if(level>=c.economy.maxEnhance)fail('强化已到上限。');pay(p,{gold:c.economy.enhanceGold*(level+1),dust:c.economy.enhanceDust*(level+1)});p.slotLevels[action.slot]++;p.stats.enhances++;}else{if(level<=0)fail('槽位尚未强化。');p.slotLevels[action.slot]--;reward(p,{gold:Math.floor(c.economy.enhanceGold*level*c.economy.downgradeGoldRefund),dust:c.economy.enhanceDust*level});message='槽位降一级，返还全部材料与一半金币。';}}
   if(['salvage','fuse','refine','refine-accept','refine-cancel','socket','unsocket','lock'].includes(type)&&!item)fail('请选择装备。');
   if(type==='lock'){item.locked=!item.locked;message=item.locked?'已锁定装备。':'已解锁装备。';}
   if(type==='salvage'){destructible(p,item);const template=requireEntry(c,'equipment',item.templateId);const rarity=requireEntry(c,'rarities',template.rarity);for(const gemId of item.gems)p.gems[gemId]++;p.inventory=p.inventory.filter(i=>i.uid!==uid);reward(p,{dust:rarity.salvage+item.fusionLevel*c.economy.fusionDustReturn,gold:c.economy.salvageGold});message='已分解并返还镶嵌宝石。';}
   if(type==='fuse'){destructible(p,item);if(item.fusionLevel>=c.economy.maxFusion)fail('融合已到上限。');const other=p.inventory.find(i=>i.uid!==uid&&i.templateId===item.templateId&&!i.locked&&!i.pendingRefine&&!p.expansion.gear[i.uid]?.pending&&!p.expansion.gear[i.uid]?.locks.length&&!Object.values(p.equipped).includes(i.uid)&&!i.gems.length);if(!other)fail('需要一件相同模板的未装备、未锁定且未镶嵌的装备。');pay(p,scaleCost(c.economy.fuseCost,item.fusionLevel+1));p.inventory=p.inventory.filter(i=>i.uid!==other.uid);item.fusionLevel++;message=`融合成功，基础属性每级提升 ${Math.round(c.economy.fusionBonus*100)}%。`;}
   if(type==='refine'){if(item.pendingRefine)fail('请先处理已有洗练候选。');pay(p,c.economy.refineCost);item.pendingRefine={effects:{attack:c.economy.refineAttackMin+Math.floor(rng(p)*c.economy.refineAttackRange),maxHp:c.economy.refineHpMin+Math.floor(rng(p)*c.economy.refineHpRange)}};message='洗练候选已生成，接受后才会生效。';}
   if(type==='refine-accept'){if(!item.pendingRefine)fail('没有待接受的候选。');item.refine=item.pendingRefine;delete item.pendingRefine;}
   if(type==='refine-cancel'){if(!item.pendingRefine)fail('没有待取消的候选。');delete item.pendingRefine;message='已取消候选，原属性保留，洗练费用不返还。';}
   if(type==='socket'){requireEntry(c,'gems',action.gemId);const template=requireEntry(c,'equipment',item.templateId);if(item.gems.length>=template.maxSockets)fail('镶孔已满。');if(!(p.gems[action.gemId]>0))fail('宝石不足。');p.gems[action.gemId]--;item.gems.push(action.gemId);}
   if(type==='unsocket'){if(!integer(action.index,0,item.gems.length-1))fail('镶孔编号不正确。');p.gems[item.gems.splice(action.index,1)[0]]++;}
  }else if(type==='sect'){const entry=requireEntry(c,'sects',id);p.sectId=id;for(const die of p.dice)die.faces=clone(entry.faces);message=`已加入${entry.name}，骰面重置为本门默认。`;
  }else if(type==='skill'){requireEntry(c,'skills',id);toggle(p.skills,id,4);
  }else if(type==='talent'){const entry=requireEntry(c,'talents',id);levelUp(p,entry,p.talents);
  }else if(type==='face'){const d=faceAt(p,action.die,action.face);if(!integer(action.value,1,6))fail('点数须为 1..6 整数。');pay(p,c.economy.faceCost);d.faces[action.face]=action.value;
  }else if(type==='material'){const d=dieAt(p,action.die),entry=requireEntry(c,'materials',id);pay(p,entry.cost);d.materialId=id;d.materialLevel=1;
  }else if(type==='material-upgrade'){const d=dieAt(p,action.die),entry=requireEntry(c,'materials',d.materialId);if(d.materialLevel>=5)fail('材质已到五级。');pay(p,scaleCost(entry.upgradeCost,d.materialLevel));d.materialLevel++;
  }else if(type==='decoration'){const d=dieAt(p,action.die),entry=requireEntry(c,'decorations',id);pay(p,entry.cost);d.decorationId=id;
  }else if(type==='mark'){const d=faceAt(p,action.die,action.face);if(id!==null){const entry=requireEntry(c,'marks',id);if(id==='wild'&&!d.marks.includes('wild')&&p.dice.filter(die=>die.marks.includes('wild')).length>=2)fail('变纹最多刻在两枚骰子上。');pay(p,entry.cost);}d.marks[action.face]=id;
  }else if(type==='relic'){requireEntry(c,'relics',id);toggle(p.relics.equipped,id,3);
  }else if(['relic-refine','relic-accept','relic-cancel','relic-infuse'].includes(type)){const entry=requireEntry(c,'relics',id);if(type==='relic-refine'){if(p.relics.pending[id])fail('请先处理遗物洗练候选。');pay(p,entry.refineCost);p.relics.pending[id]={damage:c.economy.relicRefineDamageMin+Math.floor(rng(p)*c.economy.relicRefineDamageRange),effects:{maxHp:Math.floor(rng(p)*c.economy.relicRefineHpRange)+c.economy.relicRefineHpMin}};}if(type==='relic-accept'){if(!p.relics.pending[id])fail('没有遗物候选。');p.relics.refines[id]=p.relics.pending[id];delete p.relics.pending[id];}if(type==='relic-cancel'){if(!p.relics.pending[id])fail('没有遗物候选。');delete p.relics.pending[id];}if(type==='relic-infuse'){const level=p.relics.infusions[id]??0;if(level>=entry.maxLevel)fail('灌注已到上限。');pay(p,scaleCost(entry.infuseCost,level+1));p.relics.infusions[id]=level+1;}
  }else if(type==='rune'){if(!integer(action.slot,0,4))fail('符文槽须为 0..4。');if(id!==null){requireEntry(c,'runes',id);if(p.runes.slots.some((v,i)=>v===id&&i!==action.slot))fail('同一枚符文不可重复装配。');}p.runes.slots[action.slot]=id;p.runes.plans[p.runes.planIndex]=clone(p.runes.slots);
  }else if(type==='rune-fuse'){const entry=requireEntry(c,'runes',id);const level=p.runes.levels[id]??1;if(level>=entry.maxLevel)fail('符文已到上限。');pay(p,scaleCost(entry.cost,level));p.runes.levels[id]=level+1;
  }else if(type==='rune-plan'){if(!integer(action.index,0,2))fail('符文方案须为 0..2。');p.runes.plans[p.runes.planIndex]=clone(p.runes.slots);p.runes.planIndex=action.index;p.runes.slots=clone(p.runes.plans[action.index]);
  }else if(type==='pet'){if(id!==null)requireEntry(c,'pets',id);p.pet=id;
  }else if(type==='pet-train'){const entry=requireEntry(c,'pets',id),level=p.petLevels[id]??1;if(level>=entry.maxLevel)fail('灵兽已到上限。');if(p.bag.food<1)fail('灵兽口粮不足。');pay(p,scaleCost(entry.cost,level));p.bag.food--;p.petLevels[id]=level+1;
  }else if(type==='soul'){requireEntry(c,'souls',id);toggle(p.souls,id,3);
  }else if(type==='title'){if(id!==null)requireEntry(c,'titles',id);p.title=id;
  }else if(type==='buy'){const entry=requireEntry(c,'shop',id);pay(p,entry.cost);output(p,c,entry.output);p.stats.purchases++;
  }else if(type==='draw'){pay(p,c.economy.drawCost);const roll=rng(p);p.drawsSinceRare++;const rare=p.drawsSinceRare>=c.economy.drawPity||roll<.12;const pool=c.equipment.filter(e=>rare?requireEntry(c,'rarities',e.rarity).rank>=2:requireEntry(c,'rarities',e.rarity).rank<2);if(!pool.length)fail('抽取目录没有可用装备。');const chosen=pool[Math.floor(rng(p)*pool.length)];addItem(p,chosen.id);if(rare)p.drawsSinceRare=0;p.stats.draws++;message=`本地寻宝获得${chosen.name}。`;
  }else if(type==='gather'){const entry=requireEntry(c,'gathering',id);pay(p,entry.cost);output(p,c,entry.output);p.stats.gathers++;
  }else if(type==='craft'){const entry=requireEntry(c,'recipes',id);for(const [bagId,n]of Object.entries(entry.ingredients??{}))if(!BAG_ITEMS.includes(bagId)||!integer(n)||p.bag[bagId]<n)fail('配方材料不足。');pay(p,entry.cost);for(const [bagId,n]of Object.entries(entry.ingredients??{}))p.bag[bagId]-=n;output(p,c,entry.output);p.stats.crafts++;
  }else if(type==='train'||type==='meridian'){const key=type==='train'?'training':'meridians';levelUp(p,requireEntry(c,key,id),p[key]);p.stats.training++;
  }else if(type==='gift'){const entry=requireEntry(c,'companions',id);if(p.bag.gift<1)fail('山水礼不足。');pay(p,entry.giftCost);p.bag.gift--;p.companions[id].affinity++;p.stats.gifts++;
  }else if(type==='recruit'){const entry=requireEntry(c,'companions',id);if(p.apprentices[id])fail('这位伙伴已经拜师。');if(p.companions[id].affinity<entry.recruitAffinity)fail('交情不足，先赠礼相识。');pay(p,entry.recruitCost);p.apprentices[id]={level:1};
  }else if(type==='apprentice-train'){const entry=requireEntry(c,'companions',id),apprentice=p.apprentices[id];if(!apprentice)fail('请先招收这名徒弟。');if(apprentice.level>=c.economy.maxApprenticeLevel)fail('徒弟已到上限。');pay(p,scaleCost(entry.trainCost,apprentice.level));apprentice.level++;
  }else if(type==='claim'){const entry=find(c,'quests',id)??requireEntry(c,'achievements',id);if(p.claimed.includes(id))fail('此奖励已经领取。');if((p.stats[entry.stat]??0)<entry.target)fail('尚未达到领取条件。');reward(p,entry.reward);p.claimed.push(id);
  }else if(type==='signin'){const day=Math.floor(now/86400000),claimId=`signin:${day}`;if(p.claimed.includes(claimId))fail('今日已经领取。');if(p.claimed.some(key=>key.startsWith('signin:')&&Number(key.split(':')[1])>day))fail('时间倒退，不能领取。');reward(p,c.economy.signinReward);p.claimed.push(claimId);p.stats.dailyClaims++;
  }else if(type==='offline'){if(now<=p.offlineAt)fail('时间未前进，没有离线收益。');const hours=Math.min(c.economy.offlineHours,Math.floor((now-p.offlineAt)/3600000));if(hours<1)fail('离线不足一小时。');reward(p,{gold:Math.floor(hours*c.economy.offlineGoldPerHour),dust:Math.floor(hours*c.economy.offlineDustPerHour)});p.offlineAt=now;message=`已领取 ${hours} 小时离线收益（上限 ${c.economy.offlineHours} 小时）。`;
  }else if(type==='sweep'){const entry=requireEntry(c,'chapters',action.chapter);if((p.chapterStars[entry.id]??0)<3)fail('章节三星后才可扫荡。');pay(p,entry.sweepCost);reward(p,entry.reward);p.stats.sweeps++;p.stats.clears++;
  }else if(type==='codex-claim'||type==='collection'){const entry=requireEntry(c,type==='collection'?'collections':'codex',id),claimId=`${type}:${id}`;if(p.claimed.includes(claimId))fail('此收藏奖励已经领取。');if(type==='collection'){const owned=new Set(p.inventory.map(i=>i.templateId));const count=c.equipment.filter(e=>e.setId===entry.setId&&owned.has(e.id)).length;if(count<entry.target)fail('套装收藏数量不足。');}reward(p,entry.reward);p.claimed.push(claimId);
  }else if(type==='developer-grant'){reward(p,c.economy.grant);for(const id of BAG_ITEMS)p.bag[id]+=20;for(const id of Object.keys(p.gems))p.gems[id]+=10;for(const template of c.equipment)if(!p.inventory.some(i=>i.templateId===template.id))addItem(p,template.id);message='创作测试补给：资源、消耗品和全目录已补齐。';
  }else if(type==='content-import'){const check=validateContent(action.value);if(!check.valid)fail(`配置无效：${check.errors.join('；')}`);p.contentOverrides=check.content;for(const g of check.content.gems)if(!own(p.gems,g.id))p.gems[g.id]=3;for(const pet of check.content.pets)if(!own(p.petLevels,pet.id))p.petLevels[pet.id]=1;for(const v of check.content.companions)if(!own(p.companions,v.id))p.companions[v.id]={affinity:0};for(const v of check.content.runes)if(!own(p.runes.levels,v.id))p.runes.levels[v.id]=1;for(const v of check.content.relics)if(!own(p.relics.levels,v.id))p.relics.levels[v.id]=1;for(const v of check.content.equipment)if(!p.inventory.some(i=>i.templateId===v.id))addItem(p,v.id);const checked=validateProfile(p);if(!checked.valid)fail(`配置与档案不兼容：${checked.errors.join('；')}`);message='原创内容配置已应用；当前战斗快照保持原值。';
  }else if(type==='content-reset'){p.contentOverrides=null;const checked=validateProfile(p);if(!checked.valid)fail('档案正在使用自订条目，暂不能恢复默认配置。');message='已恢复原创默认配置。';
  }else fail('未知操作。');
  observeExpansion(p,getContent(p),now);
  const checked=validateProfile(p);if(!checked.valid)fail(`操作结果无效：${checked.errors[0]}`);
  return {profile:p,message};
 }catch(error){return {profile,message:error?.message??'操作失败。'};}
}
export function beginExpedition(profile,{now=Date.now()}={}){
 const check=validateProfile(profile);if(!check.valid)return {profile,message:`档案无效：${check.errors[0]}`,runId:null,loadout:null};
 if(!integer(now))return {profile,message:'时间须为非负整数。',runId:null,loadout:null};
 const p=check.profile;observeExpansion(p,getContent(p),now);const runId=p.nextRunId++;p.stats.runs++;return {profile:p,message:'行装已备，新游历使用此刻的配装快照。',runId,loadout:deriveLoadout(profile)};
}
export function settleRun(profile,run,{now=Date.now()}={}){
 if(!object(run)||!integer(run.runId,1)||!integer(profile?.nextRunId,2)||run.runId>=profile.nextRunId)return {profile,message:'无法结算：游历编号无效。'};
 if(profile.settledRunIds.includes(run.runId))return {profile,message:'此游历已结算，无重复奖励。'};
 if(!['victory','defeat','abandoned'].includes(run.flow))return {profile,message:'游历尚未结束。'};
 if(!integer(now))return {profile,message:'结算时间不正确。'};
 const checked=validateProfile(profile);if(!checked.valid)return {profile,message:'档案无效，未结算。'};
 const p=checked.profile,c=getContent(p);
 try{
  observeExpansion(p,c,now);
  for(const [id,n]of Object.entries(run.consumed??{}))if(!RUN_ITEMS.includes(id)||!integer(n))fail('消耗品结算数量无效。');
  for(const id of RUN_ITEMS){const consumed=run.consumed?.[id]??0;let delta=-consumed;
   if(run.bag&&run.loadout?.bag){const final=run.bag[id],initial=run.loadout.bag[id];if(!integer(final)||!integer(initial)||final+consumed<initial)fail('行囊快照或消耗记录不一致。');delta=final-initial;}
   if(run.flow==='abandoned')delta=Math.min(0,delta);
   if(p.bag[id]+delta<0)fail('消耗品结算数量超过库存。');p.bag[id]+=delta;
  }
  p.settledRunIds.push(run.runId);
  if(run.flow==='abandoned')return {profile:p,message:'已放弃游历，仅扣除用过的行囊物品，没有奖励。',rewards:{}};
  receiveExpansionLoot(p,c,run,templateId=>addItem(p,templateId));
  const mode=requireEntry(c,'modes',run.mode??'campaign');const chapter=find(c,'chapters',run.chapter??'bamboo');const won=run.flow==='victory';
  const configured=run.reward??run.results?.reward??(mode.id==='campaign'?chapter?.reward:mode.reward)??mode.reward;
  const bonus=run.loadout?.effects?.goldBonus??0;if(typeof bonus!=='number'||!Number.isFinite(bonus)||bonus<0)fail('金币加成无效。');
  const rate=won?1:c.economy.defeatRewardRate;const rewards=Object.fromEntries(Object.entries(configured).map(([key,n])=>[key,Math.floor(n*rate*(key==='gold'?1+bonus/100:1))]));
  if(run.coins!==undefined&&!integer(run.coins))fail('局内金币结算无效。');rewards.gold=(rewards.gold??0)+(run.coins??0);reward(p,rewards);
  const stats=run.stats??{};for(const key of ['kills','turns']){const n=stats[key]??(key==='turns'?stats.rounds??0:0);if(!integer(n))fail('游历统计无效。');p.stats[key]+=n;}
  if(won){p.stats.clears++;p.progression.modes[mode.id]=(p.progression.modes[mode.id]??0)+1;
   if(mode.id==='campaign'&&chapter&&!p.expansion.firstClears.includes(chapter.id)){reward(p,c.expansion.cycles.firstClear);p.expansion.firstClears.push(chapter.id);}
   if(mode.id==='campaign'&&chapter){const hp=run.hero?.hp??0,maxHp=run.hero?.maxHp??180;const stars=1+(hp>=maxHp*c.economy.threeStarHpRatio?1:0)+((stats.turns??stats.rounds??100)<=c.economy.threeStarTurns?1:0);p.chapterStars[chapter.id]=Math.max(p.chapterStars[chapter.id]??0,stars);}
   if(mode.id==='tower'){const completed=run.results?.towerFloorCompleted??run.floor??p.progression.towerFloor;if(!integer(completed,1,1000000))fail('通天塔层数无效。');p.progression.towerFloor=Math.max(p.progression.towerFloor,completed+1);p.progression.towerHp=Math.max(1,Math.floor(run.hero?.hp??180));}
  }else if(mode.id==='tower')p.progression.towerHp=180;
  if(mode.id==='worldboss'){
   const remaining=run.results?.worldBossHp;if(remaining!==undefined){if(!integer(remaining))fail('世界首领生命无效。');p.progression.worldBossHp=remaining;}
   else{const damage=run.results?.worldBossDamage??stats.damage??0;if(!integer(damage))fail('世界首领伤害无效。');p.progression.worldBossHp=Math.max(0,p.progression.worldBossHp-damage);}
   if(p.progression.worldBossHp===0){reward(p,c.economy.worldBossKillReward);p.progression.worldBossHp=c.economy.worldBossHp;}
  }
  observeExpansion(p,c,now);
  const validation=validateProfile(p);if(!validation.valid)fail(`结算结果错误：${validation.errors[0]}`);
  return {profile:p,message:won?'游历结算完成，奖励已入库。':'历练结束，保留四分之一基础奖励与已获金币。',rewards};
 }catch(error){return {profile,message:error.message};}
}
export function validateProfile(value){
 const errors=[];let p;
 try{p=typeof value==='string'?JSON.parse(value):clone(value);}catch{return {valid:false,profile:null,errors:['档案必须是有效 JSON。']};}
 const error=message=>{if(errors.length<40)errors.push(message);};
 let nodes=0;
 function safe(v,depth=0){if(++nodes>60000||depth>16){error('档案过大或嵌套过深。');return;}if(v===null||typeof v==='boolean')return;if(typeof v==='number'){if(!Number.isFinite(v)||v<0||v>Number.MAX_SAFE_INTEGER)error('档案含无效数值。');return;}if(typeof v==='string'){if(v.length>4000||/[<>\u0000-\u0008]/.test(v))error('档案文本含 HTML 或控制字符。');return;}if(!object(v)&&!Array.isArray(v)){error('档案只支持普通 JSON 数据。');return;}for(const [key,item]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(key)){error('档案含不允许的键。');continue;}safe(item,depth+1);}}
 safe(p);
 if(!object(p))return {valid:false,profile:null,errors:['档案须为对象。']};
 if(p.expansion===undefined)p.expansion=ensureExpansion(p);
 const fields=['expansion','version','seed','nextRunId','nextUid','resources','inventory','equipped','slotLevels','dice','sectId','skills','talents','relics','runes','pet','petLevels','souls','title','training','meridians','companions','apprentices','bag','gems','stats','chapterStars','claimed','settledRunIds','contentOverrides','progression','drawsSinceRare','offlineAt','createdAt'];
 for(const key of Object.keys(p))if(!fields.includes(key))error(`未知档案字段：${key}`);
 for(const key of fields)if(!own(p,key))error(`缺少档案字段：${key}`);
 if(p.version!==1)error('档案版本须为 1。');
 for(const key of ['nextRunId','nextUid'])if(!integer(p[key],1))error(`${key} 须为正整数。`);
 if(!integer(p.seed,0,4294967295))error('随机种子须为 32 位非负整数。');
 for(const key of ['offlineAt','createdAt','drawsSinceRare'])if(!integer(p[key]))error(`${key} 须为非负整数。`);
 let c=CONTENT;if(p.contentOverrides!==null){const check=validateContent(p.contentOverrides);if(!check.valid)error(`内容配置无效：${check.errors[0]}`);else c=check.content;}
 function catalogId(key,id,nullable=false){return nullable&&id===null||typeof id==='string'&&Boolean(find(c,key,id));}
 function record(v,label,validKey,validValue){if(!object(v)){error(`${label} 须为对象。`);return;}for(const [k,n]of Object.entries(v))if(!validKey(k)||!validValue(n,k))error(`${label}.${k} 无效。`);}
 function list(v,label,valid,max,unique=true){if(!Array.isArray(v)||v.length>max){error(`${label} 数量无效。`);return;}if(v.some(n=>!valid(n))||unique&&new Set(v).size!==v.length)error(`${label} 含无效或重复条目。`);}
 function effects(v){return object(v)&&Object.entries(v).every(([k,n])=>EFFECT_KEYS.includes(k)&&typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1000000);}
 function refinement(v){return object(v)&&effects(v.effects)&&Object.keys(v).every(k=>k==='effects');}
 record(p.resources,'资源',k=>CURRENCIES.includes(k),n=>integer(n,0,1000000000));if(CURRENCIES.some(k=>!own(p.resources??{},k)))error('缺少必要货币。');
 record(p.bag,'行囊',k=>BAG_ITEMS.includes(k),n=>integer(n,0,1000000000));if(BAG_ITEMS.some(k=>!own(p.bag??{},k)))error('缺少行囊物品字段。');
 record(p.gems,'宝石',k=>catalogId('gems',k),n=>integer(n,0,1000000000));
 const uids=new Set();if(!Array.isArray(p.inventory)||p.inventory.length>10000)error('装备背包须为最多一万件的数组。');else for(const item of p.inventory){if(!object(item)){error('装备实例须为对象。');continue;}const template=find(c,'equipment',item.templateId);if(typeof item.uid!=='string'||!/^item-[1-9][0-9]*$/.test(item.uid)||uids.has(item.uid)){error('装备实例编号无效或重复。');}else{uids.add(item.uid);if(Number(item.uid.slice(5))>=p.nextUid)error('装备编号计数器必须递增。');}
  if(!template||typeof item.locked!=='boolean'||!integer(item.fusionLevel,0,c.economy.maxFusion)||!refinement(item.refine)||item.pendingRefine!==undefined&&!refinement(item.pendingRefine))error('装备模板、锁定、融合或洗练字段无效。');
  if(!Array.isArray(item.gems)||item.gems.length>(template?.maxSockets??0)||item.gems.some(id=>!catalogId('gems',id)))error('镶嵌宝石无效。');
  if(Object.keys(item).some(k=>!['uid','templateId','refine','gems','locked','fusionLevel','pendingRefine'].includes(k)))error('装备含未知字段。');
 }
 if(errors.length)return {valid:false,profile:null,errors};
 const equippedUids=new Set();record(p.equipped,'装配',k=>catalogId('slots',k),(uid,slot)=>{const item=p.inventory?.find?.(i=>i?.uid===uid);if(!item||find(c,'equipment',item.templateId)?.slot!==slot||equippedUids.has(uid))return false;equippedUids.add(uid);return true;});
 record(p.slotLevels,'强化',k=>catalogId('slots',k),n=>integer(n,0,c.economy.maxEnhance));if(c.slots.some(s=>!own(p.slotLevels??{},s.id)))error('缺少槽位强化等级。');
 if(!Array.isArray(p.dice)||p.dice.length!==5)error('骰匣须有五枚骰子。');else{let wild=0;for(const d of p.dice){if(!object(d)){error('骰子须为对象。');continue;}if(!Array.isArray(d.faces)||d.faces.length!==6||d.faces.some(v=>!integer(v,1,6)))error('每枚骰子须有六个 1..6 点数。');if(!Array.isArray(d.marks)||d.marks.length!==6||d.marks.some(id=>!catalogId('marks',id,true)))error('每枚骰子须有六个合法刻印。');if(d.marks?.includes?.('wild'))wild++;if(!catalogId('materials',d.materialId)||!integer(d.materialLevel,1,5)||!catalogId('decorations',d.decorationId))error('骰子材质、等级或装饰无效。');}if(wild>2)error('变纹最多位于两枚骰子上。');}
 if(!catalogId('sects',p.sectId))error('门派不存在。');list(p.skills,'武学',id=>catalogId('skills',id),4);list(p.souls,'武魂',id=>catalogId('souls',id),3);
 for(const key of ['talents','training','meridians'])record(p[key],key,id=>catalogId(key,id),(n,id)=>integer(n,0,find(c,key,id).maxLevel));
 if(!catalogId('pets',p.pet,true)||!catalogId('titles',p.title,true))error('灵兽或称号不存在。');record(p.petLevels,'灵兽等级',id=>catalogId('pets',id),(n,id)=>integer(n,1,find(c,'pets',id).maxLevel));
 if(!object(p.relics))error('遗物数据无效。');else{list(p.relics.equipped,'遗物装配',id=>catalogId('relics',id),3);record(p.relics.levels,'遗物等级',id=>catalogId('relics',id),(n,id)=>integer(n,1,find(c,'relics',id).maxLevel));for(const key of ['pending','refines'])record(p.relics[key],`遗物${key}`,id=>catalogId('relics',id),v=>object(v)&&integer(v.damage,0,1000000)&&effects(v.effects));record(p.relics.infusions,'遗物灌注',id=>catalogId('relics',id),(n,id)=>integer(n,0,find(c,'relics',id).maxLevel));}
 function runeSlots(v){return Array.isArray(v)&&v.length===5&&v.every(id=>catalogId('runes',id,true))&&new Set(v.filter(Boolean)).size===v.filter(Boolean).length;}
 if(!object(p.runes))error('符文数据无效。');else{if(!runeSlots(p.runes.slots))error('符文槽位无效。');record(p.runes.levels,'符文等级',id=>catalogId('runes',id),(n,id)=>integer(n,1,find(c,'runes',id).maxLevel));if(!integer(p.runes.planIndex,0,2)||!Array.isArray(p.runes.plans)||p.runes.plans.length!==3||p.runes.plans.some(v=>!runeSlots(v)))error('符文方案无效。');}
 record(p.companions,'交情',id=>catalogId('companions',id),v=>object(v)&&integer(v.affinity,0,1000000));record(p.apprentices,'徒弟',id=>catalogId('companions',id),v=>object(v)&&integer(v.level,1,c.economy.maxApprenticeLevel));
 record(p.stats,'统计',k=>['runs','clears','kills','turns','enhances','purchases','gathers','training','crafts','draws','dailyClaims','sweeps','gifts'].includes(k),n=>integer(n,0,1000000000));
 for(const [map,key]of [[p.gems,'gems'],[p.petLevels,'pets'],[p.companions,'companions']])if(c[key].some(row=>!own(map??{},row.id)))error(`${key} 的可用条目不完整。`);
 if(['runs','clears','kills','turns','enhances','purchases','gathers','training','crafts','draws','dailyClaims','sweeps','gifts'].some(k=>!own(p.stats??{},k)))error('缺少必要统计字段。');
 record(p.chapterStars,'章节星级',id=>catalogId('chapters',id),n=>integer(n,0,3));
 list(p.claimed,'已领奖励',v=>typeof v==='string'&&/^[a-z][a-z0-9:-]{0,119}$/.test(v),20000);list(p.settledRunIds,'已结算游历',v=>integer(v,1,p.nextRunId-1),100000);
 if(!object(p.progression)||!integer(p.progression.towerFloor,1,1000000)||!integer(p.progression.towerHp,0,1000000)||!integer(p.progression.worldBossHp,0,100000000))error('持久挑战进度无效。');else record(p.progression.modes,'模式进度',id=>catalogId('modes',id),n=>integer(n,0,1000000000));
 errors.push(...validateExpansionState(p,c));
 return {valid:errors.length===0,profile:errors.length?null:p,errors};
}
export function saveProfile(storage,profile){
 const check=validateProfile(profile);if(!check.valid)return {ok:false,message:`档案无效：${check.errors[0]}`};
 try{storage.setItem(PROFILE_KEY,JSON.stringify(check.profile));return {ok:true,message:'门庭档案已保存。'};}catch{return {ok:false,message:'保存失败：本地存储不可用或空间已满。'};}
}
export function loadProfile(storage){
 try{const raw=storage.getItem(PROFILE_KEY);if(raw===null||raw===undefined)return {profile:null,message:'尚无门庭档案。'};const check=validateProfile(raw);return {profile:check.profile,message:check.valid?'门庭档案已载入。':`档案无效：${check.errors[0]}`};}catch{return {profile:null,message:'读取失败：本地存储不可用。'};}
}
