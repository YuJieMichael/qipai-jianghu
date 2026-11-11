/** Pure local combat. Verified static reference timing: roll → charge → attack → sword release. */
import {createEncounter} from './chapters.mjs';
export const SAVE_KEY = 'qipai-reference-chapter-v1';
const STARTING_HP = 120;
const STARTING_ATTACK = 14;
const REROLLS_PER_ROUND = 3;
const SWORD_DAMAGE = 4;
const FLAME_DAMAGE = 7;
const GUARD_SHIELD = 6;
const SHIELD_CAP = 60;
const VITALITY_MAX_HP = 24;
const VITALITY_HEAL = 32;
const MAX_SKILL_LEVEL = 20;
const MAX_NUMBER = 1_000_000;
const MAX_COUNTER = 1_000_000_000;
const MAX_HISTORY = 40;
const SKILL_NAMES = {sword:'剑影',flame:'烈火',guard:'护体'};
const isSkill = kind => typeof kind === 'string' && Object.hasOwn(SKILL_NAMES,kind);
const HAND_NAMES = ['散招','一对','两对','三条','顺子','葫芦','四条','五同'];
// Local balance parameters; reference-game final damage was not runtime-verified.
const HAND_MULTIPLIERS = [1,1.5,2,2.5,3,3.5,5,10];
export const EMPTY_LOADOUT = Object.freeze({attack:0,maxHp:0,armor:0,sword:0,flame:0,guard:0,weapon:'sword'});
const encounter = (stage,chapterId=1) => createEncounter(chapterId,stage);

export function newAdventure(seed = 1, options = {}) {
  const chapterId=options.chapterId===2?2:1;
  const loadout=validLoadout(options.loadout)?structuredClone(options.loadout):{...EMPTY_LOADOUT};
  const enemies=encounter(0,chapterId);
  const hp=(chapterId===2?160:STARTING_HP)+loadout.maxHp;
  return {
    version:2, chapterId,runId:validRunId(options.runId)?options.runId:0,loadout,charges:0, seed:Number.isFinite(seed) ? Number(seed) >>> 0 : 1,
    phase:'battle', stage:0, round:1,
    hero:{hp,maxHp:hp,attack:(chapterId===2?20:STARTING_ATTACK)+loadout.attack,shield:0},
    dice:Array.from({length:5}, (_, index) => ({
      id:`die-${index}`, unlocked:index === 0, faces:[1,2,3,4,5,6], value:0,
      skill:index === 0 ? 'sword' : null, level:index === 0 ? 1 : 0,
    })),
    rerolls:REROLLS_PER_ROUND, enemies, targetId:enemies[0].id,
    choices:[], stats:{damage:0,kills:0,rerolls:0,rounds:0}, history:[],
  };
}

const integer = (value, min = 0, max = MAX_NUMBER) => Number.isSafeInteger(value) && value >= min && value <= max;
const shortString = (value, max = 80) => typeof value === 'string' && value.length > 0 && value.length <= max;
const arrayOf = (value, min, max, check) => Array.isArray(value) && value.length >= min && value.length <= max &&
  Reflect.ownKeys(value).length === value.length + 1 && Array.from(value).every(check);
