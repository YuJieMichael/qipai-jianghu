import {createNetworkClient} from './network.mjs';
import {validateProfile} from './profile.mjs';
/** Session/UI state is deliberately separate from exportable player data. */
export function createNetworkController({client=null,getProfile,setProfile,onChange=()=>{},storage,origin=globalThis.location?.origin}={}){
 let baseUrl='';try{baseUrl=JSON.parse(storage?.getItem('qipai-network-v1')||'null')?.baseUrl||'';}catch{}
 let api=client||createNetworkClient({baseUrl}),dead=false,active=false,timer=null,epoch=0;
 let state={status:'idle',busy:false,user:null,error:'',message:'',profileRevision:0,entries:[],guilds:[],guild:null,queued:false,match:null,selected:[],baseUrl};
 const emit=()=>{if(!dead)onChange(structuredClone(state));};
 const clearTimer=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
 const takeArena=r=>{state.queued=!!r.queued;state.match=r.match||null;state.selected=[];};
 function schedule(){clearTimer();if(dead||!active||(!state.queued&&state.match?.status!=='active'))return;timer=setTimeout(async()=>{
  if(dead||!active)return;
  if(!state.busy){const requestEpoch=epoch;try{const r=await api.arena();if(dead)return;if(requestEpoch!==epoch){schedule();return;}const changed=state.queued!==!!r.queued||state.match?.id!==r.match?.id||state.match?.version!==r.match?.version||state.match?.status!==r.match?.status;if(changed){takeArena(r);emit();}}catch(error){if(dead||requestEpoch!==epoch){schedule();return;}state.error=error.message||'连接中断，请刷新对局。';if(error.status===401){state.user=null;state.queued=false;state.match=null;}emit();}}
  schedule();
 },3000);timer?.unref?.();}
 async function connected(){
  await api.health();const s=await api.session();if(dead)return;state.status='connected';state.user=s.user||null;
  if(state.user){const [profile,board,guilds,arena]=await Promise.all([api.loadProfile(),api.leaderboard(),api.listGuilds(),api.arena()]);if(dead)return;state.profileRevision=profile.revision||0;state.entries=board.entries||[];state.guilds=guilds.guilds||[];const membership=state.guilds.find(g=>g.mine);state.guild=membership?(await api.guild(membership.id)).guild:null;if(dead)return;takeArena(arena);}
 }
 async function act(action={}){
  if(dead||state.busy)return;
  const type=action.type;
  if(type==='select-die'){const m=state.match,index=Number(action.index);if(!m?.isYourTurn||m.status!=='active'||!Number.isInteger(index)||index<0||index>=5)return;state.selected=state.selected.includes(index)?state.selected.filter(i=>i!==index):[...state.selected,index];emit();return;}
  if(type==='set-server'){
   const value=String(action.baseUrl||'').trim().replace(/\/$/,'');try{if(value){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('服务地址须为 HTTP 或 HTTPS。');if(origin&&url.origin!==origin)throw Error('请先在目标服务地址打开游戏页面，再使用同源账号服务。');}epoch++;baseUrl=value;api=createNetworkClient({baseUrl});state={...state,user:null,match:null,queued:false,selected:[],baseUrl,status:'idle',error:'',message:'服务地址已设置，请刷新连接。'};try{storage?.setItem('qipai-network-v1',JSON.stringify({baseUrl}));}catch{state.message+=' 地址未能持久保存。';}}catch(error){state.error=error.message;}clearTimer();emit();return;
  }
  state.busy=true;state.error='';state.message='';const own=++epoch;emit();
  try{
   let result;
   if(type==='refresh'){await connected();state.message=state.user?'账号已连接，档案尚未自动上传或下载。':'服务已连接，可以注册或登录。';}
   else if(type==='register'||type==='login'){result=await api[type](String(action.username||''),String(action.password||''));if(dead)return;state.user=result.user||null;await connected();state.message='登录成功。';}
   else if(type==='logout'){await api.logout();if(dead)return;state.user=null;state.guild=null;state.guilds=[];state.match=null;state.queued=false;state.entries=[];state.profileRevision=0;state.message='已退出账号，本机档案保留。';}
   else if(type==='save-profile'){result=await api.saveProfile(structuredClone(getProfile()),state.profileRevision);if(dead)return;state.profileRevision=result.revision;state.message='档案已上传到账号存档。';}
   else if(type==='load-profile'){result=await api.loadProfile();if(dead)return;if(!result.profile)throw Error('此账号还没有远端档案。');const checked=validateProfile(result.profile);if(!checked.valid)throw Error(`远端档案校验失败：${checked.errors[0]}`);setProfile(checked.profile);state.profileRevision=result.revision;state.message='远端档案已下载；进行中的旅程继续使用原配装快照。';}
   else if(type==='leaderboard'){result=await api.leaderboard();if(dead)return;state.entries=result.entries||[];}
   else if(type==='guilds'){result=await api.listGuilds();if(dead)return;state.guilds=result.guilds||[];const membership=state.guilds.find(g=>g.mine);state.guild=membership?(await api.guild(membership.id)).guild:null;}
   else if(type==='create-guild'){result=await api.createGuild(String(action.name||''));if(dead)return;state.guild=result.guild||null;}
   else if(type==='join-guild'){result=await api.joinGuild(action.id);if(dead)return;state.guild=result.guild||null;}
   else if(type==='leave-guild'){await api.leaveGuild(action.id);if(dead)return;state.guild=null;state.guilds=(await api.listGuilds()).guilds||[];}
   else if(type==='guild'){result=await api.guild(action.id);if(dead)return;state.guild=result.guild||null;}
   else if(type==='message'){result=await api.sendMessage(action.id,String(action.text||''));if(dead)return;state.guild=result.guild||null;}
   else if(type==='queue'){result=await api.queue();if(dead)return;takeArena(result);state.message=state.queued?'正在等待另一位真人玩家加入。':'真人对局已匹配。';}
   else if(type==='cancel'){result=await api.cancelQueue();if(dead)return;takeArena(result);}
   else if(type==='arena'){result=await api.arena();if(dead)return;takeArena(result);}
   else if(['reroll','attack','forfeit'].includes(type)){const m=state.match;if(!m)throw Error('当前没有对局。');result=await api.action({matchId:m.id,expectedVersion:m.version,type, ...(type==='reroll'?{indices:[...state.selected]}:{})});if(dead)return;takeArena(result);if(state.match?.status==='finished')state.entries=(await api.leaderboard()).entries||[];}
   else throw Error('此联网操作不存在。');
  }catch(error){if(dead||own!==epoch)return;state.error=error.code==='REVISION_CONFLICT'?'远端档案已有新版本，请先下载核对，尚未覆盖任何数据。':error.message||'连接失败，请启动服务后重试。';if(error.status===401){state.user=null;state.guild=null;state.queued=false;state.match=null;}if(type==='refresh'&&!state.user)state.status='offline';}
  finally{if(!dead&&own===epoch){state.busy=false;emit();schedule();}}
 }
 return {act,get state(){return structuredClone(state);},setActive(value){active=!!value;if(active)schedule();else clearTimer();},destroy(){dead=true;epoch++;clearTimer();}};
}
