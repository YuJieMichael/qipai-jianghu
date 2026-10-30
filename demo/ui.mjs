import {BALANCE,PERKS} from './config.mjs';
import {previewUpgrade,getRunNode,getRunNodes,getJourneyOptions} from './journey.mjs';
import {renderHub,collectHubAction} from './hub-ui.mjs';
import {getContent} from './content.mjs';
import {collectCreatorAction} from './creator-ui.mjs';
import {collectNetworkAction} from './network-ui.mjs';
import {tutorialMarkup,lootMarkup} from './presentation-ui.mjs';
import {renderRoundReport} from './battle-report-ui.mjs';
const BUILDS={sword:{name:'剑气',title:'一剑听雨',mark:'剑',desc:'4—6 点引动剑气，飞剑穿雨，逐一击破。',asc:'万剑归宗',color:'jade'},poison:{name:'毒针',title:'暗香无形',mark:'针',desc:'单数飞针施毒，层层积蓄，伺机引爆。',asc:'百毒归心',color:'violet'},guard:{name:'金刚',title:'不动如山',mark:'罡',desc:'1—3 点凝成护盾，守住锋芒，以身反震。',asc:'不动明王',color:'gold'}};
const attackEmblem='<span class="attack-emblem" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M22 5l5-1-1 5-12 12-4-4zM10 17l5 5M7 24l5-5M5 26l3-3"/><path d="M5 7l4 1 12 12-4 4L5 12zM17 24l6-6M22 23l4 4"/></svg></span>';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(text,type,value='',extra='')=>`<button type="button" data-action="${type}" data-value="${esc(value)}" ${extra}>${text}</button>`;
const icon=(name)=>name==='sound'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h11M7 12h14M3 16h12"/></svg>';
export function createUI(root,onAction){
 root.innerHTML=`<div class="game"><header class="topbar"><a href="../" class="brand" aria-label="返回七派江湖首页">七派<span>江湖</span></a><div id="chapter" class="chapter"></div><nav id="settings" aria-label="游戏设置"></nav></header><div id="tutorial"></div><div class="journey" id="journey"></div><section class="theatre" aria-label="武侠战场"><canvas id="stage" width="1000" height="540" aria-label="雨夜竹林战斗场景"></canvas><div class="scene-vignette"></div><div class="scene-caption"><span id="scene-name">夜雨竹林</span><span>一夜风雨 · 一段江湖</span></div><div id="overlay" class="overlay"></div></section><div id="playback-controls"></div><section id="hud"></section><section id="round-report" aria-label="上一回合战报"></section><div id="loot-notice"></div><div id="message" class="message" role="status" aria-live="polite"></div><footer class="footer"><span>夜雨竹林 · 破山门</span><span>原创武侠 · 骰定乾坤</span></footer></div>`;
 let current=null,options={},primary=null,focusMemory=null,editorDraft='',editorRevision=-1,previousDice=null,currentReport=null,playbackActive=false,lastSettingsMarkup=null,disclosureState=new Map(),battlePreview=null;
 const q=id=>root.querySelector('#'+id);
 function dispatch(e){const b=e.target.closest('[data-action]');if(!b||b.disabled||!root.contains(b))return; const type=b.dataset.action;if(type==='skip-playback'&&!options.busy)return;if(options.busy&&!['mute','motion','exit','speed','skip-playback'].includes(type))return;onAction(type==='network'?collectNetworkAction(b):type.startsWith('creator-')?collectCreatorAction(b):['profile','expedition','profile-import'].includes(type)?collectHubAction(b):{type,value:type==='hold'?Number(b.dataset.value):b.dataset.value});}
 root.addEventListener('click',dispatch);
 const preventSubmit=e=>e.preventDefault();root.addEventListener('submit',preventSubmit);
 function key(e){if(e.key==='Escape'&&current?.flow==='reward'&&current.pendingUpgrade&&!options.busy){e.preventDefault();onAction({type:'upgrade-cancel'});return;}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('button,a,input,select,textarea,summary')||e.target.isContentEditable||options.busy)return;let a;if(e.code==='Space'&&primary)a=primary;else if(e.key.toLowerCase()==='r'&&current?.flow==='battle'&&current.combat?.phase==='pick'&&current.combat.rerolls>0&&current.combat.held?.some(keep=>!keep))a={type:'reroll'};else if(/^[1-5]$/.test(e.key)&&current?.flow==='battle'&&current.combat?.phase==='pick')a={type:'hold',value:Number(e.key)-1};if(a){e.preventDefault();onAction(a);}}
 document.addEventListener('keydown',key);
 function render(run,opts={}){
 const active=root.contains(document.activeElement)?document.activeElement:null;
 const focusedDisclosure=active?.closest('[data-battle-disclosure]')?.dataset.battleDisclosure;
 const focusedSummary=active?.closest('[data-battle-summary]')?.dataset.battleSummary;
 // Seeds change on every roll, so disclosure state belongs to the battle, not RNG state.
 const sameBattle=current?.flow==='battle'&&run?.flow==='battle'&&current.runId===run.runId&&current.nodeIndex===run.nodeIndex&&current.mode===run.mode&&current.build===run.build;
 if(sameBattle){for(const detail of root.querySelectorAll?.('[data-battle-disclosure]')||[])disclosureState.set(detail.dataset.battleDisclosure,detail.open);}
 else{disclosureState.clear();battlePreview=null;}
 const focused=active?.closest('[data-action]');if(focused)focusMemory={action:focused.dataset.action,value:focused.dataset.value};const focusAction=focusMemory?.action,focusValue=focusMemory?.value;const previousFlow=current?.flow,previousChoice=current?.pendingUpgrade?.choiceId;current=run;options=opts;primary=null;const busy=opts.busy?'disabled':'';const flow=run?.flow||'intro';const b=BUILDS[run?.build]||BUILDS.sword;const n=run?.nodeIndex||0,node=getRunNode(run)||{},nodes=getRunNodes(run),catalog=getContent(opts.profile),modeName=catalog.modes.find(m=>m.id===run.mode)?.name,journeyView=getJourneyOptions(run);const oldEditor=root.querySelector('#workshop-editor');if(oldEditor)editorDraft=oldEditor.value;if(editorRevision!==(opts.editorRevision??0)){editorRevision=opts.editorRevision??0;editorDraft=opts.editorText||'';}
 const rolling=new Set(diceRollIndices(previousDice,run,{busy:opts.busy,reducedMotion:opts.settings?.reducedMotion}));if(!opts.busy)previousDice=diceFrame(run);
 const nextReport=opts.roundReport||null;if(nextReport!==currentReport){currentReport=nextReport;q('round-report').innerHTML=renderRoundReport(currentReport);}
 const speed=opts.settings?.playbackSpeed===2?2:1;
 const settingsMarkup=btn(`演出×${speed}`,'speed','',`class="speed-button" aria-label="演出速度 ${speed} 倍，切换为 ${speed===1?2:1} 倍" aria-pressed="${speed===2}"`)+btn('指引','tutorial-open','','class="exit-button"')+btn(icon('sound'),'mute','',`class="icon-button ${opts.settings?.muted?'off':''}" aria-label="${opts.settings?.muted?'开启声音':'静音'}" title="声音" aria-pressed="${!!opts.settings?.muted}"`)+btn(icon('motion'),'motion','',`class="icon-button" aria-label="切换减少动态效果" title="减少动态效果" aria-pressed="${!!opts.settings?.reducedMotion}"`)+(flow!=='intro'?btn('门庭','home','','class="exit-button" '+busy)+btn('暂离','exit','','class="exit-button"'):'');
 if(settingsMarkup!==lastSettingsMarkup){q('settings').innerHTML=settingsMarkup;lastSettingsMarkup=settingsMarkup;}
 if(playbackActive!==!!opts.busy){playbackActive=!!opts.busy;q('playback-controls').innerHTML=playbackActive?playbackMarkup():'';}
 if(playbackActive){const progress=opts.playback;q('playback-progress').textContent=progress?`${progress.index} / ${progress.total} · ${progress.text||'招式结算中……'}`:'招式结算中……';}
 q('tutorial').innerHTML=tutorialMarkup(opts.tutorialStep,opts.busy);q('loot-notice').innerHTML=lootMarkup(opts.lootNotice,catalog,opts.busy);
 q('chapter').innerHTML=flow==='intro'?'全系统 · 本地可改版':`<span>${esc(modeName||node.name||'江湖游历')} · ${n+1}/${nodes.length}</span><small>${flow==='battle'?`第 ${run.combat?.round||1} 回合`:'风雨行路'}</small>`;
 q('journey').innerHTML=Array.from({length:nodes.length},(_,i)=>`<i class="${i<n?'done':i===n?'active':''}" title="节点 ${i+1}"></i>`).join('');q('scene-name').textContent=({bamboo:'夜雨竹林',temple:'残灯破庙',gate:'风起山门',desert:'流沙古道',lake:'镜湖残月',tomb:'幽陵灯火',peak:'天峰云海'})[node.scene]||'夜雨竹林';
 q('message').textContent=opts.message||(opts.busy?'招式结算中……':'');q('overlay').className='overlay '+(flow==='intro'?'intro-overlay':flow==='battle'?'battle-overlay':'choice-overlay');
 if(flow==='intro'){
 q('overlay').innerHTML=`<div class="intro-copy"><div class="eyebrow">七派江湖 · 原创武侠示范</div><h1>夜雨竹林</h1><div class="subtitle"><i></i>破 山 门<i></i></div><p>山门灯火未熄，竹间杀意已至。<br>选五骰为伴，凭一脉绝学，闯过今夜风雨。</p></div><div class="lineage-label">择一传承 · 即刻入江湖</div><div class="lineages">${Object.entries(BUILDS).map(([k,v])=>btn(`<span class="seal">${v.mark}</span><span class="lineage-name">${v.name}</span><strong>${v.title}</strong><span class="lineage-desc">${v.desc}</span><span class="lineage-end">修至三重 · ${v.asc}<b>入 江 湖 ↗</b></span>`,'start',k,`class="lineage ${v.color}" ${busy}`)).join('')}</div>${opts.hasSave?btn('续上未尽的江湖 →','resume','','class="resume" '+busy):''}`;q('hud').innerHTML=renderHub(opts.profile,{tab:opts.hubTab,filter:opts.hubFilter,editorText:editorDraft,hasSave:opts.hasSave,creator:opts.creator,network:opts.network,now:opts.now});
 }else if(flow==='battle'){
 const c=run.combat||{},dice=c.dice||[],pick=c.phase==='pick';const enemies=(c.enemies||[]).filter(e=>e.hp>0);const selected=pick?(c.held||[]).filter(keep=>!keep).length:0;
 q('overlay').innerHTML=`<div class="battle-label"><span>风雨对峙</span><b>${opts.busy?'招式交锋':pick?'审势 · 择敌':'凝神 · 起手'}</b></div>`;
 const p=opts.preview;if(!opts.busy)battlePreview=p?.forecast?{run,preview:p}:null;const forecast=battlePreview;const damage=p?.directDamage??p?.damage??p?.totalDamage;const pattern=p?.combo?.name??p?.pattern?.name??p?.hand?.name??p?.handName??p?.patternName??(typeof p?.pattern==='string'?p.pattern:'');
 q('hud').innerHTML=`<div class="enemy-row" aria-label="选择攻击目标">${enemies.map(e=>btn(`<span class="enemy-top"><strong>${esc(e.name)}</strong><span>${c.targetId===e.id?'◎ 已锁定':'选择目标'}</span></span><span class="health-track"><i style="width:${Math.max(0,e.hp/e.maxHp*100)}%"></i></span><span class="enemy-vitals">${e.hp} / ${e.maxHp}${e.shield?` · 盾 ${e.shield}`:''}${e.poison?.stacks?` · 毒 ${e.poison.stacks}层`:''}</span><span class="intent">${esc(e.intent?.label||'蓄势')}${e.intent?.damage?` · ${e.intent.damage}伤害`:''}${e.stance?` · 架势 ${e.stance}`:''}</span>${e.affix?`<span class="enemy-trait">精英 · ${esc({fierce:'凶猛 · 攻击增强',armored:'铁甲 · 初始护盾',vampiric:'汲血 · 伤害回复'}[e.affix]||e.affix)}</span>`:''}${e.mechanic?`<span class="enemy-trait">${esc({assault:'破军 · 偶数回合蓄力',ward:'钟盾 · 每轮重建护盾',ritual:'祭火 · 疗愈与召援'}[e.mechanic]||e.mechanic)} · 阶段 ${e.phase||1}</span>`:''}`,'target',e.id,`class="enemy-card ${c.targetId===e.id?'selected':''}" aria-pressed="${c.targetId===e.id}" aria-label="选择目标 ${esc(e.name)}，${esc(e.intent?.label)}" ${busy}`)).join('')}</div><div class="player-strip"><div class="hero-title"><span class="small-seal">侠</span><div><strong>无名侠客</strong><span>${b.name}传承 · ${run.ascended?b.asc:`修行 ${Math.min(3,run.mastery||0)} / 3`}</span></div></div><div class="hero-vitals"><strong>${run.hero.hp}<small> / ${run.hero.maxHp}</small></strong><span>气血${run.hero.shield?` · 护盾 ${run.hero.shield}`:''}</span></div><div class="hero-health"><i style="width:${Math.max(0,run.hero.hp/run.hero.maxHp*100)}%"></i></div></div><div class="dice-panel"><div class="dice-heading"><strong>五骰问招</strong><span>${pick?'选中要换的骰子 · 已选 '+selected+' 颗 · 剩余 '+c.rerolls+' 次':'掷出五骰，寻找破绽'}</span></div><div class="dice-row">${Array.from({length:5},(_,i)=>{const skill=run.diceSkills?.[i];const sb=BUILDS[skill?.kind];const v=dice[i]||0;const trigger=skill&&(skill.kind==='sword'?v>=4:skill.kind==='poison'?v%2===1:v>0&&v<=3);return btn(`<span class="die-index">${['一','二','三','四','五'][i]}${c.frozen?.[i]?' · 固':pick&&!c.held?.[i]?' · 换':''}</span><span class="die-face ${trigger?'trigger':''}">${v?Array.from({length:9},(_,j)=>`<i class="pip ${pip(v,j)?'visible':''}"></i>`).join(''):'<span class="unrolled">?</span>'}</span><span class="die-skill">${sb?`${sb.name} · ${skill.level||1}阶`:'基础招式'}</span><span class="die-condition">${c.frozen?.[i]?'本轮固定，不可换骰':run.loadout?`${esc(catalog.materials.find(m=>m.id===run.loadout.dice[i].materialId)?.name||'竹木')} · 面${(c.faceIndices?.[i]??0)+1}`:sb?(skill.kind==='sword'?'4—6 触发':skill.kind==='poison'?'单数触发':'1—3 触发'):'随点数出招'}</span>`,'hold',i,`class="die ${pick&&!c.held?.[i]?'to-reroll':''} ${rolling.has(i)?'die-settling':''}" data-lineage="${esc(skill?.kind||'basic')}" aria-pressed="${pick&&!c.held?.[i]}" aria-label="第${i+1}颗骰子 ${v||'未投掷'}点，${!pick?'等待掷骰':c.frozen?.[i]?'本轮固定，不可重掷':!c.held?.[i]?'已选重掷':'保留'}" ${busy||(!pick||c.frozen?.[i]?'disabled':'')}`)}).join('')}</div><div class="action-row"><div class="preview"><span>${pick?esc(pattern||'招式已成'):'蓄势待发'}</span><strong>${pick?(damage!==undefined?`预计直伤 <b>${esc(damage)}</b>`:'选骰换点，再定一招'):'以骰为引 · 以技破敌'}</strong><small>${pick?'直伤不含技能与毒伤 · 下方查看完整推演':'回合自动掷骰 · 1—5 选骰 · R 重掷'}</small></div>${pick?btn(`重掷 ${selected} 颗 <small>余 ${c.rerolls} 次</small>`,'reroll','','class="secondary" '+(busy||c.rerolls<=0||selected===0?'disabled':'')):''}${btn(pick?`${attackEmblem}<span class="attack-label">出 招</span><span class="attack-arrow" aria-hidden="true">→</span>`:'掷 骰 <span>→</span>',pick?'attack':'roll','','class="primary" '+busy)}</div></div>${(pick||opts.busy&&forecast)?battleDisclosure('forecast','完整推演',forecast?`${opts.busy?'出招前 · ':''}对敌 ${forecast.preview.forecast.totalDamage} · 气血 ${forecast.run.hero.hp} → ${forecast.preview.forecast.heroHpAfter}`:'骰技 · 毒伤 · 护盾 · 敌方回应',`${opts.busy?'<p class="disclosure-note" role="status">交锋中 · 以下为本次出招前推演，实际结果见回合战报。</p>':''}${forecast?forecastMarkup(forecast.run,forecast.preview):forecastMarkup(run,p)}`,disclosureState.get('forecast')):''}${run.bag||run.loadout?battleDisclosure('supplies','行囊与行装',suppliesSummary(run),`${run.loadout?`<p class="battle-loadout">${esc(run.loadout.label)} · 铜钱 ${run.coins||0}${c.turnLimit?` · 回合 ${c.round}/${c.turnLimit}`:''}</p>`:''}${routesMarkup(run)}${runItemsMarkup(run,busy)}`,disclosureState.get('supplies')):routesMarkup(run)}`;primary={type:pick?'attack':'roll'};
 }else{
 const title=(flow==='event'&&['branch','merchant','encounter'].includes(journeyView.kind))?esc(journeyView.title):{reward:'武学精进',event:'竹径逢缘',camp:'残火照归人',victory:run.mode&&run.mode!=='campaign'?'历练完成':'山门已破',defeat:'胜败，江湖常事'}[flow]||'风雨前行';
 q('overlay').innerHTML=`<div class="interlude"><span class="eyebrow">${flow==='reward'?'一招一式 · 皆有所悟':flow==='victory'?'雨歇 · 天将明':'夜雨未停 · 江湖未远'}</span><h1>${title}</h1><p>${flow==='reward'?'将今夜领悟，化作下一战的锋芒。':flow==='event'?esc(journeyView.description||'前路有新的抉择。'):flow==='camp'?'添一把柴，拂去剑上雨水。山门就在前方。':flow==='victory'?'你踏过长夜，山门后的第一缕天光照在肩头。':'此行未竟，来日再执剑。'}</p></div>`;
 let content='';if(flow==='reward'){content=rewardMarkup(run,busy);if(run.pendingUpgrade&&previewUpgrade(run,run.pendingUpgrade.choiceId,run.pendingUpgrade.dieIndex).valid)primary={type:'upgrade-confirm'};}
 else if(flow==='event'&&['branch','merchant','encounter'].includes(journeyView.kind))content=journeyMarkup(run,journeyView,busy);
 else if(flow==='event')content=`<div class="event-choices">${btn(`<span class="seal">药</span><strong>饮下回春露</strong><span>恢复 ${BALANCE.eventHeal} 气血</span>`,'event','heal',`class="event-card" ${busy}`)}${btn('<span class="seal">悟</span><strong>参悟残谱</strong><span>本次旅途攻击 +3</span>','event','train',`class="event-card" ${busy}`)}${node.merchant?btn('<span class="seal">商</span><strong>购买回气散</strong><span>铜钱 20 · 行囊 +1</span>','event','buy-potion',`class="event-card" ${busy||(run.coins||0)<20?'disabled':''}`)+btn('<span class="seal">露</span><strong>购买养元露</strong><span>铜钱 30 · 行囊 +1</span>','event','buy-tonic',`class="event-card" ${busy||(run.coins||0)<30?'disabled':''}`):''}</div><p class="event-wallet">${run.route?`本次铜钱 ${run.coins||0}${node.treasure?' · 宝箱收益已入账':''}`:''}</p>`;
 else if(flow==='camp'){content=`<div class="camp-copy"><span>炉火尚温，前路未尽</span><p>整理行装，迎战山门守将。</p>${btn('踏向山门 →','next','','class="primary" '+busy)}</div>`;primary={type:'next'};}
 else{content=`<div class="result-stats"><div><strong>${run.stats?.turns||0}</strong><span>交锋回合</span></div><div><strong>${run.stats?.damage||0}</strong><span>造成伤害</span></div><div><strong>${run.stats?.kills||0}</strong><span>击败敌人</span></div></div><div class="result-build">${b.name} · ${run.ascended?b.asc:`修行 ${run.mastery||0} / 3`}<p>${ascensionText(run)}</p>${routesMarkup(run)}${historyMarkup(run)}</div><div class="result-actions">${btn('再入江湖 →','retry','','class="primary" '+busy)}${btn('返回门庭','home','','class="secondary"')}</div>`;primary={type:'retry'};}
 q('hud').innerHTML=`<section class="decision-panel"><div class="decision-vitals">气血 ${run.hero.hp} / ${run.hero.maxHp}${run.hero.shield?` · 护盾 ${run.hero.shield}`:''}</div><div class="decision-top"><span>${b.name}传承</span><span>${ascensionText(run)}</span></div>${content}</section>`;
 }
 root.classList.toggle('in-battle',flow==='battle');root.classList.toggle('in-reward',flow==='reward');root.classList.toggle('has-hub',flow==='intro'&&!!opts.profile);
 if(previousFlow!==undefined&&previousFlow!==flow){
  const destination=flow==='intro'&&opts.profile?root.querySelector('.hub')||root:root;
  destination.scrollIntoView?.({block:'start',behavior:'instant'});
 }
 const pendingChanged=previousChoice!==run.pendingUpgrade?.choiceId;
 if(pendingChanged&&run.pendingUpgrade){root.querySelector('[data-action="upgrade-target"], [data-action="upgrade-confirm"]:not(:disabled)')?.focus({preventScroll:true});}
 else if(!previousFlow){root.querySelector('[data-action="start"]')?.focus({preventScroll:true});}
 else if(previousFlow!==flow){root.querySelector('#hud [data-action]:not(:disabled)')?.focus({preventScroll:true});}
 else if(flow==='battle'&&previousFlow==='battle'&&!sameBattle){root.querySelector('#hud [data-action]:not(:disabled)')?.focus({preventScroll:true});}
 else if(sameBattle&&focusedSummary){root.querySelector(`[data-battle-summary="${focusedSummary}"]`)?.focus({preventScroll:true});}
 else if(focusAction&&!root.contains(document.activeElement)){const next=[...root.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focusAction&&el.dataset.value===focusValue&&!el.disabled);(next||(sameBattle&&focusedDisclosure?root.querySelector(`[data-battle-summary="${focusedDisclosure}"]`):null)||root.querySelector('#hud [data-action]:not(:disabled)')||root.querySelector('[data-action="skip-playback"]'))?.focus({preventScroll:true});}root.classList.toggle('is-busy',!!opts.busy);root.classList.toggle('reduced-motion',!!opts.settings?.reducedMotion);
 }
 return{render,destroy(){root.removeEventListener('click',dispatch);root.removeEventListener('submit',preventSubmit);document.removeEventListener('keydown',key);root.innerHTML='';}};
}
function pip(v,j){return ({1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}[v]||[]).includes(j);}

