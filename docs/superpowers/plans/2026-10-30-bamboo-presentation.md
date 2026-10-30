# Bamboo presentation implementation plan

> Use subagent-driven-development with three disjoint work packages. User approved the four-item in-chat design and automatic parallel execution.

Goal: improve the complete original 夜雨竹林 visual slice: articulated characters, distinct lineage effects, layered scene/impact, compact mobile decisions.
Architecture: extend existing Canvas presentation and DOM HUD; no simulation changes. Actors/choreography, scene/effects/audio, and UI/CSS have disjoint ownership. Root integrates, plays, reviews and releases. Baseline ba21742.
Tech: native Canvas2D, ES modules, CSS, node:test; no new dependency.
Spec: user's accepted four-item in-chat design on2026-10-30; this is existing-flow presentation work, no new subsystem.

Constraints: preserve event snapshot order, source/target IDs, damage/RNG, saves, auto initial roll, selection-to-replace, manual attack;1×2600ms/2×1300ms round budgets; skip/destroy/timer resolve once; reduced motion suppresses camera/flash/lunging. Original assets only, no root index changes, no external hosting/dependency.

- [ ] Task1 actors and pose polish: distinct silhouettes, visible preparation/release/hit/recovery/death; endpoints and finite/reduced tests. Owners actors/choreography and actor tests.
- [ ] Task2 scene/effects/audio: layered bamboo, readable event-driven lineage effects and bounded focus/impacts; actual frame and lifecycle tests, no mutation or RNG. Owners scene/audio and optional presentation modules/scene tests.
- [ ] Task3 mobile HUD: visible core battle decision at360×800, accessible persistent disclosures for detail, desktop maintained; behavior tests for disclosure/focus/locks. Owners ui/style and UI tests.
- [ ] Root: combine tests, browser desktop+360 core and details, actual threebuild battles/boss with screenshot proof, source review once covering all tasks, fixes+scoped review, merge/push by standing authorization, guide/archive/verification outputs.

Review focus: hidden tab timers and skip must settle once; changing motion whileplaying mustnot stall; death/zeroHP cannot stand up afterevent; narrow multi-enemy andlongnames cannotclip; details must retain access/focus across render; compact HUD never hides real skills/poison/counter forecast.
