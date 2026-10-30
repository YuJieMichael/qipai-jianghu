import {ENEMY_TYPES,BALANCE} from './config.mjs';
/** Chapter descriptors are copied and resolved when an expedition begins. */
const worlds=[
 ['bamboo','竹溪','竹影刀客','苇汀弩手','青篁剑主',['melee'],['melee','ranged'],'assault'],
 ['temple','古寺','执灯僧','铜钟卫','无相钟师',['shield'],['shield','ranged'],'ward'],
 ['gate','雁门','雪关斥候','铁关军','玄甲统领',['ranged'],['melee','shield'],'ritual'],
 ['desert','流沙','沙舟客','风蝎卫','赤砂霸主',['melee','ranged'],['elite','melee'],'assault'],
 ['lake','镜湖','渡舟使','水镜卫','寒月琴师',['ranged','shield'],['ranged','ranged'],'ward'],
 ['tomb','幽陵','守灯人','石棺卫','幽火司祭',['shield','melee'],['shield','shield'],'ritual'],
 ['peak','天峰','云阶客','雷霄卫','天衡剑尊',['melee','melee'],['elite','ranged'],'assault']
];
export const CHAPTER_ROUTES=Object.fromEntries(worlds.map(([id,place,foe,elite,boss,first,second,mechanic],i)=>{
 const node=(suffix,type,name,enemies=[],extra={})=>({id:`${id}-${suffix}`,type,name,scene:id,enemies,reward:false,...extra});
 const group=(kinds,name)=>kinds.map((kind,j)=>({kind,name:j?`${name}副手`:name}));
 const branch=node('fork','event',`${place}·岔路`,[],{description:`${place}旧道与险径通往不同敌阵。`,branchChoices:[{id:'safe-road',title:'循旧道',description:'熟路稳行，下一战敌人气血 -15%。',hpScale:.85,coins:0},{id:'danger-road',title:'闯险径',description:'下一战气血 +30%、攻击 +15%，胜后额外 25 铜钱。',hpScale:1.3,attackScale:1.15,coins:25}]});
 const encounter=node('oath','event',`${place}·${['竹简血誓','残钟回响','关外孤灯','沙井契约','月下倒影','幽火借命','云巅问心'][i]}`,[],{encounter:true,description:['竹简记下以气血换剑意的旧誓。','钟声问你是否愿担一场诅咒。','孤灯照见险路的报偿。','沙井只向敢付代价的人开放。','镜中侠客伸手索取气血。','幽火能换力量，也会引来追兵。','山巅没有无价的力量。'][i]});
 const merchant=node('market','event',`${place}行商`,[],{merchant:true,options:['heal','train','buy-potion','buy-tonic']});
 const early=node('entry','battle',`${place}·初遇`,group(first,foe),{reward:true,coins:18});
 const middle=node('ambush','battle',`${place}·伏阵`,group(second,foe),{reward:true,coins:20});
 const strong=node('elite','battle',`${place}·${elite}`,group(i%2?['elite','ranged']:['elite','shield'],elite),{reward:true,coins:25,eliteAffix:['fierce','armored','vampiric'][i%3]});
 const camp=node('camp','camp',`${place}营火`,[],{reward:true});
 const final=node('boss','battle',`${place}·${boss}`,[{kind:'boss',name:boss,mechanic,noSummon:true}],{coins:50});
 // Bamboo retains five growth stops and the familiar shop position for old callers.
 let route=i===0?[early,node('growth','reward','竹雨悟招'),middle,merchant,strong,node('growth-2','reward','灯下悟招'),encounter,branch,node('triple','battle','竹溪·山道伏击',group(['melee','ranged','shield'],foe),{reward:true,coins:25}),camp,final]:i%3===1?[early,branch,middle,encounter,strong,merchant,camp,final]:i%3===2?[early,encounter,branch,strong,merchant,middle,camp,final]:[early,merchant,encounter,middle,branch,strong,camp,final];
 if(id==='lake')route=[early,encounter,node('reflection','reward','镜湖·水中传承'),merchant,middle,branch,strong,camp,final];
 if(id==='tomb')route=[early,branch,strong,merchant,node('inscription','reward','幽陵·碑刻传承'),middle,encounter,camp,final];
 if(id==='peak')route=[early,merchant,middle,encounter,branch,strong,node('cloud-script','reward','天峰·云篆传承'),node('thunder','battle','天峰·雷霄双阵',group(['shield','ranged','elite'],elite),{reward:true,coins:30}),camp,final];
 return [id,route.map((n,index)=>({...n,index,enemies:n.enemies.map(e=>({...ENEMY_TYPES[e.kind],heavyDamage:BALANCE.bossHeavyDamage,...e}))}))];
}));