function battleDisclosure(id,title,summary,content,open=false){
 return `<details class="battle-disclosure" data-battle-disclosure="${id}"${open?' open':''}><summary data-battle-summary="${id}"><strong>${title}</strong><span>${esc(summary)}</span><i class="report-disclosure" aria-hidden="true"></i></summary><div class="battle-disclosure-content">${content}</div></details>`;
}
function suppliesSummary(run){
 const names=[['potion','回气散'],['reroll','转运签'],['antidote','解毒丸'],['tonic','养元露']];
 return names.filter(([id])=>run.bag?.[id]>0).map(([id,name])=>`${name} ×${run.bag[id]}`).join(' · ')||'暂无消耗品 · 查看当前行装';
}

function playbackMarkup(){
 return `<div class="playback-strip"><div role="status" aria-live="polite"><strong>本轮演出</strong><p id="playback-progress"></p></div>${btn('跳过本轮演出','skip-playback','','class="skip-playback"')}</div>`;
}

// Keep only the previous stable dice frame: playback snapshots are unrelated to rolls.
function diceFrame(run){
 return {flow:run?.flow,seed:run?.seed,nodeIndex:run?.nodeIndex,combat:run?.combat?{round:run.combat.round,phase:run.combat.phase,rerolls:run.combat.rerolls,dice:[...(run.combat.dice||[])],held:[...(run.combat.held||[])],frozen:[...(run.combat.frozen||[])]}:null,loadout:run?.loadout?{dice:run.loadout.dice?.map(die=>({decorationId:die.decorationId}))}:null};
}

