import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../demo/model.mjs';
import {createProfile} from '../demo/profile.mjs';
import {startBattle,previewAttack} from '../demo/combat.mjs';
import {NODES} from '../demo/config.mjs';
import {createExpedition} from '../demo/adventures.mjs';
import {createUI,forecastMarkup} from '../demo/ui.mjs';
import {loadRun,SAVE_KEY} from '../demo/storage.mjs';
import {createChoices,chooseUpgrade} from '../demo/journey.mjs';

test('forecast keeps summoned enemies identifiable in skill effects and final outcomes',()=>{
 const run=startBattle(createRun('sword',2),NODES[8]);
 run.nodeIndex=8;run.combat.phase='pick';run.combat.dice=[6,6,6,6,6];run.combat.enemies[0].hp=140;
 const preview=previewAttack(run);
 const markup=forecastMarkup(run,preview),skillSection=markup.split('<h3>贰 · 骰技与毒伤</h3>')[1].split('<h3>叁 · 敌方回应</h3>')[0];
 const outcomes=markup.split('aria-label="预计敌人结局"')[1];
 for(const name of ['竹林刀客','夜雨弩手']){
  assert.ok(skillSection.includes(`<span>${name}</span>`),`skill targets identify ${name}`);
  assert.ok(outcomes.includes(`<strong>${name}</strong>`),`outcomes identify ${name}`);
 }
 assert.equal(run.combat.enemies.length,1);assert.equal(run.combat.enemies[0].hp,140);
});

