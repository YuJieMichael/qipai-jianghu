import test from 'node:test';
import assert from 'node:assert/strict';
import {createUI} from '../demo/ui.mjs';
import {createRun,rollDice,toggleHold} from '../demo/model.mjs';
import {startBattle,previewAttack,resolveRound,prepareRound} from '../demo/combat.mjs';
import {NODES} from '../demo/config.mjs';

// A small DOM boundary: replacing innerHTML detaches descendants and drops focus,
// while native details.open can be changed directly by a user between renders.
function withUI(fn){
 const previousDocument=globalThis.document,sections=new Map(),listeners=new Map(),keys=new Map();
 const body={};globalThis.document={activeElement:body,addEventListener:(type,fn)=>keys.set(type,fn),removeEventListener:type=>keys.delete(type)};
 const attrs=html=>Object.fromEntries([...html.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([,key,value])=>[key,value??'']));
 const matches=(node,selector)=>selector.split(',').some(part=>{const s=part.trim();if(s==='summary')return node.tagName==='SUMMARY';if(s==='button')return node.tagName==='BUTTON';const data=s.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);return !!data&&Object.hasOwn(node.attributes,`data-${data[1]}`)&&(data[2]===undefined||node.attributes[`data-${data[1]}`]===data[2]);});
 const make=(tag,attributes={},parent=null)=>({tagName:tag.toUpperCase(),attributes,parent,connected:true,dataset:Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value])),disabled:Object.hasOwn(attributes,'disabled'),open:Object.hasOwn(attributes,'open'),closest(selector){return matches(this,selector)?this:this.parent?.closest(selector)||null;},focus(){if(!this.disabled&&this.connected&&!(this.parent?.tagName==='DETAILS'&&!this.parent.open&&this.tagName!=='SUMMARY'))document.activeElement=this;}});
 const section=id=>{
  if(!sections.has(id)){
   const item={nodes:[],textContent:'',className:'',html:''};
   Object.defineProperty(item,'innerHTML',{get:()=>item.html,set:html=>{
    for(const node of item.nodes){node.connected=false;if(document.activeElement===node)document.activeElement=body;}
    item.nodes=[];item.html=html;const disclosures=[];
    for(const match of html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)){
     const detail=make('details',attrs(match[1]));item.nodes.push(detail);disclosures.push({start:match.index,end:match.index+match[0].length,detail});
     const summary=match[2].match(/<summary\b([^>]*)>([\s\S]*?)<\/summary>/);
     if(summary){detail.summary=make('summary',attrs(summary[1]),detail);detail.summary.textContent=summary[2].replace(/<[^>]+>/g,'');item.nodes.push(detail.summary);}
    }
    for(const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
     const parent=disclosures.find(d=>match.index>d.start&&match.index<d.end)?.detail;
     item.nodes.push(make('button',attrs(match[1]),parent));
    }
   }});sections.set(id,item);
  }return sections.get(id);
 };
 const all=()=>[...sections.values()].flatMap(s=>s.nodes);
 const root={innerHTML:'',classList:{toggle(){}},contains:node=>all().includes(node)&&node.connected,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type),scrollIntoView(){},querySelector(selector){if(/^#[\w-]+$/.test(selector))return section(selector);if(selector==='#hud [data-action]:not(:disabled)')return section('#hud').nodes.find(n=>n.dataset.action&&!n.disabled);return all().find(node=>matches(node,selector))||null;},querySelectorAll:selector=>all().filter(node=>matches(node,selector))};
 const actions=[],ui=createUI(root,action=>actions.push(action));
 const detail=id=>root.querySelector(`[data-battle-disclosure="${id}"]`),summary=id=>root.querySelector(`[data-battle-summary="${id}"]`),button=(action,value='')=>all().find(n=>n.dataset.action===action&&n.dataset.value===String(value));
 const click=(action,value='')=>listeners.get('click')({target:button(action,value)});
 try{return fn({ui,root,section,detail,summary,button,click,actions,keys});}finally{ui.destroy();globalThis.document=previousDocument;}
}
function battle(){const run=rollDice(startBattle(createRun('sword',42,{runId:'mobile-test'}),NODES[0]));run.bag={potion:2,reroll:1,antidote:0,tonic:1};run.hero.hp=60;return run;}
const show=(ui,run,options={})=>ui.render(run,{preview:options.busy?null:previewAttack(run),...options});

test('battle disclosures start closed, summarize current supplies and retain every real item and forecast action',()=>withUI(({ui,detail,summary,section,click,actions})=>{
 const run=battle();show(ui,run);
 assert.ok(detail('supplies'),'the player can expand the battle bag');assert.equal(detail('supplies').open,false);
 assert.ok(detail('forecast'),'the player can expand the complete forecast');assert.equal(detail('forecast').open,false);
 for(const text of ['回气散 ×2','转运签 ×1','养元露 ×1'])assert.ok(summary('supplies').textContent.includes(text),text);
 for(const text of ['直接伤害','骰技与毒伤','敌方回应','护盾','预计敌人结局'])assert.ok(section('#hud').innerHTML.includes(text),text);
 detail('supplies').open=true;click('use-item','potion');click('hold',2);click('attack');
 assert.deepEqual(actions,[{type:'use-item',value:'potion'},{type:'hold',value:2},{type:'attack',value:''}]);
 assert.equal(section('#hud').innerHTML.includes('data-action="roll"'),false,'initial rolls stay automatic');
}));

test('user disclosure choices survive dice, target, busy playback and next round renders, including explicit closing',()=>withUI(({ui,detail})=>{
 let run=battle();show(ui,run);assert.ok(detail('forecast'),'forecast is a native disclosure');
 detail('supplies').open=true;detail('forecast').open=true;
 run=toggleHold(run,1);show(ui,run);assert.equal(detail('supplies').open,true);assert.equal(detail('forecast').open,true);
 run={...run,combat:{...run.combat,targetId:run.combat.enemies.at(-1).id}};show(ui,run);
 assert.equal(detail('forecast').open,true);
 const result=resolveRound(run);let forecastOpen=true;
 for(const [index,event] of result.events.entries()){
  assert.equal(event.snapshot.combat.phase,'resolved');
  show(ui,event.snapshot,{busy:true,playback:{index:index+1,total:result.events.length,text:event.text}});
  assert.equal(detail('supplies').open,true);assert.ok(detail('forecast'),`${event.type} keeps the complete forecast available`);assert.equal(detail('forecast').open,forecastOpen);
  if(index===1){detail('forecast').open=false;forecastOpen=false;}
 }
 run=rollDice(prepareRound(result.state));show(ui,run);
 assert.equal(detail('supplies').open,true);assert.equal(detail('forecast').open,false,'an explicit close during playback survives the next round');
 detail('forecast').open=false;show(ui,toggleHold(run,0));assert.equal(detail('forecast').open,false);
}));

test('focused forecast summaries and paired pre-attack numbers survive every real resolved snapshot and the next round',()=>withUI(({ui,detail,summary,section,button})=>{
 let run=battle();show(ui,run);assert.ok(detail('forecast'),'forecast is available');
 detail('forecast').open=true;summary('forecast').focus();
 const preview=previewAttack(run),beforeHp=run.hero.hp,result=resolveRound(run);
 assert.notEqual(result.state.hero.hp,beforeHp,'the fixture must distinguish current from pre-attack health');
 show(ui,run,{busy:true});
 for(const [index,event] of result.events.entries()){
  assert.equal(event.snapshot.combat.phase,'resolved');
  show(ui,event.snapshot,{busy:true,playback:{index:index+1,total:result.events.length,text:event.text}});
  assert.ok(detail('forecast'),`${event.type} retains the forecast disclosure`);
  assert.equal(document.activeElement,summary('forecast'),'summary focus survives every replacement');assert.equal(detail('forecast').open,true);
  assert.ok(section('#hud').innerHTML.includes(`侠客气血 ${beforeHp} → ${preview.forecast.heroHpAfter}`),'forecast numbers remain paired with the pre-attack run');
  assert.ok(summary('forecast').textContent.includes(`气血 ${beforeHp} → ${preview.forecast.heroHpAfter}`));
  for(const foe of run.combat.enemies){const after=preview.forecast.enemies.find(enemy=>enemy.id===foe.id);assert.ok(section('#hud').innerHTML.includes(`气血 ${foe.hp} → ${after.hpAfter}`),'enemy outcomes also retain their pre-attack health');}
  assert.ok(section('#hud').innerHTML.includes('以下为本次出招前推演'));
  assert.equal(button('roll').disabled,true,'resolved snapshots cannot enable rolling while playback is busy');
  assert.equal(button('use-item','potion').disabled,true);
 }
 run=rollDice(prepareRound(result.state));assert.equal(run.combat.phase,'pick');show(ui,run);
 assert.equal(detail('forecast').open,true);assert.equal(document.activeElement,summary('forecast'));
 assert.ok(section('#hud').innerHTML.includes(`侠客气血 ${run.hero.hp} → ${previewAttack(run).forecast.heroHpAfter}`),'next round refreshes the entire run/preview pair');
 assert.equal(section('#hud').innerHTML.includes('以下为本次出招前推演'),false);
 assert.equal(button('attack').disabled,false);
}));

test('item focus remains in its open disclosure when busy disables the item, and dispatch still guards actions',()=>withUI(({ui,detail,summary,button,click,actions})=>{
 const run=battle();show(ui,run);assert.ok(detail('supplies'),'supplies are available');detail('supplies').open=true;
 button('use-item','potion').focus();show(ui,toggleHold(run,2));assert.equal(document.activeElement,button('use-item','potion'));
 show(ui,run,{busy:true});assert.equal(document.activeElement,summary('supplies'),'disabled focused item yields to its summary');
 for(const action of ['attack','reroll','speed','mute','skip-playback'])click(action);
 assert.deepEqual(actions.map(a=>a.type),['speed','mute','skip-playback']);
 show(ui,run);assert.equal(document.activeElement,summary('supplies'));
}));

test('disclosure state resets when leaving combat, starting a different run or entering a different battle',()=>withUI(({ui,detail})=>{
 const run=battle();show(ui,run);assert.ok(detail('forecast'),'forecast is available');detail('forecast').open=true;
 show(ui,{...run,flow:'camp'});show(ui,run);assert.equal(detail('forecast').open,false);
 detail('forecast').open=true;show(ui,{...run,runId:'fresh-run'});assert.equal(detail('forecast').open,false);
 detail('forecast').open=true;show(ui,{...run,runId:'fresh-run',nodeIndex:1});assert.equal(detail('forecast').open,false);
}));

test('starting a different battle returns focus to an available target instead of a now collapsed item',()=>withUI(({ui,detail,button})=>{
 const run=battle();show(ui,run);detail('supplies').open=true;button('use-item','potion').focus();
 show(ui,{...run,runId:'new-battle'});
 assert.equal(detail('supplies').open,false);assert.equal(document.activeElement,button('target',run.combat.enemies[0].id));
}));

test('native battle summaries keep Space and Enter, and never trigger the combat shortcuts',()=>withUI(({ui,summary,keys,actions})=>{
 const run=battle();show(ui,run);let prevented=0;
 for(const id of ['supplies','forecast'])for(const [key,code] of [[' ','Space'],['Enter','Enter'],['r','KeyR'],['1','Digit1'],['5','Digit5']]){
  keys.get('keydown')({key,code,target:summary(id),preventDefault:()=>prevented++});
 }
 assert.deepEqual(actions,[]);assert.equal(prevented,0);
}));
