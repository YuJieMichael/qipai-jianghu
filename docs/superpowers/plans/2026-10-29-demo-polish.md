# 夜雨竹林成长与战斗表现升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 完成目标骰成长、六条分支、同源预览和原创动作升级，交付通过验证的可玩示范。

**Architecture:** 继续纯规则与事件表现分离。规则组负责run v2/成长/战斗/存档，表现组负责独立角色绘制和纯动作时间轴，界面组负责已有DOM与controller接入。主代理串行提交各组所有权文件并统一审查，避免共享Git索引竞争。

**Tech Stack:** 原生ES modules、Canvas 2D、DOM/CSS、WebAudio、node:test。

**Spec:** docs/superpowers/specs/2026-10-29-demo-polish-design.md

## Global Constraints

- 继续使用独立 demo/ ES modules 和本地 Canvas/DOM/WebAudio，无新增产品依赖、远程资源或后端。
- 保留武侠题材、三场景九节点、五次成长、三次本门成长质变、五骰两次重掷。
- 点击选择要换的骰子，选中的一起重掷；未选中不改变；空选择不消耗次数或随机状态。
- 角色、场景、图形和音频原创；不复制参考 APK 的代码或素材。
- 所有规则确定性、纯函数、输入不可变；预览不消耗随机状态。表现只消费事件快照。
- 原版 qipai-jianghu-v1 存档不改；示范键仍为 qipai-bamboo-demo-v1，旧版示范可迁移；设置键不改。
- 支持 360px 窄屏、键盘、静音和减少动态；无横向滚动，不用仅有颜色区分状态。

## Review Focus

- 奖励选择未确认、取消、改选牌和刷新恢复时，不误加技能/成长或抽牌。
- 同门/异门替换、满级分支和混合流派，不出现空候选或错误的质变累计。
- 多目标击杀、护盾、首领半血召援和毒爆，预览与实际结算相同且不改seed。
- v1奖励/战斗迁移与v2待选目标恢复，损坏待选ID和非法rank被拒绝。
- 暂离/销毁/声音设置在动画中发生时，无悬空promise、重复回合和提前显示未来状态。

### Task 1: 成长规则 六分支 同源预览与存档迁移

**Files:** Modify demo/config.mjs, model.mjs, journey.mjs, combat.mjs, storage.mjs; tests/demo-model.test.mjs, demo-combat.test.mjs, demo-journey.test.mjs, demo-storage.test.mjs; tools/simulate-demo.mjs. Create tests/demo-upgrades.test.mjs if useful. Do not edit main/ui/scene/audio/CSS or flow tests.

**Interfaces:**
- createRun(build,seed) -> version2 run with perks zero ranks and pendingUpgrade=null.
- selectUpgrade(run,id), selectUpgradeTarget(run,index), cancelUpgrade(run) -> immutable run.
- previewUpgrade(run,id,index) -> {valid,before,after,description,reason}; pure; binding needs valid index, perk does not.
- chooseUpgrade(run,id,index?) -> commit; existing no-pending legacy call may use choice.dieIndex; pending bind with null target MUST no-op. UI will use explicit confirmation gate.
- createChoices(run) -> exactly3 persistent deterministic choices with kind='bind'|'perk', build, optional perkId, and legacy string fields/id/suggested dieIndex. One own bind guaranteed; one available own branch guaranteed; third sampled from legal remaining pool. No duplicate IDs/perk IDs in one offer.
- previewAttack(run) -> existing fields plus forecast={totalDamage,poisonDamage,blocked,heroHpAfter,heroShieldAfter,enemies:[{id,hpAfter,shieldAfter,poisonStacksAfter,poisonTurnsAfter}]}|null and effects:[{type,text,value,build,sourceId,targetIds,dieIndex?}]. Use resolveRound clone trial, never duplicate formulas.
- New event types: poisonApply, poisonTick, swordFocus, swordEcho, swordArray, ascension; existing event structure preserved.
- Six perk IDs/values/caps are exactly Spec's table; use named exported definitions so UI can show route name/rank/effect.
- save/load support v1->v2 migration, same SAVE_KEY. Export migrateRun(run) for direct migration assertions if useful. v1 choice kind skill becomes bind without re-generation.

- [ ] Write failing tests for arbitrary target replacement, pending/cancel/no target, deterministic choices/eligibility/caps, all six mechanisms, preview equality/immutability, and v1/v2 restore/malformed state.
- [ ] Run targeted tests and record expected failures before rules implementation.
- [ ] Implement pure APIs and event changes, make touched files readable, preserve other base rules. Set guard counter branch to perkRank*5 + (ascended-own-guard ? 8 : 0); only when positive damage was blocked and hero survived.
- [ ] Run all tests with node --test tests/demo-*.test.mjs. Existing controller legacy upgrade path must still work at this intermediate step. Update only assertions invalidated by declared version/event changes, not delete meaningful coverage.
- [ ] Extend simulator with route-aware picks/explicit targets and report seed1–100 summaries for each build/route. Do not change game balance just to make a weak policy pass; report concerns.
- [ ] Self-review and write report with red/green logs, exact API fields, owned file list and remaining concerns. Do not stage/commit; controller serializes commits.

