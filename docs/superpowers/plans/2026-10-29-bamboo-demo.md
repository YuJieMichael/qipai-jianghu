# 夜雨竹林·破山门 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成一个首页一步可进入、三种流派均能通关、具有独立场景和技能表现的 8–12 分钟武侠骰子示范关卡。

**Architecture:** 在 `demo/` 下创建独立 ES modules 应用，由现有首页链接进入。纯规则函数产生携带状态快照的战斗事件，控制器逐条播放，Canvas 负责世界与动作，DOM 负责骰盘、卡牌和无障碍交互。原版单文件游戏保持运行和存档兼容。

**Tech Stack:** 原生 JavaScript ES modules、Canvas 2D、CSS、Web Audio；Node 内置 test runner；Python HTTP server；浏览器实际交互与截图。无生产依赖、后端或打包步骤。

**Spec:** `docs/superpowers/specs/2026-10-29-bamboo-demo-design.md`

## Global Constraints

- “目标时长为首次游玩约 8–12 分钟；该时长需要实测调整，不能代替体验验收。”
- “三种起手均可获得质变，至少各完成一次浏览器通关；失败、重试、暂离恢复也各验证一次。”
- “360px 宽度下关键按钮和骰子无需横向滚动。”
- “随机生成器状态随局保存，恢复不改变骰子、成长选项或敌人意图。”
- “原版入口和 localStorage 存档保持兼容，示范进度使用独立版本键，保存失败时提示并允许继续游玩。”
- “无需后端或打包工具，支持 GitHub Pages。”
- 原版存档键 `qipai-jianghu-v1` 不读写；示范进度键为 `qipai-bamboo-demo-v1`，设置键为 `qipai-bamboo-settings-v1`。
- 全部战斗和表现素材原创，资源位于仓库内；不得依赖远程素材加载成功才能游玩。

## Review Focus

- 快速重复点击出招、选牌或下一节点：只接受一次合法状态迁移，不能重复奖励或结算。
- 刷新、退出和后台恢复发生在动画中途：恢复到已完成的回合边界，不重放伤害、不刷新随机结果。
- localStorage 拒绝写入、格式损坏或版本错误：清楚提示；仍可开新局且不触碰原版存档。
- 尸体、空敌群、反击击杀和首领半血转阶段同时发生：不出现死者行动、重复召援或无目标阻塞。
- 360px 小屏、长技能描述、静音与减少动态效果：关键信息可读，操作可完成，规则结果一致。

## File Structure & ownership

| 文件 | 职责 / 实施任务 |
|---|---|
| `demo/config.mjs` | 节点、敌人、三流派成长及数值配置 / T1 |
| `demo/model.mjs` | 状态约束、随机数、骰型与公共结构 / T1 |
| `demo/combat.mjs` | 回合结算、技能、首领意图、预览 / T2 |
| `demo/journey.mjs` | 节点、三选一、奇遇、结算 / T3 |
| `demo/storage.mjs` | 安全保存和恢复 / T3 |
| `demo/scene.mjs` | 原创场景、角色动画、技能特效 / T4 |
| `demo/audio.mjs` | 合成音效、静音、安全解锁 / T4 |
| `demo/index.html`, `demo/style.css`, `demo/ui.mjs` | 页面、响应式布局、骰子和成长卡 / T5 |
| `demo/main.mjs` | 事件播放、输入门禁和退出生命周期 / T6 |
| `index.html`, `README.md` | 首页入口、运行说明 / T6 |
| `tests/demo-*.test.mjs` | 规则、存档和流程验证 / T1–T3、T6 |
| `tools/simulate-demo.mjs` | 固定种子的重复完整闯关 / T7 |
| `docs/demo-verification.md` | 实测结果、截图路径、已知限制 / T7 |

## 公共数据与模块接口

T1 先落实以下契约，后续并行任务只能扩充内部字段，不得自行改名。所有规则函数返回新对象，事件快照不引用可变状态。`flow` 是局外流程，`combat.phase` 是战斗内部状态，避免混用。

```text
Build = 'sword' | 'poison' | 'guard'
Run = {version:1, seed:uint32, build:Build, nodeIndex:number,
 flow:'intro'|'battle'|'reward'|'event'|'camp'|'victory'|'defeat',
 hero:{hp,maxHp,shield,attack}, diceSkills:Array<Skill|null>,
 upgrades:Record<string,number>, mastery:number, ascended:boolean,
 choices:Array<Choice>, combat:Combat|null, stats:Stats}
Combat = {round:number, phase:'roll'|'pick'|'resolved', dice:number[5],
 held:boolean[5], rerolls:number, enemies:Enemy[], targetId:string}
Enemy = {id,kind,name,hp,maxHp,shield,poison:{stacks,turns},
 stance,phase,intent:{kind,damage,label},summoned:boolean}
CombatEvent = {id,type,sourceId,targetIds,value,build,text,snapshot:Run}
Choice = {id,title,description,before,after,build,dieIndex,kind}
Stats = {turns,kills,damage,blocked,poisonDamage,upgrades:string[]}
```

