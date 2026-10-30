import test from 'node:test';
import assert from 'node:assert/strict';

test('icon API emits self-contained deterministic markup for inventory and chapter cards',async()=>{
 const {iconMarkup}=await import('../demo/icons.mjs');
 const equipment=iconMarkup({kind:'equipment',slot:'weapon',weaponType:'staff',id:'jade-staff',quality:3,size:48});
 assert.match(equipment,/^<svg /);assert.match(equipment,/width="48" height="48"/);
 assert.equal(equipment,iconMarkup({kind:'equipment',slot:'weapon',weaponType:'staff',id:'jade-staff',quality:3,size:48}));
 assert.notEqual(equipment,iconMarkup({kind:'equipment',slot:'weapon',weaponType:'hammer',id:'jade-staff',quality:3,size:48}));
 for(const kind of ['relic','rune','pet','coin','loot','chapter'])assert.match(iconMarkup({kind,id:'lake'}),/^<svg /);
 assert.notEqual(iconMarkup({kind:'chapter',id:'lake'}),iconMarkup({kind:'chapter',id:'desert'}));
});
test('untrusted icon parameters never introduce elements attributes or external references',async()=>{
 const {iconMarkup}=await import('../demo/icons.mjs');
 const svg=iconMarkup({kind:'<script>alert(1)</script>',slot:'" onload="alert(1)',weaponType:'<img src=x>',id:'<script>evil</script>',quality:Infinity,size:'40" onload="evil'});
 assert.doesNotMatch(svg,/<script|<img|onload|href=|evil|Infinity|NaN/);
 assert.match(svg,/width="40" height="40"/);
 assert.match(iconMarkup({size:9999}),/width="128" height="128"/);
});