export function diceRollIndices(previous,run,{busy=false,reducedMotion=false}={}){
 const combat=run?.combat,old=previous?.combat;
 if(busy||reducedMotion||run?.flow!=='battle'||combat?.phase!=='pick'||!combat.dice?.some(value=>value>0))return [];
 const all=()=>combat.dice.flatMap((value,index)=>value>0?[index]:[]);
 if(previous?.flow!=='battle'||!old||previous.nodeIndex!==run.nodeIndex||old.round!==combat.round||old.phase==='roll')return all();
 if(previous.seed===run.seed||old.rerolls<=combat.rerolls)return [];
 const replaced=new Set((old.held||[]).flatMap((held,index)=>!held?[index]:[]));
 for(const index of [...replaced])if(previous.loadout?.dice?.[index]?.decorationId==='chain')for(const neighbour of [index-1,index+1])if(neighbour>=0&&neighbour<combat.dice.length)replaced.add(neighbour);
 return [...replaced].filter(index=>!old.frozen?.[index]).sort((a,b)=>a-b);
}

function ascensionText(run){
 const remaining=Math.max(0,BALANCE.masteryThreshold-(run.mastery||0));
 return run.ascended?`${BUILDS[run.build].asc} · 已质变`:`本门领悟 ${Math.min(BALANCE.masteryThreshold,run.mastery||0)} / ${BALANCE.masteryThreshold} · 再悟 ${remaining} 次质变`;
}
function routesMarkup(run){
 const attained=Object.entries(PERKS).filter(([id])=>(run.perks?.[id]||0)>0);
 if(!attained.length)return '';
 return `<div class="route-strip" aria-label="已习得内部路线">${attained.map(([id,p])=>`<span title="${esc(p.description)}">${esc(p.name)} <b>${run.perks[id]} / ${p.maxRank}</b></span>`).join('')}</div>`;
}
function comparisonMarkup(before,after){return `<span class="upgrade-comparison"><span>原 · ${esc(before)}</span><b aria-hidden="true">↓</b><em>新 · ${esc(after)}</em></span>`;}
export function growthSelectionMarkup(run){
 const offer=run.rogue?.offer;if(!run.rogue?.rules?.selection||!offer)return '';
 const rarity={common:'素品',fine:'良品',rare:'珍品',epic:'逸品'}[offer.rarity]||'可用品阶';
 const own=run.choices?.some(c=>c.kind==='bind'&&c.build===run.build);
 return `<div class="growth-selection" aria-label="成长候选来源"><strong>${esc(rarity)}侧重</strong><span>${own?'本门传承保底；':''}其他招式按当前传承与章节倾向出现。</span>${offer.usedFallback?'<span>候选不足，部分招式已用其他品阶补齐；以卡面品阶为准。</span>':''}</div>`;
}
function rewardMarkup(run,busy){
 const pending=run.pendingUpgrade,choice=run.choices?.find(c=>c.id===pending?.choiceId);
 const controls=run.rogue?`<div class="growth-toolbar"><span>铜钱 ${run.coins||0} · 刷新剩余 ${getJourneyOptions(run).refresh.remaining} · 禁选剩余 ${getJourneyOptions(run).bans.remaining}</span>${btn(`刷新成长 · ${getJourneyOptions(run).refresh.cost} 铜钱`,'growth-refresh','','class="secondary" '+(busy||!getJourneyOptions(run).refresh.available?'disabled':''))}</div>`:'';
 const cards=controls+growthSelectionMarkup(run)+`<div class="reward-instruction"><strong>壹 · 选择领悟</strong><span>选牌后可返回，确认才生效</span></div><div class="reward-grid">${(run.choices||[]).map((c,i)=>{
  const selected=c.id===pending?.choiceId,perk=c.kind==='perk',definition=PERKS[c.perkId];
  const preview=perk?previewUpgrade(run,c.id):null;
  const card=btn(`<span class="card-number">${c.rarity?esc({common:'素',fine:'良',rare:'珍',epic:'逸'}[c.rarity]||c.rarity)+' · ':''}${['壹','贰','叁'][i]||'悟'} · ${BUILDS[c.build]?.name||'武学'} · ${perk?'内部路线':'骰技绑定'}</span><strong>${esc(c.title||definition?.name)}</strong><p>${esc((c.description||definition?.description||'').replace(/^第 \d+ 颗骰子：/,''))}</p>${perk?comparisonMarkup(preview.before,preview.after):'<span class="binding-note">任选一骰 · 同门升阶，异门替换</span>'}<span class="choose-label">${selected?'✓ 已选此式':perk?'查看路线 →':'选择目标骰 →'}</span>`,'upgrade',c.id,`class="reward-card ${selected?'selected':''}" data-rarity="${esc(c.rarity||'common')}" aria-pressed="${selected}" ${busy}`);
  return run.rogue?`<div class="reward-option">${card}${btn('本局禁选此分支','growth-ban',c.id,'class="ban-choice" '+(busy||getJourneyOptions(run).bans.remaining<=0?'disabled':''))}</div>`:card;
 }).join('')}</div>`;
 if(!choice)return cards;
 const perk=choice.kind==='perk',preview=previewUpgrade(run,choice.id,pending.dieIndex);
 const targets=perk?'':`<div class="reward-instruction"><strong>贰 · 选择目标骰</strong><span>五颗皆可选 · 会替换该骰原有技能</span></div><div class="binding-grid" aria-label="选择要绑定的骰子">${Array.from({length:5},(_,i)=>{
  const p=previewUpgrade(run,choice.id,i),selected=pending.dieIndex===i;
  return btn(`<span class="target-number">第 ${i+1} 颗骰子 <b>${selected?'✓ 已选':'待选'}</b></span>${comparisonMarkup(p.before,p.after)}`,'upgrade-target',i,`class="binding-card ${selected?'selected':''}" aria-pressed="${selected}" aria-label="第${i+1}颗骰子，${esc(p.before)}，改为${esc(p.after)}${selected?'，已选':''}" ${busy||!p.valid?'disabled':''}`);
 }).join('')}</div>`;
 return `${cards}<section class="upgrade-detail" aria-label="确认成长选择"><div class="upgrade-detail-heading"><span class="small-seal">悟</span><div><h2>${esc(choice.title)}</h2><p>${esc(preview.description||(choice.description||'').replace(/^第 \d+ 颗骰子：/,''))}</p></div></div>${targets}<div class="upgrade-confirmation" role="status" aria-live="polite">${preview.valid?`${perk?'路线精进':`第 ${pending.dieIndex+1} 颗骰子`} · ${esc(preview.before)} → ${esc(preview.after)}`:esc(preview.reason||'先选择一颗目标骰，再确认领悟。')}<small>${ascensionText(run)}${choice.build===run.build?' · 本次本门领悟 +1':''}</small></div><div class="upgrade-actions">${btn('返回重选','upgrade-cancel','','class="secondary" '+busy)}${btn('确认领悟 →','upgrade-confirm','','class="primary" '+(busy||!preview.valid?'disabled':''))}</div><p class="keyboard-hint">Tab 选择 · Enter 确认按钮 · Esc 返回重选</p></section>`;
}
export function forecastMarkup(run,preview){
 const f=preview?.forecast;if(!f)return `<p class="forecast-note">${ascensionText(run)}</p>`;
 const enemies=run.combat?.enemies||[],target=enemies.find(e=>e.id===run.combat.targetId);
 const names=ids=>(ids||[]).map(id=>id==='hero'?'无名侠客':enemies.find(e=>e.id===id)?.name||f.enemies.find(e=>e.id===id)?.name||'敌人').join('、');
 const effects=preview.effects||[],skillTypes=new Set(['sword','swordFocus','swordEcho','swordArray','poisonApply','poison','poisonTick','burst','shield','ascension','heal']);
 const skill=effects.filter(e=>skillTypes.has(e.type)&&!(e.type==='shield'&&e.value<0));
 const replies=effects.filter(e=>['intent','hurt','counter','phase'].includes(e.type)||(e.type==='shield'&&e.value<0));
 const lines=items=>items.length?`<ul>${items.map(e=>`<li>${e.sourceId&&e.sourceId!=='hero'?`${esc(names([e.sourceId]))} · `:''}${Number.isInteger(e.dieIndex)?`第${e.dieIndex+1}骰 · `:''}${esc(e.text)}${e.value?` <b>${e.type==='shield'?e.value>0?'护盾 +'+e.value:'抵挡 '+Math.abs(e.value):e.type==='heal'?'回复 '+e.value:'伤害 '+e.value}</b>`:''}${e.targetIds?.length?`<span>${esc(names(e.targetIds))}</span>`:''}</li>`).join('')}</ul>`:'<p>本回合无额外效果</p>';
 return `<section class="forecast" aria-label="本回合完整推演"><div class="forecast-heading"><strong>本回合推演</strong><span>出招后结算 · 当前气血条保持不变</span></div><div class="forecast-grid"><div class="forecast-block direct"><h3>壹 · 直接伤害</h3><p><strong>${esc(preview.directDamage)}</strong> → ${esc(target?.name||'当前目标')}</p><small>仅为本次招式直伤，不含技能与毒</small></div><div class="forecast-block"><h3>贰 · 骰技与毒伤</h3>${lines(skill)}<p class="forecast-total">本轮毒伤 ${f.poisonDamage} · 对敌总伤 ${f.totalDamage}</p></div><div class="forecast-block reply"><h3>叁 · 敌方回应</h3>${lines(replies)}<p class="forecast-total">抵挡 ${f.blocked} · 侠客气血 ${run.hero.hp} → ${f.heroHpAfter}<br>护盾 ${run.hero.shield||0} → ${f.heroShieldAfter}</p></div></div><div class="forecast-outcomes" aria-label="预计敌人结局">${f.enemies.map(after=>{const before=enemies.find(e=>e.id===after.id);return `<p><strong>${esc(before?.name||after.name||'援兵')}</strong><span>气血 ${before?.hp??0} → ${after.hpAfter} · 盾 ${before?.shield??0} → ${after.shieldAfter}</span><small>毒 ${before?.poison?.stacks??0} → ${after.poisonStacksAfter} 层 · 余 ${after.poisonTurnsAfter} 回合${after.hpAfter<=0?' · 击败':''}</small></p>`;}).join('')}</div><p class="forecast-note">${ascensionText(run)}</p></section>`;
}
function readableUpgrade(id){
 const text=String(id),perk=Object.values(PERKS).find(p=>text.includes(p.id));if(perk)return perk.name;
 const kind=Object.keys(BUILDS).find(k=>text.includes(k));return kind?`${BUILDS[kind].name}传承`:'武学精进';
}
function historyMarkup(run){
 const history=run.stats?.upgradeHistory||[],upgrades=run.stats?.upgrades||[];
 if(!upgrades.length)return '<p>江湖之路，从此起步</p>';
 return `<ol class="upgrade-history" aria-label="本次成长历程">${upgrades.map(id=>{
  const h=history.find(entry=>entry.id===id);
  return h?`<li><strong>${esc(h.title||readableUpgrade(id))}${Number.isInteger(h.dieIndex)?` · 第${h.dieIndex+1}骰`:''}</strong><span>${esc(h.before)} → ${esc(h.after)}</span></li>`:`<li><strong>${esc(readableUpgrade(id))}</strong></li>`;
 }).join('')}</ol>`;
}

