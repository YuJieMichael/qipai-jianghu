import {CONTENT} from '../content.mjs';
import {CAMPAIGN_SLOTS,CAMPAIGN_FORGE_COST,getCampaignLoadout,validateCampaign} from './campaign.mjs';

const SLOT_NAMES = Object.fromEntries(CONTENT.slots.map(slot=>[slot.id,slot.name]));
const SLOT_GLYPHS = {weapon:'兵',ring:'环',armor:'甲',boots:'履',scarf:'巾',amulet:'符'};
const WEAPONS = {sword:'长剑',staff:'长杖',hammer:'重锤'};
const LABELS = {attack:'攻势',maxHp:'气血',armor:'护甲',sword:'剑气',flame:'烈火',guard:'护体'};
const CATALOG = new Map(CONTENT.equipment.map(item=>[item.id,item]));
const RARITIES = new Map(CONTENT.rarities.map(item=>[item.id,item]));
let dialogSerial = 0;
const signed = value => value > 0 ? `+${value}` : String(value);
function effects(item) {
  if (!item) return {};
  const e=item.effects;
  return {attack:e.attack??0,maxHp:e.maxHp??0,armor:e.armor??0,sword:e.critChance??0,flame:e.fireDamage??0,guard:(e.shieldGain??0)+(e.openingShield??0)};
}
function effectText(item) {
  const text=Object.entries(effects(item)).filter(([,value])=>value>0).map(([key,value])=>`${LABELS[key]} +${value}`).join(' · ');
  return text || '无属性加成';
}
function comparison(item,current) {
  const next=effects(item),before=effects(current);
  const changes=Object.keys(LABELS).filter(key=>(next[key]??0)!==(before[key]??0)).map(key=>`${LABELS[key]} ${signed((next[key]??0)-(before[key]??0))}`);
  if (item.slot==='weapon' && item.weaponType !== current?.weaponType) changes.push(`${WEAPONS[current?.weaponType??'sword']} → ${WEAPONS[item.weaponType]}`);
  return changes.length ? `穿戴后：${changes.join(' · ')}` : '与当前属性相同';
}

