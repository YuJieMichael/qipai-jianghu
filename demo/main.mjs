import {createRun,rollDice,toggleHold,rerollDice} from './model.mjs';
import {prepareRound,selectTarget,previewAttack,resolveRound} from './combat.mjs';
import {enterNode,completeBattle,selectUpgrade,selectUpgradeTarget,cancelUpgrade,previewUpgrade,chooseUpgrade,chooseEvent,advanceNode} from './journey.mjs';
import {saveRun,loadRun} from './storage.mjs';
import {createProfile,loadProfile,saveProfile,applyProfileAction,beginExpedition,settleRun,validateProfile} from './profile.mjs';
import {getContent} from './content.mjs';
import {createExpedition,useRunItem} from './adventures.mjs';

export function seedFromQuery(value,fallback){return typeof value==='string'&&/^[0-9]+$/.test(value)&&Number(value)<=0xffffffff?Number(value):fallback();}

/** One input gate owns the run. Presentation consumes snapshots, never rules. */
export function createController({initial=null,initialProfile=null,storage,render=()=>{},play=async()=>{},onExit=()=>{},onSettings=()=>{},defaultSettings={},seed=()=>Date.now()>>>0,now=()=>Date.now()}={}){
 let state=initial||createRun('sword',1),busy=false,dead=false,generation=0,message='';
 const loadedProfile=loadProfile(storage);
 let profile=initialProfile||loadedProfile.profile||createProfile(1,now()),hubTab='expedition',hubFilter='weapon',editorText='',editorRevision=0;
 let settings={muted:false,reducedMotion:false,...defaultSettings},display=state;
 try{const s=JSON.parse(storage?.getItem('qipai-bamboo-settings-v1')||'null');if(s)for(const key of ['muted','reducedMotion'])if(typeof s[key]==='boolean')settings[key]=s[key];}catch{}
 let saved=loadRun(storage);message=saved.message||loadedProfile.message||'';
 const show=(view=state)=>{display=view;if(!dead)render(view,{busy,message,settings,hasSave:!!saved.run,profile,hubTab,hubFilter,editorText,editorRevision,preview:view.flow==='battle'?previewAttack(view):null});};
 const checkpoint=()=>{if(state.flow==='intro')return;const result=saveRun(storage,state);if(result.ok){saved={run:structuredClone(state),message:''};}else message=result.message;};
 const persistProfile=()=>{const result=saveProfile(storage,profile);if(!result.ok)message=result.message;};
 const settle=(run,abandoned=false)=>{
  if(!Number.isSafeInteger(run?.runId))return;
  const result=settleRun(profile,abandoned?{...run,flow:'abandoned'}:run,{now:now()});
  if(result.profile!==profile){profile=result.profile;message=result.message;persistProfile();}
 };
 const start=(build,options={})=>{
  const content=getContent(profile),mode=options.mode||'campaign',chapter=options.chapter||'bamboo';
  if(!['sword','poison','guard'].includes(build)||!content.modes.some(m=>m.id===mode)||!content.chapters.some(c=>c.id===chapter)){message='请选择有效的传承、玩法和章节。';show();return;}
  const previous=state.flow==='intro'?saved.run:state;
  if(previous&&!['victory','defeat'].includes(previous.flow))settle(previous,true);else if(previous)settle(previous);
  const begun=beginExpedition(profile);if(!begun.loadout){message=begun.message;show();return;}
  profile=begun.profile;persistProfile();
  const next=createExpedition(build,seed(),{runId:begun.runId,loadout:begun.loadout,mode,chapter,content,floor:begun.loadout.progression?.towerFloor||1,worldBossHp:begun.loadout.progression?.worldBossHp});
  message=begun.message;change(enterNode(next));
 };
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
  if(action.type==='home'){checkpoint();state=createRun(state.build||'sword',1);hubTab='expedition';show();return;}
  if(action.type==='hub-tab'){hubTab=String(action.value);show();return;}
  if(action.type==='hub-filter'){hubFilter=String(action.value);show();return;}
  if(action.type==='profile'){
   const result=applyProfileAction(profile,action.value,{now:now()});profile=result.profile;message=result.message;persistProfile();show();return;
  }
  if(action.type==='profile-export'||action.type==='content-export'){
   editorRevision++;editorText=JSON.stringify(action.type==='profile-export'?profile:getContent(profile),null,2);hubTab='editor';message='数据已写入文本框，可复制修改后导入。';show();return;
  }
  if(action.type==='profile-import'){
   const checked=validateProfile(action.value);
   if(!checked.valid){message=`档案未导入：${checked.errors.join('；')}`;show();return;}
   profile=checked.profile;persistProfile();message='档案已导入；已保存旅途的配装快照保持原值。';show();return;
  }
  if(action.type==='expedition'){start(action.value?.build||'sword',action.value||{});return;}
  if(action.type==='start'||action.type==='retry'){
   start(action.type==='start'?action.value:state.build,action.type==='retry'?{mode:state.mode,chapter:state.chapter}:{});return;
  }
  if(action.type==='resume'){
   saved=loadRun(storage);message=saved.message||'';if(saved.run){state=rollDice(saved.run);if(['victory','defeat'].includes(state.flow))settle(state);if(state!==saved.run)checkpoint();show();}return;
  }
  if(action.type==='roll'){change(rollDice(state));return;}
  if(action.type==='hold'){change(toggleHold(state,Number(action.value)));return;}
  if(action.type==='reroll'){change(rerollDice(state));return;}
  if(action.type==='use-item'){change(useRunItem(state,String(action.value)));return;}
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
   state=completeBattle(result.state);
   if(state===result.state&&state.flow==='battle')state=prepareRound(state);
   state=rollDice(state);
   if(['victory','defeat'].includes(state.flow))settle(state);
   busy=false;checkpoint();show();
  }catch(error){
   if(dead||ownGeneration!==generation)return;
   busy=false;message='本回合播放中断，已保留出招前的进度。可以重新出招。';show();
   console.error(error);
  }
 }
 if(!loadedProfile.profile&&!initialProfile){message=loadedProfile.message==='尚无门庭档案。'?'行装已备，门庭档案会自动保存。':message;persistProfile();}
 onSettings(settings);const ready=rollDice(state);if(ready!==state){state=ready;checkpoint();}show();
 return {act,get state(){return state;},get profile(){return profile;},get busy(){return busy;},get settings(){return settings;},save:checkpoint,
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