const record = (value, keys) => {
  if (value === null || typeof value !== 'object' || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
};

/** Strict bounded data validation, rather than trusting objects from localStorage. */
function validateLegacy(value) {
  try {
    if (!record(value,['version','seed','phase','stage','round','hero','dice','rerolls','enemies','targetId','choices','stats','history']) ||
      value.version !== 1 || !integer(value.seed,0,4294967295) ||
      !['battle','reward','won','lost'].includes(value.phase) || !integer(value.stage,0,5) || !integer(value.round,1) ||
      !integer(value.rerolls,0,REROLLS_PER_ROUND)) return false;
    const hero = value.hero;
    if (!record(hero,['hp','maxHp','attack','shield']) || !integer(hero.maxHp,1) ||
      !integer(hero.hp,0,hero.maxHp) || !integer(hero.attack,1) || !integer(hero.shield)) return false;
    if ((value.phase === 'lost') !== (hero.hp === 0)) return false;
    if (!arrayOf(value.dice,5,5,die => record(die,['id','unlocked','faces','value','skill','level']) &&
      shortString(die.id) && typeof die.unlocked === 'boolean' &&
      arrayOf(die.faces,6,6,face => integer(face,1,6)) && integer(die.value,0,6) &&
      (die.value === 0 || die.faces.includes(die.value)) &&
      ((die.skill === null && die.level === 0) || (isSkill(die.skill) && integer(die.level,1,MAX_SKILL_LEVEL))) &&
      (die.unlocked || (die.value === 0 && die.skill === null && die.faces.every((face,index) => face === index+1))))) return false;
    if (new Set(value.dice.map(die => die.id)).size !== 5) return false;
    const unlocked = Math.min(5,value.stage + (value.phase === 'reward' ? 2 : 1));
    if (value.dice.some((die,index) => die.unlocked !== (index < unlocked))) return false;
    if (!arrayOf(value.enemies,1,4,enemy => record(enemy,['id','kind','name','hp','maxHp','attack']) &&
      shortString(enemy.id) && ['bandit','archer','sentinel','boss'].includes(enemy.kind) && shortString(enemy.name) &&
      integer(enemy.maxHp,1) && integer(enemy.hp,0,enemy.maxHp) && integer(enemy.attack))) return false;
    if (new Set(value.enemies.map(enemy => enemy.id)).size !== value.enemies.length) return false;
    const alive = living(value);
    if (alive.length ? !alive.some(enemy => enemy.id === value.targetId) : value.targetId !== null) return false;
    if (value.phase === 'battle' && !alive.length) return false;
    if (['reward','won'].includes(value.phase) && alive.length) return false;
    if (value.phase === 'won' && value.stage !== 5) return false;
    if (value.phase === 'reward') {
      if (value.stage === 5 || !arrayOf(value.choices,3,3,choice =>
        record(choice,['id','kind','name','description','rarity']) && ['sword','flame','guard','face','vitality'].includes(choice.kind) &&
        choice.id === `s${value.stage}-${choice.kind}` && shortString(choice.name) &&
        shortString(choice.description,240) && ['common','uncommon','rare'].includes(choice.rarity)) ||
        new Set(value.choices.map(choice => choice.kind)).size !== 3) return false;
    } else if (!arrayOf(value.choices,0,0,() => false)) return false;
    if (!record(value.stats,['damage','kills','rerolls','rounds']) ||
      !Object.values(value.stats).every(number => integer(number,0,MAX_COUNTER)) ||
      !arrayOf(value.history,0,MAX_HISTORY,entry => shortString(entry,240))) return false;
    const zeroUnrolled = value.dice.some(die => die.unlocked && die.value === 0);
    if (value.phase === 'battle' && zeroUnrolled) {
      if (!pending(value) || value.rerolls !== REROLLS_PER_ROUND || hero.hp !== hero.maxHp ||
        !Object.values(value.stats).every(number => number === 0) || value.history.length ||
        value.enemies.some(enemy => enemy.hp !== enemy.maxHp)) return false;
    } else if (value.stats.rounds === 0) return false;
    return true;
  } catch {
    return false;
  }
}

const validRunId=value=>value===0 || typeof value==='string' && /^run-[1-9][0-9]{0,9}$/.test(value) && Number(value.slice(4))<=MAX_COUNTER;
const validLoadout=value=>record(value,['attack','maxHp','armor','sword','flame','guard','weapon']) &&
 ['attack','maxHp','armor','sword','flame','guard'].every(key=>integer(value[key],0,1000)) && ['sword','staff','hammer'].includes(value.weapon);

export function validateAdventure(value){
 try {
  if(value?.version===1)return validateLegacy(value);
  if(!record(value,['version','chapterId','runId','loadout','charges','seed','phase','stage','round','hero','dice','rerolls','enemies','targetId','choices','stats','history']) ||
   value.version!==2 || ![1,2].includes(value.chapterId) || !validRunId(value.runId) || !integer(value.charges,0,60) || !validLoadout(value.loadout))return false;
  if(!arrayOf(value.enemies,1,4,()=>true))return false;
  const enemies=value.enemies.map(e=>{
   const keys=['id','kind','name','hp','maxHp','attack'];
   if(e?.kind==='boss' && (Object.hasOwn(e,'intent') || Object.hasOwn(e,'phase'))){
    if(!record(e,[...keys,'intent','phase'])||!['strike','charge','heavy'].includes(e.intent)||![1,2].includes(e.phase))throw Error('boss');
   }else if(!record(e,keys))throw Error('enemy');
   return Object.fromEntries(keys.map(k=>[k,e[k]]));
  });
  const legacy={...value,version:1,enemies};for(const k of ['chapterId','runId','loadout','charges'])delete legacy[k];
  return validateLegacy(legacy);
 }catch{return false;}
}

/** Upgrade data only: never roll, heal, consume a reward, or replay an old effect. */
export function migrateAdventure(value){
 if(!validateAdventure(value))return null;
 if(value.version===2)return structuredClone(value);
 const next={...structuredClone(value),version:2,chapterId:1,runId:0,loadout:{...EMPTY_LOADOUT},charges:0};
 for(const e of next.enemies)if(e.kind==='boss'){e.intent='strike';e.phase=1;}
 for(const c of next.choices){const fresh=rewardChoices(next.stage).find(v=>v.kind===c.kind);if(fresh)c.description=fresh.description;}
 return next;
}

export function handOf(state) {
  const values = (state?.dice ?? []).filter(die => die.unlocked).map(die => die.value);
  let rank = 0;
  if (values.length && values.every(value => Number.isInteger(value) && value >= 1 && value <= 6)) {
    const counts = [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map()).values()].sort((a,b) => b-a);
    const ordered = [...values].sort((a,b) => a-b);
    if (counts[0] === 5) rank = 7;
    else if (counts[0] === 4) rank = 6;
    else if (counts[0] === 3 && counts[1] === 2) rank = 5;
    else if (values.length === 5 && ordered.every((value,index) => index === 0 || value === ordered[index-1] + 1)) rank = 4;
    else if (counts[0] === 3) rank = 3;
    else if (counts[0] === 2 && counts[1] === 2) rank = 2;
    else if (counts[0] === 2) rank = 1;
  }
  const points=values.reduce((n,v)=>n+(Number.isInteger(v)&&v>0?v:0),0);
  return {rank,name:HAND_NAMES[rank],multiplier:HAND_MULTIPLIERS[rank],points,damage:Math.max(1,Math.round(((state?.hero?.attack ?? 0)+points) * HAND_MULTIPLIERS[rank]))};
}