/** Appends one owned modal host; it neither replaces the battle nor owns storage. */
export function createCampaignUI(root,onAction) {
  const document=root.ownerDocument??globalThis.document;
  let profile=null,opts={},opened=false,destroyed=false,tab='inventory',requestedTab=null,returnFocus=null;
  const cards=new Map(),slots=new Map();
  function node(tag,className,text) {
    const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value;
  }
  function button(className,action,text,value) {
    const result=node('button',className,text);result.type='button';result.setAttribute('data-action',action);
    if(value!==undefined)result.setAttribute('data-value',value);return result;
  }
  function text(element,value) {if(element.textContent!==String(value??''))element.textContent=value??'';}
  const host=node('div','campaign-host');host.hidden=true;root.appendChild(host);
  const overlay=node('div','campaign-overlay'),panel=node('section','campaign-panel');overlay.append(panel);
  const id=`campaign-dialog-${++dialogSerial}`;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby',id);
  const header=node('header','campaign-header'),titleWrap=node('div','campaign-heading');
  const eyebrow=node('span','campaign-eyebrow','行囊与山河'),title=node('h2','','江湖行装');title.setAttribute('id',id);
  titleWrap.append(eyebrow,title);
  const close=button('campaign-close','campaign-close','×');close.setAttribute('aria-label','关闭行装，返回战斗');header.append(titleWrap,close);
  const tabs=node('div','campaign-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','江湖行装页签');
  const inventoryTab=button('campaign-tab','campaign-tab','兵装行囊','inventory'),chaptersTab=button('campaign-tab','campaign-tab','双章试炼','chapters');
  for(const [control,name]of [[inventoryTab,'inventory'],[chaptersTab,'chapters']]) {
    control.setAttribute('role','tab');control.setAttribute('id',`${id}-${name}-tab`);control.setAttribute('aria-controls',`${id}-${name}`);
  }
  tabs.append(inventoryTab,chaptersTab);
  const note=node('p','campaign-note','穿戴与卸下均在下场战斗生效，不回复当前气血。');
  const message=node('p','campaign-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  const scroll=node('div','campaign-scroll'),inventoryPanel=node('section','campaign-inventory'),chaptersPanel=node('section','campaign-chapters');
  for(const [section,name]of [[inventoryPanel,'inventory'],[chaptersPanel,'chapters']]) {
    section.setAttribute('id',`${id}-${name}`);section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',`${id}-${name}-tab`);
  }
  const summary=node('p','campaign-summary'),wornTitle=node('h3','campaign-section-title','已穿戴'),worn=node('div','campaign-equipped');
  const forgeBox=node('div','campaign-forge'),forgeCopy=node('div','campaign-forge-copy'),forgeTitle=node('strong','','锻尘铸装'),forgeHint=node('small','','分解旧装，铸造良品或更高品质的兵装。');
  const forge=button('campaign-forge-button','gear-forge',`铸装 · ${CAMPAIGN_FORGE_COST}尘`);forgeCopy.append(forgeTitle,forgeHint);forgeBox.append(forgeCopy,forge);
  for(const slot of CAMPAIGN_SLOTS) {
    const box=node('article','campaign-slot'),glyph=node('span','campaign-slot-glyph',SLOT_GLYPHS[slot]);glyph.setAttribute('aria-hidden','true');
    const body=node('div','campaign-slot-copy'),label=node('small','',SLOT_NAMES[slot]),name=node('strong'),stat=node('span','campaign-slot-stat');
    body.append(label,name,stat);const remove=button('campaign-small-button','gear-unequip','卸下',slot);box.append(glyph,body,remove);worn.append(box);slots.set(slot,{name,stat,remove});
  }
  const bagHeading=node('div','campaign-bag-heading'),bagTitle=node('h3','campaign-section-title','行囊'),capacity=node('span','campaign-capacity');bagHeading.append(bagTitle,capacity);
  const bagHint=node('p','campaign-bag-hint','每战胜利获得一件；穿戴中的装备受到分解保护。'),bag=node('div','campaign-bag'),empty=node('p','campaign-empty','行囊空空，赢下一战再添新装。');
  inventoryPanel.append(summary,forgeBox,wornTitle,worn,bagHeading,bagHint,bag,empty);
  const chapterControls=[];
  for(const chapterId of [1,2]) {
    const card=node('article',`campaign-chapter campaign-chapter-${chapterId}`),seal=node('span','campaign-chapter-seal',chapterId===1?'岚':'雨');seal.setAttribute('aria-hidden','true');
    const copy=node('div','campaign-chapter-copy'),label=node('small','',`第${chapterId===1?'一':'二'}章 · 六场试炼`),heading=node('h3','',chapterId===1?'青岚试炼':'暮雨山门');
    const detail=node('p','',chapterId===1?'循青竹山径，迎战青岚守关人。':'穿过雨幕长阶，迎战暮雨山门主。');
    const status=node('span','campaign-chapter-status'),start=button('campaign-primary','chapter-start','启程',chapterId);
    copy.append(label,heading,detail,status);card.append(seal,copy,start);chaptersPanel.append(card);chapterControls.push({chapterId,status,start});
  }
  chaptersPanel.append(node('p','campaign-chapter-hint','首章守关胜利后永久解锁第二章。章节可重打；启程将从该章第一战开始，保留行囊与成长。'));
  scroll.append(inventoryPanel,chaptersPanel);panel.append(header,tabs,note,message,scroll);

  function updateTabs() {
    inventoryPanel.hidden=tab!=='inventory';chaptersPanel.hidden=tab!=='chapters';
    for(const [control,name]of [[inventoryTab,'inventory'],[chaptersTab,'chapters']]) {
      control.setAttribute('aria-selected',String(tab===name));control.tabIndex=tab===name?0:-1;
    }
  }
  function cardFor(uid) {
    if(cards.has(uid))return cards.get(uid);
    const row=node('article','campaign-gear');row.setAttribute('data-gear-uid',uid);
    const top=node('div','campaign-gear-top'),glyph=node('span','campaign-gear-glyph'),copy=node('div','campaign-gear-copy'),name=node('strong'),rarity=node('span','campaign-rarity');
    glyph.setAttribute('aria-hidden','true');copy.append(name,rarity);top.append(glyph,copy);
    const stat=node('p','campaign-gear-stats'),current=node('p','campaign-current'),candidate=node('p','campaign-candidate'),compare=node('p','campaign-compare');
    const controls=node('div','campaign-gear-controls'),equip=button('campaign-equip','gear-equip','穿戴',uid),salvage=button('campaign-salvage','gear-salvage','分解',uid);
    controls.append(equip,salvage);row.append(top,stat,current,candidate,compare,controls);bag.append(row);
    const refs={row,glyph,name,rarity,stat,current,candidate,compare,equip,salvage};cards.set(uid,refs);return refs;
  }
  function renderInventory() {
    const loadout=getCampaignLoadout(profile);
    text(summary,`${Object.entries(LABELS).filter(([key])=>loadout[key]).map(([key,label])=>`${label} +${loadout[key]}`).join(' · ')} · 锻尘 ${profile.dust}`);
    text(capacity,`${profile.inventory.length} / 120`);
    forge.disabled=!!opts.busy||profile.dust<CAMPAIGN_FORGE_COST||profile.inventory.length>=120||profile.forgeSerial>=1_000_000_000;
    text(forgeHint,profile.inventory.length>=120?'行囊已满，请先分解闲置装备。':'分解旧装，铸造良品或更高品质的兵装。');
    forge.setAttribute('aria-label',`消耗${CAMPAIGN_FORGE_COST}锻尘铸造装备，至少良品`);
    const owned=new Map(profile.inventory.map(item=>[item.uid,item]));
    for(const slot of CAMPAIGN_SLOTS) {
      const entry=owned.get(profile.equipped[slot]),item=entry&&CATALOG.get(entry.equipmentId),refs=slots.get(slot);
      text(refs.name,item?.name??'尚未穿戴');text(refs.stat,item?effectText(item):'待添置');refs.remove.disabled=!!opts.busy||!item;
      refs.remove.setAttribute('aria-label',`卸下${SLOT_NAMES[slot]}${item?`：${item.name}`:''}`);
    }
    for(const [uid,refs]of cards)if(!owned.has(uid)){refs.row.remove();cards.delete(uid);}
    for(const entry of profile.inventory) {
      const item=CATALOG.get(entry.equipmentId),refs=cardFor(entry.uid),currentEntry=owned.get(profile.equipped[item.slot]);
      const current=currentEntry&&CATALOG.get(currentEntry.equipmentId),equipped=profile.equipped[item.slot]===entry.uid,rarity=RARITIES.get(item.rarity);
      refs.row.className=`campaign-gear rarity-${item.rarity}${equipped?' is-equipped':''}`;
      text(refs.glyph,SLOT_GLYPHS[item.slot]);text(refs.name,item.name);text(refs.rarity,`${rarity.name} · ${SLOT_NAMES[item.slot]}${equipped?' · 已穿戴':''}`);
      text(refs.stat,effectText(item));text(refs.current,`当前 ${current?.name??'空槽'}${current?` · ${effectText(current)}`:''}`);
      text(refs.candidate,`候选 ${item.name}${item.slot==='weapon'?` · ${WEAPONS[item.weaponType]}`:''}`);
      text(refs.compare,equipped?'当前穿戴中':comparison(item,current));text(refs.equip,equipped?'已穿戴':'穿戴');
      refs.equip.disabled=!!opts.busy||equipped;refs.salvage.disabled=!!opts.busy||equipped;
      refs.equip.setAttribute('aria-label',`穿戴${item.name}`);refs.salvage.setAttribute('aria-label',equipped?`${item.name}穿戴中，不可分解`:`分解${item.name}，获得${rarity.salvage}锻尘`);
      text(refs.salvage,`分解 · ${rarity.salvage}尘`);
    }
    empty.hidden=profile.inventory.length>0;
  }
  function renderChapters() {
    for(const {chapterId,status,start}of chapterControls) {
      const locked=chapterId>profile.unlockedChapter;
      text(status,locked?'通关青岚试炼后解锁':opts.chapterId===chapterId?'正在游历此章':'已开放 · 可重复挑战');
      text(start,locked?'未解锁':opts.chapterId===chapterId?'重新启程':'启程');start.disabled=!!opts.busy||locked;
      start.setAttribute('aria-label',`${chapterId===1?'青岚试炼':'暮雨山门'}${locked?'，尚未解锁':'，从第一战启程'}`);
    }
  }
  function click(event) {
    if(!opened||destroyed)return;
    const target=event.target?.closest?.('[data-action]');if(!target||!host.contains(target)||target.disabled)return;
    const action=target.dataset.action,value=target.dataset.value;
    event.stopPropagation?.();
    if(action==='campaign-tab') {if(['inventory','chapters'].includes(value)){tab=value;updateTabs();}return;}
    if(action==='campaign-close'){onAction({type:action});return;}
    if(opts.busy)return;
    if(action==='gear-forge')onAction({type:action});
    else if(action==='gear-equip'||action==='gear-salvage')onAction({type:action,uid:value});
    else if(action==='gear-unequip')onAction({type:action,slot:value});
    else if(action==='chapter-start'&&[1,2].includes(Number(value))&&Number(value)<=profile.unlockedChapter)onAction({type:action,chapterId:Number(value)});
  }
  function focusable() {
    return [...panel.querySelectorAll('button')].filter(control=>{
      if(control.disabled)return false;
      for(let ancestor=control;ancestor&&ancestor!==panel;ancestor=ancestor.parentNode)if(ancestor.hidden)return false;
      return true;
    });
  }
  function keydown(event) {
    if(!opened||destroyed)return;
    event.stopPropagation?.();event.cancelBubble=true;
    if(event.key==='Escape'){event.preventDefault();onAction({type:'campaign-close'});return;}
    if((event.key==='ArrowLeft'||event.key==='ArrowRight')&&[inventoryTab,chaptersTab].includes(document.activeElement)) {
      event.preventDefault();tab=tab==='inventory'?'chapters':'inventory';updateTabs();(tab==='inventory'?inventoryTab:chaptersTab).focus();return;
    }
    if(event.key!=='Tab')return;
    const controls=focusable(),first=controls[0],last=controls.at(-1),active=document.activeElement;
    if(event.shiftKey&&(active===first||!controls.includes(active))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(active===last||!controls.includes(active))){event.preventDefault();first?.focus();}
  }
  host.addEventListener('click',click);host.addEventListener('keydown',keydown);
  function restore() {if(returnFocus&&root.contains(returnFocus)&&!returnFocus.disabled)returnFocus.focus();returnFocus=null;}
  return {
    render(nextProfile,nextOpts={}) {
      if(destroyed)return;
      profile=nextProfile;opts=nextOpts;
      const shouldOpen=!!opts.open&&validateCampaign(profile);
      if(!shouldOpen) {
        if(opened){overlay.remove();host.hidden=true;opened=false;restore();}return;
      }
      const requested=['inventory','chapters'].includes(opts.tab)?opts.tab:'inventory',justOpened=!opened;
      if(justOpened||requested!==requestedTab)tab=requested;requestedTab=requested;
      if(justOpened){returnFocus=document.activeElement;host.hidden=false;host.append(overlay);opened=true;}
      renderInventory();renderChapters();updateTabs();text(message,opts.message??'');message.hidden=!opts.message;
      if(justOpened||!focusable().includes(document.activeElement))close.focus();
    },
    destroy() {if(destroyed)return;destroyed=true;host.removeEventListener('click',click);host.removeEventListener('keydown',keydown);host.remove();if(opened)restore();opened=false;cards.clear();},
  };
}
