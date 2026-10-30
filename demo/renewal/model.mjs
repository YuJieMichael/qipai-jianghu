/**
 * Original six-fight chapter rules. No browser or reference-game dependencies.
 * Fresh games wait for act({type:'begin'}) so the controller can animate the
 * initial roll and its sword damage. Saving a pending initial game is valid.
 */
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
const SKILL_NAMES = {sword:'剑气',flame:'烈火',guard:'护体'};
const isSkill = kind => typeof kind === 'string' && Object.hasOwn(SKILL_NAMES,kind);
const HAND_NAMES = ['散招','一对','两对','三条','顺子','葫芦','四条','五同'];
// Local balance parameters; reference-game final damage was not runtime-verified.
const HAND_MULTIPLIERS = [1,1.5,2,2.5,3,3.5,5,10];
const FIRST_ENEMY = {id:'s0-e0',kind:'bandit',name:'拦路刀客',hp:30,maxHp:30,attack:7};
const ENCOUNTERS = [
  [['bandit','拦路刀客',30,7]],
  [['bandit','林中刀客',38,8],['archer','青石弩手',24,5]],
  [['sentinel','石阶守将',58,10],['bandit','护路刀客',28,6]],
  [['archer','左翼弩手',34,8],['bandit','山道刀客',42,9],['archer','右翼弩手',34,8]],
  [['sentinel','山门守将',80,12],['archer','山门弩手',40,8]],
  [['boss','青岚试炼官',180,18],['bandit','试炼护卫',46,9]],
];
const encounter = stage => ENCOUNTERS[stage].map(([kind,name,hp,attack],index) => ({id:`s${stage}-e${index}`,kind,name,hp,maxHp:hp,attack}));

export function newAdventure(seed = 1) {
  return {
    version:1, seed:Number.isFinite(seed) ? Number(seed) >>> 0 : 1,
    phase:'battle', stage:0, round:1,
    hero:{hp:STARTING_HP,maxHp:STARTING_HP,attack:STARTING_ATTACK,shield:0},
    dice:Array.from({length:5}, (_, index) => ({
      id:`die-${index}`, unlocked:index === 0, faces:[1,2,3,4,5,6], value:0,
      skill:index === 0 ? 'sword' : null, level:index === 0 ? 1 : 0,
    })),
    rerolls:REROLLS_PER_ROUND, enemies:[{...FIRST_ENEMY}], targetId:FIRST_ENEMY.id,
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
export function validateAdventure(value) {
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
  return {rank,name:HAND_NAMES[rank],multiplier:HAND_MULTIPLIERS[rank],damage:Math.round((state?.hero?.attack ?? 0) * HAND_MULTIPLIERS[rank])};
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
    {id:`s${stage}-sword`,kind:'sword',name:'御剑诀',description:'选一颗骰绑定剑气；已有剑气则升一级，每次投掷立即出剑。',rarity:'rare'},
    {id:`s${stage}-flame`,kind:'flame',name:'离火诀',description:'选一颗骰绑定烈火；同技升级，每次投掷灼击当前选中的敌人。不同骰技会被替换。',rarity:'rare'},
    {id:`s${stage}-guard`,kind:'guard',name:'金钟诀',description:'选一颗骰绑定护体；同技升级，每次投掷积累护盾抵挡反击，上限60。不同骰技会被替换。',rarity:'uncommon'},
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
export function skillDescription(die) {
  if (!die || !isSkill(die.skill)) return '无骰技';
  const prefix = `${SKILL_NAMES[die.skill]} ${die.level} 级`;
  if (die.skill === 'sword') return `${prefix} · 全体 ${die.level*SWORD_DAMAGE} 伤害`;
  if (die.skill === 'flame') return `${prefix} · 单体 ${die.level*FLAME_DAMAGE} 伤害`;
  return `${prefix} · 护盾 +${die.level*GUARD_SHIELD}（上限${SHIELD_CAP}）`;
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
  if (die.skill === 'sword') {
    for (const target of living(state)) {
      hitEnemy(state, target, die.level * SWORD_DAMAGE, 'sword', events, {dieIndex:index});
    }
  } else if (die.skill === 'flame') {
    const target = living(state).find(enemy => enemy.id === state.targetId) ?? living(state)[0];
    if (target) hitEnemy(state, target, die.level * FLAME_DAMAGE, 'flame', events, {dieIndex:index});
  } else if (die.skill === 'guard') {
    const amount = Math.min(die.level*GUARD_SHIELD, Math.max(0, SHIELD_CAP-state.hero.shield));
    state.hero.shield += amount;
    emit(state, events, 'guard', {target:'hero',dieIndex:index,amount,text:amount ? `护盾 +${amount}` : '护盾已满'});
  }
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
    return {before:die.skill ? skillDescription(die) : choice.kind === 'sword' ? '无剑气' : '无骰技',
      after:skillDescription({skill:choice.kind,level:nextLevel}) + (die.skill && die.skill !== choice.kind ? '（替换原骰技）' : '')};
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
    return act(newAdventure(action.seed ?? state?.seed ?? 1), {type:'begin'});
  }
  if (!validateAdventure(state) || !action || typeof action !== 'object') return noop();
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
    next.enemies = encounter(next.stage);
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
    hitEnemy(next, target, handOf(next).damage, 'attack', events);
    if (next.phase !== 'battle') return {state:next,events};
    for (const enemy of living(next)) {
      const blocked = Math.min(next.hero.shield, enemy.attack);
      next.hero.shield -= blocked;
      const amount = Math.min(next.hero.hp, enemy.attack - blocked);
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
    return {state:next,events};
  }
  return noop();
}