### Task 2: 原创角色 分层场景 动作时间轴与音效

**Files:** Modify demo/scene.mjs, demo/audio.mjs. Create demo/actors.mjs, demo/choreography.mjs, tests/demo-choreography.test.mjs. Do not edit rules/main/ui/CSS.

**Interfaces:**
- createScene(canvas,options) retains setState, setOptions, destroy; play(event,context?) where context={eventIndex,events}.
- choreography pure exports choose descriptive stable names; cover weighted sequence durations and role-specific pose samples independent from DOM.
- Accept Spec event types plus old poison fallback; never mutate run/event/snapshot.
- Keep W1000,H540 logical coordinates and responsive DPR <=2. Author distinctive martial hero and enemy silhouettes/gear with layered shapes, articulated limbs, cape/hair and phase-specific poses.
- Normal sequence target2600ms with total2200–3400ms by weighted event allocation; reduced-motion shorter without camera shake, major lunge or flashing. Context absent remains safe single event.

- [ ] Write failing choreography tests for duration sum, heavy/normal event distinction, finite poses/rest return, and reduced-motion suppression.
- [ ] Run tests to observe missing feature failures, implement choreography/actors/scene/audio. Separate poison flight from on-enemy toxic erosion, independent burst/array/guard reflection. Make bamboo/temple/gate compositions meaningfully distinct.
- [ ] Run all node tests, self-review playback cleanup and compatibility; do not claim visual/audio listening without browser evidence.
- [ ] Write report with exported helper names, event support, test evidence and owned paths. Do not stage/commit; no subagents.

### Task 3: 成长选择界面 完整预览与控制器接入

**Files:** Modify demo/ui.mjs, demo/style.css, demo/main.mjs, tests/demo-flow.test.mjs. Create tests/demo-ui.test.mjs only for useful pure render helpers if introduced. Do not edit Task1/2 owned files.

**Interfaces:**
- Existing action upgrade selects a choice via selectUpgrade, no immediate stat mutation. New actions upgrade-target(index), upgrade-confirm, upgrade-cancel.
- upgrade-confirm requires valid pending choice and target for bind; commits chooseUpgrade with explicit index. Perks require no target. Cancel returns offer unchanged. No start/retry/resume double commit during busy.
- main forwards play(event,{eventIndex,events}) and mount forwards context to scene.play; tests with old one-arg callbacks remain valid.
- Consume Task1 exact preview/choice/perks fields. Keep UI placeholder-free when forecast null/legacy save. Perk descriptions include trigger condition and before/after rank. Binding selection shows all five dice with old/new comparison and selected state, cancel and confirm buttons.
- Attack forecast shows direct vs skill/poison vs enemy reply separately, affected target names and shield/HP outcomes, next ascension requirement; avoid leaking future snapshot into actual HP bars.
- Display attained routes and named upgrade history on victory. Preserve screenshot-friendly original martial UI, responsive readable hierarchy and explicit selection text.

- [ ] Write failing controller tests for selection without mutation, cancel, missing target no-op, confirm exactly once, restored pending state, and play context.
- [ ] Run failing tests, implement controller/UI/CSS. Update full-journey controller tests to use new actions and cover all3 builds with explicit targets.
- [ ] Run full node suite; document browser checks root must execute (360px keyboard and reward previews). Do not use source-string assertions as UI behavior tests.
- [ ] Self-review and write owned file list/API usage/test logs; no subagents, stage or commit.

### Task 4: 整合 审查 试玩与交付

**Files:** docs/demo-verification.md, README.md, optional focused fixes in owned files after coordination. User outputs in parent task outputs/.

- [ ] Controller generates per-task diff packages and dispatches fresh spec+quality reviewers; fixes concrete findings before accepting tasks.
- [ ] Run full suite and deterministic route simulations; investigate meaningful regressions. Verify legacy save and new pending target restore in tests and real browser where feasible.
- [ ] Use CUA to play fresh localhost-origin seed2 routes across all3 builds, use 360px iframe and desktop, inspect visible target selection/preview/animations and console. Preserve existing 127.0.0.1 user save.
- [ ] Dispatch final whole-change review on most capable model; fix important findings, run scoped re-review and relevant tests.
- [ ] Produce updated source ZIP, final verification record, representative screenshots and live local preview. State unmeasured human timing/performance honestly. Keep current feature branch locally; user did not request a push/merge/public deploy.
