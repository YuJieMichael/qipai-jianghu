import {handOf, rewardPreview} from './model.mjs';

const NUMERALS = ['壹', '贰', '叁', '肆', '伍'];
const CHAPTERS = ['青岚山径', '竹影初深', '林间伏击', '石阶问剑', '山门试锋', '青岚守关'];
const PIPS = {0:[], 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8]};
const CHOICE_GLYPHS = {sword:'剑', face:'六', vitality:'元'};
const CHOICE_CAPTIONS = {sword:'御剑 · 骰技', face:'炼骰 · 改面', vitality:'吐纳 · 气血'};

/** A persistent DOM shell: animation snapshots update nodes without replacing the canvas or focused controls. */
export function createAdventureUI(root, onAction) {
  const document = root.ownerDocument ?? globalThis.document;
  let state = null, options = {}, destroyed = false;
  let selection = {choiceId:null, index:null}, rewardKey = '', submitted = false;
  let activeModal = null, restoreFocus = null, dialogFocusPending = false;
  const enemyNodes = new Map(), choiceNodes = new Map();

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(className, action, text, value) {
    const element = node('button', className, text);
    element.type = 'button'; element.setAttribute('data-action', action);
    if (value !== undefined) element.setAttribute('data-value', value);
    return element;
  }
  function text(element, value) {
    const next = String(value ?? '');
    if (element.textContent !== next) element.textContent = next;
  }
  function health(className) {
    const box = node('div', className), bar = node('span','renewal-health-track'), fill = node('span','renewal-health-fill');
    bar.appendChild(fill); box.appendChild(bar);
    return {box,fill};
  }
  function updateHealth(fill, hp, maxHp) {
    fill.style.width = `${Math.max(0, Math.min(100, maxHp ? hp / maxHp * 100 : 0))}%`;
  }
  function dieFace() {
    const face = node('span', 'renewal-die-face'), pips = Array.from({length:9}, () => node('i', 'renewal-pip'));
    face.setAttribute('aria-hidden','true'); pips.forEach(pip=>face.appendChild(pip));
    return {face,pips};
  }
  function showFace(pips, value) {
    const visible = PIPS[value] ?? [];
    pips.forEach((pip, index)=>pip.classList.toggle('is-visible',visible.includes(index)));
  }
  function resetSelection() { selection = {choiceId:null,index:null}; submitted = false; }
  function canPlay() { return !!state && state.phase === 'battle' && !options.busy && !options.paused; }
  function chosen() { return state?.choices.find(choice=>choice.id===selection.choiceId) ?? null; }
  function isValidDie(index) { return Number.isInteger(index) && !!state?.dice[index]?.unlocked; }
  function chosenPreview() {
    const choice = chosen();
    if (!choice || choice.kind !== 'vitality' && !isValidDie(selection.index)) return null;
    return rewardPreview(state,choice.id,choice.kind==='vitality'?undefined:selection.index);
  }
  function formatPreview(preview) { return preview ? `${preview.before} → ${preview.after}` : ''; }
  function setPressed(element, pressed) { element.setAttribute('aria-pressed',String(pressed)); element.classList.toggle('is-selected',pressed); }

  const shell = node('section','renewal-game'); shell.setAttribute('aria-label','青岚试炼');
  const canvas = node('canvas','renewal-canvas'); canvas.setAttribute('aria-hidden','true');
  const worldShade = node('div','renewal-world-shade'); worldShade.setAttribute('aria-hidden','true');
  const header = node('header','renewal-header');
  const chapter = node('div','renewal-chapter');
  const chapterSeal = node('span','renewal-chapter-seal','岚');
  const chapterText = node('div','renewal-chapter-text');
  const title = node('h1','','青岚试炼'), stageName = node('span','renewal-stage-name'); chapterText.append(title,stageName); chapter.append(chapterSeal,chapterText);
  const headerEnd = node('div','renewal-header-end'), round = node('span','renewal-round');
  const settings = button('renewal-icon-button','settings','Ⅱ'); settings.setAttribute('aria-label','暂停与设置'); settings.title='暂停与设置';
  headerEnd.append(round,settings);header.append(chapter,headerEnd);
  const progress = node('div','renewal-progress');progress.setAttribute('aria-label','试炼进度');
  const progressDots = Array.from({length:6},(_,i)=>{const dot=node('span','renewal-progress-step',String(i+1));progress.appendChild(dot);return dot;});
  const targets = node('div','renewal-targets');targets.setAttribute('aria-label','选择攻击目标');
  const hero = health('renewal-hero-health');
  const heroLabel = node('div','renewal-hero-label'), heroTitle = node('strong','','青衣侠客'), heroNumbers = node('span','renewal-hp-numbers');
  heroLabel.append(heroTitle,heroNumbers);hero.box.appendChild(heroLabel);
  const shield = node('span','renewal-shield');hero.box.appendChild(shield);
  const message = node('p','renewal-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');

  const controls = node('section','renewal-controls');controls.setAttribute('aria-label','骰子与出招');
  const diceHeading = node('div','renewal-dice-heading');
  const diceHint = node('span','renewal-dice-hint','点击单骰重掷 · 立即触发骰技'), rerolls = node('strong','renewal-rerolls');
  diceHeading.append(diceHint,rerolls);
  const diceTray = node('div','renewal-dice-tray');
  const diceNodes = Array.from({length:5},(_,index)=>{
    const die = button('renewal-die','reroll',undefined,index);die.setAttribute('data-die-index',index);
    const number=node('span','renewal-die-number',NUMERALS[index]);const {face,pips}=dieFace();
    const lock=node('span','renewal-die-lock');lock.setAttribute('aria-hidden','true');
    const caption=node('span','renewal-die-caption');die.append(number,face,lock,caption);diceTray.appendChild(die);
    return {die,face,pips,lock,caption};
  });
  const actionRow = node('div','renewal-action-row'), hand = node('div','renewal-hand');
  const handTop = node('div','renewal-hand-top'), handName=node('strong','renewal-hand-name'), multiplier=node('span','renewal-multiplier');handTop.append(handName,multiplier);
  const damageLine=node('div','renewal-damage-line'),damageLabel=node('span','','出招伤害'),damage=node('strong','renewal-damage');damageLine.append(damageLabel,damage);hand.append(handTop,damageLine);
  const attack = button('renewal-attack','attack');const attackIcon=node('span','renewal-attack-icon','剑'),attackText=node('span','renewal-attack-copy');
  const attackTitle=node('strong','','出 招'),attackCaption=node('small','','攻击选中目标');attackText.append(attackTitle,attackCaption);attack.append(attackIcon,attackText);actionRow.append(hand,attack);
  controls.append(diceHeading,diceTray,actionRow);

  const rewardOverlay=node('div','renewal-overlay renewal-reward-overlay');
  const rewardPanel=node('section','renewal-reward-panel');rewardPanel.setAttribute('role','dialog');rewardPanel.setAttribute('aria-modal','true');rewardPanel.setAttribute('aria-labelledby','renewal-reward-title');
  const rewardHeader=node('header','renewal-reward-header');const rewardEyebrow=node('span','renewal-eyebrow','战胜 · 得悟');
  const rewardTitle=node('h2','','择一修炼');rewardTitle.id='renewal-reward-title';const rewardSubtitle=node('p','renewal-reward-subtitle','选一项成长，带着新招继续上山');
  rewardHeader.append(rewardEyebrow,rewardTitle,rewardSubtitle);
  const rewardCards=node('div','renewal-reward-cards');
  const rewardTarget=node('section','renewal-reward-target');rewardTarget.setAttribute('aria-label','选择成长目标骰');
  const targetTitle=node('strong','renewal-target-title','选择一颗骰子'),rewardDice=node('div','renewal-reward-dice');
  const rewardDieNodes=Array.from({length:5},(_,index)=>{
    const die=button('renewal-reward-die','pick-die',undefined,index);const {face,pips}=dieFace();const label=node('span','',`第${index+1}骰`);die.append(face,label);rewardDice.appendChild(die);return{die,pips,label};
  });rewardTarget.append(targetTitle,rewardDice);
  const rewardPreviewNode=node('p','renewal-reward-preview');rewardPreviewNode.setAttribute('data-action','reward-preview');rewardPreviewNode.setAttribute('aria-live','polite');
  const rewardActions=node('div','renewal-dialog-actions'),cancel=button('renewal-secondary-button','cancel-choice','返回重选'),confirm=button('renewal-primary-button','confirm-choice','确认 · 继续上山');rewardActions.append(cancel,confirm);
  rewardPanel.append(rewardHeader,rewardCards,rewardTarget,rewardPreviewNode,rewardActions);rewardOverlay.appendChild(rewardPanel);

  const settingsOverlay=node('div','renewal-overlay renewal-settings-overlay'),settingsPanel=node('section','renewal-settings-panel');
  settingsPanel.setAttribute('role','dialog');settingsPanel.setAttribute('aria-modal','true');settingsPanel.setAttribute('aria-labelledby','renewal-settings-title');
  const settingsEyebrow=node('span','renewal-eyebrow','山风稍歇'),settingsTitle=node('h2','','稍作歇息');settingsTitle.id='renewal-settings-title';
  const mute=button('renewal-setting-button','mute'),motion=button('renewal-setting-button','motion'),resume=button('renewal-primary-button','resume','继续试炼'),restart=button('renewal-secondary-button','restart','重新出发'),workshop=button('renewal-text-button','workshop','前往江湖工坊 ↗');
  settingsPanel.append(settingsEyebrow,settingsTitle,mute,motion,resume,restart,workshop);settingsOverlay.appendChild(settingsPanel);

  const resultOverlay=node('div','renewal-overlay renewal-result-overlay'),resultPanel=node('section','renewal-result-panel');resultPanel.setAttribute('role','dialog');resultPanel.setAttribute('aria-modal','true');resultPanel.setAttribute('aria-labelledby','renewal-result-title');
  const resultSeal=node('div','renewal-result-seal'),resultTitle=node('h2','');resultTitle.id='renewal-result-title';const resultText=node('p','renewal-result-text'),resultStats=node('div','renewal-result-stats'),resultRestart=button('renewal-primary-button','restart','再闯青岚'),resultWorkshop=button('renewal-text-button','workshop','前往江湖工坊 ↗');
  resultPanel.append(resultSeal,resultTitle,resultText,resultStats,resultRestart,resultWorkshop);resultOverlay.appendChild(resultPanel);
  shell.append(canvas,worldShade,header,progress,targets,hero.box,message,controls,rewardOverlay,resultOverlay,settingsOverlay);
  root.classList.add('renewal-root');root.replaceChildren(shell);

  function renderEnemies() {
    const ids=new Set(state.enemies.map(enemy=>enemy.id));
    for(const [id,item] of enemyNodes)if(!ids.has(id)){item.button.remove();enemyNodes.delete(id);}
    state.enemies.forEach((enemy,index)=>{
      let item=enemyNodes.get(enemy.id);
      if(!item){
        const target=button('renewal-enemy-target','target',undefined,enemy.id);target.setAttribute('data-enemy-id',enemy.id);
        const pointer=node('span','renewal-target-pointer','▼'),name=node('strong','renewal-enemy-name'),hp=health('renewal-enemy-health'),numbers=node('span','renewal-enemy-numbers');
        target.append(pointer,name,hp.box,numbers);targets.appendChild(target);item={button:target,pointer,name,fill:hp.fill,numbers};enemyNodes.set(enemy.id,item);
      }
      const x=state.enemies.length===1?.5:state.enemies.length===2?[.28,.72][index]:(index+1)/(state.enemies.length+1);
      item.button.style.left=`${x*100}%`;
      text(item.name,enemy.name);text(item.numbers,`${Math.max(0,enemy.hp)} / ${enemy.maxHp}`);updateHealth(item.fill,enemy.hp,enemy.maxHp);
      const selected=enemy.id===state.targetId&&enemy.hp>0;setPressed(item.button,selected);item.pointer.hidden=!selected;
      item.button.disabled=!canPlay()||enemy.hp<=0;item.button.hidden=enemy.hp<=0;
      item.button.setAttribute('aria-label',`${enemy.name}，气血 ${Math.max(0,enemy.hp)}/${enemy.maxHp}${selected?'，当前目标':''}`);
    });
  }
  function renderRewards() {
    rewardOverlay.hidden=state.phase!=='reward';
    if(state.phase!=='reward')return;
    const ids=new Set(state.choices.map(choice=>choice.id));
    for(const[id,item]of choiceNodes)if(!ids.has(id)){item.button.remove();choiceNodes.delete(id);}
    const selected=chosen();
    state.choices.forEach(choice=>{
      let item=choiceNodes.get(choice.id);
      if(!item){
        const card=button(`renewal-reward-card renewal-reward-card-${choice.kind}`,'pick-choice',undefined,choice.id);
        const glyph=node('span','renewal-reward-glyph',CHOICE_GLYPHS[choice.kind]??'悟'),body=node('span','renewal-reward-card-body');
        const top=node('span','renewal-reward-card-top'),name=node('strong'),kind=node('small','renewal-reward-kind',CHOICE_CAPTIONS[choice.kind]??'修炼');top.append(name,kind);
        const description=node('span','renewal-reward-description'),preview=node('span','renewal-card-preview');body.append(top,description,preview);const check=node('span','renewal-reward-check','✓');card.append(glyph,body,check);rewardCards.appendChild(card);item={button:card,name,description,preview,check};choiceNodes.set(choice.id,item);
      }
      text(item.name,choice.name);text(item.description,choice.description);
      const previewIndex=choice.kind==='vitality'?undefined:isValidDie(selection.index)?selection.index:state.dice.findIndex(die=>die.unlocked);
      text(item.preview,formatPreview(rewardPreview(state,choice.id,previewIndex)));
      setPressed(item.button,choice.id===selection.choiceId);item.check.hidden=choice.id!==selection.choiceId;item.button.disabled=!!options.busy||!!options.paused||submitted;
    });
    const needsDie=!!selected&&selected.kind!=='vitality';rewardTarget.hidden=!needsDie;
    text(targetTitle,needsDie?'选择一颗骰子':'');
    rewardDieNodes.forEach((item,index)=>{
      const die=state.dice[index];item.die.disabled=!die?.unlocked||!!options.busy||!!options.paused||submitted;
      setPressed(item.die,selection.index===index);item.die.classList.toggle('is-locked',!die?.unlocked);showFace(item.pips,die?.value||6);
      text(item.label,die?.unlocked?`第${index+1}骰`:'未解锁');item.die.setAttribute('aria-label',die?.unlocked?`第${index+1}骰，${die.skill==='sword'?`剑气${die.level}级`:'无骰技'}`:`第${index+1}骰，未解锁`);
    });
    const preview=chosenPreview();
    text(rewardPreviewNode,preview?formatPreview(preview):selected?'点选下方骰子，查看修炼变化':'选择一项成长');
    confirm.disabled=!preview||!!options.busy||!!options.paused||submitted;
    cancel.disabled=!selected||!!options.busy||!!options.paused||submitted;
  }
  function dialogControls(dialog) {
    return [...dialog.querySelectorAll('[data-action]')].filter(control=>{
      if(control.tagName!=='BUTTON'||control.disabled)return false;
      for(let parent=control;parent&&parent!==dialog;parent=parent.parentNode)if(parent.hidden)return false;
      return true;
    });
  }
  function syncDialogFocus() {
    const next=options.paused?settingsOverlay:state.phase==='reward'?rewardOverlay:['won','lost'].includes(state.phase)?resultOverlay:null;
    if(next!==activeModal){
      if(!activeModal&&next)restoreFocus=root.contains(document.activeElement)?document.activeElement:null;
      activeModal=next;dialogFocusPending=!!next;
      if(!next&&restoreFocus){if(root.contains(restoreFocus)&&!restoreFocus.disabled)restoreFocus.focus();restoreFocus=null;}
    }
    if(activeModal&&dialogFocusPending&&(!options.busy||activeModal!==rewardOverlay)){
      const first=dialogControls(activeModal)[0];if(first){first.focus();dialogFocusPending=false;}
    }
  }
  function render(nextState, opts={}) {
    if(destroyed)return;
    state=nextState;options={busy:false,muted:false,reducedMotion:false,paused:false,message:'',...opts};
    const key=state.phase==='reward'?`${state.seed}:${state.stage}:${state.choices.map(choice=>choice.id).join('|')}`:'';
    if(key!==rewardKey){rewardKey=key;resetSelection();}
    shell.classList.toggle('is-busy',!!options.busy);shell.classList.toggle('is-reduced-motion',!!options.reducedMotion);
    shell.classList.toggle('is-paused',!!options.paused);shell.setAttribute('data-phase',state.phase);
    text(stageName,`${CHAPTERS[state.stage]??'青岚山径'} · ${String(state.stage+1).padStart(2,'0')}/06`);text(round,`第 ${state.round} 回合`);
    progressDots.forEach((dot,index)=>{dot.classList.toggle('is-complete',index<state.stage);dot.classList.toggle('is-current',index===state.stage);dot.setAttribute('aria-current',index===state.stage?'step':'false');});
    text(heroNumbers,`${Math.max(0,state.hero.hp)} / ${state.hero.maxHp}`);updateHealth(hero.fill,state.hero.hp,state.hero.maxHp);text(shield,`护盾 ${state.hero.shield}`);shield.hidden=!state.hero.shield;
    text(message,options.message||(options.busy?'剑意流转…':state.phase==='battle'&&state.round===1&&state.stage===0?'点击骰子，试试御剑之术':''));message.hidden=!message.textContent;
    text(rerolls,`重掷 ${state.rerolls}`);rerolls.classList.toggle('is-empty',state.rerolls===0);
    diceNodes.forEach((item,index)=>{
      const die=state.dice[index],unlocked=!!die?.unlocked;item.die.disabled=!canPlay()||!unlocked||state.rerolls<=0;
      item.die.classList.toggle('is-locked',!unlocked);item.die.classList.toggle('has-sword',unlocked&&die.skill==='sword');item.face.hidden=!unlocked;item.lock.hidden=unlocked;
      showFace(item.pips,unlocked?die.value:0);text(item.caption,unlocked?(die.skill==='sword'?`剑气 ${die.level} 级`:'无骰技'):`第${index}战后解锁`);
      item.die.setAttribute('aria-label',unlocked?`第${index+1}骰，${die.value}点，${die.skill==='sword'?`剑气${die.level}级，`:''}点击立即重掷`:`第${index+1}骰，未解锁`);
    });
    const result=handOf(state);text(handName,result.name);text(multiplier,`×${result.multiplier}`);text(damage,result.damage);
    attack.disabled=!canPlay();text(attackCaption,options.busy?'招式演出中':'攻击选中目标');
    renderEnemies();renderRewards();
    settingsOverlay.hidden=!options.paused;text(mute,`音效${options.muted?'已关闭':'已开启'}　${options.muted?'○':'♪'}`);mute.setAttribute('aria-pressed',String(options.muted));text(motion,`减少动态${options.reducedMotion?'已开启':'已关闭'}　${options.reducedMotion?'●':'○'}`);motion.setAttribute('aria-pressed',String(options.reducedMotion));
    const finished=state.phase==='won'||state.phase==='lost';resultOverlay.hidden=!finished;
    if(finished){const won=state.phase==='won';text(resultSeal,won?'胜':'侠');text(resultTitle,won?'青岚试炼 · 通关':'胜败乃江湖常事');text(resultText,won?'六战登顶，剑意已成。':'收剑养息，再试一程。');text(resultStats,`${Math.min(6,state.stage+(won?1:0))} / 6 场　·　总伤害 ${state.stats.damage}　·　重掷 ${state.stats.rerolls} 次`);}
    controls.setAttribute('aria-hidden',String(state.phase!=='battle'||options.paused));
    syncDialogFocus();
  }
  function click(event) {
    if(destroyed||!state)return;
    const control=event.target?.closest?.('[data-action]');
    if(!control||control.tagName!=='BUTTON'||!root.contains(control)||control.disabled)return;
    const {action,value}=control.dataset;
    if(action==='pick-choice'){
      if(state.phase!=='reward'||options.busy||options.paused||submitted||!state.choices.some(choice=>choice.id===value))return;
      selection={choiceId:value,index:null};renderRewards();return;
    }
    if(action==='pick-die'){
      const index=Number(value);if(state.phase!=='reward'||!chosen()||chosen().kind==='vitality'||options.busy||options.paused||submitted||!isValidDie(index))return;
      selection.index=index;renderRewards();return;
    }
    if(action==='cancel-choice'){if(state.phase==='reward'&&!options.busy&&!options.paused&&!submitted){resetSelection();renderRewards();}return;}
    if(action==='confirm-choice'){
      if(state.phase!=='reward'||options.busy||options.paused||submitted||!chosenPreview())return;
      const choice=chosen(),action={type:'choose',choiceId:choice.id};if(choice.kind!=='vitality')action.index=selection.index;
      submitted=true;renderRewards();onAction(action);return;
    }
    if(action==='reroll'){if(canPlay()&&isValidDie(Number(value))&&state.rerolls>0)onAction({type:'reroll',index:Number(value)});return;}
    if(action==='target'){if(canPlay()&&state.enemies.some(enemy=>enemy.id===value&&enemy.hp>0))onAction({type:'target',id:value});return;}
    if(action==='attack'){if(canPlay())onAction({type:'attack'});return;}
    if(['settings','pause','resume','mute','motion','restart','workshop'].includes(action))onAction({type:action});
  }
  function keydown(event) {
    if(destroyed||!state)return;
    if(event.key==='Tab'&&activeModal){
      const controls=dialogControls(activeModal),first=controls[0],last=controls.at(-1),focused=document.activeElement;
      if(!first){event.preventDefault();return;}
      if(event.shiftKey&&focused===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&focused===last||!activeModal.contains(focused)){event.preventDefault();first.focus();}
      return;
    }
    if(event.key!=='Escape')return;
    if(state.phase==='reward'&&selection.choiceId&&!options.busy&&!options.paused){event.preventDefault();resetSelection();renderRewards();}
    else if(options.paused){event.preventDefault();onAction({type:'resume'});}
    else if(state.phase==='battle'){event.preventDefault();onAction({type:'pause'});}
  }
  root.addEventListener('click',click);root.addEventListener('keydown',keydown);
  rewardOverlay.hidden=true;settingsOverlay.hidden=true;resultOverlay.hidden=true;
  return {canvas,render,destroy(){if(destroyed)return;destroyed=true;root.removeEventListener('click',click);root.removeEventListener('keydown',keydown);shell.remove();root.classList.remove('renewal-root');}};
}
