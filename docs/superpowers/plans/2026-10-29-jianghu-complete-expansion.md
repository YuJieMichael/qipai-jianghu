# 深度系统与联机扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development; user explicitly authorized parallel independent implementation, parent integrates and reviews. Steps use checkbox syntax.

**Goal:** 将上一轮列出的全部七类离线扩展和真实账号/公会/PvP能力接入可修改游戏。

**Architecture:** 三个互不写重叠文件的实现包并行，主代理负责UI/表现/编辑器。纯数据与规则、服务器协议边界先冻结；旧档与快照继续有效。

**Tech Stack:** ES modules、Canvas、DOM/CSS/WebAudio、Node原生HTTP/crypto/文件持久化、node:test。

**Spec:** docs/superpowers/specs/2026-10-29-jianghu-complete-expansion-design.md

## Global Constraints

- 原index.html与qipai-jianghu-v1不变；旧profile/content/run可读取，不重抽已有选择；自由试配保留。
- 所有交易不可变，失败原对象，预览不耗RNG，局内掉落只结算一次；锁词条与保护分开。
- 每个新系统有真实状态变化/清晰拒绝；新网络状态不冒充云部署或真人数据；密码不明文/不进导出。
- 360px无横向溢出；静音与减少动态生效；无生产密钥写入仓库。
- 仅主代理stage/commit/push；共享文件所有权互斥；不公开监听、不创建收费服务。

## Review Focus

- 多次恢复/重复请求/断网/旧版本/并发同步不重奖、不覆写他人档案。
- 批量交易排除已装备、锁定、候选、镶嵌材料，不发生部分扣费；配装引用不能悬空。
- 锁词条/品质晋升/池编辑/删目录后旧档要明确兼容或原样拒绝，不能出现不可保存的新局。
- 分支/诅咒/商人/成长刷新/掉落每个边界都可继续且不可刷收益；首领阶段预览与实战一致。
- 深处页面启动/弹窗键盘/输入焦点/联网等待/销毁与重挂载不重复监听和请求。

### Task 1: 装备、深度养成、周期经济与内容扩展

**Files:** demo/profile.mjs,content.mjs; newdemo/expansion-content.mjs; newtests/demo-expansion-profile.test.mjs,demo-expansion-content.test.mjs. 不改combat/journey/storage/UI/server。
**Interfaces:** Spec公共API、profile动作、getExpansionView、run.loot契约；DEFAULT_EXPANSION导入CHAPTER_ROUTES（Task2创建，首轮缺文件可使用临时内存fixture而不得写Task2文件）。
- [ ] 为旧档迁移、进阶/词条/锁定/候选、原子批量、配装、一次掉落、周期/限购/首通/里程碑、配置快照校验写RED。
- [ ] 实现全部纯动作、聚合到16效果、可编辑完整扩展目录；验证旧JSON与扩展恶意输入。
- [ ] 定向GREEN与一次full suite，报告精确动作参数/派生UI视图，不stage/commit。

### Task 2: 独立章节、局内构筑、掉落与首领

**Files:** demo/model.mjs,combat.mjs,journey.mjs,adventures.mjs,storage.mjs,config.mjs; newchapter-content.mjs/rogue helpers; tests/demo-expansion-journey.test.mjs等。不得改profile/content/main/UI/scene。
**Interfaces:** CHAPTER_ROUTES/defaultExpansion公共字段、run.loot descriptors、journey函数与getJourneyOptions；新scene七类，现有八牌型/16效果继续。
- [ ] RED新章节差异、分岔/事件/商人/刷新禁选前置、掉落RNG/一次性、精英/三首领机制与同源预览、旧档迁移。
- [ ] 实现至少七独立章节路线、精英词缀、三类首领机制、实际可用商人库存/代价事件/成长规则；新route与run状态严格保存。
- [ ] 每章与mode固定种子终止，所有保存边界migrate有效，targeted/full报告；不stage/commit。

### Task 3: 真实服务端与联网客户端

**Files:** newserver/*.mjs,demo/network.mjs,tests/demo-network.test.mjs,server/README.md；允许新增.gitignore忽略server/data但不改其他源。
**Interfaces:** Spec HTTP/cookie/auth/profile/guild/arena契约。createGameServer可测试ephemeral端口、dataDir，network客户端可注入fetch；导出Node版本要求和CLI环境参数。
- [ ] RED账号隔离/密码存储/会话/CSRF/配额/路径穿越、并发版本冲突、持久化重启、公会成员、两真人匹配与每步权威验证/一次排名。
- [ ] 完成静态服务+所有API+客户端。无机器人/假排行/客户端自报胜负。原生JSON持久化串行原子写。
- [ ] HTTP真实双客户端集成测试GREEN/full；清楚报告待公网部署的依赖；不stage/commit。

### Task 4: 主代理UI、可视化创作与视听整合

**Files:** main.mjs,ui.mjs,hub-ui.mjs,style.css,scene.mjs,actors.mjs,audio.mjs,choreography.mjs；neweditor.mjs,expansion-ui.mjs,network-ui.mjs/tutorial helpers；controller/UI测试、README/docs/outputs。
**Interfaces:** 调用Task1/2公共API与Task3network methods。可视化编辑生成同一content校验对象，快照保存在profile扩展，模拟使用纯真实规则。
- [ ] 覆盖所有新动作表单/交易反馈/掉落展示/关卡分支/商人/循环任务/配装比对与账号同步、真实公会/论剑/排名；旧入口可用。
- [ ] 表单编辑装备/池/掉落/敌人/章/奖励/经济，导入导出与快照回滚、真实模拟报告；全局单Canvas。
- [ ] 原创程序化图标、七场景、装备外观、武器动作/阶段/掉落演出、可跳过的新手引导，reducedMotion不强制动画。
- [ ] 各包独立review及整体验收，重要问题修复；199旧测试+新增、种子模拟、CUA桌面360与双账号真实对局、代码包与指南，推送现有功能分支。
