import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,rollDice,rerollDice,toggleHold} from '../demo/model.mjs';
import {startBattle} from '../demo/combat.mjs';
import {NODES} from '../demo/config.mjs';
import {createUI} from '../demo/ui.mjs';
const reportUI=await import('../demo/battle-report-ui.mjs').catch(()=>({}));
const uiModule=await import('../demo/ui.mjs');

const report={round:3,nodeName:'夜雨竹林',hand:{name:'三条',dice:[2,2,2,4,6]},damage:37,kills:1,hero:{hpBefore:68,hpAfter:59,shieldBefore:12,shieldAfter:0},events:[{type:'skill',text:'飞剑穿雨',sourceName:'无名侠客',targetNames:['竹林刀客'],value:25},{type:'attack',text:'弩箭',sourceName:'夜雨弩手',targetNames:['无名侠客'],value:9}]};

function withUI(fn){
 const oldDocument=globalThis.document,nodes=new Map(),listeners=new Map(),documentListeners=new Map();
 const node=selector=>{if(!nodes.has(selector)){let html='';const item={textContent:'',className:'',details:null,mounts:0};Object.defineProperty(item,'innerHTML',{get:()=>html,set:value=>{html=value;item.mounts++;item.details=value.includes('<details')?{open:/<details\b[^>]*\bopen(?:\s|>)/.test(value)}:null;}});nodes.set(selector,item);}return nodes.get(selector);};
 const root={innerHTML:'',contains:element=>!!element,classList:{toggle(){}},addEventListener:(type,listener)=>listeners.set(type,listener),removeEventListener:type=>listeners.delete(type),querySelectorAll:()=>[],querySelector:selector=>selector==='#round-report details'?node('#round-report').details:/^#[\w-]+$/.test(selector)?node(selector):null};
 globalThis.document={activeElement:null,addEventListener:(type,listener)=>documentListeners.set(type,listener),removeEventListener:type=>documentListeners.delete(type)};
 const actions=[],ui=createUI(root,action=>actions.push(action));
 const click=type=>{const button={dataset:{action:type,value:''},disabled:false};listeners.get('click')({target:{closest:()=>button}});};
 const keydown=event=>documentListeners.get('keydown')(event);
 try{return fn({ui,root,node,actions,click,keydown});}finally{ui.destroy();globalThis.document=oldDocument;}
}
const battle=()=>rollDice(startBattle(createRun('sword',42),NODES[0]));

test('busy playback permits speed and skip but rejects combat actions, and skip is inert when idle',()=>withUI(({ui,actions,click,node})=>{
 const run=battle();ui.render(run,{busy:true,settings:{playbackSpeed:2},playback:{index:2,total:5,type:'attack',text:'弩箭逼近'}});
 for(const type of ['attack','reroll','hold','target','home','speed','skip-playback','mute','motion','exit'])click(type);
 assert.deepEqual(actions.map(a=>a.type),['speed','skip-playback','mute','motion','exit']);
 assert.match(node('#settings').innerHTML,/演出×2/);
 assert.match(node('#playback-progress').textContent,/2\s*\/\s*5/);assert.match(node('#playback-progress').textContent,/弩箭逼近/);
 assert.match(node('#playback-controls').innerHTML,/data-action="skip-playback"/);
 ui.render(run,{settings:{playbackSpeed:1}});click('skip-playback');
 assert.equal(actions.length,5);assert.equal(node('#playback-controls').innerHTML,'');
}));

test('playback event updates retain mounted skip and settings controls until busy changes',()=>withUI(({ui,node,click,actions})=>{
 const run=battle(),settings={playbackSpeed:2,muted:false};
 ui.render(run,{busy:true,settings,playback:{index:1,total:3,text:'凝神'}});
 const settingsMounts=node('#settings').mounts,skipMounts=node('#playback-controls').mounts;
 assert.ok(skipMounts>0,'skip control is mounted at playback start');
 for(const text of ['飞剑穿雨','弩箭逼近'])ui.render(run,{busy:true,settings:{...settings},playback:{index:2,total:3,text}});
 assert.equal(node('#settings').mounts,settingsMounts,'unchanged header controls retain pointer and focus targets');
 assert.equal(node('#playback-controls').mounts,skipMounts,'event updates retain the skip pointer target');
 assert.match(node('#playback-progress').textContent,/弩箭逼近/);click('skip-playback');assert.equal(actions.at(-1).type,'skip-playback');
 ui.render(run,{settings});assert.equal(node('#playback-controls').innerHTML,'');
 const idleMounts=node('#playback-controls').mounts;ui.render(toggleHold(run,0),{settings});assert.equal(node('#playback-controls').mounts,idleMounts);
}));

test('round report shows actual endpoints and ordered named events without mutating input',()=>{
 assert.equal(typeof reportUI.renderRoundReport,'function');
 const before=structuredClone(report),html=reportUI.renderRoundReport(report,{open:true});
 assert.match(html,/<details\b[^>]*\bopen/);assert.match(html,/<summary[^>]*>.*上一回合战报/s);
 for(const text of ['第 3 回合','夜雨竹林','三条','2 · 2 · 2 · 4 · 6','实际伤害','37','击败','气血 68 → 59','护盾 12 → 0'])assert.ok(html.includes(text),text);
 assert.match(html,/<ol\b/);assert.ok(html.indexOf('飞剑穿雨')<html.indexOf('弩箭'));
 for(const name of ['无名侠客','竹林刀客','夜雨弩手'])assert.ok(html.includes(name));
 assert.deepEqual(report,before);assert.equal(reportUI.renderRoundReport(null),'');
});

test('round report escapes content names, dice, event text and event attributes',()=>{
 assert.equal(typeof reportUI.renderRoundReport,'function');
 const unsafe='<img src=x onerror="bad()">';
 const html=reportUI.renderRoundReport({...report,nodeName:unsafe,hand:{name:unsafe,dice:[unsafe]},events:[{type:'" onclick="bad()',text:unsafe,sourceName:unsafe,targetNames:[unsafe],value:unsafe}]});
 assert.ok(html.includes('&lt;img src=x onerror=&quot;bad()&quot;&gt;'));assert.doesNotMatch(html,/<img| onclick="bad/);
 assert.doesNotMatch(html,/<details\b[^>]*\bopen/);
});

test('report event amounts label damage, recovery and blocking without presenting phase or windup values as damage',()=>{
 const events=[{type:'phase',text:'钟盾二阶段',value:2},{type:'mechanic',text:'每轮重建护盾',value:2},{type:'windup',text:'凝神出招',value:0},{type:'hurt',text:'受到攻击',value:0},{type:'heal',text:'回春',value:8},{type:'shield',text:'护体',value:12},{type:'shield',text:'护盾抵挡',value:-5},{type:'strike',text:'一剑',value:14},{type:'poisonTick',text:'毒发',value:6}];
 const html=reportUI.renderRoundReport({...report,events});
 const eventHTML=type=>html.match(new RegExp(`<li data-event="${type}">([\\s\\S]*?)</li>`))?.[1];
 for(const type of ['phase','mechanic','windup','hurt'])assert.doesNotMatch(eventHTML(type),/<b>/,`${type} has no misleading raw amount`);
 for(const text of ['回复 8','护盾 12','抵挡 5','伤害 14','伤害 6'])assert.ok(html.includes(text),text);
});

test('report disclosure survives same-report selections and resets for a new or absent report',()=>withUI(({ui,node})=>{
 const run=battle();ui.render(run,{roundReport:report});
 assert.ok(node('#round-report').details,'report has its own disclosure after the HUD');
 node('#round-report').details.open=true;
 ui.render(toggleHold(run,1),{roundReport:report,settings:{playbackSpeed:2}});
 assert.equal(node('#round-report').details.open,true);
 ui.render(run,{roundReport:{...report,round:4}});assert.equal(node('#round-report').details.open,false);
 node('#round-report').details.open=true;ui.render(run,{roundReport:null});assert.equal(node('#round-report').innerHTML,'');
 ui.render(run,{roundReport:report});assert.equal(node('#round-report').details.open,false);
}));

test('native report summary and its descendants retain keyboard handling without combat shortcuts',()=>withUI(({ui,keydown,actions})=>{
 ui.render(toggleHold(battle(),0),{roundReport:report});
 let prevented=0;
 const summary={tagName:'SUMMARY'},descendant={tagName:'SPAN'};
 for(const element of [summary,descendant])for(const [key,code] of [[' ','Space'],['r','KeyR'],['1','Digit1'],['2','Digit2'],['3','Digit3'],['4','Digit4'],['5','Digit5'],['Enter','Enter']]){
  const target={...element,closest:selector=>selector.split(',').some(part=>part.trim()==='summary')?summary:null};
  keydown({key,code,target,preventDefault:()=>prevented++});
 }
 assert.deepEqual(actions,[],'native report interaction must never attack, reroll or select dice');
 assert.equal(prevented,0,'Space and Enter retain native disclosure behavior');
}));

test('same report retains its native DOM through settings, hold and busy events; a new report replaces it and null clears it',()=>withUI(({ui,node})=>{
 const run=battle();ui.render(run,{roundReport:report});
 const initialMounts=node('#round-report').mounts,details=node('#round-report').details;
 details.open=true;
 ui.render(run,{roundReport:report,settings:{playbackSpeed:2}});
 ui.render(toggleHold(run,0),{roundReport:report});
 ui.render(run,{roundReport:report,busy:true,playback:{index:1,total:2,text:'出招'}});
 ui.render(run,{roundReport:report,busy:true,playback:{index:2,total:2,text:'回应'}});
 assert.equal(node('#round-report').mounts,initialMounts,'unchanged report must retain pointer/focus targets');
 assert.equal(node('#round-report').details,details);assert.equal(details.open,true);
 ui.render(run,{roundReport:{...report,round:4}});assert.equal(node('#round-report').mounts,initialMounts+1);assert.notEqual(node('#round-report').details,details);assert.equal(node('#round-report').details.open,false);
 ui.render(run,{roundReport:null});assert.equal(node('#round-report').innerHTML,'');assert.equal(node('#round-report').mounts,initialMounts+2);
 ui.render(run,{roundReport:null});assert.equal(node('#round-report').mounts,initialMounts+2);
}));

test('earlier dice focus history does not steal focus from a native report summary on updates',()=>withUI(({ui,root})=>{
 const run=battle(),die={dataset:{action:'hold',value:'0'},disabled:false,closest:()=>die,focus:()=>{document.activeElement=die;}};
 root.querySelectorAll=()=>[die];document.activeElement=die;ui.render(run,{roundReport:report});
 const summary={closest:()=>null};document.activeElement=summary;
 ui.render(run,{roundReport:report,settings:{playbackSpeed:2}});
 assert.equal(document.activeElement,summary);
}));

test('dice feedback classifies real rolls, stable selection changes and equal-value linked rerolls',()=>{
 assert.equal(typeof uiModule.diceRollIndices,'function');
 const before=startBattle(createRun('sword',42),NODES[0]),first=rollDice(before);
 assert.deepEqual(uiModule.diceRollIndices(before,first),[0,1,2,3,4]);
 assert.deepEqual(uiModule.diceRollIndices(null,first),[0,1,2,3,4]);
 const selected=toggleHold(first,1);assert.deepEqual(uiModule.diceRollIndices(first,selected),[]);
 assert.deepEqual(uiModule.diceRollIndices(selected,{...selected,combat:{...selected.combat,targetId:'other'}}),[]);
 const linked=structuredClone(selected);linked.loadout={dice:Array.from({length:5},(_,i)=>({faces:[3,3,3,3,3,3],decorationId:i===1?'chain':''}))};linked.combat.dice=[3,3,3,3,3];linked.combat.frozen=[true,false,false,false,false];
 const rerolled=rerollDice(linked);
 assert.deepEqual(rerolled.combat.dice,linked.combat.dice,'a real RNG roll can retain every value');
 assert.deepEqual(uiModule.diceRollIndices(linked,rerolled),[1,2],'linked neighbour rolls while frozen neighbour stays');
 assert.deepEqual(uiModule.diceRollIndices(linked,rerolled,{busy:true}),[]);
 assert.deepEqual(uiModule.diceRollIndices(linked,rerolled,{reducedMotion:true}),[]);
 assert.deepEqual(uiModule.diceRollIndices(first,{...first,combat:{...first.combat,round:2}}),[0,1,2,3,4]);
});
