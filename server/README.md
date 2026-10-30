# 七派江湖真实本机服务

Node.js **22 或更新**，已用 **26.11.0** 验证；仅用 Node 标准库，无需 npm install。在仓库根目录运行：

```sh
node server/start.mjs
```

打开终端显示的 `http://127.0.0.1:8768/`，这里提供完整 demo 与 `/api`。默认仅监听回环地址，不会部署到公网。使用两个浏览器独立资料或无痕窗口注册两个账号，分别点「匹配真人对手」。同一浏览器的标签页共享账号 cookie。

| 环境变量 | 默认 | 用途 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址 |
| `PORT` | `8768` | HTTP 端口 |
| `QIPAI_DATA_DIR` | `server/data` | 持久数据目录，默认已 gitignore |
| `QIPAI_PUBLIC_ORIGIN` | 空 | 自托管 HTTPS 反向代理的精确来源，例如 `https://game.example.org` |

数据目录由进程创建，目录模式 0700、档案文件 0600。每个目录只运行 **一个** Node 进程；不可用多个进程同时写同一 JSON 文件。写操作与 API 状态转移在进程内串行执行；状态文件先写临时文件、fsync，再原子替换 `state.json`。备份时先正常停止进程，再复制数据目录。损坏的既有状态文件使 API 返回 503，不会自动覆盖为新库。

## 身份与同步

账号为 2–24 个 Unicode 文字、数字、`_` 或 `-`；使用 NFKC 正规化且不区分大小写。密码 8–128 个字符，使用随机 16 字节盐和 scrypt 64 字节摘要持久化。不会保存明文密码。成功登录替换当前会话，cookie 为随机令牌、HttpOnly、SameSite=Strict、24 小时有效；服务重启后需重新登录。每账号最多 5 个会话，总共 5000 个。

上传仅由用户点击「上传本机档案」触发。远端从 revision 0、profile null 开始。PUT 必须提供读取到的 expectedRevision；同一旧版本的并发上传只有一个成功，另一个返回 409 / REVISION_CONFLICT 和当前 revision，不返回任何别人的档案。下载与覆盖本机的决定由 UI 明确操作。客户端不会轮询上传或自动合并。远端档案可修改，不作为竞技分数来源。

## HTTP 契约

所有 API 返回 JSON：成功 `{ok:true,...}`；失败 `{ok:false,error,code}`。常见状态 400 输入错误、401 未登录、403 来源或成员资格错误、404 不存在、409 版本/状态冲突、413 超额、415 非 JSON、429 限流、503 存储不可用。除 health/session/auth 外均需登录。

写请求必须 `Content-Type: application/json` 且 `Origin` 与服务来源完全一致。GET 若携带 Origin 也须匹配。浏览器应直接打开该服务上的 app；跨端口的页面不属于同源，不开放宽泛 CORS。无 Origin 的 curl 写请求亦会被拒绝。Host 默认只接受 loopback、监听 IP 或配置的 PUBLIC_ORIGIN 主机，防止 DNS 重绑定。

| 路由 | body | 主要成功字段 |
| --- | --- | --- |
| GET `/api/health` | — | service,version,storage,nodeRequirement |
| GET `/api/session` | — | user:null 或 {id,username},expiresAt? |
| POST `/api/auth/register` | {username,password} | user,expiresAt |
| POST `/api/auth/login` | {username,password} | user,expiresAt |
| POST `/api/auth/logout` | {} | user:null |
| GET `/api/profile` | — | profile,revision |
| PUT `/api/profile` | {profile,expectedRevision} | profile,revision |
| GET `/api/leaderboard` | — | entries:[{userId,username,wins,losses,played}] |
| GET `/api/guilds` | — | guilds:[{id,name,memberCount}] |
| POST `/api/guilds` | {name} | guild |
| GET `/api/guilds/:id` | — | guild（仅成员） |
| POST `/api/guilds/:id/join` | {} | guild |
| POST `/api/guilds/:id/leave` | {} | guild（空会解散时为 null） |
| POST `/api/guilds/:id/message` | {text} | guild |
| POST `/api/arena/queue` | {} | queued,match |
| POST `/api/arena/cancel` | {} | queued,match |
| GET `/api/arena/state` | — | queued,match |
| POST `/api/arena/action` | {matchId,expectedVersion,type,indices?} | queued,match |

`guild` 为 `{id,name,ownerId,members:[{id,username}],messages:[{id,userId,username,text,createdAt}]}`。每人只能加入一家，最多 50 成员；会长离开自动交给下一位。消息最多 300 字，保留最后 100 条。