const living = state => state.enemies.filter(enemy => enemy.hp > 0);
const pending = state => state.phase === 'battle' && state.stage === 0 && state.round === 1 &&
  state.dice.filter(die => die.unlocked).every(die => die.value === 0);
const hasRolled = state => state.dice.filter(die => die.unlocked).every(die => die.value > 0);
const validIndex = (state, index) => Number.isInteger(index) && index >= 0 && index < 5 && state.dice[index].unlocked;

function emit(state, events, type, data = {}) {
  events.push({type,source:'hero',...data,snapshot:structuredClone(state)});
}

function rewardChoices(stage) {
  const choices = [
    {id:`s${stage}-sword`,kind:'sword',name:'御剑诀',description:'选一颗骰绑定剑气；已有剑气则升一级，每消耗一次重掷，各剑影骰按等级蓄气；出招后逐层随机单体释放。',rarity:'rare'},
    {id:`s${stage}-flame`,kind:'flame',name:'离火诀',description:'选一颗骰绑定烈火；同技升级，出招后追加灼击当前选中的敌人。不同骰技会被替换。',rarity:'rare'},
    {id:`s${stage}-guard`,kind:'guard',name:'金钟诀',description:'选一颗骰绑定护体；同技升级，出招后获得护盾抵挡反击，上限60。不同骰技会被替换。',rarity:'uncommon'},
    {id:`s${stage}-face`,kind:'face',name:'六面归元',description:'选一颗骰，将它最小的一个物理骰面改为六。',rarity:'uncommon'},
    {id:`s${stage}-vitality`,kind:'vitality',name:'养元心法',description:'气血上限增加24，回复32点气血。',rarity:'common'},
  ];
  // Opening rewards remain familiar; later victories offer distinct build paths.
  // Choices already stored in a save are never regenerated.
  const kinds = [
    ['sword','face','vitality'], ['flame','guard','vitality'],
    ['sword','flame','vitality'], ['flame','guard','vitality'], ['sword','guard','vitality'],
  ][stage];
  return kinds.map(kind => choices.find(choice => choice.kind === kind));
}

