# 七派江湖 · 深度系统与联机扩展设计

用户已要求将上一轮列出的所有方向加入，并已授权自动实施与子代理并行。目标是可玩、可修改、可回滚；不是菜单占位。沿用现有ES modules/Canvas/DOM，不改根index.html和原版存档。

## 交付范围

1. 装备：战斗掉落、首领专属掉落、品质进阶、随机副词条、按品质解锁被动、批量合成/分解、三套配装保存/载入及对比；保留现有全部自由试配库存。
2. 深度洗练：装备/遗物/符文的多词条候选与逐词条锁定、接受/取消、重铸、遗物分解返还、品质共鸣；池/成本可修改。
3. 局内：成长稀有度与权重、前置分支、有限刷新/禁选；商人库存含技能/遗物/装饰；带代价奇遇、诅咒和分岔路线，均影响后续战斗或收益。
4. 内容：七章各有不同布局/敌群/名称/剧情事件，至少七种章节场景主题；精英词缀，首领至少三类机制并有阶段/破招可见反馈，奖励/成长/营火仍可保存继续。
5. 长期目标：UTC日/周任务循环、随机商店刷新与库存/限购、收藏发现、首通奖励和塔里程碑；本机时钟回退不能重复领奖。
6. 表现：原创装备/遗物/符文图标，角色装备外观、剑杖锤差异动作，技能/首领阶段演出、可跳过掉落展示、新手引导；减少动态与静音继续有效。
7. 可视化修改：表单编辑装备/词条池/掉落/敌群/章节/奖励/经济/技能配置，校验后应用；完整JSON仍保留；本地配置快照/恢复，掉落概率预览与真实规则模拟报告。
8. 服务端：真实注册/登录/注销、账号档案版本化同步、排行榜、公会创建加入离开/成员/消息、两个真实账号的回合制骰子论剑。默认本机127.0.0.1，不伪装全球玩家或云部署。提供可自托管Node服务和部署说明；外部域名/托管/收费项目不凭空创建。

## 架构与公共契约

- CONTENT.version/profile.version仍为1；内容新增可选`expansion`，旧JSON自动采用默认扩展。旧profile新增可选`expansion`，validate/load规范化至默认值。旧run版本1/2/3不重抽骰；新字段均可选，当前旧旅程仍按快照继续。
- 档案扩展由profile/content所有者独占实现；导出API保持现状，beginExpedition可新增第二`{now}`参数。applyProfileAction处理所有扩展动作，仍返回`{profile,message}`，失败保持原对象。新增`getExpansionView(profile,{now})`返回UI所需派生状态，`ensureExpansion(profile)`可导出便于读取旧档案。
- `CONTENT.expansion`公共顶层：`affixes`(array{id,name,key,min,max}),`loot`({chance,bossChance,rarityWeights,affixCount}),`gear`(costs/limits/passiveRules),`refining`(costs/lockCost/pools),`cycles`(daily/weekly/firstClear/towerMilestones),`market`(slots/limit/refreshCost),`rogue`(rarityWeights/refreshCost/maxRefresh/maxBans),`encounters`(choices/curseRules),`chapterRoutes`(map chapterId→node descriptor array)。允许其他owner内部子字段，但公共字段不得更名。
- 初始默认扩展由新`demo/expansion-content.mjs`提供DEFAULT_EXPANSION；装备所有者写此文件并实现validateExpansion，content.mjs合并调用。关卡所有者独占新`demo/chapter-content.mjs`，导出CHAPTER_ROUTES；expansion-content导入它设默认chapterRoutes。服务端不依赖此新文件的导出以外细节。
- 新战斗掉落只写run快照`loot:[{id,templateId,affixes:[{key,value}],source}]`，id在本局唯一；模板来自当局content，词条来自当局expansion.affixes。run.seed决定掉落，预览不消耗RNG。settleRun仅一次接收胜负已获得loot，abandoned不接收。旧run无loot视为空。
- deriveLoadout将装备进阶/副词条/被动、遗物符文品质词条共鸣全部聚合到现有16个effects键；战斗触发条目若新增，必须有run快照及storage验证。禁止增加未实现的effect键。
- 新profile动作前缀：`gear-advance`,`gear-roll`,`gear-lock-affix`,`gear-refine`,`gear-refine-accept`,`gear-refine-cancel`,`gear-recast`,`gear-batch-salvage`,`gear-batch-fuse`,`loadout-save`,`loadout-load`,`relic-affix-*`,`relic-salvage`,`rune-affix-*`,`rune-recast`,`cycle-claim`,`market-refresh`,`market-buy`,`milestone-claim`,`config-snapshot`,`config-restore`。精确参数由所有者报告并提供常量/映射，不让UI猜测。候选/锁定保护不得绕过交易校验。
- 新journey导出：refreshChoices(run),banChoice(run,id),chooseBranch(run,index),chooseMerchant(run,id),chooseEncounter(run,id)。现有chooseEvent/chooseUpgrade可委托新操作，所有动作不可变，有效果或明确拒绝。getJourneyOptions(run)可导出标准化UI描述。新flow优先复用event/reward/camp，避免UI/存档状态大改。
- Route descriptor可扩展scene到bamboo/temple/gate/desert/lake/tomb/peak；新增kind/affix/boss机制若保留既有enemy.kind则存储附加字段。节点快照配置不能被之后导入影响。
- UI由主代理独占main/ui/hub-ui/style/scene/actors/audio/choreography/editor扩展及controller测试。主控制器新增actions路由至上述纯函数；run/profile分离，自动骰、勾选要换、手动攻击、busy/exit逻辑不变。

