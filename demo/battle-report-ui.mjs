const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function renderRoundReport(report,{open=false}={}){
 if(!report)return '';
 const hero=report.hero||{},hand=report.hand||{};
 return `<details class="round-report"${open?' open':''}><summary><strong>上一回合战报</strong><span>第 ${esc(report.round)} 回合 · ${esc(report.nodeName)}</span><span class="report-disclosure" aria-hidden="true"></span></summary><div class="report-content"><div class="report-totals"><p><span>实际伤害</span><strong>${esc(report.damage)}</strong></p><p><span>击败</span><strong>${esc(report.kills)} <small>人</small></strong></p><p class="report-hero"><span>气血 ${esc(hero.hpBefore)} → ${esc(hero.hpAfter)}</span><span>护盾 ${esc(hero.shieldBefore)} → ${esc(hero.shieldAfter)}</span></p></div><p class="report-hand"><strong>${esc(hand.name)}</strong><span>当回合骰面 · ${(hand.dice||[]).map(esc).join(' · ')}</span></p><ol class="report-events" aria-label="当回合招式顺序">${(report.events||[]).map(event=>`<li data-event="${esc(event.type)}"><div class="report-event-names">${esc(event.sourceName||'战场')}${event.targetNames?.length?` <span aria-hidden="true">→</span> ${event.targetNames.map(esc).join('、')}`:''}</div><p>${esc(event.text||'招式结算')}${eventAmount(event)}</p></li>`).join('')}</ol></div></details>`;
}

function eventAmount(event){
 const value=Number(event.value);
 if(!Number.isFinite(value)||value===0)return '';
 const type=event.type;
 const label=type==='heal'&&value>0?'回复':type==='shield'?(value<0?'抵挡':'护盾'):['strike','sword','swordFocus','swordEcho','swordArray','counter','burst','poisonTick','hurt'].includes(type)&&value>0?'伤害':'';
 return label?` <b>${label} ${Math.abs(value)}</b>`:'';
}
