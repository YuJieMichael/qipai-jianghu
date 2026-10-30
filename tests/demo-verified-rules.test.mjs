import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT,validateContent} from '../demo/content.mjs';
import {createProfile,applyProfileAction,deriveLoadout} from '../demo/profile.mjs';
import {renderHub} from '../demo/hub-ui.mjs';
import {renderExpansionPanel} from '../demo/expansion-ui.mjs';
import {renderCreator} from '../demo/creator-ui.mjs';
import * as battleUI from '../demo/ui.mjs';
import {createExpedition} from '../demo/adventures.mjs';
import {enterNode} from '../demo/journey.mjs';
import {rollDice} from '../demo/model.mjs';
import {migrateRun} from '../demo/storage.mjs';

test('default gear/growth rules are active and full-content validation rejects malformed optional rules',()=>{
 assert.ok(CONTENT.expansion.gear.progression,'gear rules wired');
 assert.ok(CONTENT.expansion.rogue.selection,'growth rules wired');
 assert.equal(validateContent(CONTENT).valid,true);
 for(const mutate of [c=>c.expansion.gear.progression.cumulativeFactors=[0,2,1],c=>c.expansion.gear.progression.percentRules[0].effects.attack=-1,c=>c.expansion.rogue.selection.poolWeights={sword:0,poison:0,guard:0},c=>c.expansion.rogue.selection.chapterBias.unknown={sword:1}]){
  const c=structuredClone(CONTENT);mutate(c);assert.equal(validateContent(c).valid,false);
  const p=createProfile(1,0),result=applyProfileAction(p,{type:'content-import',value:c},{now:0});assert.strictEqual(result.profile,p);
 }
});
test('equipment UI exposes retained levels, cap, effective enhancement and exact next upgrade delta',()=>{
 const p=createProfile(1,0);p.slotLevels.weapon=12;
 const capped=renderHub(p,{tab:'equipment',now:0});
 assert.match(capped,/已保存 \+12/);assert.match(capped,/生效 \+10/);assert.match(capped,/装备上限 \+10/);assert.match(capped,/超出等级仍保留/);
 p.slotLevels.weapon=9;const ready=renderHub(p,{tab:'equipment',now:0});
 assert.match(ready,/下一级增量/);assert.match(ready,/攻击 2/);assert.match(ready,/铜钱 400/);assert.match(ready,/锻材 40/);
});
test('quality workshop shows equipment-only flat/percent/result and creator exposes both rule groups',()=>{
 let p=createProfile(1,0);p=applyProfileAction(p,{type:'gear-advance',uid:p.equipped.weapon},{now:0}).profile;
 const gear=renderExpansionPanel(p,{tab:'equipment',now:0});assert.match(gear,/装备属性分层/);assert.match(gear,/装备平值/);assert.match(gear,/品质百分比/);assert.match(gear,/装备合计/);assert.match(gear,/攻击 \+5%/);
 const editor=renderCreator(p,{section:'gear'});assert.match(editor,/强化累计系数/);assert.match(editor,/装备属性百分比层/);
 const growth=renderCreator(p,{section:'growth'});assert.match(growth,/流派池权重/);assert.match(growth,/条目权重/);
});
test('growth explanation identifies fallback without promising unavailable rare choices',()=>{
 assert.equal(typeof battleUI.growthSelectionMarkup,'function');
 const run={build:'sword',choices:[{kind:'bind',build:'sword'}],rogue:{rules:{selection:{}},offer:{rarity:'rare',usedFallback:true}}};
 const html=battleUI.growthSelectionMarkup(run);assert.match(html,/珍品/);assert.match(html,/候选不足/);assert.match(html,/本门传承保底/);
 assert.equal(battleUI.growthSelectionMarkup({rogue:{rules:{}}}),'');
});
test('optional-rule-free old content remains valid and frozen old expedition survives new profile defaults',()=>{
 const legacy=structuredClone(CONTENT);delete legacy.expansion.gear.progression;delete legacy.expansion.rogue.selection;
 assert.equal(validateContent(legacy).valid,true);
 let p=createProfile(4,0);p=applyProfileAction(p,{type:'content-import',value:legacy},{now:0}).profile;
 const loadout=deriveLoadout(p),run=rollDice(enterNode(createExpedition('sword',42,{content:legacy,loadout,runId:1})));
 const before=JSON.stringify(run);assert.equal(run.rogue.rules.selection,undefined);
 p=applyProfileAction(p,{type:'content-reset'},{now:0}).profile;
 const restored=migrateRun(run);assert.ok(restored);assert.equal(restored.seed,run.seed);assert.deepEqual(restored.loadout,loadout);assert.equal(JSON.stringify(run),before);
 assert.ok(CONTENT.expansion.gear.progression);assert.ok(deriveLoadout(p).equipmentBreakdown);
});
