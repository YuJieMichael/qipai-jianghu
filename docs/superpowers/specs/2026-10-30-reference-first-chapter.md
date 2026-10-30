# 七派江湖：青岚试炼重构

## 目标
回应用户“和六六英雄完全不一样”的反馈。先完成一个手机竖屏的连续冒险：首战、三选一、选择目标骰、下一战，最终可打完六场。验收重点是操作和画面，而不是系统数量。用户此前授权自动推进、并行开发、整合审查与推送部署，本次“继续”确认这一纠偏方向。

## 证据和限制
- App Store 官方预览已人工查看：竖屏纵深战场，敌人在上、主角在下，骰盘和出招在底部，生命与战场结合。
- App Store 专题 id1874544364 明确描述重掷触发剑气、绑定多骰和升级；本地1.4.2静态核查支持单骰重掷扣一次机会、五槽渐解锁、改面和目标骰成长。
- 本次仍不是参考游戏完整还原，也没有实机运行参考APK。美术、关卡和参数原创；示范长度和自动解锁安排是本项目设计。

## 方案
`demo/index.html`默认进入新的青岚试炼。旧版全部系统留在`demo/workshop.html`，旧存档不迁移、不覆盖。新代码位于`demo/renewal/`，无新增产品依赖。独立localStorage键`qipai-reference-chapter-v1`。

竖屏画面以明亮青绿石径和原创精灵角色为主，Canvas占满战场，DOM只叠加当前决策信息。主角在下方中央，敌人在上方；五骰槽始终可见，初始一骰，前四场胜利逐步打开其余骰位。点一颗已解锁骰即花一次机会重掷，立即演出该骰的剑气。每回合自动投骰，初掷也触发骰技；出招执行牌型攻击后才轮到敌人。技能伤害可以在按出招前击杀敌人并进入成长。起手不再预选固定传承。

六场战斗使用同一美术场景及不同敌群，最后首领。每场胜利进入三选一；剑气绑定/升级、将目标骰最小面改为6、生命成长有明确前后值。先选条目再选目标骰；关闭或重选不会修改状态。选择完成自动进入下一战。完整失败、重试、暂停、静音、减少动态、存档恢复。

## 共享接口
模型`model.mjs`导出`newAdventure(seed=1)`, `act(state,action)`, `handOf(state)`, `validateAdventure(value)`, `SAVE_KEY`。`act`返回`{state,events}`，无效动作返回原state与空events。

State字段：`version:1,seed,phase:'battle'|'reward'|'won'|'lost',stage:0..5,round,hero:{hp,maxHp,attack,shield},dice:[{id,unlocked,faces:[6整数],value,skill:null|'sword',level}],rerolls,enemies:[{id,kind:'bandit'|'archer'|'sentinel'|'boss',name,hp,maxHp,attack}],targetId,choices:[{id,kind:'sword'|'face'|'vitality',name,description,rarity}],stats:{damage,kills,rerolls,rounds},history:[]`。

Action：`{type:'reroll',index}`, `{type:'attack'}`, `{type:'target',id}`, `{type:'choose',choiceId,index?}`, `{type:'restart',seed?}`。剑气/改面必须目标骰有效，生命不需index。choice选择由UI暂存，确认时才act choose。

Event：`{type,source,target?,amount?,dieIndex?,text?,snapshot:State}`；type为`roll,sword,attack,hurt,death,unlock,reward,heal`。snapshot为事件当时独立状态，事件源为`hero`或敌id。输入动作先原子结算，控制器锁住输入，再按事件snapshot演出，保存只保存最终合法状态。

UI `createAdventureUI(root,onAction)`返回`{canvas,render(state,opts),destroy()}`。opts为`{busy,muted,reducedMotion,paused,message}`。UI可以发`settings,pause,resume,mute,motion,workshop`给控制器。局部选卡/选骰由UI处理，最终发choose。保留canvas身份。场景`createAdventureScene(canvas,{backgroundUrl,spritesUrl})`返回`{ready,update(state),play(events,{reducedMotion,onFrame}),destroy()}`；`play`每事件调用onFrame(snapshot)。主控负责存档、音频、页面入口和初始化。

美术路径`assets/forest-path.png`,`assets/characters.png`，后者四列透明角色图集，依次侠客、刀客、弩手、山门守将；sentinel复用守将。实际尺寸和裁切在生成后通知场景实现者。

实施裁定：`newAdventure`保留未初掷状态，由控制器自动调用新增`begin`动作以演出初掷；新增`rewardPreview`共享真实成长前后值。首领胜利直接进入won，因此共五次成长。剑气按已知描述攻击全体存活敌人，目标选择只影响手动出招。普通高度敌人居中y=.34，700px以下y=.29，血条随之上移，主角按实际血条位置避让。默认静态服务仅扩展renewal和assets两层目录白名单。贴图等待最多4.5秒，后台晚到仍可显示；BFCache暂存页面不销毁挂载。

## 验收
- 新开局一颗可操作骰、四颗锁定；单骰重掷扣一次，未选骰不变，剑气在按出招前造成伤害。
- 击杀、成长、选骰、开下一战完整，取消无修改，恢复不重抽；错误存档不崩溃。
- 360×800及390×844核心操作一屏可用；桌面保持竖屏舞台，不铺成文字仪表盘。
- 原创角色和场景图片真实加载，动作/飞剑/伤害可辨；控制台无错误。
- 浏览器从首战实际玩到下一战，自动模拟到胜负；已有工作台测试继续通过。
- 线上替换同一Sites项目、保持原有私有权限，不创建新站。不得把截图观察写成参考游戏实机还原。