事件 `type` 固定为 `windup|strike|sword|poison|burst|shield|counter|hurt|death|intent|phase|heal|finish`。伤害事件 `value` 为实际扣除的生命，护盾事件为实际护盾变化；多目标伤害每个目标一个事件。UI 不解析日志推断伤害或技能。

### T1：确定状态、配置和五骰规则（串行基础）

**Files:** Create `demo/model.mjs`, `demo/config.mjs`, `tests/demo-model.test.mjs`。

**Interfaces:** `createRun(build,seed)->Run`; `nextRandom(seed)->{seed,value}`；`evaluateDice(values)->{rank,name,multiplier}`；`rollDice(run)->Run`；`toggleHold(run,index)->Run`；`rerollDice(run)->Run`。非法动作保持状态不变。T2–T6 使用本节契约。

- [ ] **Step 1:** 写测试 `recognizes_all_eight_combos`，依次断言 `[1,2,3,4,6]→1`、一对→1.5、两对→2、三条→3、顺子→4、葫芦→5、四条→7、五同→10；两种顺子均命中，四连不是顺子。
- [ ] **Step 2:** 写 `reroll_preserves_held_dice_and_has_two_uses`、`same_seed_replays_same_roll`、`invalid_index_and_wrong_phase_are_noops`，断言锁定骰不变、两次用尽、输入不变异。
- [ ] **Step 3:** 运行 `node --test tests/demo-model.test.mjs`，确认因尚缺模块而失败。
- [ ] **Step 4:** 实现接口；配置九节点和三起手。英雄初始 180 HP、基础攻击 12；每轮两次免费重掷。数值作为首轮调优基线，集中配置，T7 可调整并记录。
- [ ] **Step 5:** 运行同一测试命令，全部通过；提交 `feat: define demo state and dice rules`。

### T2：可回放战斗与首领机制（依赖 T1）

**Files:** Create `demo/combat.mjs`, `tests/demo-combat.test.mjs`。

**Interfaces:** `startBattle(run,node)->Run`；`selectTarget(run,id)->Run`；`previewAttack(run)->{combo,directDamage,triggers,enemyIntents}`；`resolveRound(run)->{state:Run,events:CombatEvent[]}`。战斗仅接收 `phase:'pick'`，返回 `resolved`，由控制器结束回放后进入下一轮。`prepareRound(run)->Run` 重置骰子、重掷数并生成预告；持续状态不在该函数重复扣血。

- [ ] **Step 1:** 写 `preview_equals_guaranteed_direct_hit`、`event_snapshots_follow_hit_order`、`resolved_round_rejects_double_attack`，断言预览直接伤害与事件一致、生命随快照递减、重复操作无事件。
- [ ] **Step 2:** 写三流派用例：剑气仅 4–6 触发且多目标逐次命中；毒针仅单数触发，毒层三回合、阈值 6 消耗 6 层引爆；金刚仅 1–3 获盾，先抵扣护盾，反击不递归。
- [ ] **Step 3:** 写 `boss_half_health_summons_once`、`breaking_stance_interrupts_charged_attack`、`counter_kill_prevents_later_action`、`no_live_targets_finishes_battle`。断言半血阶段只切一次、破架势中断重击、死者不行动、胜负唯一。
- [ ] **Step 4:** 运行 `node --test tests/demo-combat.test.mjs`，确认失败后实现。普通直接伤害为攻击×骰型倍率；剑气基础每次 6 伤害；毒层每层每轮 3；金刚每次基础 8 护盾。首领初始 260 HP、24 架势，半血召援两名；重击 42、普攻 16。所有值在 config 配置，允许 T7 实测调优。
- [ ] **Step 5:** 执行 T1、T2 测试，检查事件与状态无共享对象引用；提交 `feat: implement demo combat and boss phases`。

### T3：成长、关卡和安全恢复（依赖 T1，与 T2 可并行）

**Files:** Create `demo/journey.mjs`, `demo/storage.mjs`, `tests/demo-journey.test.mjs`, `tests/demo-storage.test.mjs`。

**Interfaces:** `enterNode(run)->Run`；`completeBattle(run)->Run`；`createChoices(run)->Run`；`chooseUpgrade(run,choiceId)->Run`；`chooseEvent(run,optionId)->Run`；`advanceNode(run)->Run`；`saveRun(storage,run)->{ok,message}`；`loadRun(storage)->{run,message}`。通过显式传入 Storage 对象避免在规则里访问浏览器。

