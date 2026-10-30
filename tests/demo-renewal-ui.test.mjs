import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../demo/renewal/ui.mjs').catch(() => null);

// The repository uses an in-memory DOM boundary for UI tests. These nodes preserve
// identity/focus and bubble click events; assertions exercise the public UI, never
// source text or generated markup.
function dom() {
  class Node {
    constructor(tag, ownerDocument) {
      this.tagName = tag.toUpperCase(); this.ownerDocument = ownerDocument;
      this.children = []; this.parentNode = null; this.attributes = new Map();
      this.dataset = {}; this.style = {setProperty(key, value) { this[key] = String(value); }};
      this.listeners = new Map(); this.hidden = false; this.disabled = false;
      this._text = ''; this.className = '';
      this.classList = {toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        const add = force ?? !names.has(name); add ? names.add(name) : names.delete(name);
        this.className = [...names].join(' '); return add;
      }, add: (...names) => names.forEach(name => this.classList.toggle(name, true)),
      remove: (...names) => names.forEach(name => this.classList.toggle(name, false)),
      contains: name => this.className.split(/\s+/).includes(name)};
    }
    append(...nodes) { for (const node of nodes) this.appendChild(node); }
    appendChild(node) { node.parentNode?.removeChild(node); this.children.push(node); node.parentNode = this; return node; }
    removeChild(node) { this.children.splice(this.children.indexOf(node), 1); node.parentNode = null; return node; }
    remove() { this.parentNode?.removeChild(this); }
    replaceChildren(...nodes) { for (const child of [...this.children]) this.removeChild(child); this._text = ''; this.append(...nodes); }
    set textContent(value) { for (const child of [...this.children]) this.removeChild(child); this._text = String(value ?? ''); }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'class') this.className = String(value);
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    matches(selector) {
      if (selector === 'button') return this.tagName === 'BUTTON';
      if (selector === 'canvas') return this.tagName === 'CANVAS';
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      const attr = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      return !!attr && this.attributes.has(attr[1]) && (attr[2] === undefined || this.getAttribute(attr[1]) === attr[2]);
    }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    focus() { if (!this.disabled) this.ownerDocument.activeElement = this; }
    dispatchEvent(event) {
      event.target ??= this; event.preventDefault ??= () => { event.defaultPrevented = true; };
      for (const listener of this.listeners.get(event.type) ?? []) listener(event);
      if (!event.cancelBubble) this.parentNode?.dispatchEvent(event); return !event.defaultPrevented;
    }
    click() { if (!this.disabled && !this.hidden) this.dispatchEvent({type: 'click', target: this}); }
  }
  const doc = {activeElement: null, createElement: tag => new Node(tag, doc)};
  doc.body = doc.createElement('body'); doc.activeElement = doc.body;
  const root = doc.createElement('main'); doc.body.appendChild(root);
  return {doc, root};
}
function fixture(phase = 'battle') {
  return {version:1, seed:42, phase, stage:0, round:1,
    hero:{hp:72,maxHp:100,attack:12,shield:0},
    dice:Array.from({length:5}, (_, i) => ({id:`d${i}`,unlocked:i<(phase==='reward'?2:1),faces:[1,2,3,4,5,6],value:i===0?3:0,skill:i===0?'sword':null,level:i===0?1:0})),
    rerolls:2, enemies:[{id:'bandit-1',kind:'bandit',name:'山径刀客',hp:phase==='reward'?0:38,maxHp:50,attack:8}], targetId:phase==='reward'?null:'bandit-1',
    choices:phase==='reward' ? [
      {id:'s0-sword',kind:'sword',name:'御剑诀',description:'为一颗骰绑定或升级剑气',rarity:'rare'},
      {id:'s0-face',kind:'face',name:'六点真意',description:'最小骰面化为六点',rarity:'uncommon'},
      {id:'s0-vitality',kind:'vitality',name:'吐纳心法',description:'气血与上限提升',rarity:'uncommon'}] : [],
    stats:{damage:12,kills:0,rerolls:0,rounds:1},history:[]};
}
function withUI(run) {
  assert.ok(api?.createAdventureUI, 'the adventure DOM UI is available');
  const {doc,root}=dom(),actions=[],ui=api.createAdventureUI(root, action=>actions.push(action));
  const find=(action, value) => root.querySelectorAll('[data-action]').find(node => node.dataset.action===action && (value===undefined || node.dataset.value===String(value)));
  const click=(action,value)=>{const button=find(action,value);assert.ok(button,`${action} ${value??''} exists`);button.click();return button;};
  try { run({ui,root,doc,actions,find,click}); } finally {ui.destroy();}
}

test('five stable die buttons immediately reroll one unlocked die and preserve focused DOM/canvas during snapshots', () => withUI(({ui,root,doc,actions,find,click}) => {
  const state=fixture();ui.render(state);
  assert.equal(root.querySelectorAll('[data-die-index]').length,5);
  assert.equal(find('reroll',0).disabled,false);assert.equal(find('reroll',1).disabled,true);
  const canvas=ui.canvas,die=find('reroll',0);die.focus();click('reroll',0);click('reroll',1);
  assert.deepEqual(actions,[{type:'reroll',index:0}]);
  ui.render({...state,dice:state.dice.map((d,i)=>i?d:{...d,value:6})},{busy:true});
  assert.equal(ui.canvas,canvas);assert.equal(root.querySelector('canvas'),canvas);
  assert.equal(find('reroll',0),die);assert.equal(doc.activeElement,die);
  assert.equal(die.disabled,true);assert.equal(find('attack').disabled,true);
}));

