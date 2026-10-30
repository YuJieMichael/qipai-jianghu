import {evaluateRunDice} from './model.mjs';
import {getRunNode} from './journey.mjs';
/** Detached presentation of a completed resolution; never consumes RNG or runs combat. */
export function createBattleReport(before,result){
 if(!before?.combat||!result?.state?.hero)return null;
 const after=result.state;
 const name=(id,snapshot)=>id==='hero'?'无名侠客':snapshot?.combat?.enemies?.find(e=>e.id===id)?.name||before.combat.enemies.find(e=>e.id===id)?.name||String(id||'江湖客');
 return {round:before.combat.round,nodeName:getRunNode(before)?.name||'江湖交锋',hand:{name:evaluateRunDice(before).name,dice:[...before.combat.dice]},damage:Math.max(0,after.stats.damage-before.stats.damage),kills:Math.max(0,after.stats.kills-before.stats.kills),hero:{hpBefore:before.hero.hp,hpAfter:after.hero.hp,shieldBefore:before.hero.shield||0,shieldAfter:after.hero.shield||0},events:(result.events||[]).slice(-240).map(event=>({type:event.type,text:String(event.text||''),sourceName:name(event.sourceId,event.snapshot),targetNames:(event.targetIds||[]).map(id=>name(id,event.snapshot)),value:Number.isFinite(event.value)?event.value:0}))};
}