- [ ] **Step 1:** 写 `nine_nodes_have_five_rewards_and_final_boss`、`first_three_rewards_offer_build_growth`、`all_builds_reach_ascension`、`duplicate_choice_is_noop`。固定节点顺序：初战→成长→双敌→奇遇→精英→成长→三敌→营火→首领；初战、双敌、精英、三敌、营火后各有一次选牌，节点 2、6 是对应选牌展示阶段，不额外发奖。
- [ ] **Step 2:** 写存档用例：选择与随机状态往返相同；截断 JSON、错误版本、非法 build、负生命或不存在节点返回可见错误；写入抛错时返回失败而不抛出；所有操作不接触 `qipai-jianghu-v1`。
- [ ] **Step 3:** 运行 `node --test tests/demo-journey.test.mjs tests/demo-storage.test.mjs`，确认失败后实现。每次成长三选一，保留一个本流派选项和两个有效选项；第三次选择本流派成长解锁质变。绑定骰位、升级限制与说明由 Choice 提供。
- [ ] **Step 4:** 定义剑气质变每战首次满足三颗高骰触发剑阵；毒引爆每次施毒完成后检查一次；金刚质变每次受敌人攻击抵挡后反击。每次升级显示旧值→新值，不能用空泛“变强”文案。
- [ ] **Step 5:** 运行测试全部通过；提交 `feat: add demo journey growth and persistence`。

### T4：原创场景、动作和音效（T1 契约确定后，可与 T2/T3 并行）

**Files:** Create `demo/scene.mjs`, `demo/audio.mjs`。

**Interfaces:** `createScene(canvas,{reducedMotion})->{setState(run),async play(event),setOptions(options),destroy()}`；`createAudio()->{async unlock(),play(event),setMuted(boolean),destroy()}`。`play(event)` 结束才 resolve；所有角色位置由 id 映射，不从 DOM 读取。场景只消费状态和事件，不修改生命或随机种子。

- [ ] **Step 1:** 先建立可检查的表现清单：三段各有远中近景、雨雾和灯光；主角与四类敌人各有待机、起手、攻击、受击、死亡；对比普通斩击、剑气、毒针、护盾反击的颜色、轨迹、时序和音色。
- [ ] **Step 2:** 使用 Canvas 原创绘制高辨识度武侠角色、竹林/破庙/山门场景与技能轨迹，避免方块占位人物和只换色的技能。人物站位不能遮挡敌人预告区域。
- [ ] **Step 3:** 实现事件动作：起手 120–180ms、普通命中停顿约 45ms、技能独立轨迹与受击击退，死亡淡出。整轮回放控制在约 2–4 秒，避免五骰连锁造成冗长等待。减少动态效果下取消震动和闪屏、缩短位移，但保留技能辨识和结算文字。
- [ ] **Step 4:** 实现 Web Audio 的掷骰、锁定、命中、剑气、毒、护盾、首领与胜负音色。AudioContext 只在用户手势后解锁；创建失败静默退化，界面显示静音可用。
- [ ] **Step 5:** 集成到 T6 后人工检查三段场景与三流派动画；浏览器确认销毁不再触发 RAF/音频，手机画布尺寸稳定。提交 `feat: add bamboo stage animation and audio`。

### T5：手机优先界面与可读决策（T1 契约确定后，可与 T2–T4 并行）

**Files:** Create `demo/index.html`, `demo/style.css`, `demo/ui.mjs`。

**Interfaces:** `createUI(root,onAction)->{render(run,{busy,message,settings}),destroy()}`。Action 为 `{type:'start'|'resume'|'roll'|'hold'|'reroll'|'target'|'attack'|'upgrade'|'event'|'next'|'retry'|'exit'|'mute'|'motion',value?:string|number}`；T6 唯一处理所有规则调用。

- [ ] **Step 1:** 明确页面布局：顶部进度与设置，中部战场和敌人意图，底部生命、五骰、直接伤害预览和主操作；开局三传承、成长三选一、结算层使用语义按钮。为所有交互提供中文可访问名称，触摸目标至少 44px。
- [ ] **Step 2:** 实现完整状态界面：起手、继续存档、战斗、成长、奇遇、营火、胜负。成长显示绑定骰位、触发范围、旧值→新值及质变进度；骰子显示锁定、技能和即将触发状态。
- [ ] **Step 3:** 实现 360px 到桌面的布局、safe-area、滚动和长文案；忙碌态禁用规则按钮。键盘 Space 执行当前主操作，R 重掷、1–5 锁骰，输入控件聚焦时不截获空格；不允许触发不可用动作。
- [ ] **Step 4:** 集成到 T6 后验证 360px 和桌面、长技能卡、键盘顺序、静音与减少动态效果；不写只断言 CSS 类的测试。提交 `feat: build mobile demo interface`。

