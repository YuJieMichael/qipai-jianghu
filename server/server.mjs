import http from 'node:http';
import {randomBytes as cryptoBytes,scrypt as cryptoScrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir,readFile,rename,open,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {validateProfile} from '../demo/profile.mjs';
import {evaluateDice} from '../demo/model.mjs';
const scrypt=promisify(cryptoScrypt);
export const NODE_REQUIREMENT='Node.js >=22.0.0 (tested with 26.11.0)';
const BODY_LIMIT=768*1024,PROFILE_LIMIT=512*1024,SESSION_MS=86400000,TURN_MS=120000;
const blank=()=>({version:1,accounts:[],guilds:[],matches:[]});
class HttpError extends Error {constructor(status,code,message,details={}){super(message);Object.assign(this,{status,code,details});}}
const fail=(status,code,message,details)=>{throw new HttpError(status,code,message,details);};
const own=(obj,key)=>Object.hasOwn(obj,key);
function exact(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'INVALID_BODY','请求字段无效。');}
function text(value,min,max,label){if(typeof value!=='string'||value.trim()!==value||[...value].length<min||[...value].length>max||/[<>\u0000-\u001f\u007f]/u.test(value))fail(400,'INVALID_TEXT',`${label}格式无效。`);return value;}
function credentials(body){exact(body,['username','password']);const username=text(body.username,2,24,'账号').normalize('NFKC');if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(username))fail(400,'INVALID_USERNAME','账号须为 2–24 个文字、数字、下划线或连字符。');if(typeof body.password!=='string'||body.password.length<8||body.password.length>128)fail(400,'INVALID_PASSWORD','密码须为 8–128 个字符。');return {username,key:username.toLocaleLowerCase('en-US'),password:body.password};}
const publicUser=user=>({id:user.id,username:user.username});
/** One process owns one dataDir. All API operations and atomic file writes are serialized. */
export function createGameServer({dataDir=path.resolve(import.meta.dirname,'data'),rootDir=path.resolve(import.meta.dirname,'..'),now=Date.now,randomBytes=cryptoBytes,publicOrigin=null}={}){
 const trustedOrigin=publicOrigin?new URL(publicOrigin).origin:null;
 const file=path.join(dataDir,'state.json');let state=blank(),queue=[],dirty=false,chain=Promise.resolve();
 const sessions=new Map(),limits=new Map();
 const bytes=n=>Buffer.from(randomBytes(n));
 const token=()=>bytes(24).toString('hex');
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const ready=(async()=>{await mkdir(dataDir,{recursive:true,mode:0o700});try{const raw=JSON.parse(await readFile(file,'utf8'));if(raw.version!==1||!Array.isArray(raw.accounts)||!Array.isArray(raw.guilds)||!Array.isArray(raw.matches))throw new Error('Invalid state');state=raw;}catch(error){if(error.code!=='ENOENT')throw error;}})();
 // Keep a rejected startup promise handled; each request reports a generic 503.
 ready.catch(()=>{});
 async function persist(){
  const temp=path.join(dataDir,`.state-${token()}.tmp`),handle=await open(temp,'wx',0o600);
  try{await handle.writeFile(JSON.stringify(state));await handle.sync();}finally{await handle.close();}
  await rename(temp,file);
 }
 function rate(key,max,windowMs){
  const time=now();for(const [k,v]of limits)if(v.until<=time)limits.delete(k);
  if(!limits.has(key)){if(limits.size>=10000)fail(429,'RATE_LIMIT','服务繁忙，请稍后重试。');limits.set(key,{count:0,until:time+windowMs});}
  const entry=limits.get(key);if(++entry.count>max)fail(429,'RATE_LIMIT','请求过于频繁，请稍后重试。');
 }
 function userFor(req){
  for(const [key,session]of sessions)if(session.expiresAt<=now())sessions.delete(key);
  const match=/(?:^|;\s*)qipai_session=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie||'');const session=match?sessions.get(hash(match[1])):null;
  return session?{user:state.accounts.find(u=>u.id===session.userId),session,key:hash(match[1])}:{user:null,session:null,key:null};
 }
 function auth(req){const result=userFor(req);if(!result.user)fail(401,'AUTH_REQUIRED','请先登录。');return result;}
 function sessionCookie(res,value,req,expire=false){res.setHeader('Set-Cookie',`qipai_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${expire?0:SESSION_MS/1000}${req.socket.encrypted||trustedOrigin?.startsWith('https:')?'; Secure':''}`);}
 function loginSession(user,req,res){
  const previous=userFor(req);if(previous.key)sessions.delete(previous.key);
  const entries=[...sessions.entries()].filter(([,v])=>v.userId===user.id);if(entries.length>=5)sessions.delete(entries[0][0]);
  if(sessions.size>=5000)fail(429,'SESSION_LIMIT','会话已满，请稍后重试。');
  const value=token(),expiresAt=now()+SESSION_MS;sessions.set(hash(value),{userId:user.id,expiresAt});sessionCookie(res,value,req);return {user:publicUser(user),expiresAt};
 }
 function guildView(g){return {id:g.id,name:g.name,ownerId:g.ownerId,members:g.members.map(id=>publicUser(state.accounts.find(u=>u.id===id))),messages:g.messages};}
 function finish(match,winnerId,reason){
  if(match.status!=='active')return;
  match.status='finished';match.winnerId=winnerId;match.reason=reason;match.version++;match.finishedAt=now();match.deadline=null;
  match.log.push({type:'finish',winnerId,reason,at:now()});match.log=match.log.slice(-40);
  // A finished state and its standings are saved in the same atomic replacement.
  for(const id of match.players.map(p=>p.id)){const u=state.accounts.find(a=>a.id===id);u.played++;if(id===winnerId)u.wins++;else u.losses++;}
  dirty=true;
 }
 function expire(){for(const m of state.matches)if(m.status==='active'&&m.deadline<=now())finish(m,m.players.find(p=>p.id!==m.turnUserId).id,'timeout');queue=queue.filter(q=>q.until>now());}
 function roll(){let value;do{value=bytes(1)[0];}while(value>=252);return value%6+1;}
 function matchFor(user){return state.matches.findLast(m=>m.players.some(p=>p.id===user.id));}
 function arenaView(user,match=matchFor(user)){
  if(queue.some(q=>q.id===user.id))return {queued:true,match:null};
  if(!match)return {queued:false,match:null};
  const me=match.players.find(p=>p.id===user.id),opponent=match.players.find(p=>p.id!==user.id);
  return {queued:queue.some(q=>q.id===user.id),match:{id:match.id,version:match.version,status:match.status,you:{...me},opponent:{id:opponent.id,username:opponent.username,hp:opponent.hp,shield:opponent.shield},turnUserId:match.turnUserId,isYourTurn:match.status==='active'&&match.turnUserId===user.id,winnerId:match.winnerId,reason:match.reason||null,log:match.log,deadline:match.deadline}};
 }
 async function bodyOf(req){
  if(!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']||''))fail(415,'JSON_REQUIRED','写请求须使用 application/json。');
  if(Number(req.headers['content-length'])>BODY_LIMIT)fail(413,'BODY_TOO_LARGE','请求体过大。');
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>BODY_LIMIT)fail(413,'BODY_TOO_LARGE','请求体过大。');chunks.push(chunk);}
  try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body;}catch{fail(400,'INVALID_JSON','请求须为有效 JSON 对象。');}
 }
 async function route(req,res,url,body){
  const pathname=url.pathname,method=req.method,key=`${method} ${pathname}`;
  if(key==='GET /api/health')return {service:'qipai-jianghu',version:1,storage:'local',nodeRequirement:NODE_REQUIREMENT};
  if(key==='GET /api/session'){const {user,session}=userFor(req);return {user:user?publicUser(user):null,...(session?{expiresAt:session.expiresAt}:{})};}
  if(pathname==='/api/auth/register'||pathname==='/api/auth/login'){
   if(method!=='POST')fail(404,'NOT_FOUND','接口不存在。');
   rate(`auth:${req.socket.remoteAddress}`,30,900000);const input=credentials(body);let user=state.accounts.find(a=>a.key===input.key);
   if(pathname.endsWith('/register')){
    rate(`register:${req.socket.remoteAddress}`,10,3600000);
    if(user)fail(409,'USERNAME_EXISTS','账号已存在。');if(state.accounts.length>=1000)fail(429,'ACCOUNT_QUOTA','本机服务账号名额已满。');
    const salt=bytes(16).toString('hex'),digest=(await scrypt(input.password,salt,64)).toString('hex');
    user={id:`u-${token()}`,username:input.username,key:input.key,password:{algorithm:'scrypt',salt,digest},profile:null,revision:0,wins:0,losses:0,played:0,createdAt:now()};state.accounts.push(user);dirty=true;
   }else{
    // Unknown names still do the same scrypt work; generic error avoids account disclosure.
    const salt=user?.password.salt||'0'.repeat(32),candidate=await scrypt(input.password,salt,64),expected=Buffer.from(user?.password.digest||'0'.repeat(128),'hex');
    if(!user||!timingSafeEqual(candidate,expected))fail(401,'INVALID_CREDENTIALS','账号或密码错误。');
   }
   return loginSession(user,req,res);
  }
  if(key==='POST /api/auth/logout'){exact(body,[]);const {key:sessionKey,user:priorUser}=userFor(req);if(sessionKey)sessions.delete(sessionKey);queue=queue.filter(q=>q.id!==priorUser?.id);sessionCookie(res,'',req,true);return {user:null};}
  const {user}=auth(req);
  rate(`user:${user.id}`,180,60000);
  if(key==='GET /api/profile')return {profile:user.profile,revision:user.revision};
  if(key==='PUT /api/profile'){
   exact(body,['profile','expectedRevision']);if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)fail(400,'INVALID_REVISION','档案版本无效。');
   if(body.expectedRevision!==user.revision)fail(409,'REVISION_CONFLICT','远端档案已变化，请先下载或重新确认。',{revision:user.revision});
   if(Buffer.byteLength(JSON.stringify(body.profile??null))>PROFILE_LIMIT)fail(413,'PROFILE_TOO_LARGE','档案超过 512 KiB。');
   const check=validateProfile(body.profile);if(!check.valid)fail(400,'INVALID_PROFILE',check.errors[0]||'档案无效。');
   user.profile=check.profile;user.revision++;dirty=true;return {profile:user.profile,revision:user.revision};
  }
  if(key==='GET /api/leaderboard')return {entries:state.accounts.filter(u=>u.played>0).map(u=>({userId:u.id,username:u.username,wins:u.wins,losses:u.losses,played:u.played})).sort((a,b)=>b.wins-a.wins||a.losses-b.losses||a.username.localeCompare(b.username)).slice(0,100)};
  if(key==='GET /api/guilds')return {guilds:state.guilds.map(g=>({id:g.id,name:g.name,memberCount:g.members.length}))};
  if(key==='POST /api/guilds'){
   exact(body,['name']);const name=text(body.name,2,24,'公会名');if(state.guilds.some(g=>g.members.includes(user.id)))fail(409,'ALREADY_IN_GUILD','请先离开当前公会。');if(state.guilds.some(g=>g.name===name))fail(409,'GUILD_NAME_EXISTS','公会名已存在。');if(state.guilds.length>=200)fail(429,'GUILD_QUOTA','公会名额已满。');
   const g={id:`g-${token()}`,name,ownerId:user.id,members:[user.id],messages:[]};state.guilds.push(g);dirty=true;return {guild:guildView(g)};
  }
  const gm=/^\/api\/guilds\/(g-[a-f0-9]{48})(?:\/(join|leave|message))?$/.exec(pathname);
  if(gm){
   const g=state.guilds.find(g=>g.id===gm[1]);if(!g)fail(404,'GUILD_NOT_FOUND','公会不存在。');const action=gm[2];
   if(!action&&method==='GET'){if(!g.members.includes(user.id))fail(403,'GUILD_MEMBERS_ONLY','只有成员可查看公会详情。');return {guild:guildView(g)};}
   if(method!=='POST')fail(404,'NOT_FOUND','接口不存在。');exact(body,action==='message'?['text']:[]);
   if(action==='join'){
    if(state.guilds.some(g=>g.members.includes(user.id)))fail(409,'ALREADY_IN_GUILD','已加入公会。');if(g.members.length>=50)fail(429,'GUILD_FULL','公会成员已满。');g.members.push(user.id);
   }else{
    if(!g.members.includes(user.id))fail(403,'GUILD_MEMBERS_ONLY','只有公会成员可操作。');
    if(action==='leave'){g.members=g.members.filter(id=>id!==user.id);if(g.ownerId===user.id)g.ownerId=g.members[0]||null;if(!g.members.length)state.guilds=state.guilds.filter(other=>other!==g);}
    else if(action==='message'){rate(`message:${user.id}`,20,60000);const message=text(body.text,1,300,'消息');g.messages.push({id:`msg-${token()}`,userId:user.id,username:user.username,text:message,createdAt:now()});g.messages=g.messages.slice(-100);}
    else fail(404,'NOT_FOUND','接口不存在。');
   }
   dirty=true;return {guild:g.members.length?guildView(g):null};
  }
  if(key==='GET /api/arena/state')return arenaView(user);
  if(key==='POST /api/arena/cancel'){exact(body,[]);queue=queue.filter(q=>q.id!==user.id);return arenaView(user);}
  if(key==='POST /api/arena/queue'){
   exact(body,[]);const current=matchFor(user);if(current?.status==='active')return arenaView(user,current);
   if(queue.some(q=>q.id===user.id))return {queued:true,match:null};
   const waiting=queue.shift();if(!waiting){queue.push({id:user.id,until:now()+300000});return {queued:true,match:null};}
   const other=state.accounts.find(u=>u.id===waiting.id),players=[other,user].map(u=>({...publicUser(u),hp:100,shield:0,dice:Array.from({length:5},roll),rerolls:2}));
   const match={id:`m-${token()}`,version:1,status:'active',players,turnUserId:players[0].id,winnerId:null,log:[],deadline:now()+TURN_MS};state.matches.push(match);const finished=state.matches.filter(m=>m.status==='finished');if(finished.length>2000){const drop=new Set(finished.slice(0,finished.length-2000));state.matches=state.matches.filter(m=>!drop.has(m));}dirty=true;return arenaView(user,match);
  }
  if(key==='POST /api/arena/action'){
   exact(body,['matchId','expectedVersion','type','indices']);if(typeof body.matchId!=='string'||!Number.isSafeInteger(body.expectedVersion)||!['reroll','attack','forfeit'].includes(body.type))fail(400,'INVALID_ACTION','论剑动作无效。');
   const match=state.matches.find(m=>m.id===body.matchId&&m.players.some(p=>p.id===user.id));if(!match)fail(404,'MATCH_NOT_FOUND','对局不存在。');
   if(match.status!=='active')fail(409,'MATCH_FINISHED','对局已结束。');if(match.version!==body.expectedVersion)fail(409,'STALE_MATCH','对局版本已变化，请刷新。');
   const me=match.players.find(p=>p.id===user.id),other=match.players.find(p=>p.id!==user.id);
   if(body.type==='forfeit'){if(own(body,'indices'))fail(400,'INVALID_ACTION','投降无需骰子索引。');finish(match,other.id,'forfeit');return arenaView(user,match);}
   if(match.turnUserId!==user.id)fail(409,'NOT_YOUR_TURN','尚未轮到你。');
   if(body.type==='reroll'){
    const indices=body.indices;if(!Array.isArray(indices)||indices.length<1||indices.length>5||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>4))fail(400,'INVALID_INDICES','请选择 1–5 枚不同骰子。');if(me.rerolls<=0)fail(409,'NO_REROLLS','本轮重掷已用完。');for(const i of indices)me.dice[i]=roll();me.rerolls--;match.version++;
   }else{
    if(own(body,'indices'))fail(400,'INVALID_ACTION','攻击无需骰子索引。');const hand=evaluateDice(me.dice),damage=Math.floor(8*hand.multiplier),blocked=Math.min(other.shield,damage);other.shield-=blocked;other.hp=Math.max(0,other.hp-(damage-blocked));const shield=me.dice.filter(v=>v===1).length*2;me.shield=Math.min(30,me.shield+shield);
    match.log.push({type:'attack',userId:user.id,hand:hand.name,damage,blocked,shield,at:now()});match.log=match.log.slice(-40);match.version++;
    if(other.hp===0)finish(match,me.id,'defeat');else{match.turnUserId=other.id;other.dice=Array.from({length:5},roll);other.rerolls=2;match.deadline=now()+TURN_MS;}
   }
   dirty=true;return arenaView(user,match);
  }
  fail(404,'NOT_FOUND','接口不存在。');
 }
 const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon'};
 async function serveStatic(req,res,pathname){
  if(!['GET','HEAD'].includes(req.method))fail(404,'NOT_FOUND','资源不存在。');
  if(pathname==='/'){res.writeHead(302,{Location:'/demo/'});res.end();return;}
  const target=pathname==='/demo/'?'/demo/index.html':pathname;
  if(!/^\/demo\/[a-zA-Z0-9_-]+\.(?:html|mjs|css|svg|png|webp|jpg|ico)$/.test(target))fail(404,'NOT_FOUND','资源不存在。');
  let resolved;try{resolved=await realpath(path.join(rootDir,target));const allowed=await realpath(path.join(rootDir,'demo'));if(!resolved.startsWith(allowed+path.sep))throw new Error();if(!(await stat(resolved)).isFile())throw new Error();}catch{fail(404,'NOT_FOUND','资源不存在。');}
  const body=await readFile(resolved);res.writeHead(200,{'Content-Type':mime[path.extname(resolved)],'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
  let body,url;
  try{
   if((req.url||'').length>2048)fail(414,'URI_TOO_LONG','地址过长。');
   const rawPath=decodeURIComponent((req.url||'/').split('?')[0]);if(rawPath.includes('\\')||rawPath.split('/').some(p=>p==='..'||p==='.')||rawPath.includes('%'))fail(404,'NOT_FOUND','资源不存在。');
   const authority=req.headers.host||'';if(!/^[a-zA-Z0-9.\[\]:-]+$/.test(authority))fail(400,'INVALID_HOST','主机名无效。');
   url=new URL(req.url,`http://${authority}`);
   const allowedHosts=new Set(['127.0.0.1','localhost','[::1]',server.address()?.address,...(trustedOrigin?[new URL(trustedOrigin).hostname]:[])]);
   if(!allowedHosts.has(url.hostname))fail(403,'HOST_REJECTED','请求主机不受信任。');
   if(!url.pathname.startsWith('/api/'))return await serveStatic(req,res,rawPath);
   rate(`ip:${req.socket.remoteAddress}`,240,60000);
   const origin=req.headers.origin,expected=trustedOrigin||`${req.socket.encrypted?'https':'http'}://${authority}`;
   if(origin&&origin!==expected||['POST','PUT','DELETE','PATCH'].includes(req.method)&&origin!==expected)fail(403,'ORIGIN_REJECTED','请求来源不匹配。');
   if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   if(!['GET','POST','PUT'].includes(req.method))fail(404,'NOT_FOUND','接口不存在。');
   if(req.method!=='GET')body=await bodyOf(req);
   const run=async()=>{
    try{await ready;}catch{fail(503,'STORAGE_UNAVAILABLE','档案存储不可用。');}
    const before=structuredClone(state),oldQueue=structuredClone(queue);dirty=false;
    let payload,error;
    try{expire();payload=await route(req,res,url,body);}catch(caught){error=caught;}
    if(dirty){try{await persist();}catch{state=before;queue=oldQueue;fail(503,'STORAGE_UNAVAILABLE','档案保存失败，请重试。');}}
    if(error)throw error;return payload;
   };
   const operation=chain.then(run);chain=operation.catch(()=>{});const payload=await operation;
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({ok:true,...payload}));
  }catch(error){
   if(res.headersSent){res.destroy();return;}
   const status=error instanceof HttpError?error.status:error instanceof URIError?404:500;
   res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...(status===429?{'Retry-After':'60'}:{})});res.end(JSON.stringify({ok:false,error:error instanceof HttpError?error.message:status===404?'资源不存在。':'服务暂时不可用。',code:error instanceof HttpError?error.code:status===404?'NOT_FOUND':'INTERNAL_ERROR',...(error instanceof HttpError?error.details:{})}));
  }
 });
 server.maxConnections=128;server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
 return server;
}
