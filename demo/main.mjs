import {createRun,rollDice,toggleHold,rerollDice} from './model.mjs';
import {prepareRound,selectTarget,previewAttack,resolveRound} from './combat.mjs';
import {enterNode,completeBattle,selectUpgrade,selectUpgradeTarget,cancelUpgrade,previewUpgrade,chooseUpgrade,chooseEvent,advanceNode} from './journey.mjs';
import {saveRun,loadRun} from './storage.mjs';

export function seedFromQuery(value,fallback){return typeof value==='string'&&/^[0-9]+$/.test(value)&&Number(value)<=0xffffffff?Number(value):fallback();}

/** One input gate owns the run. Presentation consumes snapshots, never rules. */
export function createController({initial=null,storage,render=()=>{},play=async()=>{},onExit=()=>{},onSettings=()=>{},defaultSettings={},seed=()=>Date.now()>>>0}={}){
 let state=initial||createRun('sword',1),busy=false,dead=false,generation=0,message='';
 let settings={muted:false,reducedMotion:false,...defaultSettings},display=state;
 try{const s=JSON.parse(storage?.getItem('qipai-bamboo-settings-v1')||'null');if(s)for(const key of ['muted','reducedMotion'])if(typeof s[key]==='boolean')settings[key]=s[key];}catch{}
 let saved=loadRun(storage);message=saved.message||'';
 const show=(view=state)=>{display=view;if(!dead)render(view,{busy,message,settings,hasSave:!!saved.run,preview:view.flow==='battle'?previewAttack(view):null});};
 const checkpoint=()=>{if(state.flow==='intro')return;const result=saveRun(storage,state);if(result.ok){saved={run:structuredClone(state),message:''};}else message=result.message;};
 const change=next=>{next=rollDice(next);if(next===state)return;state=next;checkpoint();show();};
 async function act(action){
  if(dead||!action)return;
  if(action.type==='mute'||action.type==='motion'){
   settings={...settings,[action.type==='mute'?'muted':'reducedMotion']:!settings[action.type==='mute'?'muted':'reducedMotion']};
   try{storage?.setItem('qipai-bamboo-settings-v1',JSON.stringify(settings));}catch{message='设置暂时无法保存，本次仍然生效。';}
   onSettings(settings);show(display);return;
  }
  if(action.type==='exit'){checkpoint();generation++;busy=false;onExit();return;}
  if(busy)return;
  if(action.type==='start'||action.type==='retry'){
   message='';change(enterNode(createRun(action.type==='start'?action.value:state.build,seed())));return;
  }
  if(action.type==='resume'){
   saved=loadRun(storage);message=saved.message||'';if(saved.run){state=rollDice(saved.run);if(state!==saved.run)checkpoint();show();}return;
  }
  if(action.type==='roll'){change(rollDice(state));return;}
  if(action.type==='hold'){change(toggleHold(state,Number(action.value)));return;}
  if(action.type==='reroll'){change(rerollDice(state));return;}
  if(action.type==='target'){change(selectTarget(state,String(action.value)));return;}
  if(action.type==='upgrade'){change(selectUpgrade(state,String(action.value)));return;}
  if(action.type==='upgrade-target'){change(selectUpgradeTarget(state,Number(action.value)));return;}
  if(action.type==='upgrade-cancel'){change(cancelUpgrade(state));return;}
  if(action.type==='upgrade-confirm'){
   const pending=state.pendingUpgrade;
   if(!pending||!previewUpgrade(state,pending.choiceId,pending.dieIndex).valid)return;
   change(chooseUpgrade(state,pending.choiceId,pending.dieIndex));return;
  }
  if(action.type==='event'){change(chooseEvent(state,String(action.value)));return;}
  if(action.type==='next'){if(state.flow==='camp')change(enterNode(advanceNode(state)));return;}
  if(action.type!=='attack'||state.flow!=='battle'||state.combat?.phase!=='pick')return;
  // Save the decision boundary, including exact dice and target, before playback.
  checkpoint();busy=true;const ownGeneration=++generation;show();
  try{
   const result=resolveRound(state);
   for(const [eventIndex,event] of result.events.entries()){
    if(dead||ownGeneration!==generation)return;
    await play(event,{eventIndex,events:result.events});if(dead||ownGeneration!==generation)return;show(event.snapshot);
   }
   if(dead||ownGeneration!==generation)return;
   state=result.state;
   state=rollDice(state.hero.hp<=0||!state.combat.enemies.some(e=>e.hp>0)?completeBattle(state):prepareRound(state));
   busy=false;checkpoint();show();
  }catch(error){
   if(dead||ownGeneration!==generation)return;
   busy=false;message='本回合播放中断，已保留出招前的进度。可以重新出招。';show();
   console.error(error);
  }
 }
 onSettings(settings);const ready=rollDice(state);if(ready!==state){state=ready;checkpoint();}show();
 return {act,get state(){return state;},get busy(){return busy;},get settings(){return settings;},save:checkpoint,
  destroy(){if(dead)return;checkpoint();generation++;dead=true;busy=false;}};
}

/** A restored document owns a fresh app and exactly one next pagehide listener. */
export function bindPageLifecycle(win,cleanup,remount){
 win.addEventListener('pagehide',()=>{
  cleanup();
  win.addEventListener('pageshow',event=>{if(event.persisted)remount();},{once:true});
 },{once:true});
}

async function mount(){
 const [{createUI},{createScene},{createAudio}]=await Promise.all([import('./ui.mjs'),import('./scene.mjs'),import('./audio.mjs')]);
 let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('storage unavailable');}};}
 const audio=createAudio();let controller,scene;
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ui=createUI(document.querySelector('#app'),action=>{audio.unlock();controller?.act(action);});
 scene=createScene(document.querySelector('#stage'),{reducedMotion});
 const requestedSeed=new URLSearchParams(location.search).get('seed');
 controller=createController({storage,defaultSettings:{reducedMotion},
  seed:()=>seedFromQuery(requestedSeed,()=>crypto.getRandomValues(new Uint32Array(1))[0]),
  render:(run,options)=>{ui.render(run,options);scene.setState(run);},
  play:async (event,context)=>{audio.play(event);await scene.play(event,context);},
  onSettings:settings=>{audio.setMuted(settings.muted);scene.setOptions(settings);},
  onExit:()=>{cleanup();location.href='../';}
 });
 function cleanup(){controller?.destroy();ui.destroy();scene.destroy();audio.destroy();}
 bindPageLifecycle(window,cleanup,()=>mount().catch(showMountError));
}
function showMountError(error){
 console.error(error);const root=document.querySelector('#app');if(root){root.textContent='关卡加载失败，请刷新页面重试。';}
}
if(typeof document!=='undefined')mount().catch(showMountError);
