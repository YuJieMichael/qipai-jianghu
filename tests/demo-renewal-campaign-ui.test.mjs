import test from 'node:test';
import assert from 'node:assert/strict';
import {newCampaign,beginCampaignRun,awardBattle} from '../demo/renewal/campaign.mjs';
const api=await import('../demo/renewal/campaign-ui.mjs').catch(()=>null);

function dom() {
  class Node {
    constructor(tag,ownerDocument) {this.tagName=tag.toUpperCase();this.ownerDocument=ownerDocument;this.children=[];this.parentNode=null;this.attributes=new Map();this.dataset={};this.listeners=new Map();this.hidden=false;this.disabled=false;this._text='';this.className='';this.style={};}
    append(...nodes){for(const n of nodes)this.appendChild(n);}
    appendChild(n){n.parentNode?.removeChild(n);this.children.push(n);n.parentNode=this;return n;}
    removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;return n;}
    remove(){this.parentNode?.removeChild(this);}
    replaceChildren(...nodes){for(const n of [...this.children])this.removeChild(n);this._text='';this.append(...nodes);}
    set textContent(value){this.replaceChildren();this._text=String(value??'');}
    get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
    setAttribute(k,v){this.attributes.set(k,String(v));if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
    getAttribute(k){return this.attributes.get(k)??null;}
    removeAttribute(k){this.attributes.delete(k);}
    addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
    removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
    contains(n){return n===this||this.children.some(c=>c.contains(n));}
    matches(s){if(s==='button')return this.tagName==='BUTTON';if(s[0]==='.')return this.className.split(/\s+/).includes(s.slice(1));const a=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return !!a&&this.attributes.has(a[1])&&(a[2]===undefined||this.getAttribute(a[1])===a[2]);}
    closest(s){return this.matches(s)?this:this.parentNode?.closest(s)??null;}
    querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
    querySelector(s){return this.querySelectorAll(s)[0]??null;}
    focus(){if(!this.disabled)this.ownerDocument.activeElement=this;}
    dispatchEvent(e){e.target??=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};for(const fn of this.listeners.get(e.type)??[])fn(e);if(!e.cancelBubble)this.parentNode?.dispatchEvent(e);return !e.defaultPrevented;}
    click(){if(!this.disabled&&!this.hidden)this.dispatchEvent({type:'click',target:this});}
  }
  const doc={activeElement:null,createElement:tag=>new Node(tag,doc)};doc.body=doc.createElement('body');doc.activeElement=doc.body;
  const root=doc.createElement('main');doc.body.append(root);const canvas=doc.createElement('canvas');root.append(canvas);return {doc,root,canvas};
}
function setup(run) {
  assert.ok(api?.createCampaignUI,'the campaign modal UI is available');
  const {doc,root,canvas}=dom(),actions=[],ui=api.createCampaignUI(root,a=>actions.push(a));
  const find=(action,value)=>root.querySelectorAll('[data-action]').find(n=>n.dataset.action===action&&(value===undefined||n.dataset.value===String(value)));
  const click=(action,value)=>{const b=find(action,value);assert.ok(b,`${action} is rendered`);b.click();return b;};
  try {run({doc,root,canvas,actions,ui,find,click});}finally{ui.destroy();}
}

test('campaign host appends beside battle content, opens only when requested and destroys only its own nodes',()=>setup(({ui,root,canvas})=>{
  const p=newCampaign(),before=JSON.stringify(p);ui.render(p,{open:false});assert.equal(root.querySelector('[role="dialog"]'),null);
  ui.render(p,{open:true,tab:'inventory'});assert.equal(root.children[0],canvas);assert.ok(root.querySelector('[role="dialog"]'));
  assert.match(root.textContent,/下场战斗生效/);assert.match(root.textContent,/4\s*\/\s*120/);assert.equal(JSON.stringify(p),before);
  ui.render(p,{open:false});assert.equal(root.querySelector('[role="dialog"]'),null);ui.destroy();assert.deepEqual(root.children,[canvas]);
}));

