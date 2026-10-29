import test from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../demo/content.mjs').catch(()=>null);
test('editable catalog supplies every workshop system as JSON data',()=>{
 assert.ok(mod,'content module must exist');
 const {CONTENT,validateContent,getContent}=mod;
 assert.ok(CONTENT.equipment.length>=40);assert.equal(CONTENT.sects.length,7);assert.ok(CONTENT.skills.length>=12);assert.ok(CONTENT.talents.length>=8);
 assert.equal(CONTENT.materials.length,7);assert.equal(CONTENT.decorations.length,8);assert.equal(CONTENT.marks.length,9);
 assert.ok(CONTENT.relics.length>=8);assert.ok(CONTENT.runes.length>=10);assert.ok(CONTENT.pets.length>=5);assert.ok(CONTENT.souls.length>=6);
 assert.equal(CONTENT.chapters.length,7);assert.ok(CONTENT.modes.length>=11);
 assert.equal(validateContent(JSON.parse(JSON.stringify(CONTENT))).valid,true);
 const changed=structuredClone(CONTENT);changed.equipment[0].effects.attack=17;
 assert.equal(getContent({contentOverrides:changed}).equipment[0].effects.attack,17);assert.notEqual(CONTENT.equipment[0].effects.attack,17);
});
test('content validation rejects unsafe objects, duplicate ids, invalid enums and negative costs',()=>{
 assert.ok(mod);for(const alter of [c=>c.equipment[0].cost={gold:-1},c=>c.materials[0].id='script',c=>c.equipment.push(c.equipment[0]),c=>c.skills[0].effects.attack=Infinity,c=>c.shop[0].name='<script>x</script>',c=>c.equipment[0].effects.attack='x']) {
  const c=structuredClone(mod.CONTENT);alter(c);const result=mod.validateContent(c);assert.equal(result.valid,false);assert.ok(result.errors.length);
 }
});
test('content rejects malformed entries and required numeric fields without throwing',()=>{
 assert.ok(mod);for(const alter of [c=>c.equipment[0]=null,c=>c.relics[0]=null,c=>c.economy.enhanceGold='free',c=>c.pets[0].damage='a',c=>c.shop[0].output={bag:{potion:-1}},c=>c.training[0].effects=null,c=>c.recipes[0].ingredients={unobtainable:1},c=>c.quests[0].target=0,c=>c.runes[0].family='__proto__']) {
  const c=structuredClone(mod.CONTENT);alter(c);let result;assert.doesNotThrow(()=>result=mod.validateContent(c));assert.equal(result.valid,false);
 }
});
test('rarity configuration requires ranks and usable salvage and multiplier numbers',()=>{
 for(const alter of [
  c=>{delete c.rarities[0].rank;},
  c=>{c.rarities[0].rank='0';},
  c=>{c.rarities[0].rank=.5;},
  c=>{delete c.rarities[0].salvage;},
  c=>{c.rarities[0].salvage=1.5;},
  c=>{delete c.rarities[0].multiplier;},
  c=>{c.rarities[0].multiplier=0;},
  c=>{c.rarities[0].multiplier='1';}
 ]){
  const c=structuredClone(mod.CONTENT);alter(c);
  const result=mod.validateContent(c);
  assert.equal(result.valid,false,'malformed rarity must be rejected before importing');
  assert.ok(result.errors.some(message=>message.startsWith('rarities.')));
 }
});
test('configured equipment must supply both ordinary and rare draws',()=>{
 for(const alter of [
  c=>{for(const entry of c.equipment)entry.rarity='common';},
  c=>{for(const entry of c.equipment)entry.rarity='rare';},
  c=>{for(const entry of c.rarities)entry.rank=0;},
  c=>{for(const entry of c.rarities)entry.rank=2;}
 ]){
  const c=structuredClone(mod.CONTENT);alter(c);
  const result=mod.validateContent(c);
  assert.equal(result.valid,false,'accepted configuration must support every draw branch');
  assert.ok(result.errors.some(message=>message.startsWith('equipment.draw')));
 }
});
test('mode turn limits must be present positive integers before an expedition can use them',()=>{
 for(const value of [undefined,0,.5,1001,'8']){
  const c=structuredClone(mod.CONTENT);
  if(value===undefined)delete c.modes[0].turnLimit;else c.modes[0].turnLimit=value;
  const result=mod.validateContent(c);
  assert.equal(result.valid,false,'invalid turn limit must not enter a run snapshot');
  assert.ok(result.errors.some(message=>message.startsWith('modes.campaign.turnLimit')));
 }
 const c=structuredClone(mod.CONTENT);c.modes[0].turnLimit=1000;
 assert.equal(mod.validateContent(c).valid,true);
});
test('offline cap remains editable from one through one hundred hours',()=>{
 for(const hours of [1,48,100]){
  const c=structuredClone(mod.CONTENT);c.economy.offlineHours=hours;
  assert.equal(mod.validateContent(c).valid,true);
 }
 for(const hours of [0,100.5,101]){
  const c=structuredClone(mod.CONTENT);c.economy.offlineHours=hours;
  const result=mod.validateContent(c);
  assert.equal(result.valid,false);assert.ok(result.errors.some(message=>message.startsWith('economy.offlineHours')));
 }
});