/** Shared truthful ability text for dice, target selection and reward previews. */
export function skillDescription(die, loadout = EMPTY_LOADOUT) {
  if (!die || !isSkill(die.skill)) return '无骰技';
  const prefix = `${SKILL_NAMES[die.skill]} ${die.level} 级`;
  if (die.skill === 'sword') return `${prefix} · 重掷蓄气 +${die.level}`;
  if (die.skill === 'flame') return `${prefix} · 攻击后单体 ${die.level*FLAME_DAMAGE+(loadout?.flame??0)} 伤害`;
  return `${prefix} · 攻击后护盾 +${die.level*GUARD_SHIELD+(loadout?.guard??0)}（上限${SHIELD_CAP}）`;
}

function finishFight(state, events) {
  if (state.phase !== 'battle' || living(state).length) return;
  state.targetId = null;
  if (state.stage === 5) {
    state.phase = 'won';
    state.choices = [];
    return;
  }
  state.phase = 'reward';
  state.choices = rewardChoices(state.stage);
  if (state.stage < 4) {
    const index = state.stage + 1;
    state.dice[index].unlocked = true;
    emit(state, events, 'unlock', {dieIndex:index,text:`第${index+1}骰已解锁`});
  }
  emit(state, events, 'reward', {text:'试炼胜利 · 选择一项成长'});
}

function hitEnemy(state, enemy, damage, type, events, data = {}) {
  const amount = Math.min(enemy.hp, damage);
  enemy.hp -= amount;
  state.stats.damage = Math.min(MAX_COUNTER,state.stats.damage + amount);
  if (enemy.hp === 0 && !living(state).some(candidate=>candidate.id===state.targetId)) state.targetId = living(state)[0]?.id ?? null;
  emit(state, events, type, {target:enemy.id,amount,text:`${SKILL_NAMES[type] ?? '出招'} ${amount}`,...data});
  if (enemy.hp === 0) {
    state.stats.kills = Math.min(MAX_COUNTER,state.stats.kills+1);
    emit(state, events, 'death', {target:enemy.id,text:`${enemy.name}退场`});
  }
  finishFight(state, events);
}

function rollOne(state, index, events) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  const die = state.dice[index];
  die.value = die.faces[Math.floor(state.seed / 4294967296 * 6)];
  emit(state, events, 'roll', {dieIndex:index,amount:die.value,text:`第${index + 1}骰 · ${die.value}`});

}

function rollRound(state, events) {
  state.stats.rounds = Math.min(MAX_COUNTER,state.stats.rounds+1);
  state.rerolls = REROLLS_PER_ROUND;
  for (let index = 0; index < 5 && state.phase === 'battle'; index++) {
    if (state.dice[index].unlocked) rollOne(state, index, events);
  }
}

