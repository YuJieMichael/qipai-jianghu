// Tuning baseline: every rule value lives here; no remote assets are required.
const freeze = value => { if(value && typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
export const BALANCE = freeze({heroHp:180,heroAttack:12,rerolls:2,swordDamage:6,poisonDamage:8,poisonTurns:3,poisonThreshold:6,poisonConsume:6,guardShield:3,bossHp:260,bossStance:24,bossHeavyDamage:42,bossDamage:16,campHeal:45,eventHeal:35,masteryThreshold:3,poisonBurstDamage:48,guardCounterDamage:8});
export const BUILDS = freeze({
 sword:{id:'sword',name:'剑气',title:'青霄剑诀',description:'4–6 点触发剑气，飞剑贯穿敌阵。',trigger:'4–6 点',ascension:'万剑归宗'},
 poison:{id:'poison',name:'毒针',title:'碧影针经',description:'单数施毒，毒层持续侵蚀敌人。',trigger:'单数',ascension:'百毒归心'},
 guard:{id:'guard',name:'金刚',title:'金刚护体',description:'1–3 点获得护盾，抵挡后反击。',trigger:'1–3 点',ascension:'不动明王'}
});
// Public route metadata used by growth cards and the shared combat rules.
export const PERKS = freeze({
 swordFocus:{id:'swordFocus',build:'sword',name:'凝锋',maxRank:2,effectPerRank:3,damagePerRank:3,description:'每颗触发剑气的骰子额外对当前目标造成 3 伤害。'},
 swordEcho:{id:'swordEcho',build:'sword',name:'回响剑阵',maxRank:2,effectPerRank:3,damagePerRank:3,description:'每两颗触发剑气骰子额外对全体造成 3 伤害。'},
 poisonLingering:{id:'poisonLingering',build:'poison',name:'蚀骨余毒',maxRank:2,effectPerRank:2,damagePerRank:2,turnsPerRank:1,description:'毒持续时间每级 +1 回合，每层毒每回合伤害每级 +2。'},
 poisonCatalyst:{id:'poisonCatalyst',build:'poison',name:'催毒引爆',maxRank:2,effectPerRank:1,stacksPerRank:1,thresholdReductionPerRank:1,minThreshold:4,description:'每次施毒每级额外附 1 层；质变毒爆阈值每级 -1，最低 4 层，并消耗当前阈值。'},
 guardBulwark:{id:'guardBulwark',build:'guard',name:'固若金汤',maxRank:2,effectPerRank:2,shieldPerRank:2,description:'每次护盾触发每级额外获得 2 护盾。'},
 guardRiposte:{id:'guardRiposte',build:'guard',name:'借力反震',maxRank:2,effectPerRank:5,damagePerRank:5,description:'抵挡正数伤害且存活后，每级反击 5 伤害，与质变 8 伤害相加。'}
});
export const emptyPerks = () => Object.fromEntries(Object.keys(PERKS).map(id => [id,0]));
export const ENEMY_TYPES = freeze({
 melee:{kind:'melee',name:'竹林刀客',hp:55,attack:10,shield:0,stance:0},
 ranged:{kind:'ranged',name:'夜雨弩手',hp:45,attack:10,shield:0,stance:0},
 shield:{kind:'shield',name:'铁伞卫',hp:65,attack:8,shield:18,stance:0},
 elite:{kind:'elite',name:'破庙执刀使',hp:115,attack:15,shield:10,stance:12},
 boss:{kind:'boss',name:'山门守将',hp:BALANCE.bossHp,attack:BALANCE.bossDamage,shield:0,stance:BALANCE.bossStance}
});
export const NODES = freeze([
 {id:'first-battle',index:0,type:'battle',name:'夜雨初战',scene:'bamboo',enemies:['melee'],reward:true},
 {id:'first-growth',index:1,type:'reward',name:'雨中悟招',scene:'bamboo',enemies:[],reward:false},
 {id:'double-battle',index:2,type:'battle',name:'竹影双敌',scene:'bamboo',enemies:['melee','ranged'],reward:true},
 {id:'supplies',index:3,type:'event',name:'残灯奇遇',scene:'temple',enemies:[],reward:false},
 {id:'elite-battle',index:4,type:'battle',name:'破庙精英',scene:'temple',enemies:['elite','shield'],reward:true},
 {id:'second-growth',index:5,type:'reward',name:'灯下悟招',scene:'temple',enemies:[],reward:false},
 {id:'triple-battle',index:6,type:'battle',name:'山道伏击',scene:'gate',enemies:['melee','ranged','shield'],reward:true},
 {id:'camp',index:7,type:'camp',name:'营火传承',scene:'gate',enemies:[],reward:true},
 {id:'boss-battle',index:8,type:'battle',name:'破山门',scene:'gate',enemies:['boss'],reward:false}
]);