test('result history retains migrated choices in order after a detailed upgrade is recorded',()=>{
 const legacy=createRun('sword',19);legacy.version=1;
 delete legacy.perks;delete legacy.pendingUpgrade;delete legacy.stats.upgradeHistory;
 legacy.stats.upgrades=['growth-0-bind-poison','growth-1-bind-guard'];
 const migrated=loadRun({getItem:key=>key===SAVE_KEY?JSON.stringify(legacy):null}).run;
 assert.ok(migrated);migrated.nodeIndex=1;
 const offered=createChoices(migrated),choice=offered.choices[0];
 const run=chooseUpgrade(offered,choice.id,4);run.flow='victory';
 assert.equal(run.stats.upgrades.length,3);assert.equal(run.stats.upgradeHistory.length,1);
 const previousDocument=globalThis.document,nodes=new Map();
 const root={innerHTML:'',addEventListener(){},removeEventListener(){},contains:()=>false,classList:{toggle(){}},querySelector(selector){
  if(!/^#[\w-]+$/.test(selector))return null;
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',className:''});
  return nodes.get(selector);
 }};
 globalThis.document={activeElement:null,addEventListener(){},removeEventListener(){}};
 let ui;
 try{
  ui=createUI(root,()=>{});ui.render(run);
  const result=nodes.get('#hud').innerHTML,history=result.match(/<ol class="upgrade-history"[^>]*>(.*?)<\/ol>/)?.[1];
  assert.ok(history,'result exposes an ordered growth history');
  assert.equal((history.match(/<li>/g)||[]).length,3);
  assert.ok(history.indexOf('毒针传承')<history.indexOf('金刚传承'));
  assert.ok(history.indexOf('金刚传承')<history.indexOf(`${choice.title} · 第5骰`));
  assert.ok(history.includes('未绑定 → 剑气 1 级 · 每道剑气 6 伤害'));
  assert.ok(!history.includes('growth-'),'legacy identifiers have readable names');
 }finally{ui?.destroy();globalThis.document=previousDocument;}
});

test('every expedition renders a complete nine-cell pip grid for all six die values',()=>{
 const previousDocument=globalThis.document,nodes=new Map();
 const root={innerHTML:'',addEventListener(){},removeEventListener(){},contains:()=>false,classList:{toggle(){}},querySelector(selector){
  if(!/^#[\w-]+$/.test(selector))return null;
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',className:''});return nodes.get(selector);
 }};
 globalThis.document={activeElement:null,addEventListener(){},removeEventListener(){}};
 let ui;
 try{
  ui=createUI(root,()=>{});
  for(const mode of ['boss','dungeon','resource']){
   const run=createExpedition('sword',2,{mode});run.flow='battle';run.combat=startBattle(run,run.route[0]).combat;run.combat.phase='pick';
   for(let value=1;value<=6;value++){
    run.combat.dice=Array(5).fill(value);ui.render(run);
    const faces=[...nodes.get('#hud').innerHTML.matchAll(/class="die-face[^"]*">(.*?)<\/span>/g)];
    assert.equal(faces.length,5);
    for(const face of faces){assert.equal((face[1].match(/class="pip /g)||[]).length,9,`${mode} uses a 3x3 grid`);assert.equal((face[1].match(/class="pip visible"/g)||[]).length,value,`${mode} displays ${value} pips`);}
   }
  }
 }finally{ui?.destroy();globalThis.document=previousDocument;}
});


test('major flow changes scroll to the new screen while initial and same-flow renders retain the viewport',()=>{
 const previousDocument=globalThis.document,nodes=new Map(),scrolls=[];
 const hub={scrollIntoView:options=>scrolls.push({target:'hub',options})};
 let hasHub=true;
 const root={innerHTML:'',addEventListener(){},removeEventListener(){},contains:()=>false,classList:{toggle(){}},
  scrollIntoView:options=>scrolls.push({target:'root',options}),querySelector(selector){
   if(selector==='.hub')return hasHub?hub:null;
   if(!/^#[\w-]+$/.test(selector))return null;
   if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',className:''});return nodes.get(selector);
  }};
 globalThis.document={activeElement:null,addEventListener(){},removeEventListener(){}};
 let ui;
 try{
  ui=createUI(root,()=>{});const profile=createProfile(7,100000),intro=createRun('sword',7);
  ui.render(intro,{profile});ui.render(intro,{profile,hubTab:'editor'});
  assert.deepEqual(scrolls,[],'opening the page and editing a hub tab retain scroll');
  let run=startBattle(createRun('sword',7),NODES[0]);run.flow='battle';run.combat.phase='pick';run.combat.dice=[1,2,3,4,5];
  ui.render(run,{profile});
  assert.deepEqual(scrolls,[{target:'root',options:{block:'start',behavior:'instant'}}],'starting a mode reveals the battle top');
  scrolls.length=0;
  run=structuredClone(run);run.combat.held[0]=true;ui.render(run,{profile});
  run=structuredClone(run);run.combat.targetId=run.combat.enemies[0].id;ui.render(run,{profile,busy:true});
  run=structuredClone(run);run.combat.round++;run.combat.dice=[6,5,4,3,2];ui.render(run,{profile});
  assert.deepEqual(scrolls,[],'dice, targets, animation and next rounds retain battle scroll');
  for(const flow of ['reward','event','camp','victory']){
   ui.render({...run,flow},{profile});
   assert.deepEqual(scrolls.pop(),{target:'root',options:{block:'start',behavior:'instant'}},`${flow} reveals the new decision screen`);
   ui.render({...run,flow},{profile});assert.deepEqual(scrolls,[]);
  }
  ui.render(intro,{profile});
  assert.deepEqual(scrolls.pop(),{target:'hub',options:{block:'start',behavior:'instant'}},'returning home reveals the hub');
  ui.render(run,{profile});scrolls.length=0;hasHub=false;ui.render(intro,{profile});
  assert.deepEqual(scrolls.pop(),{target:'root',options:{block:'start',behavior:'instant'}},'home falls back to the root when a hub is absent');
  ui.render(run);scrolls.length=0;ui.render(intro);
  assert.deepEqual(scrolls.pop(),{target:'root',options:{block:'start',behavior:'instant'}},'standalone intro reveals its top');
 }finally{ui?.destroy();globalThis.document=previousDocument;}
});