test('reward choice remains local until a valid unlocked target is confirmed', () => withUI(({ui,actions,find,click}) => {
  const state=fixture('reward'),before=structuredClone(state);ui.render(state);
  click('pick-choice','s0-sword');assert.equal(find('confirm-choice').disabled,true);
  click('pick-die',2);assert.equal(find('confirm-choice').disabled,true);assert.deepEqual(actions,[]);
  click('pick-die',0);assert.equal(find('confirm-choice').disabled,false);
  assert.match(find('reward-preview').textContent,/1.*→.*2/,'the target preview exposes the real level change');
  assert.deepEqual(state,before);click('confirm-choice');
  assert.deepEqual(actions,[{type:'choose',choiceId:'s0-sword',index:0}]);
}));

test('cancel and switching reward cards clear a pending target without mutating the adventure', () => withUI(({ui,actions,find,click}) => {
  const state=fixture('reward'),before=structuredClone(state);ui.render(state);
  click('pick-choice','s0-sword');click('pick-die',0);click('cancel-choice');
  assert.deepEqual(actions,[]);assert.deepEqual(state,before);assert.equal(find('confirm-choice').disabled,true);
  click('pick-choice','s0-sword');click('pick-die',0);click('pick-choice','s0-face');
  assert.equal(find('confirm-choice').disabled,true,'a new card needs a new explicit target');
  click('pick-die',0);click('confirm-choice');assert.deepEqual(actions,[{type:'choose',choiceId:'s0-face',index:0}]);
}));

test('vitality can be confirmed without a target while busy playback blocks every game mutation', () => withUI(({ui,actions,find,click}) => {
  const state=fixture('reward');ui.render(state);click('pick-choice','s0-vitality');
  assert.equal(find('confirm-choice').disabled,false);click('confirm-choice');
  assert.deepEqual(actions,[{type:'choose',choiceId:'s0-vitality'}]);actions.length=0;
  ui.render(fixture(),{busy:true});for(const action of ['attack','reroll','target'])click(action,action==='reroll'?0:action==='target'?'bandit-1':undefined);
  assert.deepEqual(actions,[]);click('settings');assert.deepEqual(actions,[{type:'settings'}]);
}));

test('enemy buttons dispatch their IDs and pause/settings controls route explicit actions', () => withUI(({ui,root,actions,click}) => {
  const state=fixture();state.enemies.push({id:'archer-2',kind:'archer',name:'夜雨弩手',hp:24,maxHp:24,attack:6});ui.render(state);
  click('target','archer-2');assert.deepEqual(actions,[{type:'target',id:'archer-2'}]);
  assert.equal(root.querySelectorAll('[data-enemy-id]').length,2);
  ui.render(state,{paused:true,muted:true,reducedMotion:false});
  for(const action of ['mute','motion','resume','restart','workshop'])click(action);
  assert.deepEqual(actions.slice(1).map(action=>action.type),['mute','motion','resume','restart','workshop']);
}));

test('reward selection survives a busy snapshot, Escape cancels it, and a confirmed choice cannot dispatch twice', () => withUI(({ui,root,actions,find,click}) => {
  const state=fixture('reward');ui.render(state);click('pick-choice','s0-face');click('pick-die',0);
  ui.render(state,{busy:true});assert.equal(find('confirm-choice').disabled,true);click('confirm-choice');assert.deepEqual(actions,[]);
  ui.render(state);assert.equal(find('confirm-choice').disabled,false);
  root.dispatchEvent({type:'keydown',key:'Escape'});assert.equal(find('confirm-choice').disabled,true);assert.deepEqual(actions,[]);
  click('pick-choice','s0-face');click('pick-die',0);click('confirm-choice');click('confirm-choice');
  assert.deepEqual(actions,[{type:'choose',choiceId:'s0-face',index:0}]);
}));

test('a new reward clears stale choice/target state and newly unlocked dice can receive growth', () => withUI(({ui,actions,find,click}) => {
  const state=fixture('reward');ui.render(state);click('pick-choice','s0-sword');click('pick-die',0);
  const next=structuredClone(state);next.stage=1;next.dice[2].unlocked=true;next.choices.forEach(choice=>choice.id=choice.id.replace('s0-','s1-'));ui.render(next);
  assert.equal(find('confirm-choice').disabled,true);click('pick-choice','s1-sword');click('pick-die',2);click('confirm-choice');
  assert.deepEqual(actions,[{type:'choose',choiceId:'s1-sword',index:2}]);
}));

test('opening a decision dialog moves focus inside and its keyboard boundary keeps focus in the dialog', () => withUI(({ui,root,doc,find}) => {
  ui.render(fixture());const die=find('reroll',0);die.focus();ui.render(fixture('reward'));
  assert.ok(doc.activeElement===find('pick-choice','s0-sword'),'dialog initially focuses its first reward');
  const first=find('pick-choice','s0-sword');root.dispatchEvent({type:'keydown',key:'Tab',shiftKey:true});
  assert.ok(doc.activeElement===find('pick-choice','s0-vitality'),'Shift+Tab wraps to the final enabled choice');
  root.dispatchEvent({type:'keydown',key:'Tab'});assert.ok(doc.activeElement===first,'Tab wraps to the first enabled choice');
  ui.render(fixture());assert.ok(doc.activeElement===die,'closing the decision restores an available world control');
}));