## 真实网络契约

服务端文件新server/，Node原生HTTP+crypto+持久化，不引入产品依赖。导出createGameServer({dataDir,rootDir,now,randomBytes})返回http.Server，CLI入口server/start.mjs默认HOST127.0.0.1/PORT8768，数据目录环境QIPAI_DATA_DIR或work/在线档案目录(默认server/data但gitignore)。静态资源白名单，不提供server/.git/.superpowers/数据文件。

JSON API统一{ok:true,...}或{ok:false,error,code}；认证用随机HttpOnly/SameSite会话cookie，密码scrypt或PBKDF2随机salt，不明文持久化。写请求JSON且校验Origin，账号限长/限速/配额，持久化串行原子替换，400/401/403/404/409/413/429不泄露他人数据。

API最小完整契约：GET /api/health、GET /api/session，POST /api/auth/{register,login,logout} body{username,password}；GET/PUT /api/profile body{profile,expectedRevision}冲突409；GET /api/leaderboard；GET /api/guilds、POST /api/guilds body{name}、POST /api/guilds/{id}/{join,leave,message} body{text}、GET /api/guilds/{id}；POST /api/arena/queue、POST /api/arena/cancel、GET /api/arena/state、POST /api/arena/action body{matchId,expectedVersion,type:'reroll'|'attack'|'forfeit',indices?}。

匹配仅真实两个登录账号，服务端持有骰子/RNG/回合/HP/重掷/版本，拒绝非本人回合/旧版本/篡改数值，不接受客户端结算或排名分。双方初始HP100、攻击8，5个标准骰自动掷、每轮2次重掷，牌型倍率复用evaluateDice；伤害/护盾在服务端结算。超时/投降处理；完成只记一次胜负。每个浏览器会话只看到自身骰子和公开战况，等待对手不生成机器人。排行榜来自真实比赛历史，可另外列本机游历榜但不得冒充竞技胜场。

新demo/network.mjs导出createNetworkClient({fetch,baseUrl=''})，方法health/session/register/login/logout/loadProfile/saveProfile/leaderboard/listGuilds/createGuild/joinGuild/leaveGuild/guild/sendMessage/queue/cancelQueue/arena/action。UI通过root controller联网options读取client数据，默认同源/api，服务未启动明确可重试；不自动上传档案，用户点击同步才上传，不静默覆盖本地。profile导出无密码/session。

## 验收与边界

所有上一轮199测试需继续通过；各工作包TDD，新增跨系统/恶意输入/旧档兼容测试。每mode/章固定种子终止和存档恢复；真实CUA桌面/360操作交易、分支、编辑/快照/回滚、双账号联机并截屏。服务端API集成测试可用原生HTTP客户端；禁止CLI替代浏览器UI试玩。最后整体验收、源码ZIP/配置/指南/启动脚本，更新同功能分支并非强推；不合并main、不未经授权部署公网。
