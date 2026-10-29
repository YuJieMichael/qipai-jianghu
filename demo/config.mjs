// Tuning baseline: every rule value lives here; no remote assets are required.
const freeze = value => { if(value && typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
export const BALANCE = freeze({heroHp:180,heroAttack:12,rerolls:2,swordDamage:6,poisonDamage:3,poisonTurns:3,poisonThreshold:6,poisonConsume:6,guardShield:8,bossHp:260,bossStance:24,bossHeavyDamage:42,bossDamage:16,campHeal:45,eventHeal:35,masteryThreshold:3,poisonBurstDamage:24,guardCounterDamage:8});
export const BUILDS = freeze({
 sword:{id:'sword',name:'剑气',title:'青霄剑诀',description:'4–6 点触发剑气，飞剑贯穿敌阵。',trigger:'4–6 点',ascension:'万剑归宗'},
 poison:{id:'poison',name:'毒针',title:'碧影针经',description:'单数施毒，毒层持续侵蚀敌人。',trigger:'单数',ascension:'百毒归心'},
 guard:{id:'guard',name:'金刚',title:'金刚护体',description:'1–3 点获得护盾，抵挡后反击。',trigger:'1–3 点',ascension:'不动明王'}
});
export const ENEMY_TYPES = freeze({
 melee:{kind:'melee',name:'竹林刀客',hp:55,attack:10,shield:0,stance:0},
 ranged:{kind:'ranged',name:'夜雨弩手',hp:45,attack:12,shield:0,stance:0},
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
