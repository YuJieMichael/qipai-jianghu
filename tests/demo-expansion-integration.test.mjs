import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../demo/main.mjs';
import {getContent} from '../demo/content.mjs';
import {renderCreator} from '../demo/creator-ui.mjs';
import {lootProbabilities} from '../demo/creator-data.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('creator applies atomically, snapshots restore, simulations preserve profile and resume preserves original run',async()=>{
 let view;const c=createController({storage:memory(),seed:()=>2,render:(_r,o)=>view=o});
 try{
  await c.act({type:'expedition',value:{build:'sword',chapter:'bamboo',mode:'boss'}});const battle=structuredClone(c.state);
  await c.act({type:'home'});await c.act({type:'profile',value:{type:'config-snapshot',index:0,name:'回归备份'}});
  const beforeName=getContent(c.profile).equipment[0].name;
  await c.act({type:'creator-apply',value:[{path:['equipment','0','name'],kind:'string',value:'试改武器'}]});assert.equal(getContent(c.profile).equipment[0].name,'试改武器');
  const before=JSON.stringify(c.profile);await c.act({type:'creator-simulate',value:{build:'sword',chapter:'bamboo',mode:'boss',count:1}});assert.equal(view.creator.report.局数,1);assert.equal(JSON.stringify(c.profile),before);
  await c.act({type:'creator-apply',value:[{path:['modes','0','turnLimit'],kind:'number',value:'0'}]});assert.equal(JSON.stringify(c.profile),before);
  await c.act({type:'profile',value:{type:'config-restore',index:0}});assert.equal(getContent(c.profile).equipment[0].name,beforeName);
  const markup=renderCreator(c.profile);assert.match(markup,/data-field="index" data-kind="number"/);assert.match(markup,/恢复位置 1 · 回归备份/);assert.match(markup,/config-restore/);
  await c.act({type:'resume'});assert.deepEqual(c.state,battle);
 }finally{c.destroy();}
});
test('probability preview caps actual affix count by unique effect keys',()=>{
 const c=createController({storage:memory()});try{const content=structuredClone(getContent(c.profile));content.expansion.affixes.forEach(a=>a.key='attack');assert.ok(lootProbabilities(content).every(r=>r.affixes===1));}finally{c.destroy();}
});
test('skipped tutorial stays dismissed and can be reopened without changing the run',async()=>{
 const storage=memory();let view;const c=createController({storage,render:(_r,o)=>view=o});await c.act({type:'tutorial-skip'});assert.equal(view.tutorialStep,3);c.destroy();const second=createController({storage,render:(_r,o)=>view=o});assert.equal(view.tutorialStep,3);await second.act({type:'tutorial-open'});assert.equal(view.tutorialStep,0);assert.equal(second.state.flow,'intro');second.destroy();
});
