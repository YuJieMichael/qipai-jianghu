import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT,validateContent} from '../demo/content.mjs';
import {patchContent,lootProbabilities} from '../demo/creator-data.mjs';
test('visual edits validate the same full configuration without mutating the original',()=>{
 const before=JSON.stringify(CONTENT),result=patchContent(CONTENT,[{path:['equipment','0','name'],value:'听雨试剑',kind:'string'},{path:['equipment','0','effects','attack'],value:'9',kind:'number'}]);
 assert.equal(result.valid,true);assert.equal(result.content.equipment[0].effects.attack,9);assert.equal(result.content.equipment[0].name,'听雨试剑');assert.equal(JSON.stringify(CONTENT),before);assert.equal(validateContent(result.content).valid,true);
});
test('invalid numeric, unknown paths and prototype paths are rejected atomically',()=>{
 for(const edit of [{path:['modes','0','turnLimit'],value:'0',kind:'number'},{path:['modes','0','turnLimit'],value:'abc',kind:'number'},{path:['equipment','0','notDefined'],value:'3',kind:'number'},{path:['__proto__','polluted'],value:'yes',kind:'string'}]){
  const r=patchContent(CONTENT,[{path:['equipment','0','name'],value:'should not persist',kind:'string'},edit]);assert.equal(r.valid,false);assert.equal(r.content,CONTENT);
 }
 assert.equal({}.polluted,undefined);
});
test('drop preview normalizes only available weighted rarities and handles zero weights',()=>{
 const c=structuredClone(CONTENT);c.expansion={loot:{chance:.5,bossChance:1,rarityWeights:{common:1,fine:3,rare:0,epic:0},affixCount:{common:1,fine:2,rare:3,epic:4}}};
 const p=lootProbabilities(c);assert.equal(p.reduce((n,r)=>n+r.probability,0),1);assert.equal(p.find(r=>r.id==='common').probability,.25);assert.equal(p.find(r=>r.id==='fine').battleChance,.375);assert.equal(p.find(r=>r.id==='rare').probability,0);
});
test('drop preview includes full-equipment fallback for a configured rarity with no templates',()=>{
 const c=structuredClone(CONTENT);c.equipment.forEach(e=>{if(e.rarity==='fine')e.rarity='common';});
 const p=lootProbabilities(c);for(const [id,expected] of [['common',.69],['rare',.21],['epic',.1]])assert.ok(Math.abs(p.find(r=>r.id===id).probability-expected)<1e-12);
});
