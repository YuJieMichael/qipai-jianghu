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
