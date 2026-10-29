import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,applyProfileAction} from '../demo/profile.mjs';
import {renderHub} from '../demo/hub-ui.mjs';
test('rune plan control reports the active plan when editing saved layouts',()=>{
 let profile=createProfile(1,100000);
 for(const index of [1,2,0]){
  profile=applyProfileAction(profile,{type:'rune-plan',index}).profile;
  const html=renderHub(profile,{tab:'relics'}),options=html.match(/data-field="index"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.ok(options);assert.match(options,new RegExp(`<option value="${index}" selected>`));
  assert.equal((options.match(/ selected/g)||[]).length,1);
 }
});
