import test from 'node:test';import assert from 'node:assert/strict';
import {createProfile} from '../demo/profile.mjs';import {simulateConfiguration} from '../demo/creator-simulation.mjs';
test('creator simulation runs real routes and never changes player data',()=>{const p=createProfile(1,100000),before=JSON.stringify(p);for(const mode of ['boss','campaign','resource']){const report=simulateConfiguration(p,{mode,count:1});assert.equal(report.局数,1);assert.equal(report.详情.length,1);assert.ok(report.详情[0].回合>0);}assert.equal(JSON.stringify(p),before);});
test('creator simulation rejects unbounded batches',()=>{for(const count of [0,11,Infinity,1.5])assert.throws(()=>simulateConfiguration(createProfile(),{count}));});
