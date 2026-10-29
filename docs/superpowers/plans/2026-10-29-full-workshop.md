# 全玩法可改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for independent implementation/review tasks; parent integrates and verifies. Steps use checkbox syntax.

**Goal:** 自动掷骰并交付装备/骰匣/成长/经济/挑战/编辑工具均可操作的本地完整系统版。

**Architecture:** 独立档案与纯run快照分离。数据/档案、战斗/路线、UI三组所有权，主代理整合控制器并串行提交，保留原版。

**Tech Stack:** ES modules、Canvas、DOM/CSS、WebAudio、node:test。

**Spec:** docs/superpowers/specs/2026-10-29-full-workshop-design.md

## Global Constraints

- 保留原版index.html及qipai-jianghu-v1键。示范SAVE_KEY不改，run v1/v2迁移到v3，已有seed/dice/pending不重抽。
- 新增档案键qipai-bamboo-profile-v1。无产品依赖/远程资源。
- 规则和档案转换不可变；profile.seed与run.seed分离；预览同源结算；装备配置只在新局快照。
- 保留勾选要换骰、批量重掷、手动出招，额外重掷上限6；恢复pick不重投。
- 360px可纵向滚动，禁止横向溢出；JSON仅数据且校验，不使用eval。
- 所有可见操作有真实状态变化或明确拒绝原因；不能做空菜单冒充实现。

## Review Focus

- 新局/换局/继续/动画中断/回门庭不重复投骰和领取结算。
- 换装保留槽强化，分解/合成排除装备与锁定物品，洗练候选未接受不生效。
- 自定义骰面、物理面刻印与wild改变牌型但不混淆材质触发；预览不消耗RNG。
- 旧档迁移、新模式解析路线、额外重掷、缩放意图和配置编辑后继续保持一致。
- 资源不足、重复claim、非法JSON、时间倒退、离线封顶不能引入负资源/NaN或重复收益。

### Task 1: 自动掷骰

**Files:** demo/main.mjs; tests/demo-flow.test.mjs, demo-auto-roll.test.mjs.
**Interfaces:** 仅controller在playable边界调用rollDice；model/startBattle保持手动纯API。所有battle roll边界自动变pick并checkpoint；恢复pick原样。
- [x] 行为测试RED再实现；所有新战斗、存活下一回合、constructor/resume覆盖；动画未结束不露未来骰；busy/exit继续有效。
- [x] 更新三流派控制器遍历，不再执行roll，运行full suite并报告。

### Task 2: 内容目录与完整档案系统

**Files:** Create demo/content.mjs, demo/profile.mjs (可拆equipment/profile-storage辅助，但必须re-export spec API), tests/demo-profile.test.mjs, tests/demo-equipment.test.mjs, tests/demo-content.test.mjs.
**Interfaces:** 完整遵循Spec导出函数、loadout字段和action契约。getContent(profile)读取CONTENT或已校验的contentOverrides；deriveLoadout包含所有启用系统的实际数值/触发条目。beginExpedition返回{profile,message,runId,loadout}，runId单调唯一。settleRun只对同runId一次，按run.flow/mode/stats/consumed更新资源/物品/任务/三星/模式进度。
- [x] 写失败测试：交易资源守恒、六槽强化和换装、锁定保护、洗练接受取消、融合、材质/面/符文、领取/离线时钟、配置及档案验证、重复settle。
- [x] 实现所有Spec档案动作及可编辑目录，至少40装备、7门派、12武学、8天赋、7材质、8装饰、9刻印、8遗物、10符文、5灵兽、6武魂、称号/配方/任务/7章/模式/关系与徒弟目录。
- [x] 目录数据与参考取值分离，所有值为原创可调；无HTML/eval和全局存储副作用。
- [x] targeted/full tests；报告字段/action实际支持列表和局限，不stage/commit。

### Task 3: 可配装战斗与全部离线路线

**Files:** demo/model.mjs, combat.mjs, journey.mjs, storage.mjs; new demo/adventures.mjs; relevant rule tests and new demo-expedition.test.mjs/demo-loadout.test.mjs; tools/simulate-demo.mjs if required. Do not edit main/ui/content/profile.
**Interfaces:** 按Spec的loadout及createExpedition/getRunNode/getRunNodes/useRunItem。导出useRunItem从adventures.mjs。创建run可optional第三options但无options原行为不变（除version迁移）。route和loadout存入run，表现通过节点函数读metadata。mode/chapter来自CONTENT读取的参数可由main传入定义快照，缺省可用CONTENT。
- [x] TDD面索引/六面重复/wild/连锁、装备效应与武器牌型、暴击冻结同源预览、消耗品、各mode路由/回合限制、v1/v2迁移及新档恢复。
- [x] 实现限定的效果契约，每个统计有真实结算规则；新事件使用既有可表现事件，保留boss召援延后。
- [x] 迁移严格检查新字段/数值/route/意图，不硬编码2次重掷和旧enemy attack而使新档不能保存。
- [x] 运行旧/新增suite和每mode seeded终止检查；报告exact API、规则、覆盖与关注点；不stage/commit。

### Task 4: 门庭UI与控制器整合/验收

**Files:** parent owns demo/main.mjs after Task1 frozen; demo/ui.mjs, new hub-ui.mjs, style.css; existing scene/actors/audio only if precise newintegration needed; tests/demo-hub.test.mjs/controller integration; README/docs.
**Interfaces:** render opts增加profile/hubTab；hub动作经onAction进入profile reducer，战斗只读run.loadout。主界面Canvas只创建一次。profile-import/content-import输入来自真实textarea，JSON错误保留数据并反馈。
- [x] 面板覆盖装备、骰匣、武学、奇珍、同伴、修炼、工坊商店、任务图鉴、关系、出征与编辑器；目录驱动卡片/表单，显示当前资源与成本。
- [x] 连接begin/start/settle/home/resume、runitem与事件商人。可配置章节/难度/模式，装备下一局生效。保存/恢复/放弃可见。
- [x] 独立任务spec+quality reviews及一次整体review，重要问题修完复审。
- [x] 完整tests+seeded mode check+CUA真实桌面360体验，保存截图、源码zip、配置JSON与覆盖/修改指南。
