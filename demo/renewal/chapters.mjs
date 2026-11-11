/** Original campaign encounters and telegraphed bosses; not recovered reference content. */
export const CHAPTERS = [
 {id:1,name:'青岚试炼',seal:'岚',stages:['青岚山径','竹影初深','林间伏击','石阶问剑','山门试锋','青岚守关'],encounters:[
  [['bandit','拦路刀客',30,7]],
  [['bandit','林中刀客',38,8],['archer','青石弩手',24,5]],
  [['sentinel','石阶守将',58,10],['bandit','护路刀客',28,6]],
  [['archer','左翼弩手',34,8],['bandit','山道刀客',42,9],['archer','右翼弩手',34,8]],
  [['sentinel','山门守将',80,12],['archer','山门弩手',40,8]],
  [['boss','青岚试炼官',180,18],['bandit','试炼护卫',46,9]],
 ]},
 {id:2,name:'暮雨山门',seal:'雨',stages:['雨夜古道','断桥追影','灯下伏兵','旧寺回廊','暮雨山门','镇雨问心'],encounters:[
  [['bandit','夜行刀客',48,9],['archer','雨林弩手',36,6]],
  [['sentinel','断桥守将',88,12],['bandit','斗笠刀客',44,8]],
  [['archer','檐下弩手',44,8],['bandit','听雨刀客',64,10],['archer','回廊弩手',44,8]],
  [['sentinel','旧寺守将',118,15],['archer','雾中弩手',54,9]],
  [['sentinel','左山门将',98,12],['sentinel','右山门将',98,12]],
  [['boss','镇雨楼主',280,24],['archer','镇雨护卫',65,10]],
 ]},
];
export const chapterOf=id=>CHAPTERS.find(c=>c.id===id)??CHAPTERS[0];
export function createEncounter(chapterId,stage){
 return chapterOf(chapterId).encounters[stage].map(([kind,name,hp,attack],i)=>({id:`s${stage}-e${i}`,kind,name,hp,maxHp:hp,attack,...(kind==='boss'?{intent:'strike',phase:1}:{})}));
}
export function enemyIntent(enemy){
 if(enemy.kind!=='boss')return `反击 ${enemy.attack}`;
 const boost=enemy.phase===2?4:0;
 if(enemy.intent==='charge')return '蓄力 · 两对及以上可打断';
 if(enemy.intent==='heavy')return `重击 ${enemy.attack*2+boost} · 护体减伤`;
 return `出招 ${enemy.attack+boost}${enemy.phase===2?' · 二阶段':''}`;
}