export function rewardPreview(state, choiceId, index) {
  if (!validateAdventure(state) || state.phase !== 'reward') return null;
  const choice = state.choices.find(value => value.id === choiceId);
  if (!choice) return null;
  if (choice.kind === 'vitality') {
    if (state.hero.maxHp + VITALITY_MAX_HP > MAX_NUMBER) return null;
    return {
      before:`气血 ${state.hero.hp}/${state.hero.maxHp}`,
      after:`气血 ${Math.min(state.hero.hp+VITALITY_HEAL,state.hero.maxHp+VITALITY_MAX_HP)}/${state.hero.maxHp+VITALITY_MAX_HP}`,
    };
  }
  if (!validIndex(state, index)) return null;
  const die = state.dice[index];
  if (isSkill(choice.kind)) {
    if (die.skill === choice.kind && die.level >= MAX_SKILL_LEVEL) return null;
    const nextLevel = die.skill === choice.kind ? die.level + 1 : 1;
    return {before:die.skill ? skillDescription(die,state.loadout) : choice.kind === 'sword' ? '无剑气' : '无骰技',
      after:skillDescription({skill:choice.kind,level:nextLevel},state.loadout) + (die.skill && die.skill !== choice.kind ? '（替换原骰技）' : '')};
  }
  if (choice.kind === 'face') {
    const faces = [...die.faces], minimum = Math.min(...faces);
    if (minimum === 6) return null;
    faces[faces.indexOf(minimum)] = 6;
    return {before:`骰面 ${die.faces.join('·')}`,after:`骰面 ${faces.join('·')}`};
  }
  return null;
}

