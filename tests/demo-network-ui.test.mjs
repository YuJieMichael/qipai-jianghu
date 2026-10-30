import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../demo/network-ui.mjs').catch(()=>null);
test('network panel presents real accounts and explicit profile sync without retaining credentials',()=>{
 assert.ok(api,'network panel must exist');const html=api.renderNetworkPanel({status:'offline',user:null,password:'NEVER ECHO',username:'NEVER ECHO'});assert.ok(html.includes('本机服务端'));assert.ok(html.includes('未连接'));assert.ok(html.includes('type="password"'));assert.ok(html.includes('autocomplete="current-password"'));assert.ok(!html.includes('NEVER ECHO'));assert.ok(!html.includes('全球'));
 const online=api.renderNetworkPanel({user:{id:'u1',username:'剑客'},profileRevision:3});assert.ok(online.includes('上传本机档案'));assert.ok(online.includes('下载远端档案'));assert.ok(online.includes('版本 3'));assert.ok(online.includes('匹配真人对手'));
});
test('network panel escapes server fields and disables attack/reroll on opponent turn',()=>{
 assert.ok(api);const bad='<img src=x onerror="alert(1)">';const html=api.renderNetworkPanel({user:{id:'u1',username:bad},error:bad,baseUrl:bad,entries:[{username:bad,wins:1,losses:0,played:1}],guilds:[{id:bad,name:bad,memberCount:1}],guild:{id:bad,name:bad,members:[{username:bad}],messages:[{username:bad,text:bad}]},match:{id:'m1',version:4,status:'active',you:{id:'u1',username:bad,hp:100,shield:0,dice:[1,2,3,4,5],rerolls:2},opponent:{id:'u2',username:bad,hp:80,shield:0},isYourTurn:false,log:[{type:'attack',hand:bad,damage:12}]}});assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));for(const type of ['attack','reroll','select-die']){const button=html.match(new RegExp(`<button[^>]+data-value="[^\"]*&quot;type&quot;:&quot;${type}&quot;[^\"]*"[^>]*>`));assert.ok(button,`${type} exists`);assert.ok(button[0].includes('disabled'),`${type} disabled`);}
 assert.ok(html.includes('等待对手行动'));assert.ok(!html.includes('[object Object]'));
});
test('network action collection reads only relevant fields and keeps numeric die indices',()=>{
 assert.ok(api);const field=(name,value)=>({name,value,dataset:{networkField:name}});const fields=[field('username','玩家'),field('password','secret12'),field('name','ignored')];const button={dataset:{value:'{"type":"login"}'},closest:()=>({querySelectorAll:()=>fields}),disabled:false};assert.deepEqual(api.collectNetworkAction(button),{type:'network',value:{type:'login',username:'玩家',password:'secret12'}});button.dataset.value='{"type":"select-die","index":2}';assert.deepEqual(api.collectNetworkAction(button),{type:'network',value:{type:'select-die',index:2}});button.disabled=true;assert.equal(api.collectNetworkAction(button),null);
});
