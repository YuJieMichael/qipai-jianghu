/** Original, editable offline workshop catalog. This module has no storage or DOM side effects. */
export const EFFECT_KEYS = ['attack','maxHp','armor','critChance','critDamage','lifesteal','poisonDamage','shieldGain','extraRerolls','openingShield','regen','thorns','fireDamage','freezeChance','comboBonus','goldBonus'];
const named=(ids,names,extra=()=>({}))=>ids.map((id,i)=>({id,name:names[i],...extra(id,i)}));
const slots=named(['weapon','ring','armor','boots','scarf','amulet'],['兵器','指环','衣甲','足履','围巾','护符']);
const rarities=named(['common','fine','rare','epic'],['素品','良品','珍品','逸品'],(id,i)=>({rank:i,multiplier:1+i*.6,salvage:8+i*8}));
const equipment=slots.flatMap((slot,si)=>Array.from({length:8},(_,i)=>{
 const weaponType=['sword','staff','hammer'][i%3];const rank=Math.floor(i/2);const primary=['attack','critChance','maxHp','armor','shieldGain','openingShield'][si];
 const effects={[primary]:si===2?12+rank*8:si===5?4+rank*3:1+rank};if(si===0)effects.attack=2+rank*2;
 return {id:si===0?`weapon-${weaponType}-${Math.floor(i/3)+1}`:`${slot.id}-${i+1}`,name:`${['竹影','溪月','晨砂','远岫','听雨','晴岚','归鸿','星河'][i]}${slot.name}`,slot:slot.id,rarity:rarities[rank].id,setId:['bamboo','river'][i%2],...(si===0?{weaponType}:{}),effects,cost:{gold:60+rank*75},maxSockets:2};
}));
export const CONTENT={
 version:1,slots,rarities,equipment,
 workshopRules:{slotEffects:{weapon:{attack:2},ring:{critChance:1},armor:{maxHp:8},boots:{armor:1},scarf:{shieldGain:1},amulet:{openingShield:2}},runeResonance:{yang:{attack:2,comboBonus:3},yin:{armor:1,regen:1}},relicResonance:{openingShield:4,shieldGain:1}},
 combatRules:{swordStraightBonus:30,hammerShield:6,hammerBreak:12,markSword:4,markCritChance:10,markFire:5,markLeech:3,markHeal:5,markGuard:4,markColdChance:25,materialFirePerLevel:2,materialFrostChance:5,decorationDamage:2,decorationHeal:2,decorationShield:2,focusDamage:3,fortuneCoins:1},
 sets:[{id:'bamboo',name:'青竹行装',pieces:3,effects:{maxHp:12,armor:1}},{id:'river',name:'长河行装',pieces:3,effects:{attack:2,regen:1}}],
 gems:[{id:'ruby',name:'赤霞石',effects:{attack:2}},{id:'jade',name:'青叶石',effects:{maxHp:10}},{id:'pearl',name:'晨露珠',effects:{shieldGain:2}},{id:'amber',name:'流光珀',effects:{critChance:3}}],
 sects:named(['bamboo','river','forge','cloud','frost','venom','thunder'],['青竹门','长河馆','赤炉庄','流云阁','寒汀社','百草谷','惊雷堂'],(id,i)=>({effects:[{comboBonus:5},{regen:1},{armor:1},{extraRerolls:1},{freezeChance:5},{poisonDamage:1},{critChance:4}][i],faces:[[1,2,3,4,5,6],[1,1,2,3,5,6],[2,2,3,4,5,6],[1,2,3,4,6,6],[1,2,2,4,5,6],[1,3,3,4,5,6],[1,2,4,4,5,6]][i],description:['顺势出剑，连招更强。','流水调息，回合回复。','锻体护身，减轻伤害。','随云转势，额外重掷。','寒息凝敌，偶得冻结。','药毒相济，毒伤精进。','雷光破隙，暴击精进。'][i]})),
 skills:named(['bamboo-strike','river-heal','stone-guard','embers','toxic-needle','cloud-step','triple-break','straight-song','twin-blade','frost-breath','thunder-palm','restoring-mist'],['竹叶斩','回溪诀','磐石式','余烬掌','青芒针','浮云步','破岭锤','长风剑歌','双燕击','寒汀息','惊雷掌','养元雾'],(id,i)=>({trigger:['always','pair','pair','round','pair','round','triple','straight','pair','triple','crit','round'][i],effects:[{damage:2},{heal:3},{shield:3},{damage:2},{poison:2},{shield:1},{damage:5},{damage:6},{damage:3},{shield:4},{damage:5},{heal:1}][i],description:'满足触发条件时自动施展。'})),
 talents:named(['might','vitality','shell','acuity','venom','ward','breath','fortune'],['臂力','根骨','坚韧','洞察','药理','护元','调息','福缘'],(id,i)=>({maxLevel:10,cost:{gold:70,dust:5,insight:1},effects:[{attack:1},{maxHp:8},{armor:1},{critChance:2},{poisonDamage:1},{shieldGain:1},{regen:1},{goldBonus:3}][i]})),
 materials:named(['wood','jade','iron','flame','frost','thunder','poison'],['竹木','温玉','玄铁','赤焰','寒晶','雷纹','碧毒'],(id,i)=>({description:['均衡骰质','触发回复','触发护盾','触发火伤','偶数回合初掷后冻结骰子，增加冻结率','触发直伤','触发毒伤'][i],cost:{dust:5},upgradeCost:{gold:50,dust:8}})),
 decorations:named(['plain','lucky','chain','blood','guard','focus','restore','fortune'],['素面','吉签','连环','赤契','守纹','定心','回春','招财'],(id,i)=>({description:['无附加效果','初掷与重掷取两次采样较高点','重掷带动一层相邻骰；技能连锁一次','每轮直伤 2 并回复 2','每轮获得 2 护盾','初掷后固定骰子，每轮增加 3 直伤','每轮回复 2 生命','每轮增加 1 局内金币'][i],cost:{gold:i?30:0,dust:i?3:0}})),
 marks:named(['sword','crit','poison','fire','cold','leech','heal','guard','wild'],['剑纹','锋纹','毒纹','火纹','寒纹','汲纹','春纹','盾纹','变纹'],()=>({cost:{gold:20,dust:2}})),
 relics:named(['reed-flute','sun-disc','stone-bell','moon-lamp','cloud-seal','ember-cup','river-mirror','star-wheel'],['苇笛','曦轮','石铃','月灯','云篆','炭盏','河镜','星盘'],(id,i)=>({handRank:i%4,damage:3+i,effects:i%2?{openingShield:2}:{maxHp:4},refineCost:{gold:80,dust:8},infuseCost:{essence:2,gold:60},maxLevel:5})),
 runes:named(['edge','heart','shell','venom','spark','snow','spring','guard','fortune','focus'],['锋','心','壳','毒','焰','雪','泉','御','禄','定'],(id,i)=>({family:['yang','yin'][i%2],effects:[{attack:1},{maxHp:5},{armor:1},{poisonDamage:1},{fireDamage:1},{freezeChance:2},{regen:1},{shieldGain:1},{goldBonus:3},{critChance:2}][i],maxLevel:5,cost:{dust:12,essence:1}})),
 pets:named(['fox','crane','turtle','lynx','moth'],['赤尾狐','芦汀鹤','苔背龟','山岚猞','月粉蛾'],(id,i)=>({damage:[2,1,0,3,1][i],heal:[0,2,1,0,1][i],shield:[0,0,3,1,1][i],maxLevel:10,cost:{gold:80,essence:1}})),
 souls:named(['blade','herbalist','sentinel','wanderer','storm','artisan'],['剑客魂','药师魂','守关魂','行者魂','雷师魂','巧匠魂'],(id,i)=>({effects:[{attack:2},{lifesteal:3},{armor:1},{extraRerolls:1},{critChance:3},{goldBonus:4}][i]})),
 titles:[{id:'wanderer',name:'初行江湖',effects:{maxHp:5}},{id:'collector',name:'竹影藏家',effects:{goldBonus:5}},{id:'tower-climber',name:'登楼客',effects:{attack:2}},{id:'kindred',name:'山水知音',effects:{regen:1}}],
 recipes:[{id:'potion',name:'炼制回气散',cost:{gold:20},ingredients:{herb:3},output:{bag:{potion:1}}},{id:'tonic',name:'炼制养元露',cost:{gold:25},ingredients:{herb:4,ore:1},output:{bag:{tonic:1}}},{id:'blade',name:'锻造竹影剑',cost:{gold:70,dust:5},ingredients:{ore:3},output:{equipmentId:'weapon-sword-1'}},{id:'ruby',name:'凝炼赤霞石',cost:{gold:40,dust:8},ingredients:{ore:2},output:{gemId:'ruby'}}],
 shop:[{id:'potion',name:'回气散',cost:{gold:40},output:{bag:{potion:1}}},{id:'reroll',name:'转运签',cost:{gold:50},output:{bag:{reroll:1}}},{id:'antidote',name:'解毒丸',cost:{gold:25},output:{bag:{antidote:1}}},{id:'tonic',name:'养元露',cost:{gold:60},output:{bag:{tonic:1}}},{id:'gift',name:'山水礼',cost:{gold:45},output:{bag:{gift:1}}},{id:'ruby',name:'赤霞石',cost:{gold:70},output:{gemId:'ruby'}}],
 quests:named(['quest-clear','quest-kills','quest-enhance','quest-buy','quest-gather','quest-train'],['初战归来','退敌有方','磨砺兵装','行商识货','山野采撷','日课有成'],(id,i)=>({stat:['clears','kills','enhances','purchases','gathers','training'][i],target:[1,5,1,1,1,1][i],reward:{gold:80,dust:8}})),
 achievements:[{id:'achievement-kills',name:'百战记',stat:'kills',target:30,reward:{gold:300,insight:2}},{id:'achievement-clear',name:'山河游',stat:'clears',target:7,reward:{gold:400,essence:5}},{id:'daily-chest',name:'勤行阶段宝箱',stat:'dailyClaims',target:3,reward:{gold:150,essence:2}}],
 chapters:named(['bamboo','temple','gate','desert','lake','tomb','peak'],['竹溪初行','古寺听钟','雁门风雪','流沙问路','镜湖残月','幽陵探火','天峰论道'],(id,i)=>({hpScale:1+i*.2,attackScale:1+i*.15,reward:{gold:100+i*30,dust:10+i*3,essence:i>2?2:1},sweepCost:{gold:30+i*5},description:'三景九节点，清敌、奇遇与首领交替。'})),
 modes:named(['campaign','boss','tower','dungeon','arena','bounty','escort','worldboss','tournament','resource','totem'],['常规游历','首领试炼','通天塔','八室秘境','本地论剑','悬赏追缉','三段押镖','本地世界首领','武林大会','资源挑战','图腾挑战'],(id,i)=>({hpScale:1+i*.06,attackScale:1+i*.03,turnLimit:id==='resource'?8:id==='worldboss'?10:30,reward:{gold:80+i*15,dust:8+i,essence:i%3===0?1:0},description:id==='arena'?'离线对手练习':id==='worldboss'?'共享进度在本机保存':'原创离线遭遇'})),
 companions:named(['mei','yan','shi'],['梅青','燕回','石桥'],(id,i)=>({description:['采药同行，滋养根骨。','剑术切磋，磨砺锋芒。','护镖结伴，练习守势。'][i],giftCost:{gold:20},recruitAffinity:1,recruitCost:{gold:100},trainCost:{gold:60,dust:4},effects:[{maxHp:2},{attack:1},{shieldGain:1}][i]})),
 training:[{id:'strength',name:'举石功',maxLevel:20,cost:{gold:50,dust:3},effects:{attack:1}},{id:'breath',name:'吐纳功',maxLevel:20,cost:{gold:45,dust:3},effects:{maxHp:5}},{id:'focus',name:'静心功',maxLevel:20,cost:{gold:60,insight:1},effects:{critChance:1}}],
 meridians:[{id:'heart',name:'心脉',maxLevel:10,cost:{gold:70,essence:1},effects:{maxHp:6}},{id:'hand',name:'手脉',maxLevel:10,cost:{gold:75,essence:1},effects:{attack:1}},{id:'root',name:'根脉',maxLevel:10,cost:{gold:80,insight:1},effects:{armor:1}}],
 gathering:[{id:'herb',name:'竹溪采药',cost:{gold:10},output:{bag:{herb:3}}},{id:'ore',name:'山石采矿',cost:{gold:12},output:{bag:{ore:3}}},{id:'hide',name:'林间寻材',cost:{gold:8},output:{bag:{hide:2}}}],
 economy:{fusionBonus:.25,maxFusion:5,downgradeGoldRefund:.5,refineAttackMin:1,refineAttackRange:5,refineHpMin:2,refineHpRange:9,relicRefineDamageMin:1,relicRefineDamageRange:5,relicRefineHpMin:1,relicRefineHpRange:7,relicInfuseDamage:2,relicInfuseEffectScale:.2,runeResonancePieces:3,relicResonancePieces:3,companionAffinityStep:3,maxApprenticeLevel:10,salvageGold:10,fusionDustReturn:4,defeatRewardRate:.25,threeStarHpRatio:.4,threeStarTurns:18,worldBossKillReward:{gold:400,essence:5},enhanceGold:40,enhanceDust:4,maxEnhance:20,refineCost:{gold:60,dust:6},fuseCost:{gold:80,dust:8},faceCost:{gold:10},offlineGoldPerHour:60,offlineDustPerHour:6,offlineHours:12,drawCost:{gold:100},drawPity:10,signinReward:{gold:80,dust:5},grant:{gold:10000,dust:1000,essence:100,insight:100},worldBossHp:4000},
 collections:[{id:'bamboo',name:'青竹套装收藏',setId:'bamboo',target:6,reward:{gold:120,essence:2}},{id:'river',name:'长河套装收藏',setId:'river',target:6,reward:{gold:120,essence:2}}],
 codex:[{id:'equipment',name:'兵装图鉴',catalog:'equipment',reward:{gold:100,dust:10}},{id:'sects',name:'门派图鉴',catalog:'sects',reward:{gold:50,insight:1}},{id:'pets',name:'灵兽图鉴',catalog:'pets',reward:{gold:60,essence:2}}]
};
const required=['equipment','slots','rarities','sets','gems','sects','skills','talents','materials','decorations','marks','relics','runes','pets','souls','titles','recipes','shop','quests','achievements','chapters','modes','companions','training','meridians','gathering','collections','codex'];
const costKeys=['gold','dust','essence','insight'];
const validId=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(v);
const sameIds=(list,ids)=>Array.isArray(list)&&list.length===ids.length&&ids.every(id=>list.some(row=>row.id===id));
export function validateContent(value){
 const errors=[];let c;
 try {c=typeof value==='string'?JSON.parse(value):structuredClone(value);}catch{ return {valid:false,content:null,errors:['配置必须是有效 JSON 数据。']}; }
 const fail=(path,why)=>{if(errors.length<40)errors.push(`${path}: ${why}`);};
 let nodes=0;
 function walk(v,path,depth=0){
  if(++nodes>30000||depth>14){fail(path,'数据过大或嵌套过深');return;}
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='number'){if(!Number.isFinite(v)||v<0||v>100000000)fail(path,'数值必须为有限非负数');return;}
  if(typeof v==='string'){if(v.length>2000||/[<>\u0000-\u0008]/.test(v))fail(path,'文本不可包含 HTML 或控制字符');return;}
  if(typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype&&!Array.isArray(v)){fail(path,'仅支持普通 JSON 数据');return;}
  for(const [key,item]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(key)){fail(path,'不允许的键');continue;}walk(item,`${path}.${key}`,depth+1);}
 }
 walk(c,'配置');if(!c||typeof c!=='object'||Array.isArray(c))return {valid:false,content:null,errors:['配置须为对象。']};
 if(c.version!==1)fail('version','仅支持版本 1');
 for(const key of required){
  const list=c[key];if(!Array.isArray(list)||!list.length||list.length>500){fail(key,'目录须为 1..500 条数组');continue;}
  const ids=new Set();for(const row of list){if(!row||typeof row!=='object'||!validId(row.id)||typeof row.name!=='string'||!row.name.trim()){fail(key,'每项必须含合法 id 和名称');continue;}if(ids.has(row.id))fail(`${key}.${row.id}`,'重复 id');ids.add(row.id);
   for(const field of ['effects'])if(row[field]){if(typeof row[field]!=='object'||Array.isArray(row[field]))fail(`${key}.${field}`,'效果须为对象');else for(const [effect,n]of Object.entries(row[field]))if(![...EFFECT_KEYS,'damage','heal','shield','poison'].includes(effect)||typeof n!=='number'||!Number.isFinite(n)||n<0)fail(`${key}.${row.id}.${effect}`,'效果须为合法数值');}
   for(const field of ['cost','upgradeCost','refineCost','infuseCost','giftCost','recruitCost','trainCost','sweepCost','reward'])if(row[field])checkCurrency(row[field],`${key}.${row.id}.${field}`);
  }
 }
 if(errors.length)return {valid:false,content:null,errors};
 function checkCurrency(v,path){if(!v||typeof v!=='object'||Array.isArray(v)){fail(path,'资源须为对象');return;}for(const [k,n]of Object.entries(v))if(!costKeys.includes(k)||!Number.isSafeInteger(n)||n<0||n>10000000)fail(`${path}.${k}`,'资源为非负整数');}
 for(const key of ['slots','materials','decorations','marks'])if(!sameIds(c[key],CONTENT[key].map(v=>v.id)))fail(key,'固定枚举不可增删或改名');

 const bagIds=['potion','reroll','antidote','tonic','herb','ore','hide','gift','food'];
 const effectCatalogs=['equipment','sets','gems','sects','skills','talents','relics','runes','souls','titles','companions','training','meridians'];
 for(const key of effectCatalogs)for(const row of c[key])if(!row.effects||typeof row.effects!=='object'||Array.isArray(row.effects))fail(`${key}.${row.id}.effects`,'缺少效果对象');
 for(const key of ['recipes','shop','gathering'])for(const row of c[key]){
  const out=row.output;if(!out||typeof out!=='object'||Array.isArray(out)||!Object.keys(out).length||Object.keys(out).some(k=>!['bag','equipmentId','gemId'].includes(k)))fail(`${key}.${row.id}.output`,'产出对象无效');
  else{if(out.bag){if(typeof out.bag!=='object'||Array.isArray(out.bag)||Object.entries(out.bag).some(([k,n])=>!bagIds.includes(k)||!Number.isSafeInteger(n)||n<1))fail(`${key}.${row.id}.output.bag`,'产出物品须为合法正整数');}if(out.equipmentId&&!c.equipment.some(e=>e.id===out.equipmentId)||out.gemId&&!c.gems.some(e=>e.id===out.gemId))fail(`${key}.${row.id}.output`,'产出条目不存在');}
  if(key==='recipes'&&(!row.ingredients||typeof row.ingredients!=='object'||Array.isArray(row.ingredients)||Object.entries(row.ingredients).some(([k,n])=>!bagIds.includes(k)||!Number.isSafeInteger(n)||n<1)))fail(`${key}.${row.id}.ingredients`,'配方材料须为合法正整数');
 }
 for(const key of ['quests','achievements'])for(const row of c[key])if(!['runs','clears','kills','turns','enhances','purchases','gathers','training','crafts','draws','dailyClaims','sweeps','gifts'].includes(row.stat)||!Number.isSafeInteger(row.target)||row.target<1||!row.reward)fail(`${key}.${row.id}`,'任务统计、目标或奖励无效');
 for(const row of c.runes)if(!['yang','yin'].includes(row.family))fail(`runes.${row.id}.family`,'共鸣类别须为 yang 或 yin');
 for(const row of c.pets)for(const key of ['damage','heal','shield'])if(typeof row[key]!=='number'||!Number.isFinite(row[key])||row[key]<0)fail(`pets.${row.id}.${key}`,'灵兽数值须为非负数');

 if(c.workshopRules!==undefined){const rules=c.workshopRules;const validEffects=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([k,n])=>EFFECT_KEYS.includes(k)&&typeof n==='number'&&Number.isFinite(n)&&n>=0);if(!rules||typeof rules!=='object'||Array.isArray(rules))fail('workshopRules','成长规则须为对象');else{if(!rules.slotEffects||slots.some(s=>!validEffects(rules.slotEffects[s.id])))fail('workshopRules.slotEffects','六槽效果须齐全且为非负数值');if(!rules.runeResonance||!validEffects(rules.runeResonance.yang)||!validEffects(rules.runeResonance.yin)||!validEffects(rules.relicResonance))fail('workshopRules','共鸣效果无效');}}
 if(c.combatRules!==undefined){if(!c.combatRules||typeof c.combatRules!=='object'||Array.isArray(c.combatRules))fail('combatRules','战斗规则须为对象');else for(const [key,n]of Object.entries(c.combatRules))if(!Object.keys(CONTENT.combatRules).includes(key)||typeof n!=='number'||!Number.isFinite(n)||n<0||n>100000)fail(`combatRules.${key}`,'规则数值无效');}
 // Both draw branches must be usable before a configuration can replace a profile.
 const rarityById=new Map(c.rarities.map(rarity=>[rarity.id,rarity]));
 for(const rarity of c.rarities){
  const path=`rarities.${rarity.id}`;
  if(!Number.isInteger(rarity.rank)||rarity.rank<0||rarity.rank>100){
   fail(`${path}.rank`,'品质阶须为 0..100 整数');
  }
  if(!Number.isSafeInteger(rarity.salvage)||rarity.salvage<0||rarity.salvage>10000000){
   fail(`${path}.salvage`,'分解材料须为 0..10000000 整数');
  }
  if(typeof rarity.multiplier!=='number'||!Number.isFinite(rarity.multiplier)||rarity.multiplier<=0||rarity.multiplier>1000000){
   fail(`${path}.multiplier`,'品质倍率须为正数且不超过 1000000');
  }
 }
 const hasOrdinaryDraw=c.equipment.some(entry=>{
  const rank=rarityById.get(entry.rarity)?.rank;
  return Number.isInteger(rank)&&rank>=0&&rank<2;
 });
 const hasRareDraw=c.equipment.some(entry=>{
  const rank=rarityById.get(entry.rarity)?.rank;
  return Number.isInteger(rank)&&rank>=2&&rank<=100;
 });
 if(!hasOrdinaryDraw)fail('equipment.draw.ordinary','至少需要一件品质阶低于 2 的可抽取装备');
 if(!hasRareDraw)fail('equipment.draw.rare','至少需要一件品质阶不低于 2 的保底装备');
 for(const mode of c.modes){
  if(!Number.isInteger(mode.turnLimit)||mode.turnLimit<1||mode.turnLimit>1000){
   fail(`modes.${mode.id}.turnLimit`,'回合上限须为 1..1000 整数');
  }
 }
 if(Array.isArray(c.equipment))for(const row of c.equipment){if(!slots.some(s=>s.id===row.slot)||!c.rarities?.some(r=>r.id===row.rarity)||!c.sets?.some(s=>s.id===row.setId)||row.slot==='weapon'&&!['sword','staff','hammer'].includes(row.weaponType)||!Number.isInteger(row.maxSockets)||row.maxSockets<0||row.maxSockets>4)fail(`equipment.${row.id}`,'槽位、品质、套装、武器或镶孔错误');}
 if(Array.isArray(c.skills))for(const row of c.skills)if(!['always','pair','straight','triple','round','crit','sword','poison','guard'].includes(row.trigger))fail(`skills.${row.id}`,'未知触发条件');
 for(const key of ['sects'])for(const row of c[key]??[])if(!Array.isArray(row.faces)||row.faces.length!==6||row.faces.some(n=>!Number.isInteger(n)||n<1||n>6))fail(`${key}.${row.id}.faces`,'须为六个 1..6 点数');
 for(const key of ['talents','relics','runes','pets','training','meridians'])for(const row of c[key]??[])if(!Number.isInteger(row.maxLevel)||row.maxLevel<1||row.maxLevel>100)fail(`${key}.${row.id}.maxLevel`,'等级须为 1..100 整数');
 for(const key of ['chapters','modes'])for(const row of c[key]??[])if(typeof row.hpScale!=='number'||typeof row.attackScale!=='number'||row.hpScale<=0||row.attackScale<=0)fail(`${key}.${row.id}`,'倍率必须为正数');
 for(const row of c.relics??[])if(!Number.isInteger(row.handRank)||row.handRank<0||row.handRank>7||typeof row.damage!=='number')fail(`relics.${row.id}`,'遗物触发与伤害错误');
 if(!c.economy||typeof c.economy!=='object')fail('economy','缺少经济配置');else{for(const key of Object.keys(CONTENT.economy))if(!(key in c.economy))fail(`economy.${key}`,'缺少配置');for(const key of ['drawCost','refineCost','fuseCost','faceCost','signinReward','grant','worldBossKillReward'])checkCurrency(c.economy[key],`economy.${key}`);for(const key of ['enhanceGold','enhanceDust','offlineGoldPerHour','offlineDustPerHour','worldBossHp'])if(!Number.isSafeInteger(c.economy[key])||c.economy[key]<0)fail(`economy.${key}`,'须为非负整数');for(const key of ['fusionBonus','downgradeGoldRefund','relicInfuseEffectScale','defeatRewardRate','threeStarHpRatio'])if(typeof c.economy[key]!=='number'||c.economy[key]<0||c.economy[key]>1)fail(`economy.${key}`,'比例须为 0..1');for(const key of ['refineAttackMin','refineAttackRange','refineHpMin','refineHpRange','relicRefineDamageMin','relicRefineDamageRange','relicRefineHpMin','relicRefineHpRange','relicInfuseDamage','runeResonancePieces','relicResonancePieces','companionAffinityStep','salvageGold','fusionDustReturn','threeStarTurns'])if(!Number.isSafeInteger(c.economy[key])||c.economy[key]<1||c.economy[key]>10000)fail(`economy.${key}`,'参数须为合法正整数');for(const key of ['maxFusion','maxApprenticeLevel','maxEnhance','drawPity','offlineHours'])if(!Number.isInteger(c.economy[key])||c.economy[key]<1||c.economy[key]>100)fail(`economy.${key}`,'须为 1..100 整数');}
 return {valid:errors.length===0,content:errors.length?null:c,errors};
}
export function getContent(profile){return profile?.contentOverrides??CONTENT;}
