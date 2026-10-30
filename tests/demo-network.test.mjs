import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {createProfile} from '../demo/profile.mjs';
const serverModule=await import('../server/server.mjs').catch(()=>null);
const clientModule=await import('../demo/network.mjs').catch(()=>null);
const rootDir=path.resolve(import.meta.dirname,'..');
async function harness(t,options={}){
 assert.ok(serverModule,'real game server must exist');assert.ok(clientModule,'browser network client must exist');
 const dataDir=await mkdtemp(path.join(tmpdir(),'qipai-network-'));let server;
 async function start(){server=serverModule.createGameServer({dataDir,rootDir,...options});server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;}
 let baseUrl=await start();
 async function stop(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 t.after(async()=>{await stop();await rm(dataDir,{recursive:true,force:true});});
 function browser(){let cookie='';const client=clientModule.createNetworkClient({baseUrl,fetch:async(url,init={})=>{const res=await fetch(url,{...init,headers:{...init.headers,Origin:baseUrl,...(cookie?{Cookie:cookie}:{})}});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;}});return {client,raw:(url,init={})=>fetch(baseUrl+url,{...init,headers:{Origin:baseUrl,...(cookie?{Cookie:cookie}:{}),...init.headers}})};}
 return {browser,dataDir,get url(){return baseUrl;},restart:async()=>{await stop();baseUrl=await start();}};
}
const reject=async(p,status,code)=>assert.rejects(p,e=>e.status===status&&(!code||e.code===code));
test('portrait chapter modules and textures load without opening unrelated nested directories',async t=>{
 const h=await harness(t);
 for(const [resource,mime]of [['/demo/renewal/main.mjs','text/javascript; charset=utf-8'],['/demo/renewal/assets/characters.png','image/png'],['/demo/renewal/assets/forest-path.png','image/png']]){
  const response=await fetch(h.url+resource);assert.equal(response.status,200,resource);assert.equal(response.headers.get('content-type'),mime);assert.ok(Number(response.headers.get('content-length'))>0);
 }
 for(const resource of ['/demo/renewal/assets/README.md','/demo/other/private.mjs','/demo/renewal/%2e%2e/%2e%2e/server/server.mjs','/server/server.mjs'])assert.equal((await fetch(h.url+resource)).status,404,resource);
});
test('real HTTP sessions hash passwords, isolate profiles, serialize revisions and survive restart',async t=>{
 const h=await harness(t);const a=h.browser().client,b=h.browser().client;
 assert.deepEqual((await a.session()).user,null);await reject(a.loadProfile(),401);
 const alice=await a.register('云剑客','safe-password-A');await b.register('other-player','safe-password-B');assert.equal(alice.user.username,'云剑客');
 await reject(a.register('云剑客','safe-password-A'),409);await reject(b.login('云剑客','wrong-password'),401);
 const p=createProfile(9,0);assert.equal((await a.loadProfile()).revision,0);
 const saves=await Promise.allSettled([a.saveProfile(p,0),a.saveProfile(p,0)]);assert.equal(saves.filter(s=>s.status==='fulfilled').length,1);assert.equal(saves.find(s=>s.status==='rejected').reason.status,409);
 assert.equal((await b.loadProfile()).profile,null);assert.deepEqual((await a.loadProfile()).profile,p);
 const disk=await readFile(path.join(h.dataDir,'state.json'),'utf8');assert.ok(!disk.includes('safe-password-A'));assert.ok(!disk.includes('safe-password-B'));assert.ok(!disk.includes('qipai_session'));
 await h.restart();const fresh=h.browser().client;await fresh.login('云剑客','safe-password-A');assert.equal((await fresh.loadProfile()).revision,1);await fresh.logout();await reject(fresh.loadProfile(),401);
});
test('HTTP rejects CSRF, malformed data, traversal, oversized input and untrusted profile keys',async t=>{
 const h=await harness(t),a=h.browser();await a.client.register('security','safe-password');
 const csrf=await a.raw('/api/profile',{method:'PUT',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 const absent=await fetch(h.url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(absent.status,403);
 assert.equal((await a.raw('/api/profile',{method:'PUT',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
 assert.equal((await a.raw('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
 assert.equal((await a.raw('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:'x'.repeat(800000)})})).status,413);
 await reject(a.client.saveProfile({...createProfile(),password:'oops'},0),400);
 for(const url of ['/server/state.json','/.git/config','/demo/%2e%2e/server/server.mjs','/demo/%252e%252e/server/server.mjs'])assert.equal((await a.raw(url)).status,404);
 assert.equal((await a.raw('/')).status,200);assert.equal((await a.raw('/demo/main.mjs')).status,200);
 assert.equal((await a.raw('/api/session')).headers.get('access-control-allow-origin'),h.url);
});
test('guild membership and messages are real, bounded and persistent',async t=>{
 const h=await harness(t),a=h.browser().client,b=h.browser().client;await a.register('guild-one','safe-password');await b.register('guild-two','safe-password');
 const {guild:g}=await a.createGuild('清风会');assert.equal((await a.listGuilds()).guilds[0].mine,true);assert.equal((await b.listGuilds()).guilds[0].mine,false);await reject(b.sendMessage(g.id,'intruder'),403);await b.joinGuild(g.id);const message=await b.sendMessage(g.id,'一起论剑');assert.equal(message.guild.messages[0].text,'一起论剑');assert.equal((await a.guild(g.id)).guild.members.length,2);await reject(a.createGuild('重复'),409);
 await b.leaveGuild(g.id);await reject(b.guild(g.id),403);assert.equal((await a.listGuilds()).guilds[0].memberCount,1);
 await h.restart();const c=h.browser().client;await c.login('guild-one','safe-password');assert.equal((await c.guild(g.id)).guild.messages.length,1);
});
test('arena waits for a human and validates ownership, versions, dice and server-only results',async t=>{
 const h=await harness(t),a=h.browser().client,b=h.browser().client,c=h.browser().client;await a.register('arena-one','safe-password');await b.register('arena-two','safe-password');await c.register('arena-three','safe-password');
 assert.equal((await a.queue()).queued,true);assert.equal((await a.arena()).match,null);const joined=await b.queue();assert.equal(joined.match.status,'active');let sa=await a.arena(),sb=await b.arena();assert.equal(sa.match.you.hp,100);assert.equal(sa.match.you.dice.length,5);assert.equal(sa.match.opponent.dice,undefined);assert.equal(sb.match.id,sa.match.id);
 const active=sa.match.isYourTurn?a:b,passive=sa.match.isYourTurn?b:a;let s=(await active.arena()).match;
 await reject(passive.action({matchId:s.id,expectedVersion:s.version,type:'attack'}),409);await reject(c.action({matchId:s.id,expectedVersion:s.version,type:'attack'}),404);
 await reject(active.action({matchId:s.id,expectedVersion:s.version,type:'attack',damage:10000}),400);await reject(active.action({matchId:s.id,expectedVersion:s.version,type:'reroll',indices:[0,0]}),400);
 const rolled=await active.action({matchId:s.id,expectedVersion:s.version,type:'reroll',indices:[0,2]});assert.equal(rolled.match.you.rerolls,1);await reject(active.action({matchId:s.id,expectedVersion:s.version,type:'attack'}),409);s=rolled.match;
 const attack=await active.action({matchId:s.id,expectedVersion:s.version,type:'attack'});assert.equal(attack.match.isYourTurn,false);assert.ok(attack.match.opponent.hp<100);
 const ended=await passive.action({matchId:s.id,expectedVersion:attack.match.version,type:'forfeit'});assert.equal(ended.match.status,'finished');await reject(passive.action({matchId:s.id,expectedVersion:ended.match.version,type:'forfeit'}),409);
 const board=(await a.leaderboard()).entries;assert.equal(board.reduce((n,row)=>n+row.wins,0),1);assert.equal(board.reduce((n,row)=>n+row.losses,0),1);assert.equal(board.some(row=>row.username==='arena-three'),false);
 await h.restart();const d=h.browser().client;await d.login('arena-one','safe-password');assert.equal((await d.leaderboard()).entries.reduce((n,row)=>n+row.wins,0),1);
});
test('active match restores across restart and an expired turn records one forfeit',async t=>{
 let timestamp=1000;const h=await harness(t,{now:()=>timestamp}),a=h.browser().client,b=h.browser().client;await a.register('restore-one','safe-password');await b.register('restore-two','safe-password');await a.queue();await b.queue();const before=(await a.arena()).match;await h.restart();const c=h.browser().client;await c.login('restore-one','safe-password');assert.deepEqual((await c.arena()).match,before);timestamp+=120001;assert.equal((await c.arena()).match.status,'finished');await c.arena();assert.equal((await c.leaderboard()).entries.reduce((n,r)=>n+r.wins,0),1);
});
test('request rate limits and account registration quota return bounded JSON errors',async t=>{
 const h=await harness(t);let last;for(let i=0;i<11;i++)last=await fetch(h.url+'/api/auth/register',{method:'POST',headers:{Origin:h.url,'Content-Type':'application/json'},body:JSON.stringify({username:`quota${i}`,password:'safe-password'})});assert.equal(last.status,429);assert.equal((await last.json()).ok,false);
});
test('loopback service rejects DNS rebinding hosts and counts profile limits in UTF-8 bytes',async t=>{
 const h=await harness(t),a=h.browser();await a.client.register('origin-case','safe-password');
 const hostile=await new Promise((resolve,reject)=>{const req=httpRequest(h.url+'/api/health',{headers:{Host:'evil.example',Origin:'http://evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(hostile,403);
 await reject(a.client.saveProfile({...createProfile(),extra:'江'.repeat(190000)},0),413);
});
test('completed players can queue again without showing an old match or self matching',async t=>{
 const h=await harness(t),a=h.browser().client,b=h.browser().client;await a.register('repeat-one','safe-password');await b.register('repeat-two','safe-password');await a.queue();const s=(await b.queue()).match;await b.action({matchId:s.id,expectedVersion:s.version,type:'forfeit'});await a.queue();assert.deepEqual(await a.arena(),{ok:true,queued:true,match:null});assert.deepEqual(await a.queue(),{ok:true,queued:true,match:null});await a.logout();await a.login('repeat-one','safe-password');assert.equal((await a.arena()).queued,false);
});
test('normal attacks can finish a match and two rerolls are enforced with private opponent dice',async t=>{
 const h=await harness(t),a=h.browser().client,b=h.browser().client;await a.register('combat-one','safe-password');await b.register('combat-two','safe-password');await a.queue();await b.queue();
 let current=a,s=(await a.arena()).match;
 if(!s.isYourTurn){current=b;s=(await b.arena()).match;}
 for(let i=0;i<2;i++)s=(await current.action({matchId:s.id,expectedVersion:s.version,type:'reroll',indices:[0]})).match;
 await reject(current.action({matchId:s.id,expectedVersion:s.version,type:'reroll',indices:[0]}),409,'NO_REROLLS');
 for(let turns=0;s.status==='active'&&turns<100;turns++){
  s=(await current.action({matchId:s.id,expectedVersion:s.version,type:'attack'})).match;
  if(s.status==='active'){current=current===a?b:a;s=(await current.arena()).match;assert.equal(s.opponent.dice,undefined);assert.equal(s.you.rerolls,2);}
 }
 assert.equal(s.status,'finished');assert.equal(s.reason,'defeat');const board=(await a.leaderboard()).entries;assert.equal(board.reduce((n,r)=>n+r.wins,0),1);
});
test('default entry redirects to demo directory and its actual relative script and stylesheet load',async t=>{
 const h=await harness(t);
 const entry=await fetch(h.url+'/',{redirect:'manual'});assert.equal(entry.status,302);assert.equal(entry.headers.get('location'),'/demo/');
 const page=await fetch(new URL(entry.headers.get('location'),h.url));assert.equal(page.status,200);assert.equal(page.headers.get('content-type'),'text/html; charset=utf-8');
 const html=await page.text(),script=/<script\b[^>]*\bsrc="([^"]+)"/i.exec(html)?.[1],stylesheet=/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/i.exec(html)?.[1];assert.ok(script,'entry HTML references script');assert.ok(stylesheet,'entry HTML references stylesheet');
 for(const [resource,mime]of [[script,'text/javascript; charset=utf-8'],[stylesheet,'text/css; charset=utf-8']]){const response=await fetch(new URL(resource,page.url));assert.equal(response.status,200,resource);assert.equal(response.headers.get('content-type'),mime,resource);assert.ok((await response.text()).length>0,resource);}
 const head=await fetch(h.url+'/',{method:'HEAD',redirect:'manual'});assert.equal(head.status,302);assert.equal(head.headers.get('location'),'/demo/');assert.equal(await head.text(),'');
 assert.equal((await fetch(h.url+'/main.mjs')).status,404,'root whitelist remains closed');
});