`match` 为 null 或 `{id,version,status,you,opponent,turnUserId,isYourTurn,winnerId,reason,log,deadline}`。`status` 为 active/finished；you 为 `{id,username,hp,shield,dice:[5个1..6点],rerolls}`；opponent 只包含 `{id,username,hp,shield}`。deadline 为毫秒 Unix 时间。log 保留最多 40 条，attack 包含 userId,hand,damage,blocked,shield,at；finish 包含 winnerId,reason,at。

双方初始 HP 100，攻击 8，五枚标准骰，每回合两次重掷。`type:'reroll'` 必须有 1–5 个不重复、0–4 的 indices；`type:'attack'|'forfeit'` 不接受 indices。攻击使用现有 evaluateDice 牌型倍率，伤害向下取整为 8 × 倍率，先扣对手护盾，再扣 HP。攻击后自己每枚点数 1 获得 2 护盾，上限 30。攻击后交替回合并自动掷新骰，120 秒未行动判负；重掷不延长回合时间。forfeit 可在任意一方回合执行。服务端不接受自报骰面、伤害、分数或胜负，未知字段直接拒绝。

首位排队玩家先手。队列只配对两位真实账号，不生成机器人；队列五分钟过期，注销取消该账号排队，重启清空队列。**进行中的对局状态持久化，重启后可原样继续；若期限已过，下一次 API 访问时结算一次超时判负。** 没有后台计时 daemon，访问 API 才推进超时结算。比赛状态与胜负计数在同一次原子写中落盘；旧版本或已完成比赛不能再次计分。保留最多 2000 个已完成对局，战绩累计保留；排行榜仅包含已参赛账号，最多 100 人。

## 浏览器模块

`demo/network.mjs` 导出 `createNetworkClient({fetch=globalThis.fetch,baseUrl=''})`。fetch 可注入独立 cookie jar 以集成测试。方法均返回上述 JSON，失败抛出 NetworkError，字段为 message/status/code/payload；网络不可用 status=0/code=NETWORK_UNAVAILABLE，请求 15 秒超时。

```js
const client = createNetworkClient();
await client.health(); await client.session();
await client.register(username,password); await client.login(username,password); await client.logout();
await client.loadProfile(); await client.saveProfile(profile,expectedRevision);
await client.leaderboard(); await client.listGuilds();
await client.createGuild(name); await client.joinGuild(id); await client.leaveGuild(id);
await client.guild(id); await client.sendMessage(id,text);
await client.queue(); await client.cancelQueue(); await client.arena();
await client.action({matchId,expectedVersion,type:'reroll',indices:[0,2]});
```

`demo/network-ui.mjs` 导出 `renderNetworkPanel(state)` 与 `collectNetworkAction(button)`；纯展示，不读本机档案、不请求网络。后者从按钮所在表单即时读取字段，返回 `{type:'network',value:{type,...}}`，密码不需要写入 UI state。按钮事件、轮询与覆盖下载控制由根 controller 管理。

## 配额与静态资源

全库 1000 个账号、200 家公会；单档案最多 512 KiB（UTF-8），请求体 768 KiB。每 IP 240 API 请求/分钟，认证 30/15 分钟，注册 10/小时；每用户 180 API 请求/分钟，发言 20/分钟。限流在内存中，重启清空；绑定默认 loopback 供本机使用。最多 128 个同时连接，15 秒 request timeout。静态服务仅开放 demo 目录内单层白名单扩展名文件；不提供 server、.git、.superpowers、数据或任意磁盘路径。

## 自托管边界

公网托管需你自行提供域名、主机、TLS 证书及 HTTPS 反向代理，将 PUBLIC_ORIGIN 配成浏览器访问的唯一精确来源；HTTPS 时设置 Secure cookie。域名、收费服务、远端数据库不会自动创建。代理必须将请求发往 Node，并保留 Host，或使用配置的来源；不要将整个仓库作为静态目录。绑定公网/LAN 地址应是明确的运维决定。此 JSON 单进程服务适用于个人/小规模自托管；没有邮件找回、管理后台、分布式限流和多进程数据库。

验证：`node --test tests/demo-network.test.mjs tests/demo-network-ui.test.mjs`；全套：`node --test tests/*.test.mjs`。集成测试用临时数据目录和随机端口，真实两个 HTTP cookie 客户端，不使用生产 8768 端口。