### T6：联调、入口和可恢复回放（依赖 T2–T5）

**Files:** Create `demo/main.mjs`, `tests/demo-flow.test.mjs`；Modify `index.html` 的 `brand()`（当前约 2766 行）、`README.md`。

**Interfaces:** 控制器遵循 `idle -> resolving -> playing -> idle` 单一互斥门禁。规则最终状态只在事件播放完成后用于下轮操作；展示态逐帧使用 event.snapshot。仅在完整回合/节点边界持久化，动画期间刷新恢复最近边界；开启回放前先保存已掷出的骰子和所选目标，避免刷新重掷。

- [ ] **Step 1:** 写 `full_run_visits_battle_reward_event_camp_and_result`、`serialized_actions_accept_only_one_attack`、`animation_exit_cancels_remaining_updates`、`restoring_saved_pick_keeps_dice_choices_and_intent`。控制器的异步播放器以可控 Promise 替身驱动测试，断言忙碌期无第二次调用和销毁后无更新。
- [ ] **Step 2:** 运行 `node --test tests/demo-flow.test.mjs`，确认失败后实现。监听 pagehide 保存最近完整边界；退出清理 RAF、音频和键盘监听。损坏存档只清示范键并显示说明，用户仍可启动新局。
- [ ] **Step 3:** 修改原版 `brand()` 添加清晰的 `./demo/` 入口，使创建角色前后均可进入。更新 README 的 HTTP 启动方式：`python3 -m http.server 8765`，并解释示范页 ES modules 需要 HTTP。原版 index.html 的 file:// 玩法继续保留。
- [ ] **Step 4:** 执行 `node --test tests/demo-*.test.mjs` 全部通过；以 HTTP 启动浏览器检查新入口、返回原版、继续原版存档。提交 `feat: integrate playable bamboo demo`。

### T7：平衡、浏览器验收与交付（依赖 T6）

**Files:** Create `tools/simulate-demo.mjs`, `docs/demo-verification.md`；需要时仅调 `demo/config.mjs` 与实际缺陷文件。

- [ ] **Step 1:** 实现固定种子 1–100、三种起手的全流程模拟，策略为选择本流派成长、按触发范围锁骰、优先中断蓄力再集火低血敌人。每场最多 100 回合，超限作为错误退出；输出胜率、平均回合和质变达成率。运行 `node tools/simulate-demo.mjs`，必须无非法状态、死循环或必败起手；阈值只作诊断，不假造测试结果。
- [ ] **Step 2:** 浏览器分别以剑气、毒针、金刚从首页实玩到胜利，记录种子和时间；再验证一次失败→重试、一次战斗中退出/刷新恢复。展示普通攻击与各流派质变、首领阶段和中断反馈。发现问题先复现再修改相应测试或规则，不能仅绕过 UI。
- [ ] **Step 3:** 检查 360px 手机与桌面；静音、减少动态、长卡牌和键盘均完成操作；收集 console errors。保存真实截图（开局、战斗、成长、首领、结算），写清截图种子与流派；不用模拟截图代替实测。
- [ ] **Step 4:** 运行完整规则测试和模拟；记录实际通过数、通关用时、平衡数据、限制及未达目标。一次独立整体代码审查后修复实际问题，复跑受影响检查；提交 `test: verify bamboo demo playthrough and balance`。
- [ ] **Step 5:** 提供本地运行预览与源代码变更说明。创建 PR 时遵循仓库与工具要求并附加到当前聊天；发布线上站点留作明确授权后的操作，不把本地完成说成线上已更新。

## 执行顺序

先 T1，再以互不编辑同一文件为前提并行推进 T2/T3/T4/T5；T6 串行整合并验证；T7 为完整质量门槛。最多同时 3 名工作代理，主代理维护契约和联调；出现接口变更由主代理统一协调，工作代理不能各自创建不兼容的数据模型。

## 自审记录

已覆盖设计稿中的入口、九节点五次成长、三流派质变、两阶段首领、表现、音频、手机、存档和验证要求。明确了节点 2/6 是前场战斗奖励的展示阶段，避免重复计为七次成长。规则预览、动画快照和持久化边界分别由 T2/T6/T3 负责，接口名称与公共契约一致。Review Focus 的五类问题分别落实在 T6、T6、T3、T2、T5/T7。数值属于首轮基线，T7 以真实试玩结果调优，视觉完成度仍需人工判断。
