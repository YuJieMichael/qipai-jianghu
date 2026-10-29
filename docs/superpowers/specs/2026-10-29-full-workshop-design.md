# 全玩法可改版设计

用户希望进入回合自动掷骰，并先加入尽可能完整的玩法、装备和成长系统，之后自行修改。沿用其“全部自动进行”和并行开发授权，例行设计、接口和数值由本轮直接落实，不再逐份请求确认。

## 交付目标

在现有原创示范中加入可玩的本地完整系统工作台。系统是参考静态机制与本项目已有玩法的原创实现；没有重用参考代码/美术，未恢复的参考数值采用公开可改的本地配置。所有已知可离线玩法类别都要有实际状态变化、资源成本/收益或可进入的战斗，不能只增加菜单标题。

1. 自动初掷：开战、下一回合、成长/奇遇/营火后的新战斗自动投骰；恢复已有pick状态不重投；保留勾选要换骰、批量重掷、手动出招。
2. 六槽装备（武器、戒指、衣甲、靴、围巾、护符），剑/法杖/锤三武器机制，品质、槽位强化、洗练候选/接受/取消、镶嵌、合成、分解、重置返还、原创套装与收藏。
3. 五骰×六面的骰匣：点数、物理面索引、材质/等级、装饰、刻印分离。七门派默认骰面与被动，保留原有三种局内构筑。连锁只扩展一次相邻骰，冻结/固定骰有可见限制，额外重掷上限6。
4. 武学装配、永久天赋、遗物/洗练/灌注/共鸣、五符文/方案/共鸣、武魂、灵兽、称号、修炼/经脉。
5. 行囊、消耗品、采集、炼丹/锻造、金币商店、软货币抽取、局内商人、宝箱/奇遇/营火。
6. 七章常规路线、首领挑战、通天塔、八室秘境、论剑、悬赏、三段押镖、本地世界首领、四轮武林大会、资源挑战和图腾挑战。
7. 章节三星/扫荡、任务/成就、每日领取/阶段宝箱、封顶离线收益、图鉴、关系/赠礼与徒弟。
8. 本地创作工具：资源补给、全目录解锁，导出/导入档案，导出/校验/应用内容配置。JSON为数据，禁止eval；数据错误有明确反馈。所有能力目录和数值集中在content.mjs，编辑档案不会改变正在进行的战斗快照。

真实联机、支付、广告、账号同步没有可用服务，当前以明确命名的本地挑战/练习提供对应离线战斗。无需伪造其他真人玩家或服务端状态。

## 状态与模块

保留原版index.html及qipai-jianghu-v1键。示范SAVE_KEY不改，run v1/v2迁移到v3，已有seed/dice/pending不重抽。新增档案键qipai-bamboo-profile-v1。无产品依赖/远程资源。

- content.mjs：JSON兼容原创目录；导出CONTENT、getContent(profile)、validateContent(value)。顶层键包括equipment,slots,rarities,sets,gems,sects,skills,talents,materials,decorations,marks,relics,runes,pets,souls,titles,recipes,shop,quests,achievements,chapters,modes,companions,training。
- profile.mjs：createProfile(seed=1,now=Date.now())、applyProfileAction(profile,action,{now}={})、deriveLoadout(profile)、beginExpedition(profile)、settleRun(profile,run,{now}={})、loadProfile(storage)、saveProfile(storage,profile)、validateProfile(value)。所有转换不可变，返回{profile,message}（begin另含runId/loadout）。Hub RNG用profile.seed，与run.seed分离。
- adventures.mjs：createExpedition(build,seed,{runId,loadout,mode='campaign',chapter='bamboo',floor=1,worldBossHp}={})、getRunNode(run)、getRunNodes(run)。新路线在run.route保存解析后的节点及倍率，旧run走NODES。
- run扩展：runId、loadout、mode/chapter/floor、route、coins、bag、consumed、settled=false。loadout为纯可序列化快照。保留hero/perks/diceSkills/choices旧结构。
- main.mjs持有profile和run，将profile、hubTab传给UI；新局用beginExpedition+createExpedition；完成或放弃旧局时settleRun一次，回门庭仍可resume。奖励不能在render里结算。档案settledRunIds防重复领取。
- hub-ui.mjs负责门庭各面板与通用表单/数据编辑器，ui.mjs保留一次创建的Canvas和战斗HUD。360px可纵向滚动，禁止横向溢出。

## 载入快照契约

`deriveLoadout`返回：

```
{label,sectId,weaponType:'sword'|'staff'|'hammer',
 effects:{attack,maxHp,armor,critChance,critDamage,lifesteal,poisonDamage,shieldGain,extraRerolls,openingShield,regen,thorns,fireDamage,freezeChance,comboBonus,goldBonus},
 dice:[{faces:[1,2,3,4,5,6],marks:[null,null,null,null,null,null],materialId:'wood',materialLevel:1,decorationId:'plain'}]×5,
 skills:[{id,name,trigger,effects}],pet:{id,name,damage,heal,shield}|null,
 relics:[{id,name,handRank,damage}],bag:{potion,reroll,antidote,tonic},
 progression:{towerFloor,worldBossHp},contentVersion:1}
```