function runItemsMarkup(run,busy){if(!run.bag)return '';const items=[['potion','回气散','回复35'],['reroll','转运签','重掷+1'],['antidote','解毒丸','回复15 · 盾5'],['tonic','养元露','攻击+3']];return `<div class="run-items" aria-label="战备行囊">${items.map(([id,name,desc])=>btn(`${name} <b>×${run.bag[id]||0}</b><small>${desc}</small>`,'use-item',id,`class="item-button" ${busy||!(run.bag[id]>0)||(id==='potion'&&run.hero.hp>=run.hero.maxHp)||(id==='reroll'&&run.combat.rerolls>=6)?'disabled':''}`)).join('')}</div>`;}

function journeyMarkup(run,view,busy){
 return `<section class="journey-options"><p class="event-wallet">本次铜钱 ${run.coins||0}${run.rogue?.curses?.length?` · 诅咒 ${esc(run.rogue.curses.join('、'))}`:''}</p><div class="event-choices">${view.choices.map((c,index)=>{const full=c.kind==='skill'&&(run.loadout?.skills?.length||0)>=4||c.kind==='relic'&&(run.loadout?.relics?.length||0)>=3,disabled=busy||c.disabled||full;const type=view.kind==='branch'?'branch':view.kind==='merchant'?'merchant':'encounter';return btn(`<strong>${esc(c.title)}</strong><span>${esc(c.description)}</span>${c.price!==undefined?`<small>铜钱 ${c.price}</small>`:''}${disabled&&c.reason?`<small>${esc(c.reason)}</small>`:full?'<small>当前装配槽已满</small>':''}`,type,type==='branch'?index:c.id,`class="event-card" ${disabled?'disabled':''}`);}).join('')}</div></section>`;
}