test('inventory compares the worn same-slot gear, routes actions and protects worn items from salvage',()=>setup(({ui,root,actions,find,click})=>{
  const p=newCampaign();ui.render(p,{open:true,tab:'inventory'});
  const staff=p.inventory.find(i=>i.equipmentId==='weapon-staff-1');
  const row=root.querySelectorAll('[data-gear-uid]').find(n=>n.dataset.gearUid===staff.uid);
  assert.match(row.textContent,/当前.*竹影兵器/);assert.match(row.textContent,/候选.*溪月兵器/);assert.match(row.textContent,/长杖/);
  assert.equal(find('gear-salvage',p.equipped.weapon).disabled,true);
  click('gear-equip',staff.uid);click('gear-unequip','armor');click('gear-salvage',staff.uid);
  assert.deepEqual(actions,[{type:'gear-equip',uid:staff.uid},{type:'gear-unequip',slot:'armor'},{type:'gear-salvage',uid:staff.uid}]);
}));

test('tabs switch locally, chapter locks reflect permanent progress and chapter starts use numeric IDs',()=>setup(({ui,actions,find,click})=>{
  let p=newCampaign();ui.render(p,{open:true,tab:'inventory',chapterId:1});click('campaign-tab','chapters');assert.equal(find('chapter-start',2).disabled,true);
  click('chapter-start',2);assert.deepEqual(actions,[]);
  const started=beginCampaignRun(p,1);p=awardBattle(started.campaign,{runId:started.runId,chapterId:1,stage:5,won:true}).campaign;
  ui.render(p,{open:true,tab:'inventory',chapterId:1});assert.equal(find('chapter-start',2).disabled,false,'snapshot does not erase the local tab');
  click('chapter-start',2);assert.deepEqual(actions,[{type:'chapter-start',chapterId:2}]);
}));

test('busy snapshots block equipment and chapter mutations while close and tab controls remain available',()=>setup(({ui,actions,find,click})=>{
  const p=newCampaign();ui.render(p,{open:true,busy:true,tab:'inventory'});
  click('gear-equip','starter-staff');click('gear-unequip','armor');click('gear-salvage','starter-staff');assert.deepEqual(actions,[]);
  click('campaign-tab','chapters');assert.equal(find('chapter-start',1).disabled,true);click('chapter-start',1);
  click('campaign-close');assert.deepEqual(actions,[{type:'campaign-close'}]);
}));

test('opening traps focus, Escape only requests close, and closing restores the previous battle control',()=>setup(({doc,root,ui,actions,find})=>{
  const world=doc.createElement('button');root.append(world);world.focus();const p=newCampaign();ui.render(p,{open:true,tab:'inventory'});
  const close=find('campaign-close');assert.equal(doc.activeElement,close);
  root.querySelector('.campaign-host').dispatchEvent({type:'keydown',key:'Tab',shiftKey:true});
  assert.notEqual(doc.activeElement,world);assert.notEqual(doc.activeElement,close);
  root.querySelector('.campaign-host').dispatchEvent({type:'keydown',key:'Tab'});assert.equal(doc.activeElement,close);
  root.querySelector('.campaign-host').dispatchEvent({type:'keydown',key:'Escape'});assert.deepEqual(actions,[{type:'campaign-close'}]);
  ui.render(p,{open:false});assert.equal(doc.activeElement,world);
}));

test('a snapshot that hides or disables the focused equipment action moves focus to an available dialog control',()=>setup(({ui,doc,find})=>{
  const p=newCampaign();ui.render(p,{open:true,tab:'inventory'});find('gear-equip','starter-staff').focus();
  ui.render(p,{open:true,tab:'chapters'});assert.ok(doc.activeElement===find('campaign-close'));
  ui.render(p,{open:true,tab:'inventory'});find('gear-equip','starter-staff').focus();
  ui.render(p,{open:true,tab:'inventory',busy:true});assert.ok(doc.activeElement===find('campaign-close'));
}));

test('forge displays a 24-dust cost, emits one explicit action and disables when unaffordable, full or busy',()=>setup(({ui,root,actions,find,click})=>{
  let p=newCampaign();ui.render(p,{open:true});assert.match(find('gear-forge').textContent,/24/);assert.equal(find('gear-forge').disabled,true);
  p={...p,dust:24};ui.render(p,{open:true});assert.equal(find('gear-forge').disabled,false);click('gear-forge');assert.deepEqual(actions,[{type:'gear-forge'}]);
  ui.render(p,{open:true,busy:true});assert.equal(find('gear-forge').disabled,true);
  const full={...p,inventory:Array.from({length:120},(_,index)=>({uid:`gear-${index}`,equipmentId:'weapon-sword-1'})),equipped:Object.fromEntries(Object.keys(p.equipped).map(slot=>[slot,null]))};
  ui.render(full,{open:true});assert.equal(find('gear-forge').disabled,true);assert.match(root.textContent,/行囊已满/);
}));
