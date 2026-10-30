import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAdventureLifecycle} from '../demo/renewal/lifecycle.mjs';

test('a cached Back navigation retains the app and a later permanent exit releases it once',()=>{
 const page=new EventTarget();let stops=0,destroys=0;
 bindAdventureLifecycle(page,{stop:()=>stops++,destroy:()=>destroys++});
 const cached=new Event('pagehide');Object.defineProperty(cached,'persisted',{value:true});
 page.dispatchEvent(cached);assert.equal(stops,1);assert.equal(destroys,0);
 page.dispatchEvent(new Event('pageshow'));page.dispatchEvent(new Event('pagehide'));assert.equal(destroys,1);
 page.dispatchEvent(new Event('pagehide'));assert.equal(destroys,1);
});
