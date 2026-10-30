import {iconMarkup} from './icons.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function tutorialMarkup(step=3,busy=false){
 const lessons=[['先备行装','在门庭选择兵装、骰匣、武学和奇珍。出征使用当时的配装快照，之后换装留给下一局。'],['五骰问招','开战和下一回合自动掷骰。点选要换的骰子，再点重掷；看推演、选敌人，自己决定何时出招。'],['行路与创作','成长、分岔、行商和奇遇会改变后续战斗。战利品随旅程结算入库；创作台可改规则，账号页可手动同步。']];
 if(!Number.isInteger(step)||step<0||step>=lessons.length)return '';
 const [title,text]=lessons[step];return `<aside class="tutorial-card" aria-label="新手指引"><div><span class="eyebrow">江湖指引 ${step+1} / 3</span><h3>${title}</h3><p>${text}</p></div><div class="hub-actions"><button type="button" class="hub-button" data-action="tutorial-next" ${busy?'disabled':''}>${step===2?'开始游历':'下一步'}</button><button type="button" class="hub-button" data-action="tutorial-skip" ${busy?'disabled':''}>跳过指引</button></div></aside>`;
}
export function lootMarkup(entries=[],content,busy=false){
 if(!entries.length)return '';const names={attack:'攻击',maxHp:'气血',armor:'减伤',critChance:'暴击%',shieldGain:'护盾',regen:'回复',fireDamage:'火伤',goldBonus:'铜钱%'};
 return `<aside class="loot-notice" aria-label="本次战利品"><div class="hub-section-heading"><h2>战利品入囊</h2><p>本次旅程获得的兵装，按旅程结算入门庭。</p></div><div class="hub-grid">${entries.map(drop=>{const t=content.equipment.find(e=>e.id===drop.templateId),q=content.rarities.find(r=>r.id===t?.rarity);return `<article class="hub-card"><div class="loot-icon">${iconMarkup({kind:'equipment',slot:t?.slot,weaponType:t?.weaponType,quality:q?.rank||0})}</div><h3>${esc(t?.name||drop.templateId)}</h3><p>${esc(q?.name||'战利品')} · ${drop.source==='boss'?'首领专属':drop.source==='elite'?'精英掉落':'战斗掉落'}</p><p>${(drop.affixes||[]).map(a=>`${esc(names[a.key]||a.key)} +${a.value}`).join(' · ')}</p></article>`;}).join('')}</div><button type="button" class="hub-button" data-action="drop-dismiss" ${busy?'disabled':''}>收好，继续前行</button></aside>`;
}
