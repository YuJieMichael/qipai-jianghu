import {getContent} from './content.mjs';
import {getExpansionView} from './profile.mjs';
import {lootProbabilities} from './creator-data.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={name:'名称',description:'说明',effects:'效果',attack:'攻击',maxHp:'气血',armor:'减伤',critChance:'暴击率',critDamage:'暴击伤害',shieldGain:'护盾加成',goldBonus:'铜钱加成',cost:'消耗',reward:'奖励',gold:'铜钱',dust:'锻材',essence:'精华',insight:'悟性',min:'最小值',max:'最大值',chance:'普通掉落概率',bossChance:'首领掉落概率',rarityWeights:'品质权重',affixCount:'词条数量',hpScale:'气血倍率',attackScale:'攻击倍率',turnLimit:'回合限制',enemies:'敌人',hp:'气血',shield:'护盾',stance:'架势',heavyDamage:'重击伤害',price:'售价',heal:'回复',hpCost:'气血代价',refreshCost:'刷新消耗',maxRefresh:'刷新上限',maxBans:'禁选上限',enemyAttack:'敌方攻击加成'};
Object.assign(labels,{progression:'强化与品质机制',cumulativeFactors:'强化累计系数',rarityCaps:'装备品质基础上限',qualityCapBonus:'每阶品质增加的上限',percentRules:'装备属性百分比层',quality:'品质阶数',selection:'成长抽取机制',poolWeights:'流派池权重',ownBuildBonus:'本门额外权重',entryWeights:'条目权重',chapterBias:'章节流派倾向',common:'素品',fine:'良品',rare:'珍品',epic:'逸品',sword:'剑气',poison:'毒针',guard:'金刚',bind:'骰技绑定',swordFocus:'凝锋',swordEcho:'回响剑阵',poisonLingering:'蚀骨余毒',poisonCatalyst:'催毒引爆',guardBulwark:'固若金汤',guardRiposte:'借力反震'});
const sections=[['equipment','装备'],['gear','强化与品质规则'],['affixes','词条池'],['loot','掉落概率'],['routes','敌群与路线'],['chapters','章节奖励'],['modes','模式规则'],['economy','经济数值'],['skills','武学'],['growth','成长规则'],['encounters','奇遇与诅咒'],['refining','深度洗练'],['cycles','任务周期'],['market','随机街市']];
const option=(id,name,current)=>`<option value="${esc(id)}" ${String(id)===String(current)?'selected':''}>${esc(name)}</option>`;
const select=(field,title,entries,value)=>`<label class="hub-field"><span>${esc(title)}</span><select data-field="${field}">${entries.map(([id,name])=>option(id,name,value)).join('')}</select></label>`;
function fields(value,path=[],depth=0){
 if(depth>7)return '<p>更深层字段请使用 JSON 编辑。</p>';
 if(value&&typeof value==='object')return Object.entries(value).map(([key,v])=>{const name=path.at(-1)==='cumulativeFactors'?`强化 +${key} 的累计系数`:labels[key]||key;return v&&typeof v==='object'?`<fieldset class="creator-fieldset"><legend>${esc(name)}</legend>${fields(v,[...path,key],depth+1)}</fieldset>`:field(v,[...path,key],name);}).join('');
 return field(value,path,path.at(-1)||'值');
}
function field(value,path,name){
 if(value===null)return `<p>${esc(name)}：无</p>`;
 const kind=typeof value;if(!['number','boolean','string'].includes(kind))return '';
 const readOnly=['id','key','kind','type','slot','weaponType','rarity','setId','trigger','perkId','curseId','family'].includes(path.at(-1));
 const attr=`data-edit-path="${esc(JSON.stringify(path))}" data-edit-kind="${kind}"`;
 if(readOnly)return `<label class="hub-field"><span>${esc(name)} · 标识</span><input value="${esc(value)}" readonly></label>`;
 return `<label class="hub-field"><span>${esc(name)}</span>${kind==='boolean'?`<select ${attr}>${option('true','开启',String(value))}${option('false','关闭',String(value))}</select>`:kind==='number'?`<input ${attr} type="number" min="0" step="any" value="${esc(value)}">`:String(value).length>48?`<textarea ${attr} rows="2">${esc(value)}</textarea>`:`<input ${attr} value="${esc(value)}">`}</label>`;
}
export function renderCreator(profile,state={}){
 const c=getContent(profile),x=c.expansion||{},section=sections.some(s=>s[0]===state.section)?state.section:'equipment';
 let rows,path,heading;
 if(['equipment','chapters','modes','skills'].includes(section)){rows=c[section];path=[section];}
 else if(section==='affixes'){rows=x.affixes||[];path=['expansion','affixes'];}
 else if(section==='encounters'){rows=null;path=['expansion','encounters'];}
 else if(section==='routes'){const chapter=state.chapter&&x.chapterRoutes?.[state.chapter]?state.chapter:c.chapters[0]?.id;rows=x.chapterRoutes?.[chapter]||[];path=['expansion','chapterRoutes',chapter];heading=chapter;}
 else{const key=section==='growth'?'rogue':section;rows=null;path=section==='economy'?['economy']:['expansion',key];}
 const index=rows?Math.max(0,rows.findIndex(r=>r.id===state.id)):0,target=rows?rows[index]:path.reduce((obj,k)=>obj?.[k],c),targetPath=rows?[...path,String(index)]:path;
 const chooser=select('section','内容分类',sections,section)+(section==='routes'?select('chapter','章节',c.chapters.map(r=>[r.id,r.name]),heading):'')+(rows?select('id','条目',rows.map((r,i)=>[r.id||String(i),r.name||r.title||r.id||`条目${i+1}`]),rows[index]?.id||String(index)):'');
 const ruleNote=section==='gear'?'<p>累计系数直接乘槽位基础效果；品质百分比的单位是 %，只作用于装备属性。全局强化上限仍受经济数值限制。</p>':section==='growth'?'<p>池与条目权重只在满足条件的候选间比较；不代表全局出现概率。当前旅程沿用出发时的规则。</p>':'';
 const edits=target?`${ruleNote}<form class="hub-form creator-edit"><div class="creator-fields">${fields(target,targetPath)}</div><div class="hub-actions"><button type="button" class="hub-button primary" data-action="creator-apply">校验并应用此条目</button></div></form>`:'<p>该目录尚无可编辑条目。</p>';
 const probabilities=lootProbabilities(c).map(r=>`<tr><td>${esc(r.name)}</td><td>${(r.probability*100).toFixed(1)}%</td><td>${(r.battleChance*100).toFixed(1)}%</td><td>${r.affixes}</td></tr>`).join('');
 const snapshots=getExpansionView(profile).snapshots;
 return `<section class="hub-section"><div class="hub-section-heading"><h2>可视化创作台</h2><p>每次应用都会校验完整配置。当前旅程保留出发快照，新出征体验修改。</p></div><form class="hub-form creator-picker">${chooser}<button type="button" class="hub-button" data-action="creator-open">打开条目</button></form>${section==='routes'?'<p>敌群数值为基础值，出征时再叠加章节与模式倍率。</p>':''}${edits}</section><section class="hub-section"><h2>掉落概率预览</h2><div class="creator-table"><table><thead><tr><th>品质</th><th>掉落后的占比</th><th>普通战每局概率</th><th>词条数</th></tr></thead><tbody>${probabilities}</tbody></table></div><p>首领专属物品按专属表优先掉落；此表展示普通品质池。</p></section><section class="hub-section"><h2>规则模拟</h2><p>使用当前配装和真实战斗规则运行固定种子，不消耗资源，不改变档案。</p><form class="hub-form creator-simulation">${select('build','传承',[['sword','剑气'],['poison','毒针'],['guard','金刚']],'sword')}${select('mode','玩法',c.modes.map(r=>[r.id,r.name]),'boss')}${select('chapter','章节',c.chapters.map(r=>[r.id,r.name]),'bamboo')}<label class="hub-field"><span>模拟局数 · 1至10</span><input data-field="count" data-kind="number" type="number" min="1" max="10" value="3"></label><button type="button" class="hub-button" data-action="creator-simulate">运行模拟</button></form>${state.report?`<pre class="creator-report">${esc(typeof state.report==='string'?state.report:JSON.stringify(state.report,null,2))}</pre>`:''}</section><section class="hub-section"><h2>配置快照</h2><p>先保存再修改，可将已保存的完整内容恢复；恢复仍需通过档案兼容校验。</p><form class="hub-form">${select('index','存入位置',snapshots.map(s=>[s.index,`位置 ${s.index+1} · ${s.name||'空'}`]),0).replace('data-field="index"','data-field="index" data-kind="number"')}<label class="hub-field"><span>快照名称</span><input data-field="name" maxlength="40" value="手动备份"></label><button type="button" class="hub-button" data-action="profile" data-value="{&quot;type&quot;:&quot;config-snapshot&quot;}">保存当前配置</button></form><div class="hub-actions">${snapshots.map(s=>`<button type="button" class="hub-button" data-action="profile" data-value="${esc(JSON.stringify({type:'config-restore',index:s.index}))}" ${s.saved?'':'disabled'}>恢复位置 ${s.index+1} · ${esc(s.name||'空')}</button>`).join('')}</div></section>`;
}
export function collectCreatorAction(button){
 const type=button.dataset.action;
 if(type==='creator-apply'){const changes=[...button.closest('form').querySelectorAll('[data-edit-path]')].map(el=>({path:JSON.parse(el.dataset.editPath),kind:el.dataset.editKind,value:el.value}));return {type,value:changes};}
 const value={};for(const el of button.closest('form')?.querySelectorAll('[data-field]')||[])value[el.dataset.field]=el.dataset.kind==='number'?Number(el.value):el.value;
 return {type,value};
}
