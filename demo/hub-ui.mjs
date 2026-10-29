import {getContent} from './content.mjs';
import {deriveLoadout} from './profile.mjs';

export const HUB_TABS=[['expedition','出征'],['equipment','兵装'],['dice','骰匣'],['skills','武学'],['relics','奇珍'],['companions','灵兽武魂'],['training','修炼'],['workshop','工坊商店'],['quests','任务图鉴'],['relations','江湖关系'],['editor','修改工具']];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={gold:'铜钱',dust:'锻材',essence:'精华',insight:'悟性',attack:'攻击',maxHp:'气血',armor:'减伤',critChance:'暴击%',critDamage:'暴伤%',lifesteal:'吸血%',poisonDamage:'毒伤',shieldGain:'护盾',extraRerolls:'重掷',openingShield:'开场盾',regen:'回合回复',thorns:'反伤',fireDamage:'火伤',freezeChance:'冻结%',comboBonus:'直伤%',goldBonus:'铜钱%',damage:'伤害',heal:'回复',shield:'护盾',poison:'毒层',potion:'回气散',reroll:'转运签',antidote:'解毒丸',tonic:'养元露',herb:'药草',ore:'矿石',hide:'皮革',gift:'山水礼',food:'灵兽食粮'};
const textStats=o=>Object.entries(o||{}).filter(([,v])=>v!==0).map(([k,v])=>`${labels[k]||k} ${typeof v==='number'?Number(v.toFixed(2)):v}`).join(' · ')||'基础条目';
const action=(label,payload,disabled=false,cls='')=>`<button type="button" class="hub-button ${cls}" data-action="profile" data-value="${esc(JSON.stringify(payload))}" ${disabled?'disabled':''}>${esc(label)}</button>`;
const button=(label,type,value='',cls='')=>`<button type="button" class="hub-button ${cls}" data-action="${esc(type)}" data-value="${esc(value)}">${esc(label)}</button>`;
const optionList=(values,current)=>values.map(v=>`<option value="${esc(v.id??v[0])}" ${(v.id??v[0])===current?'selected':''}>${esc(v.name??v[1])}</option>`).join('');
const select=(field,label,values,current,kind='')=>`<label class="hub-field"><span>${esc(label)}</span><select data-field="${field}" ${kind?'data-kind="number"':''}>${optionList(values,current)}</select></label>`;
const form=(body,buttons,cls='')=>`<form class="hub-form ${cls}">${body}<div class="hub-actions">${buttons}</div></form>`;
const card=(title,body,buttons='',meta='')=>`<article class="hub-card"><div class="hub-card-head"><h3>${esc(title)}</h3>${meta?`<span>${esc(meta)}</span>`:''}</div><div class="hub-card-body">${body}</div>${buttons?`<div class="hub-actions">${buttons}</div>`:''}</article>`;
const section=(title,body,note='')=>`<section class="hub-section"><div class="hub-section-heading"><h2>${esc(title)}</h2>${note?`<p>${esc(note)}</p>`:''}</div>${body}</section>`;
const grid=body=>`<div class="hub-grid">${body}</div>`;
const lookup=(list,id)=>list?.find(v=>v.id===id);
const info=x=>`<p>${esc(x?.description||'可在本地配置中调整效果与成本。')}</p>`;
const effect=x=>`<p class="hub-effect">${esc(textStats(x?.effects))}</p>`;
const cost=x=>`<small class="hub-cost">消耗：${esc(textStats(x||{}))}</small>`;
const scaledCost=(value,factor=1)=>Object.fromEntries(Object.entries(value||{}).map(([id,n])=>[id,Math.ceil(n*factor)]));
const paidOptions=rows=>rows.map(row=>({...row,name:`${row.name} · ${textStats(row.cost)}`}));
const isEquipped=(p,uid)=>Object.values(p.equipped||{}).includes(uid);
const numberOptions=(max,start=0)=>Array.from({length:max},(_,i)=>({id:String(i+start),name:String(i+start)}));