Effects为加成：attack/maxHp在创建时加入180/12基线；armor抵每次来袭，critChance为百分比(0..75)，critDamage为额外百分比（默认50）；lifesteal为百分比；poisonDamage/shieldGain每次对应效果增加；extraRerolls与base2相加上限6；openingShield每战初始；regen每回合存活回复；thorns抵挡/受击后存活反伤；fireDamage每轮触发火伤；freezeChance百分比使当轮一名敌人伤害为0；comboBonus百分比加直伤；goldBonus百分比结算金币。未装备loadout时现有基线结果保持。

materialId固定wood/jade/iron/flame/frost/thunder/poison；decorationId固定plain/lucky/chain/blood/guard/focus/restore/fortune；mark固定null/sword/crit/poison/fire/cold/leech/heal/guard/wild。材质等级1..5。wild最多2骰枚举替代点数，只影响牌型；物理面索引用于刻印触发。

Profile至少包括version/seed/nextRunId/resources/inventory/equipped/slotLevels/dice/sectId/skills/talents/relics/runes/pet/souls/title/training/meridians/companions/apprentices/stats/chapterStars/claimed/settledRunIds/contentOverrides。装备实例{uid,templateId,refine,gems,locked}；强化在槽位，换装备保留。默认给基础可用配装、全目录可试用条目和1000金币/120材料/20精华/6悟性。编辑器补给应明确标注测试用途。

## 档案动作契约

`applyProfileAction`的action为{type,...fields}，非法动作保持原档案并返回中文message。UI使用下列动作，不修改profile全局：

- equip {uid}, unequip {slot}, enhance {slot}, downgrade {slot}, salvage {uid}, fuse {uid}, refine {uid}, refine-accept {uid}, refine-cancel {uid}, socket {uid,gemId}, unsocket {uid,index}, lock {uid}。
- sect {id}, skill {id}切换装配最多4, talent {id}, face {die,face,value}, material {die,id}, material-upgrade {die}, decoration {die,id}, mark {die,face,id}。
- relic {id}切换最多3, relic-refine {id}, relic-accept {id}, relic-cancel {id}, relic-infuse {id}, rune {slot,id}, rune-fuse {id}, rune-plan {index}, pet {id}, pet-train {id}, soul {id}最多3, title {id}。
- buy {id}, draw {}, gather {id}, craft {id}, train {id}, meridian {id}, gift {id}, recruit {id}, apprentice-train {id}。
- claim {id}, signin {}, offline {}, sweep {chapter}, codex-claim {id}, collection {id}, developer-grant {}。
- content-import {value}, content-reset {}, profile导入由validateProfile检查后控制器替换。导出只读。

任务至少覆盖通关、击杀、强化、购买、采集、修炼；收益只领取一次。离线收益默认上限12h；创作配置可将上限改为1..100小时，界面显示当前上限。倒退时间不产生收益。纯函数显式接收now。抽取只消耗本地虚拟资源，品质保底可配置。

## 战斗与路线

实际结算和预览共用resolveRound；随机暴击/冻结只消耗run.seed；不会消耗profile.seed。新增事件优先复用strike/sword/poisonApply/poisonTick/shield/counter/heal/burst；必要新事件有安全表现退路。武器剑强化顺子，法杖牌型≥两对产生群攻，锤在三条以上造成破势/额外盾。具体原创数值集中目录或命名常量。

保留现有NODES旧路线。新campaign同一三场景九节点模板可按七章倍率形成章节，加入局内商人选项；其他模式构建实际不同遭遇：boss单首领，tower单层带累积进度/HP，dungeon八室含选择/宝箱/战斗，arena单对手，worldboss持续HP，escort三战，tournament四战，resource回合限制金币战，totem带日常修正。胜负/回合限制都能正常结算返回门庭，章节三星及模式收益在档案记录。存档保存resolved route/stat参数，改配置不改变继续的关卡。

新增`useRunItem(run,id)`及局内商人动作可以纯函数测试；run.bag快照，run.consumed记录消耗，settle时扣除档案一次。开始另局前结算放弃旧局，不能通过重复render/resume领取奖励。

## 验收

先对auto-roll写失败测试；profile/costs/refine/fusion/claim/content validation、equipment→loadout→combat、face-index/wild/chain、每种模式通关/失败/恢复与一次结算做有意义的行为测试。完整基线80项保留或按明确版本/自动投骰变化更新。浏览器实测：直接进入pick、选骰/重掷/出招、装备修改与下一局生效、消费/强化/洗练、骰面/材质、商店、一次模式奖励与恢复、JSON导入错误、360px和桌面、控制台。覆盖清单区分实际参考证据与原创适配，未实现项不能写已完成。
