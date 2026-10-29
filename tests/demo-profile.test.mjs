import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../demo/profile.mjs').catch(()=>null);
const catalog=await import('../demo/content.mjs').catch(()=>null);
const act=(p,type,fields={},now=0)=>api.applyProfileAction(p,{type,...fields},{now});
test('profile starts with independent permanent resources and validates on roundtrip',()=>{
 assert.ok(api,'profile module must exist');const p=api.createProfile(1,100);assert.deepEqual(p.resources,{gold:1000,dust:120,essence:20,insight:6});assert.equal(api.validateProfile(JSON.parse(JSON.stringify(p))).valid,true);
 const changed=structuredClone(p);changed.resources.gold=-1;assert.equal(api.validateProfile(changed).valid,false);changed.resources.gold=1;changed.equipped.weapon='missing';assert.equal(api.validateProfile(changed).valid,false);
});
test('dice edits, sects, martial skills and talents produce independent next-run snapshots',()=>{
 assert.ok(api);let p=api.createProfile();const snapshot=api.deriveLoadout(p);p=act(p,'face',{die:0,face:0,value:6}).profile;p=act(p,'material',{die:0,id:'jade'}).profile;p=act(p,'material-upgrade',{die:0}).profile;p=act(p,'decoration',{die:0,id:'chain'}).profile;p=act(p,'mark',{die:0,face:0,id:'wild'}).profile;
 const next=api.deriveLoadout(p);assert.equal(next.dice[0].faces[0],6);assert.equal(next.dice[0].materialLevel,2);assert.equal(next.dice[0].decorationId,'chain');assert.equal(next.dice[0].marks[0],'wild');assert.equal(snapshot.dice[0].faces[0],1);
 const skill=catalog.CONTENT.skills[1];p=act(p,'skill',{id:skill.id}).profile;assert.ok(api.deriveLoadout(p).skills.some(s=>s.id===skill.id));
 const t=catalog.CONTENT.talents[0];const attack=api.deriveLoadout(p).effects.attack;p=act(p,'talent',{id:t.id}).profile;assert.ok(api.deriveLoadout(p).effects.attack>attack);
});
test('relic refinement, infusion, rune fusion and saved plans affect combat loadout',()=>{
 assert.ok(api);let p=act(api.createProfile(),'developer-grant').profile;const id=catalog.CONTENT.relics[0].id;p=act(p,'relic',{id}).profile;const initial=api.deriveLoadout(p).relics[0].damage;p=act(p,'relic-refine',{id}).profile;assert.strictEqual(act(p,'relic-refine',{id}).profile,p);p=act(p,'relic-accept',{id}).profile;p=act(p,'relic-infuse',{id}).profile;assert.ok(api.deriveLoadout(p).relics[0].damage>initial);
 p=act(p,'rune',{slot:0,id:'edge'}).profile;const attack=api.deriveLoadout(p).effects.attack;p=act(p,'rune-fuse',{id:'edge'}).profile;assert.ok(api.deriveLoadout(p).effects.attack>attack);
 p=act(p,'rune-plan',{index:1}).profile;assert.equal(p.runes.planIndex,1);assert.equal(p.runes.slots[0],null);p=act(p,'rune-plan',{index:0}).profile;assert.equal(p.runes.slots[0],'edge');
});
test('pets, souls, titles, training, meridians and relationships yield real growth',()=>{
 assert.ok(api);let p=act(api.createProfile(),'developer-grant').profile;p=act(p,'pet',{id:'fox'}).profile;const damage=api.deriveLoadout(p).pet.damage;p=act(p,'pet-train',{id:'fox'}).profile;assert.ok(api.deriveLoadout(p).pet.damage>damage);
 for(const [type,id] of [['soul','blade'],['title','wanderer'],['train','strength'],['meridian','heart'],['gift','mei'],['recruit','mei'],['apprentice-train','mei']]){const result=act(p,type,{id});assert.notStrictEqual(result.profile,p,`${type}: ${result.message}`);p=result.profile;}
 assert.equal(p.apprentices.mei.level,2);assert.ok(api.deriveLoadout(p).effects.maxHp>0);
});
test('shop, gathering, crafting and draws conserve prices and advance their task counters',()=>{
 assert.ok(api);let p=api.createProfile(4,0);p=act(p,'buy',{id:'potion'}).profile;assert.equal(p.resources.gold,960);assert.equal(p.bag.potion,4);assert.equal(p.stats.purchases,1);
 p=act(p,'gather',{id:'herb'}).profile;assert.equal(p.bag.herb,8);assert.equal(p.stats.gathers,1);p=act(p,'craft',{id:'potion'}).profile;assert.equal(p.bag.herb,5);assert.equal(p.bag.potion,5);
 const count=p.inventory.length;const gold=p.resources.gold;p=act(p,'draw').profile;assert.equal(p.resources.gold,gold-100);assert.equal(p.inventory.length,count+1);
});
test('claims, signin, codex and collections cannot be replayed',()=>{
 assert.ok(api);let p=api.createProfile(1,0);for(const [type,fields] of [['signin',{}],['codex-claim',{id:'equipment'}],['collection',{id:'bamboo'}]]){const result=act(p,type,fields,1000);assert.notStrictEqual(result.profile,p,result.message);p=result.profile;assert.strictEqual(act(p,type,fields,1000).profile,p);}
 p=act(p,'enhance',{slot:'weapon'}).profile;const id=catalog.CONTENT.quests.find(q=>q.stat==='enhances').id;p=act(p,'claim',{id}).profile;assert.ok(p.claimed.includes(id));assert.strictEqual(act(p,'claim',{id}).profile,p);
});
test('offline rewards cap at twelve hours and backward or repeated clocks mint nothing',()=>{
 assert.ok(api);let p=api.createProfile(1,100000);assert.strictEqual(act(p,'offline',{},99999).profile,p);
 p=act(p,'offline',{},100000+48*3600000).profile;assert.equal(p.resources.gold,1720);assert.strictEqual(act(p,'offline',{},100000+48*3600000).profile,p);
});
test('expedition ids increase and each settlement consumes items and awards resources once',()=>{
 assert.ok(api);let p=api.createProfile();const started=api.beginExpedition(p);p=started.profile;assert.equal(started.runId,1);assert.equal(p.nextRunId,2);
 const run={runId:1,mode:'campaign',chapter:'bamboo',floor:1,flow:'victory',stats:{kills:3,rounds:6},consumed:{potion:1},hero:{hp:150,maxHp:180},coins:20};
 const result=api.settleRun(p,run,{now:1000});assert.equal(result.profile.bag.potion,2);assert.ok(result.profile.resources.gold>1000);assert.equal(result.profile.stats.kills,3);assert.ok(result.profile.chapterStars.bamboo>=1);assert.strictEqual(api.settleRun(result.profile,run).profile,result.profile);
 const next=api.beginExpedition(result.profile);assert.equal(next.runId,2);assert.equal(started.loadout.bag.potion,3);
});
test('abandonment consumes used items but awards no currency, kills or stars',()=>{
 assert.ok(api);const started=api.beginExpedition(api.createProfile());const result=api.settleRun(started.profile,{runId:started.runId,flow:'abandoned',mode:'campaign',chapter:'bamboo',stats:{kills:99},consumed:{reroll:1},coins:900});assert.deepEqual(result.profile.resources,started.profile.resources);assert.equal(result.profile.bag.reroll,1);assert.equal(result.profile.stats.kills,0);assert.equal(result.profile.chapterStars.bamboo,undefined);
});
test('sweeps need three stars and mode settlement advances persistent progress',()=>{
 assert.ok(api);let p=api.createProfile();assert.strictEqual(act(p,'sweep',{chapter:'bamboo'}).profile,p);p={...p,chapterStars:{bamboo:3}};p=act(p,'sweep',{chapter:'bamboo'}).profile;assert.equal(p.stats.sweeps,1);
 const start=api.beginExpedition(p);p=api.settleRun(start.profile,{runId:start.runId,mode:'tower',floor:2,flow:'victory',stats:{kills:1}}).profile;assert.equal(api.deriveLoadout(p).progression.towerFloor,3);
});
test('content import applies validated data and rejects corrupt content without losing profile',()=>{
 assert.ok(api);let p=api.createProfile();assert.strictEqual(act(p,'content-import',{value:'{"equipment":[]}'}).profile,p);
 const c=structuredClone(catalog.CONTENT);c.equipment[0].effects.attack=33;p=act(p,'content-import',{value:JSON.stringify(c)}).profile;assert.ok(api.deriveLoadout(p).effects.attack>=33);assert.equal(act(p,'content-reset').profile.contentOverrides,null);
});
test('storage failures are reported and successful loads validate data',()=>{
 assert.ok(api);const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};const p=api.createProfile();assert.equal(api.saveProfile(storage,p).ok,true);assert.deepEqual(api.loadProfile(storage).profile,p);const bad={getItem:()=>'{bad',setItem:()=>{throw Error('quota')}};assert.equal(api.saveProfile(bad,p).ok,false);assert.equal(api.loadProfile(bad).profile,null);
});
test('profile import rejects malformed nested records without throwing',()=>{
 assert.ok(api);for(const alter of [p=>p.inventory={},p=>p.inventory=[null],p=>p.equipped=null,p=>p.dice[0].marks={},p=>p.runes.slots=[null],p=>p.resources=null,p=>p.companions={},p=>p.stats={},p=>p.gems={},p=>p.petLevels={}]){
  const p=api.createProfile();alter(p);let result;assert.doesNotThrow(()=>result=api.validateProfile(p));assert.equal(result.valid,false);
 }
});
test('settlement applies bonus to base reward once and preserves merchant purchases',()=>{
 assert.ok(api);let start=api.beginExpedition(api.createProfile());const bag={...start.loadout.bag,potion:4,reroll:1};
 const result=api.settleRun(start.profile,{runId:start.runId,flow:'victory',mode:'boss',reward:{gold:100,dust:10},coins:20,loadout:{...start.loadout,effects:{goldBonus:25}},bag,consumed:{potion:1,reroll:1},stats:{kills:1,turns:1}});
 assert.equal(result.profile.resources.gold,1145);assert.equal(result.profile.bag.potion,4);assert.equal(result.profile.bag.reroll,1);
 assert.strictEqual(api.settleRun(result.profile,{runId:start.runId,flow:'victory'}).profile,result.profile);
});
test('world boss kill pays once and resets local health for the next challenge',()=>{
 assert.ok(api);const started=api.beginExpedition(api.createProfile());const r=api.settleRun(started.profile,{runId:started.runId,flow:'victory',mode:'worldboss',stats:{kills:1,turns:3},results:{worldBossHp:0},reward:{gold:100}});assert.ok(r.profile.resources.gold>=1500);assert.equal(r.profile.progression.worldBossHp,4000);assert.strictEqual(api.settleRun(r.profile,{runId:started.runId,flow:'victory'}).profile,r.profile);
});
test('insufficient resources reject transactions without advancing RNG or losing ingredients',()=>{
 assert.ok(api);let p=api.createProfile(19,0);p={...p,resources:{gold:0,dust:0,essence:0,insight:0}};const before=structuredClone(p);for(const [type,fields]of [['draw',{}],['craft',{id:'potion'}],['buy',{id:'potion'}],['enhance',{slot:'weapon'}],['refine',{uid:p.equipped.weapon}],['material-upgrade',{die:0}],['train',{id:'strength'}],['gift',{id:'mei'}]])assert.strictEqual(act(p,type,fields).profile,p,type);assert.deepEqual(p,before);
});
test('abandonment discards purchased leftovers while consuming only inventory actually spent',()=>{
 assert.ok(api);const start=api.beginExpedition(api.createProfile());const result=api.settleRun(start.profile,{runId:start.runId,flow:'abandoned',loadout:start.loadout,bag:{...start.loadout.bag,potion:4,reroll:1},consumed:{potion:1,reroll:1},coins:99});
 assert.equal(result.profile.bag.potion,3);assert.equal(result.profile.bag.reroll,1);assert.deepEqual(result.profile.resources,start.profile.resources);
});
test('equipment slot changes, capped assemblies and wild marks enforce limits atomically',()=>{
 assert.ok(api);let p=act(api.createProfile(),'developer-grant').profile;const uid=p.equipped.weapon;p=act(p,'unequip',{slot:'weapon'}).profile;assert.equal(p.equipped.weapon,undefined);p=act(p,'equip',{uid}).profile;assert.equal(p.equipped.weapon,uid);
 for(const id of catalog.CONTENT.skills.slice(1,4).map(v=>v.id))p=act(p,'skill',{id}).profile;assert.equal(p.skills.length,4);assert.strictEqual(act(p,'skill',{id:catalog.CONTENT.skills[4].id}).profile,p);
 for(const id of catalog.CONTENT.souls.slice(0,3).map(v=>v.id))p=act(p,'soul',{id}).profile;assert.strictEqual(act(p,'soul',{id:catalog.CONTENT.souls[3].id}).profile,p);
 for(const id of catalog.CONTENT.relics.slice(0,3).map(v=>v.id))p=act(p,'relic',{id}).profile;assert.strictEqual(act(p,'relic',{id:catalog.CONTENT.relics[3].id}).profile,p);
 p=act(p,'mark',{die:0,face:0,id:'wild'}).profile;p=act(p,'mark',{die:1,face:0,id:'wild'}).profile;assert.strictEqual(act(p,'mark',{die:2,face:0,id:'wild'}).profile,p);p=act(p,'mark',{die:0,face:0,id:null}).profile;p=act(p,'mark',{die:2,face:0,id:'wild'}).profile;assert.equal(p.dice[2].marks[0],'wild');
});
test('editable workshop tuning changes enhancement and refinement without code edits',()=>{
 assert.ok(api);let p=api.createProfile();const c=structuredClone(catalog.CONTENT);c.workshopRules={...(c.workshopRules??{}),slotEffects:{...(c.workshopRules?.slotEffects??{}),weapon:{attack:11}}};c.economy.refineAttackMin=7;c.economy.refineAttackRange=1;
 p=act(p,'content-import',{value:c}).profile;const before=api.deriveLoadout(p).effects.attack;p=act(p,'enhance',{slot:'weapon'}).profile;assert.equal(api.deriveLoadout(p).effects.attack,before+11);
 const uid=p.equipped.weapon;p=act(p,'refine',{uid}).profile;assert.equal(p.inventory.find(i=>i.uid===uid).pendingRefine.effects.attack,7);
});
