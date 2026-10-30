/** Same-origin HTTP client. It never uploads local state until saveProfile is called. */
export class NetworkError extends Error {
 constructor(message,{status=0,code='NETWORK_UNAVAILABLE',payload=null}={}){super(message);this.name='NetworkError';this.status=status;this.code=code;this.payload=payload;}
}
export function createNetworkClient({fetch:fetchImpl=globalThis.fetch,baseUrl=''}={}){
 const base=baseUrl.replace(/\/$/,'');
 async function request(path,method='GET',body){
  let response;
  try{response=await fetchImpl(`${base}/api${path}`,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});}catch{throw new NetworkError('联网服务不可用，请启动服务后重试。');}
  let payload;try{payload=await response.json();}catch{throw new NetworkError('服务未返回有效 JSON。',{status:response.status,code:'INVALID_RESPONSE'});}
  if(!response.ok||payload?.ok!==true)throw new NetworkError(payload?.error||'请求失败。',{status:response.status,code:payload?.code||'REQUEST_FAILED',payload});
  return payload;
 }
 const id=value=>encodeURIComponent(value);
 return Object.freeze({
  health:()=>request('/health'),session:()=>request('/session'),
  register:(username,password)=>request('/auth/register','POST',{username,password}),login:(username,password)=>request('/auth/login','POST',{username,password}),logout:()=>request('/auth/logout','POST',{}),
  loadProfile:()=>request('/profile'),saveProfile:(profile,expectedRevision)=>request('/profile','PUT',{profile,expectedRevision}),leaderboard:()=>request('/leaderboard'),
  listGuilds:()=>request('/guilds'),createGuild:name=>request('/guilds','POST',{name}),joinGuild:guildId=>request(`/guilds/${id(guildId)}/join`,'POST',{}),leaveGuild:guildId=>request(`/guilds/${id(guildId)}/leave`,'POST',{}),guild:guildId=>request(`/guilds/${id(guildId)}`),sendMessage:(guildId,text)=>request(`/guilds/${id(guildId)}/message`,'POST',{text}),
  queue:()=>request('/arena/queue','POST',{}),cancelQueue:()=>request('/arena/cancel','POST',{}),arena:()=>request('/arena/state'),action:action=>request('/arena/action','POST',action)
 });
}
