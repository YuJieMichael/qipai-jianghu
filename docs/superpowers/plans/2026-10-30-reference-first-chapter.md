# 青岚试炼 Implementation Plan

> **For agentic workers:** Use subagent-driven-development. Tasks use explicit file ownership; root integrates, reviews, commits and publishes.

**Goal:** 将默认入口变成可玩、可见成长的手机竖屏骰子冒险。
**Architecture:** 新的纯函数冒险模型、固定Canvas身份的DOM界面、事件快照驱动画面；旧工坊独立入口保留。
**Tech Stack:** 原生ES modules、Canvas、CSS、Node test，无新增依赖。
**Spec:** `docs/superpowers/specs/2026-10-30-reference-first-chapter.md`

## Global Constraints
- 只改约定文件；不修改原版根index.html、不覆盖旧存档；参数原创，研究观察和推断分开。
- 现有工作台保持可访问；新入口无需账号。
- 所有提交、推送、部署由root执行。

## Review Focus
- 重掷击杀后不能再让敌人行动或重复发奖励。
- 动画期间重复点击、退出、重试不会泄漏事件或改动新局。
- 成长目标失效、取消、存档被损坏时保持原状态或明确恢复。
- 360px和矮屏仍可操作五个骰和出招；原生按钮可键盘触达。
- 贴图未载入/失败与减少动态不能阻塞规则执行。

### Task 1: 模型与成长
Files: `demo/renewal/model.mjs`, `tests/demo-renewal-model.test.mjs`。
- [x] 写失败测试：单骰重掷扣1且当场造成剑气伤害；击杀只发一次reward；成长只修改目标；解锁不超过5；恢复校验与纯函数不变性。
- [x] 跑RED，按spec共享接口实现，再跑GREEN。常量在模块集中定义。
- [x] 固定种子模拟六场、选择不同成长路径，控制回合上限避免死循环；输出报告给root。

### Task 2: 竖屏界面
Files: `demo/renewal/ui.mjs`, `demo/renewal/style.css`, `tests/demo-renewal-ui.test.mjs`。
- [x] 真实DOM行为测试选卡再选目标、取消不发choose、busy禁用和canvas不被替换。
- [x] 按spec接口实现，五槽锁定/解锁，牌型与攻击，战场锚定血条，成长遮罩，设置/结果。
- [x] 根主控接入后实际浏览器检查360px与矮屏，修复溢出。

### Task 3: 场景演出
Files: `demo/renewal/scene.mjs`, `tests/demo-renewal-scene.test.mjs`。
- [x] 写事件到快照、取消/销毁、减少动态相关有意义测试并跑RED。
- [x] 使用真实生成图片，竖向纵深角色位置、轻待机和起手/冲击/剑气，清楚的伤害读数，异步加载失败降级。
- [x] 确保同一事件只展示一次、onFrame顺序正确、destroy不回调旧局。

### Task 4: 资产与整合（root）
Files: `demo/renewal/assets/*`, `demo/renewal/main.mjs`, `demo/index.html`, `demo/workshop.html`。
- [x] 生成并检视原创场景/透明四角色图集，保存到repo并记录提示词。
- [x] 新存档安全恢复、原子保存、输入锁、设置、音效、暂停及旧入口。
- [x] 完整测试、独立代码复审，浏览器实玩首战到第二战、窄屏截图。
- [x] 合并推送并复用同一Sites部署；打开线上新入口确认，交付实际截图与已知差距。