export function renderHub(profile,{tab='expedition',filter='weapon',editorText='',hasSave=false}={}){
 if(!profile)return '';
 const c=getContent(profile),loadout=deriveLoadout(profile),resources=profile.resources||{};
 const content={expedition:expeditionPanel,equipment:equipmentPanel,dice:dicePanel,skills:skillsPanel,relics:relicsPanel,companions:companionsPanel,training:trainingPanel,workshop:workshopPanel,quests:questsPanel,relations:relationsPanel,editor:editorPanel};
 return `<div class="hub" aria-label="完整江湖系统"><div class="hub-banner"><div><span class="eyebrow">七派江湖 · 本地可改版</span><h2>江湖门庭</h2><p>先试配，再出征。兵装与修炼在下一局生效，当前旅途可继续。</p></div><div class="hub-resources">${Object.entries(resources).map(([id,n])=>`<span>${esc(labels[id]||id)}<b>${esc(n)}</b></span>`).join('')}</div></div><nav class="hub-nav" aria-label="门庭系统">${HUB_TABS.map(([id,name])=>`<button type="button" data-action="hub-tab" data-value="${id}" aria-pressed="${id===tab}" class="${id===tab?'active':''}">${name}</button>`).join('')}</nav><div class="loadout-summary" aria-label="下次出征属性"><strong>${esc(loadout.label||'当前配装')}</strong><span>${esc(textStats(loadout.effects))}</span></div><div class="hub-content">${(content[tab]||content.expedition)(profile,c,{filter,editorText,hasSave})}</div></div>`;
}
function expeditionPanel(p,c,{hasSave}){
 const fields=select('build','局内传承',[{id:'sword',name:'剑气'},{id:'poison',name:'毒针'},{id:'guard',name:'金刚'}],'sword')+select('mode','玩法',c.modes,'campaign')+select('chapter','章节',c.chapters,'bamboo');
 const start=`<button type="button" class="hub-button primary" data-action="expedition">按当前配装出征 →</button>`;
 const resume=hasSave?button('继续已保存旅途','resume','','secondary'):'';
 return section('行路问招',form(fields,start+resume,'expedition-form'),'进入战斗自动掷骰；选中要换的骰子，再决定何时出招。')+
 grid(c.modes.map(m=>card(m.name,info(m)+`<p class="hub-effect">${esc(textStats(m.reward))}</p>`,form(select('build','传承',[{id:'sword',name:'剑气'},{id:'poison',name:'毒针'},{id:'guard',name:'金刚'}],'sword')+`<input type="hidden" data-field="mode" value="${esc(m.id)}"><input type="hidden" data-field="chapter" value="bamboo">`,`<button type="button" class="hub-button" data-action="expedition">进入${esc(m.name)}</button>`),m.id==='tower'?`第 ${p.progression?.towerFloor||1} 层`:'')).join(''))+
 section('山河星谱',grid(c.chapters.map(ch=>card(ch.name,info(ch)+`<p>章节星级 <strong>${'★'.repeat(p.chapterStars?.[ch.id]||0)}${'☆'.repeat(3-(p.chapterStars?.[ch.id]||0))}</strong></p>${cost(ch.sweepCost)}`,action('已通关章节扫荡',{type:'sweep',chapter:ch.id}))).join('')));
}
function equipmentPanel(p,c,{filter}){
 const owned=p.inventory||[],slots=c.slots.map(s=>{const item=owned.find(i=>i.uid===p.equipped?.[s.id]),t=lookup(c.equipment,item?.templateId);return card(s.name,`<p>${esc(t?.name||'未装备')}</p><p>槽位强化 +${p.slotLevels?.[s.id]||0}</p>${cost({gold:c.economy.enhanceGold*((p.slotLevels?.[s.id]||0)+1),dust:c.economy.enhanceDust*((p.slotLevels?.[s.id]||0)+1)})}`,action('强化槽位',{type:'enhance',slot:s.id})+action('重置返还',{type:'downgrade',slot:s.id})+(item?action('卸下',{type:'unequip',slot:s.id}):''));}).join('');
 const nav=`<div class="hub-filters">${c.slots.map(s=>button(s.name,'hub-filter',s.id,s.id===filter?'active':'')).join('')}</div>`;
 const items=owned.filter(i=>lookup(c.equipment,i.templateId)?.slot===filter).map(i=>{const t=lookup(c.equipment,i.templateId),equipped=isEquipped(p,i.uid),rarity=lookup(c.rarities,t.rarity);return card(t.name,effect(t)+`<p>${esc(lookup(c.sets,t.setId)?.name||'')} · ${esc(t.weaponType?{sword:'剑 · 顺子专精',staff:'法杖 · 牌型群攻',hammer:'锤 · 三条破势'}[t.weaponType]:'')} ${equipped?'· 已装备':''}</p><p>洗练：${esc(textStats(i.refine?.effects||i.refine||{}))}</p>${i.pendingRefine?`<p class="hub-candidate">候选：${esc(textStats(i.pendingRefine.effects||i.pendingRefine))}</p>`:''}<p>融合 +${i.fusionLevel||0} · 洗练消耗 ${esc(textStats(c.economy.refineCost))} · 合成消耗 ${esc(textStats(scaledCost(c.economy.fuseCost,(i.fusionLevel||0)+1)))}</p><p>镶嵌：${esc((i.gems||[]).map(id=>lookup(c.gems,id)?.name||id).join('、')||'空')}</p>`,
 action(equipped?'已装备':'装备',{type:'equip',uid:i.uid},equipped)+action(i.locked?'解除保护':'保护',{type:'lock',uid:i.uid})+action('洗练',{type:'refine',uid:i.uid})+(i.pendingRefine?action('接受候选',{type:'refine-accept',uid:i.uid})+action('取消候选',{type:'refine-cancel',uid:i.uid}):'')+action('同类合成',{type:'fuse',uid:i.uid},equipped||i.locked)+action('分解',{type:'salvage',uid:i.uid},equipped||i.locked)+form(select('gemId','镶嵌宝石 · 消耗1颗',c.gems.map(g=>({...g,name:`${g.name} · 拥有 ${p.gems?.[g.id]||0}`})),c.gems[0]?.id),action('镶嵌',{type:'socket',uid:i.uid}))+(i.gems||[]).map((g,index)=>action(`取下${lookup(c.gems,g)?.name||g}`,{type:'unsocket',uid:i.uid,index})).join(''),`${rarity?.name||''} · ${i.uid}`);}).join('');
 return section('六槽兵装',grid(slots),'强化跟随槽位；换装保留强化。受保护和正在装备的物品不能分解或作合成材料。')+section('行囊兵装',nav+grid(items))+section('套装与收藏',grid(c.collections.map(v=>card(v.name,`<p>收集 ${v.target} 件 · ${esc(textStats(v.reward))}</p>`,action('领取收藏奖励',{type:'collection',id:v.id}))).join('')));
}
function dicePanel(p,c){
 return section('五骰工坊',grid((p.dice||[]).map((d,die)=>card(`第 ${die+1} 颗骰子`,`<div class="hub-face-preview">${d.faces.map((v,i)=>`<span>${v}<small>${esc(lookup(c.marks,d.marks?.[i])?.name||'素面')}</small></span>`).join('')}</div><p>${esc(lookup(paidOptions(c.materials),d.materialId)?.name)} ${d.materialLevel}级 · ${esc(lookup(paidOptions(c.decorations),d.decorationId)?.name)}</p>`,
 form(select('id','材质',paidOptions(c.materials),d.materialId),action('更换材质',{type:'material',die}))+cost(scaledCost(lookup(c.materials,d.materialId)?.upgradeCost,d.materialLevel))+action('材质升阶',{type:'material-upgrade',die})+form(select('id','装饰',paidOptions(c.decorations),d.decorationId),action('更换装饰',{type:'decoration',die}))+form(select('face','物理骰面',numberOptions(6),String(0),'number')+select('value','点数',numberOptions(6,1),String(d.faces[0]),'number'),cost(c.economy.faceCost)+action('修改这一面',{type:'face',die}))+form(select('face','物理骰面',numberOptions(6),'0','number')+select('id','刻印',[{id:'',name:'擦除刻印'},...paidOptions(c.marks)],''),action('刻印这一面',{type:'mark',die})),`物理面 0–5`)).join('')),'物理面决定刻印，点数决定牌型。相同点数可重复，形成偏向骰；变纹最多替代两骰参与牌型。')+
 section('材质与装饰图录',grid([...c.materials,...c.decorations].map(v=>card(v.name,info(v))).join('')));
}
function skillsPanel(p,c){
 return section('门派与天赋',grid(c.sects.map(s=>card(s.name,info(s)+effect(s),action(p.sectId===s.id?'当前门派':'修习此门',{type:'sect',id:s.id},p.sectId===s.id))).join('')))+
 section('武学装配',grid(c.skills.map(s=>card(s.name,info(s)+`<p class="hub-effect">触发 ${esc({always:'每轮',pair:'一对及以上',triple:'三条及以上',straight:'顺子',round:'回合结束',crit:'暴击',sword:'剑气',poison:'毒针',guard:'护盾'}[s.trigger]||s.trigger)} · ${esc(textStats(s.effects))}</p>`,action((p.skills||[]).includes(s.id)?'卸下武学':'装配武学',{type:'skill',id:s.id}))).join('')),'最多同时装配四式，出招时按条件自动触发。')+
 section('永久天赋',grid(c.talents.map(t=>card(t.name,effect(t)+cost(scaledCost(t.cost,(p.talents?.[t.id]||0)+1)),action('修习一级',{type:'talent',id:t.id}),`${p.talents?.[t.id]||0} / ${t.maxLevel}`)).join('')));
}
function relicsPanel(p,c){
 const relics=p.relics||{},runes=p.runes||{};
 return section('遗物与灌注',grid(c.relics.map(r=>card(r.name,`<p>牌型阶位 ${r.handRank} · 追加伤害 ${r.damage}</p>${effect(r)}<p>洗练消耗 ${esc(textStats(r.refineCost))} · 灌注消耗 ${esc(textStats(scaledCost(r.infuseCost,(relics.infusions?.[r.id]||0)+1)))}</p><p>灌注 ${relics.infusions?.[r.id]||0} · 洗练 ${esc(textStats(relics.refines?.[r.id]?.effects||relics.refines?.[r.id]||{}))}</p>${relics.pending?.[r.id]?`<p class="hub-candidate">新候选 ${esc(textStats(relics.pending[r.id]?.effects||relics.pending[r.id]))}</p>`:''}`,action((relics.equipped||[]).includes(r.id)?'取下遗物':'装配遗物',{type:'relic',id:r.id})+action('灌注',{type:'relic-infuse',id:r.id})+action('洗练',{type:'relic-refine',id:r.id})+(relics.pending?.[r.id]?action('接受',{type:'relic-accept',id:r.id})+action('取消',{type:'relic-cancel',id:r.id}):''))).join('')),'最多三件。共鸣与灌注效果计入配装。')+
 section('五符文方案',form(select('index','方案',numberOptions(3),String(runes.planIndex||0),'number'),action('切换方案',{type:'rune-plan'}))+grid(Array.from({length:5},(_,slot)=>card(`符位 ${slot+1}`,`<p>${esc(lookup(c.runes,runes.slots?.[slot])?.name||'空')}</p>`,form(select('id','符文',[{id:'',name:'取下'},...c.runes],runes.slots?.[slot]||''),action('替换符文',{type:'rune',slot})))).join('')))+
 section('符文精进',grid(c.runes.map(r=>card(`${r.name}符`,effect(r)+cost(scaledCost(r.cost,runes.levels?.[r.id]||1)),action('合成升阶',{type:'rune-fuse',id:r.id}),`${runes.levels?.[r.id]||1} / ${r.maxLevel}`)).join('')));
}
function companionsPanel(p,c){return section('灵兽出战',grid(c.pets.map(v=>card(v.name,`<p>伤害 ${v.damage} · 治疗 ${v.heal} · 护盾 ${v.shield}</p>${cost(scaledCost(v.cost,p.petLevels?.[v.id]||1))}<small>培养另需灵兽食粮 1</small>`,action(p.pet===v.id?'休息':'选择出战',{type:'pet',id:p.pet===v.id?null:v.id})+action('培养',{type:'pet-train',id:v.id}),`培养 ${p.petLevels?.[v.id]||1}级`)).join('')))+section('武魂共鸣',grid(c.souls.map(v=>card(v.name,effect(v),action((p.souls||[]).includes(v.id)?'卸下武魂':'佩戴武魂',{type:'soul',id:v.id}))).join('')),'最多佩戴三枚武魂。')+section('江湖称号',grid(c.titles.map(v=>card(v.name,effect(v),action(p.title===v.id?'取下称号':'佩戴称号',{type:'title',id:p.title===v.id?null:v.id}))).join('')));}
function trainingPanel(p,c){return section('日常修炼',grid(c.training.map(v=>card(v.name,effect(v)+cost(scaledCost(v.cost,(p.training?.[v.id]||0)+1)),action('修炼一级',{type:'train',id:v.id}),`${p.training?.[v.id]||0} / ${v.maxLevel}`)).join('')))+section('周天经脉',grid(c.meridians.map(v=>card(v.name,effect(v)+cost(scaledCost(v.cost,(p.meridians?.[v.id]||0)+1)),action('打通一重',{type:'meridian',id:v.id}),`${p.meridians?.[v.id]||0} / ${v.maxLevel}`)).join('')))+section('闭关所得',`<p>按本机时间积累，最高 ${c.economy.offlineHours} 小时。每小时铜钱 ${c.economy.offlineGoldPerHour}、锻材 ${c.economy.offlineDustPerHour}。</p>${action('领取离线所得',{type:'offline'})}`);}
function workshopPanel(p,c){
 return section('行囊',`<div class="hub-resource-list">${Object.entries(p.bag||{}).map(([id,n])=>`<span>${esc(labels[id]||id)} <b>${n}</b></span>`).join('')}</div>`,'战备药品可在战斗中使用，消耗在本次旅途结算时扣除。')+
 section('街市',grid(c.shop.map(v=>card(v.name,cost(v.cost),action('购买',{type:'buy',id:v.id}))).join('')))+
 section('采集与炼制',grid([...c.gathering.map(v=>card(v.name,cost(v.cost),action('前往采集',{type:'gather',id:v.id}))),...c.recipes.map(v=>card(v.name,cost(v.cost)+`<p>材料：${esc(textStats(v.ingredients))}</p>`,action('制作',{type:'craft',id:v.id})))].join('')))+
 section('天机匣',`<p>仅使用本地铜钱。每 ${c.economy.drawPity} 次有品质保底，物品直接进入行囊。</p>${cost(c.economy.drawCost)}${action('开启一次',{type:'draw'})}<p>累计开启 ${p.stats?.draws||0} 次</p>`);
}
function questsPanel(p,c){const claimed=p.claimed||[];const isClaimed=id=>Array.isArray(claimed)?claimed.includes(id):!!claimed[id];return section('日课与任务',action('领取今日行路礼',{type:'signin'})+grid([...c.quests,...c.achievements].map(q=>card(q.name,`<p>${esc(q.description||'累积完成目标后领取奖励。')}</p><p>进度 ${p.stats?.[q.stat]||0} / ${q.target}</p><p class="hub-effect">${esc(textStats(q.reward))}</p>`,action(isClaimed(q.id)?'已领取':'领取奖励',{type:'claim',id:q.id},isClaimed(q.id)))).join('')))+section('见闻图鉴',grid(c.codex.map(v=>card(v.name,`<p>收录 ${c[v.catalog]?.length||0} 项 · ${esc(textStats(v.reward))}</p>`,action('领取图鉴奖励',{type:'codex-claim',id:v.id}))).join('')));}
function relationsPanel(p,c){return section('山水故人',grid(c.companions.map(v=>card(v.name,info(v)+effect(v)+`<p>情谊 ${p.companions?.[v.id]?.affinity||0} · ${p.apprentices?.[v.id]?'已收为弟子':'尚未拜师'}</p>`,cost(v.giftCost)+`<small>赠礼另需山水礼 1 · 收徒需情谊 ${v.recruitAffinity}，${esc(textStats(v.recruitCost))} · 指导 ${esc(textStats(scaledCost(v.trainCost,p.apprentices?.[v.id]?.level||1)))}</small>`+action('赠礼',{type:'gift',id:v.id})+action('收徒',{type:'recruit',id:v.id})+action('指导弟子',{type:'apprentice-train',id:v.id}),`弟子 ${p.apprentices?.[v.id]?.level||0}级`)).join('')),'赠礼积累情谊，收徒后指导弟子获得长期配装加成。');}
function editorPanel(p,c,{editorText}){return section('本地创作工具',`<p>这里提供测试补给、档案与内容配置的导入导出。导入内容需要通过校验，当前旅途仍使用出发时的快照。</p><div class="hub-actions">${action('领取测试补给',{type:'developer-grant'})}${button('将档案写入文本','profile-export')}${button('将内容配置写入文本','content-export')}</div><form class="hub-form editor-form"><label class="hub-field"><span>JSON 数据文本</span><textarea id="workshop-editor" data-field="value" spellcheck="false" placeholder="导出后在这里修改 JSON，也可以粘贴已有备份。">${esc(editorText)}</textarea></label><div class="hub-actions">${button('校验并导入档案','profile-import')}${action('校验并应用内容',{type:'content-import'})}${action('恢复默认内容配置',{type:'content-reset'})}</div></form><p class="hub-cost">内容目录：${Object.keys(c).filter(k=>Array.isArray(c[k])).map(k=>`${esc(k)} ${c[k].length}`).join(' · ')}</p>`);}

/** Event data stays explicit and JSON-only; called for a real clicked button. */
export function collectHubAction(buttonElement){
 const type=buttonElement.dataset.action;
 let value=type==='profile'?JSON.parse(buttonElement.dataset.value||'{}'):buttonElement.dataset.value||'';
 if(['profile','expedition','profile-import'].includes(type)){
  const values={};for(const field of buttonElement.closest('form')?.querySelectorAll('[data-field]')||[])values[field.dataset.field]=field.dataset.kind==='number'?Number(field.value):field.value;
  value=type==='profile'?{...value,...values}:type==='profile-import'?values.value:values;if(type==='profile'&&['mark','rune','pet','title'].includes(value.type)&&value.id==='')value.id=null;
 }
 return {type,value};
}
