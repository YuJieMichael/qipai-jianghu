import {newAdventure,act as reduce,validateAdventure,migrateAdventure,SAVE_KEY} from './model.mjs';
import {CAMPAIGN_KEY,newCampaign,validateCampaign,beginCampaignRun,awardBattle,campaignAction,getCampaignLoadout} from './campaign.mjs';

const SETTINGS_KEY='qipai-reference-settings-v1';
export const RUN_JOURNAL_KEY='qipai-reference-pending-run-v1';
const soundFor={attack:'strike',roll:'dice',charge:'mechanic',flame:'burst',guard:'shield',intent:'mechanic',phase:'phase',unlock:'ascension',reward:'victory'};

/** Owns browser boundaries; complete decisions are checkpointed before cancellable playback. */
export function createAdventureController({storage,initial,seed=()=>Date.now()>>>0,scene,render=()=>{},audio,onWorkshop=()=>{}}={}){
 let state,campaign,dead=false,busy=false,loading=true,paused=false,generation=0,message='';
 let campaignOpen=false,campaignTab='inventory',loadingTimer=null,releaseReadiness=null;
 let settings={muted:false,reducedMotion:false};
 const read=key=>{try{return storage?.getItem(key)??null;}catch{return null;}};
 const write=(key,value)=>{try{storage?.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
 try{const value=JSON.parse(read(SETTINGS_KEY));if(value&&typeof value.muted==='boolean'&&typeof value.reducedMotion==='boolean')settings={muted:value.muted,reducedMotion:value.reducedMotion};}catch{}
 try{const raw=read(CAMPAIGN_KEY),value=raw&&raw.length<100000?JSON.parse(raw):null;if(validateCampaign(value))campaign=value;}catch{}
 campaign??=newCampaign(seed());
 if(initial&&validateAdventure(initial))state=migrateAdventure(initial);
 if(!state){
  const raw=read(SAVE_KEY);
  if(raw){try{const saved=raw.length<=100000?JSON.parse(raw):null;if(validateAdventure(saved))state=migrateAdventure(saved);else message='存档未能读取，已开启新的试炼。';}catch{message='存档未能读取，已开启新的试炼。';}}
 }
 // A small write-ahead journal makes the two localStorage keys recoverable.
 // A newer same-run adventure/profile always wins over an uncleared journal.
 if(!initial){try{
  const raw=read(RUN_JOURNAL_KEY),j=raw&&raw.length<200000?JSON.parse(raw):null;
  if(j?.version===1&&Object.keys(j).length===3&&validateAdventure(j.adventure)&&j.adventure.version===2&&validateCampaign(j.campaign)&&
   j.campaign.activeRun?.runId===j.adventure.runId&&j.campaign.activeRun.chapterId===j.adventure.chapterId){
   const target=j.campaign.runSerial,current=typeof state?.runId==='string'?Number(state.runId.slice(4)):0;
   if(current<=target&&campaign.runSerial<=target){
    if(current!==target)state=migrateAdventure(j.adventure);
    if(campaign.activeRun?.runId!==j.adventure.runId)campaign=j.campaign;
    const saved=write(SAVE_KEY,state),profileSaved=write(CAMPAIGN_KEY,campaign);
    if(saved&&profileSaved)write(RUN_JOURNAL_KEY,null);
   }
  }
 }catch{}}
 function allocate(chapterId){
  const started=beginCampaignRun(campaign,chapterId);if(started.runId===null)return null;
  const fresh=newAdventure(seed(),{chapterId,runId:started.runId,loadout:getCampaignLoadout(started.campaign)});
  if(!write(RUN_JOURNAL_KEY,{version:1,campaign:started.campaign,adventure:fresh})){
   message='浏览器未能保存新旅程，本次进度可能无法保留。';
  }
  campaign=started.campaign;
  const saved=write(SAVE_KEY,fresh),profileSaved=write(CAMPAIGN_KEY,campaign);
  if(saved&&profileSaved)write(RUN_JOURNAL_KEY,null);
  else message='新旅程已开启，存档将在浏览器恢复后补存。';
  return fresh;
 }
 state??=allocate(1)??newAdventure(seed());
 audio?.setMuted(settings.muted);
 const options=()=>({busy:busy||loading,paused,muted:settings.muted,reducedMotion:settings.reducedMotion,message,campaign,campaignOpen,campaignTab});
 const show=(view=state)=>{if(!dead)render(view,options());};
 function checkpoint(){if(!write(SAVE_KEY,state))message='当前浏览器未能保存进度，可继续游玩。';}
 function settle(){
  const latest=['reward','won'].includes(state.phase)?state.stage:state.stage-1;
  if(latest<0)return;
  // Legacy adventures receive an identity without resetting combat, then catch up
  // only victories already proved by the saved stage/phase. Each is receipted once.
  if(state.runId===0||campaign.activeRun===null){
   if(state.chapterId===2&&campaign.unlockedChapter===1)campaign={...campaign,unlockedChapter:2};
   const started=state.runId===0&&campaign.activeRun?.chapterId===state.chapterId?{campaign,runId:campaign.activeRun.runId}:beginCampaignRun(campaign,state.chapterId);if(started.runId===null)return;
   campaign=started.campaign;write(CAMPAIGN_KEY,campaign);state={...state,runId:started.runId};checkpoint();
  }
  const notices=[];for(let stage=0;stage<=latest;stage++){
   const result=awardBattle(campaign,{runId:state.runId,chapterId:state.chapterId,stage,won:true});
   if(result.campaign!==campaign){campaign=result.campaign;if(result.message)notices.push(result.message);}
  }
  if(notices.length)message=notices.length===1?notices[0]:`已补领${notices.length}场装备。${notices.at(-1)}`;
  if(!write(CAMPAIGN_KEY,campaign))message='本次掉落暂未存入浏览器，请保持页面开启。';
 }
 function sync(){scene?.update?.(state,{reducedMotion:settings.reducedMotion});show();}

 async function present(result){
  const previous=state;if(state.phase==='reward'&&result.state.phase==='battle')message='';state=result.state;paused=false;campaignOpen=false;checkpoint();settle();
  if(!result.events.length){sync();return;}
  const own=++generation;busy=true;show(previous);let eventIndex=0;
  try{
   if(scene?.play){await scene.play(result.events,{reducedMotion:settings.reducedMotion,onFrame(snapshot){
    if(dead||own!==generation)return;
    const event=result.events[eventIndex++];
    const sound=event?.type==='hurt'&&event.amount===0&&event.blocked>0?'shield':soundFor[event?.type]||event?.type;
    audio?.play(sound);show(snapshot);
   }});}
  }catch{if(!dead&&own===generation)message='演出已略过，可以继续试炼。';}
  finally{if(!dead&&own===generation){busy=false;sync();}}
 }
 async function dispatch(action){
  if(dead||!action||typeof action!=='object')return;
  if(action.type==='mute'||action.type==='motion'){
   if(action.type==='mute'){settings.muted=!settings.muted;audio?.setMuted(settings.muted);}
   else settings.reducedMotion=!settings.reducedMotion;
   write(SETTINGS_KEY,settings);if(!busy)scene?.update?.(state,{reducedMotion:settings.reducedMotion});show();return;
  }
  if(action.type==='resume'){paused=false;show();return;}
  if(busy||loading)return;
  if(action.type==='inventory'||action.type==='chapters'){campaignOpen=true;campaignTab=action.type==='chapters'?'chapters':'inventory';show();return;}
  if(action.type==='campaign-close'){campaignOpen=false;show();return;}
  if(action.type.startsWith('gear-')){
   if(!campaignOpen)return;
   const result=campaignAction(campaign,{...action,type:action.type.slice(5)});
   campaign=result.campaign;message=result.message;if(!write(CAMPAIGN_KEY,campaign))message='浏览器未能保存换装。';show();return;
  }
  if(action.type==='chapter-start'||action.type==='restart'){
   if(action.type==='chapter-start'&&!campaignOpen)return;
   const chapterId=action.type==='restart'?state.chapterId:action.chapterId;
   const fresh=allocate(chapterId);if(!fresh)return;
   return present(reduce(fresh,{type:'begin'}));
  }
  if(campaignOpen)return;
  if(action.type==='pause'||action.type==='settings'){paused=true;show();return;}
  if(action.type==='workshop'){onWorkshop();return;}
  if(paused)return;
  const result=reduce(state,action.type==='choose'?{...action,loadout:getCampaignLoadout(campaign)}:action);
  if(result.state===state)return;
  return present(result);
 }
 show();scene?.update?.(state,{reducedMotion:settings.reducedMotion});
 const ready=(async()=>{
  const loaded=await new Promise(resolve=>{
   releaseReadiness=resolve;loadingTimer=setTimeout(()=>resolve(false),4500);
   Promise.resolve(scene?.ready).then(()=>resolve(true),()=>resolve(false));
  });
  clearTimeout(loadingTimer);loadingTimer=null;releaseReadiness=null;
  if(dead)return;
  if(!loaded&&!message){
   const notice='画面仍在载入，可以先开始试炼。';message=notice;
   Promise.resolve(scene?.ready).then(()=>{if(dead||message!==notice)return;message='';if(!busy)sync();},()=>{});
  }
  loading=false;
  if(state.phase==='battle'&&state.dice.filter(die=>die.unlocked).every(die=>die.value===0))await dispatch({type:'begin'});
  else {checkpoint();settle();sync();}
 })();
 return {ready,act:dispatch,get state(){return state;},get campaign(){return structuredClone(campaign);},get busy(){return busy||loading;},get paused(){return paused;},get settings(){return {...settings};},destroy(){if(dead)return;dead=true;generation++;clearTimeout(loadingTimer);releaseReadiness?.(false);audio?.destroy();scene?.destroy?.();}};
}
