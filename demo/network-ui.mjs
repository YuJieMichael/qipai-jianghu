const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,type,fields={},disabled=false,extra='')=>`<button type="button" class="hub-button" data-action="network" data-value="${esc(JSON.stringify({type,...fields}))}" ${disabled?'disabled':''} ${extra}>${esc(label)}</button>`;
const card=(title,body)=>`<article class="hub-card"><div class="hub-card-head"><h3>${esc(title)}</h3></div><div class="hub-card-body">${body}</div></article>`;
const actions=body=>`<div class="hub-actions">${body}</div>`;
const input=(name,label,options='')=>`<label class="hub-field"><span>${esc(label)}</span><input name="${name}" data-network-field="${name}" ${options}></label>`;
const form=body=>`<form class="hub-form" onsubmit="return false">${body}</form>`;
const number=value=>esc(Number.isFinite(Number(value))?Number(value):0);
function logLine(log,match){
 const name=log.userId===match.you?.id?'你':match.opponent?.username||'对手';
 if(log.type==='attack')return `${name}使出${log.hand||'散招'}，伤害 ${Number(log.damage)||0}，抵挡 ${Number(log.blocked)||0}，获得护盾 ${Number(log.shield)||0}。`;
 if(log.type==='finish')return `对局结束：${{forfeit:'投降',timeout:'回合超时',defeat:'气血耗尽'}[log.reason]||'已结算'}。`;
 return '对局状态更新。';
}
export function renderNetworkPanel(state={}){
 const {user=null,busy=false,error='',message='',entries=[],guilds=[],guild=null,queued=false,match=null,selected=[]}=state;
 const connected=Boolean(user)||['connected','online','ready'].includes(state.status),disabled=busy||!user;
 let html=`<section class="hub-section" aria-label="真实本机联网"><div class="hub-section-heading"><h2>本机服务端 · 江湖会友</h2><p>${connected?'已连接':'未连接'} · 账号、档案、公会与真人论剑来自你连接的 Node 服务。可在本机启动，也可自行托管。</p></div>${error?`<p role="alert">${esc(error)}</p>`:''}${message?`<p role="status">${esc(message)}</p>`:''}`;
 html+=card('连接与账号',`<p>同源服务默认无需填地址。${esc(state.baseUrl||'当前页面 /api')} · ${busy?'请求中…':'可手动刷新'}</p>${actions(btn('刷新连接','refresh',{},busy))}${form(input('baseUrl','服务地址（留空使用同源）',`type="url" placeholder="http://127.0.0.1:8768" value="${esc(state.baseUrl||'')}"`)+actions(btn('设置服务地址','set-server',{},busy)))}${user?`<p>已登录：<strong>${esc(user.username)}</strong></p>${actions(btn('退出账号','logout',{},busy))}`:form(input('username','账号 · 2–24 字符','type="text" minlength="2" maxlength="24" autocomplete="username" required')+input('password','密码 · 8–128 字符','type="password" minlength="8" maxlength="128" autocomplete="current-password" required')+actions(btn('注册并登录','register',{},busy)+btn('登录','login',{},busy)))}`);
 if(!user)return html+'<p>登录后可手动同步档案、加入公会、等待真人对手。服务未启动时，启动 Node 服务后点刷新连接。</p></section>';
 html+=`<div class="hub-grid">${card('账号档案',`<p>远端版本 ${number(state.profileRevision)}。上传保存本机档案；下载会替换当前本机门庭。版本冲突时请先下载核对，再自行决定。</p><p>档案不会自动上传。竞技胜负只由服务端对局记录。</p>${actions(btn('上传本机档案','save-profile',{},disabled)+btn('下载远端档案','load-profile',{},disabled))}`)}${card('真人战绩榜',`${actions(btn('刷新战绩榜','leaderboard',{},disabled))}<p>仅显示已完成真人对局的账号。</p>${entries.length?`<ol>${entries.map(row=>`<li>${esc(row.username)} · ${number(row.wins)} 胜 / ${number(row.losses)} 负 · ${number(row.played)} 场</li>`).join('')}</ol>`:'<p>尚无已完成的真人对局。</p>'}`)}</div>`;
 html+=card('公会会馆',`${actions(btn('刷新公会','guilds',{},disabled))}${guild?`<p><strong>${esc(guild.name)}</strong> · 成员 ${(guild.members||[]).map(member=>esc(member.username)).join('、')}</p>${actions(btn('刷新会馆','guild',{id:guild.id},disabled)+btn('离开公会','leave-guild',{id:guild.id},disabled))}<ul>${(guild.messages||[]).map(row=>`<li><strong>${esc(row.username)}</strong>：${esc(row.text)}</li>`).join('')||'<li>还没有消息。</li>'}</ul>${form(input('text','公会消息 · 最多 300 字','type="text" maxlength="300" autocomplete="off" required')+actions(btn('发送消息','message',{id:guild.id},disabled)))}`:`${form(input('name','新公会名称 · 2–24 字','type="text" minlength="2" maxlength="24" autocomplete="off" required')+actions(btn('创建公会','create-guild',{},disabled)))}${guilds.length?`<ul>${guilds.map(row=>`<li>${esc(row.name)} · ${number(row.memberCount)} 位成员 ${btn('加入公会','join-guild',{id:row.id},disabled)}</li>`).join('')}</ul>`:'<p>暂无公会，可创建第一家。</p>'}`}`);
 let arena=`<p>双方气血 100、攻击 8、五枚标准骰；每轮可重掷两次。牌型决定倍率，点数 1 每枚在攻击后获得 2 护盾，上限 30。回合 120 秒超时判负。</p>${actions(btn('匹配真人对手','queue',{},disabled||queued||match?.status==='active')+btn('刷新对局','arena',{},disabled)+(queued?btn('取消等待','cancel',{},disabled):''))}`;
 if(queued)arena+='<p role="status">等待真人对手加入；不会生成机器人。等待最多 5 分钟，可随时取消。</p>';
 if(match){
  const active=match.status==='active',turn=active&&match.isYourTurn,locked=disabled||!turn,me=match.you||{},op=match.opponent||{};
  arena+=`<p><strong>${esc(me.username||'你')}</strong> · 气血 ${number(me.hp)} / 100 · 护盾 ${number(me.shield)}<br><strong>${esc(op.username||'对手')}</strong> · 气血 ${number(op.hp)} / 100 · 护盾 ${number(op.shield)}</p><p>对局版本 ${number(match.version)} · ${active?(turn?'轮到你出招':'等待对手行动'):`已结束 · ${match.winnerId===me.id?'你获胜':'对手获胜'}`} · 可重掷 ${number(me.rerolls)} 次</p><div class="hub-actions" role="group" aria-label="选择要替换的骰子">${(me.dice||[]).map((value,index)=>btn(`骰 ${index+1} · ${value}${selected.includes(index)?' · 已选替换':''}`,'select-die',{index},locked,`aria-pressed="${selected.includes(index)}"`)).join('')}</div>${actions(btn('重掷已选骰子','reroll',{},locked||me.rerolls<=0||!selected.length)+btn('出招','attack',{},locked)+btn('投降','forfeit',{},disabled||!active))}<p>对手的骰面保持隐藏。选择骰子后重掷，或直接出招。</p><ul aria-label="公开战况">${(match.log||[]).slice(-10).map(log=>`<li>${esc(logLine(log,match))}</li>`).join('')||'<li>双方已就位。</li>'}</ul>`;
 }
 return html+card('回合制骰子论剑',arena)+'</section>';
}
/** Read credentials directly from the clicked form; the controller need not keep them in UI state. */
export function collectNetworkAction(button){
 if(!button||button.disabled)return null;
 let descriptor;try{descriptor=JSON.parse(button.dataset.value);}catch{return null;}
 if(!descriptor||typeof descriptor.type!=='string')return null;
 const wanted={register:['username','password'],login:['username','password'],'create-guild':['name'],message:['text'],'set-server':['baseUrl']}[descriptor.type]||[];
 for(const field of button.closest?.('form')?.querySelectorAll?.('[data-network-field]')||[]){const name=field.dataset.networkField;if(wanted.includes(name))descriptor[name]=field.value;}
 return {type:'network',value:descriptor};
}