export function act(state, action) {
  const noop = () => ({state,events:[]});
  if (action && typeof action === 'object' && action.type === 'restart') {
    return act(newAdventure(action.seed ?? state?.seed ?? 1,{chapterId:action.chapterId??state?.chapterId,runId:action.runId??0,loadout:action.loadout??state?.loadout}), {type:'begin'});
  }
  if (!validateAdventure(state) || !action || typeof action !== 'object') return noop();
  if(state.version===1)state=migrateAdventure(state);
  if (action.type === 'choose') {
    const preview = rewardPreview(state, action.choiceId, action.index);
    if (!preview) return noop();
    const next = structuredClone(state), events = [];
    const choice = next.choices.find(value => value.id === action.choiceId);
    if (choice.kind === 'vitality') {
      next.hero.maxHp += VITALITY_MAX_HP;
      const previousHp = next.hero.hp;
      next.hero.hp = Math.min(next.hero.maxHp, next.hero.hp + VITALITY_HEAL);
      emit(next, events, 'heal', {target:'hero',amount:next.hero.hp-previousHp,text:`气血 +${next.hero.hp-previousHp}`});
    } else {
      const die = next.dice[action.index];
      if (isSkill(choice.kind)) {
        die.level = die.skill === choice.kind ? die.level + 1 : 1;
        die.skill = choice.kind;
      } else {
        die.faces[die.faces.indexOf(Math.min(...die.faces))] = 6;
      }
    }
    next.history.push(`第${next.stage+1}战 · ${choice.name} · ${preview.before} → ${preview.after}`);
    next.history = next.history.slice(-MAX_HISTORY);
    next.stage++;
    next.round = 1;
    next.phase = 'battle';
    next.choices = [];
    if(validLoadout(action.loadout)){
      const old=next.loadout;next.loadout=structuredClone(action.loadout);
      next.hero.attack=Math.max(1,next.hero.attack-old.attack+next.loadout.attack);
      next.hero.maxHp=Math.max(1,next.hero.maxHp-old.maxHp+next.loadout.maxHp);
      next.hero.hp=Math.min(next.hero.hp,next.hero.maxHp);
    }
    next.charges=0;
    next.enemies = encounter(next.stage,next.chapterId);
    next.targetId = next.enemies[0].id;
    rollRound(next, events);
    return {state:next,events};
  }
  if (state.phase !== 'battle') return noop();
  if (action.type === 'begin') {
    if (!pending(state)) return noop();
    const next = structuredClone(state), events = [];
    rollRound(next, events);
    return {state:next,events};
  }
  if (action.type === 'target') {
    if (!living(state).some(enemy => enemy.id === action.id) || state.targetId === action.id) return noop();
    const next = structuredClone(state);
    next.targetId = action.id;
    return {state:next,events:[]};
  }
  if (action.type === 'attack') {
    if (!hasRolled(state)) return noop();
    const next = structuredClone(state), events = [];
    const target = living(next).find(enemy => enemy.id === next.targetId) ?? living(next)[0];
    if (!target) return noop();
    const hand=handOf(next),charges=next.charges;next.charges=0;
    const interrupted=new Set(living(next).filter(e=>e.kind==='boss'&&e.intent==='charge'&&hand.rank>=2).map(e=>e.id));
    hitEnemy(next, target, hand.damage, 'attack', events);
    for(let layer=0;layer<charges && next.phase==='battle';layer++){
      const targets=living(next);if(!targets.length)break;
      next.seed=(Math.imul(next.seed,1664525)+1013904223)>>>0;
      hitEnemy(next,targets[Math.floor(next.seed/4294967296*targets.length)],SWORD_DAMAGE+next.loadout.sword,'sword',events);
    }
    for(const skill of ['flame','guard'])for(let i=0;i<next.dice.length&&next.phase==='battle';i++){
      const die=next.dice[i];if(!die.unlocked||die.skill!==skill)continue;
      if(die.skill==='flame'){
        const enemy=living(next).find(e=>e.id===next.targetId)??living(next)[0];
        if(enemy)hitEnemy(next,enemy,die.level*FLAME_DAMAGE+next.loadout.flame,'flame',events,{dieIndex:i});
      }else if(die.skill==='guard'){
        const amount=Math.min(die.level*GUARD_SHIELD+next.loadout.guard,Math.max(0,SHIELD_CAP-next.hero.shield));
        next.hero.shield+=amount;emit(next,events,'guard',{target:'hero',dieIndex:i,amount,text:amount?`护盾 +${amount}`:'护盾已满'});
      }
    }
    if (next.phase !== 'battle') return {state:next,events};
    for (const enemy of living(next)) {
      let incoming=enemy.attack;
      if(enemy.kind==='boss'){
        enemy.intent??='strike';enemy.phase??=1;
        if(enemy.hp<=enemy.maxHp/2&&enemy.phase===1){enemy.phase=2;emit(next,events,'phase',{source:enemy.id,target:enemy.id,text:'破势 · 首领进入二阶段'});}
        if(interrupted.has(enemy.id)){
          enemy.intent='strike';emit(next,events,'intent',{source:enemy.id,target:enemy.id,text:`${hand.name} · 打断蓄力`});continue;
        }
        if(enemy.intent==='charge'){
          enemy.intent='heavy';emit(next,events,'intent',{source:enemy.id,target:enemy.id,text:'蓄力完成 · 下回合重击'});continue;
        }
        incoming=enemy.attack*(enemy.intent==='heavy'?2:1)+(enemy.phase===2?4:0);
        enemy.intent=enemy.intent==='heavy'?'strike':'charge';
      }
      incoming=Math.max(1,incoming-next.loadout.armor);
      const blocked = Math.min(next.hero.shield, incoming);
      next.hero.shield -= blocked;
      const amount = Math.min(next.hero.hp, incoming - blocked);
      next.hero.hp -= amount;
      emit(next, events, 'hurt', {source:enemy.id,target:'hero',amount,blocked,text:amount ? `气血 -${amount}` : `格挡 ${blocked}`});
      if (next.hero.hp === 0) {
        next.phase = 'lost';
        emit(next, events, 'death', {source:enemy.id,target:'hero',text:'试炼未竟'});
        return {state:next,events};
      }
    }
    next.round = Math.min(MAX_NUMBER,next.round+1);
    rollRound(next, events);
    return {state:next,events};
  }
  if (action.type === 'reroll') {
    if (!hasRolled(state) || !validIndex(state, action.index) || state.rerolls <= 0) return noop();
    const next = structuredClone(state), events = [];
    next.rerolls--;
    next.stats.rerolls = Math.min(MAX_COUNTER,next.stats.rerolls+1);
    rollOne(next, action.index, events);
    const gain=next.dice.filter(d=>d.unlocked&&d.skill==='sword').reduce((n,d)=>n+d.level,0);
    const amount=Math.min(gain,60-next.charges);next.charges+=amount;
    if(gain)emit(next,events,'charge',{target:'hero',amount,text:amount?`剑气 +${amount} · 已蓄${next.charges}层`:'剑气已满60层'});
    return {state:next,events};
  }
  return noop();
}
