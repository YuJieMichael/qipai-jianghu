import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../demo/model.mjs';
import {startBattle,previewAttack} from '../demo/combat.mjs';
import {NODES} from '../demo/config.mjs';
import {forecastMarkup} from '../demo/ui.mjs';

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
