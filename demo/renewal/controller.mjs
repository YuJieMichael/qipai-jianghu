import {newAdventure,act as reduce,validateAdventure,SAVE_KEY} from './model.mjs';

const SETTINGS_KEY='qipai-reference-settings-v1';
const soundFor={attack:'strike',roll:'dice',flame:'burst',guard:'shield',unlock:'ascension',reward:'victory'};

/** Owns browser boundaries; model decisions are atomic and presentation is cancellable. */
export function createAdventureController({storage,initial,seed=()=>Date.now()>>>0,scene,render=()=>{},audio,onWorkshop=()=>{}}={}){
 let state,dead=false,busy=false,loading=true,paused=false,generation=0,message='';
 let loadingTimer=null,releaseReadiness=null;
 let settings={muted:false,reducedMotion:false};
 const read=key=>{try{return storage?.getItem(key)??null;}catch{return null;}};
 const write=(key,value)=>{try{storage?.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
 try{const value=JSON.parse(read(SETTINGS_KEY));if(value&&typeof value.muted==='boolean'&&typeof value.reducedMotion==='boolean')settings={muted:value.muted,reducedMotion:value.reducedMotion};}catch{}
 if(initial&&validateAdventure(initial))state=structuredClone(initial);
 if(!state){
  const raw=read(SAVE_KEY);
  if(raw){try{const saved=raw.length<=100000?JSON.parse(raw):null;if(validateAdventure(saved))state=saved;else message='存档未能读取，已开启新的试炼。';}catch{message='存档未能读取，已开启新的试炼。';}}
 }
 state??=newAdventure(seed());
 audio?.setMuted(settings.muted);
 const options=()=>({busy:busy||loading,paused,muted:settings.muted,reducedMotion:settings.reducedMotion,message});
 const show=(view=state)=>{if(!dead)render(view,options());};
 function checkpoint(){if(!write(SAVE_KEY,state))message='当前浏览器未能保存进度，可继续游玩。';}
 function sync(){scene?.update?.(state,{reducedMotion:settings.reducedMotion});show();}

 async function dispatch(action){
  if(dead||!action||typeof action!=='object')return;
  if(action.type==='mute'||action.type==='motion'){
   if(action.type==='mute'){settings.muted=!settings.muted;audio?.setMuted(settings.muted);}
   else settings.reducedMotion=!settings.reducedMotion;
   write(SETTINGS_KEY,settings);if(!busy)scene?.update?.(state,{reducedMotion:settings.reducedMotion});show();return;
  }
  if(action.type==='resume'){paused=false;show();return;}
  if(busy||loading)return;
  if(action.type==='pause'||action.type==='settings'){paused=true;show();return;}
  if(action.type==='workshop'){onWorkshop();return;}
  if(paused&&action.type!=='restart')return;
  const result=reduce(state,action.type==='restart'?{...action,seed:seed()}:action);
  if(result.state===state)return;
  const previous=state;state=result.state;paused=false;checkpoint();
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
 show();scene?.update?.(state,{reducedMotion:settings.reducedMotion});
 const ready=(async()=>{
  const loaded=await new Promise(resolve=>{
   releaseReadiness=resolve;
   loadingTimer=setTimeout(()=>resolve(false),4500);
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
  else {checkpoint();sync();}
 })();
 return {ready,act:dispatch,get state(){return state;},get busy(){return busy||loading;},get paused(){return paused;},get settings(){return {...settings};},destroy(){if(dead)return;dead=true;generation++;clearTimeout(loadingTimer);releaseReadiness?.(false);audio?.destroy();scene?.destroy?.();}};
}
