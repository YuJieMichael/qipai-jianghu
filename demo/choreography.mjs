/** Pure presentation math. No snapshots are inspected and no combat state is changed. */
const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = n => { const p=clamp(n); return p*p*(3-2*p); };
const weights={windup:.8,strike:1.25,sword:1.25,swordFocus:1.1,swordEcho:1.65,swordArray:2.7,poisonApply:1.05,poisonTick:.85,burst:2.35,shield:1,counter:1.7,hurt:1,death:1.3,intent:.85,phase:2.2,ascension:1.65,heal:1,finish:1.3};
export function normalizeEventType(event={}) {return event.type==='poison'?(event.value>0?'poisonTick':'poisonApply'):event.type||'idle';}
export function allocateSequenceDurations(events=[],{reducedMotion=false}={}) {
 if(!events.length)return [];
 const values=events.map(e=>weights[normalizeEventType(e)]||1),total=values.reduce((a,b)=>a+b,0),budget=reducedMotion?1400:2600;
 return values.map(weight=>budget*weight/total);
}
export function eventDuration(event={},context={},options={}) {
 if(Array.isArray(context?.events)&&Number.isInteger(context.eventIndex)&&context.eventIndex>=0&&context.eventIndex<context.events.length)return allocateSequenceDurations(context.events,options)[context.eventIndex];
 return (weights[normalizeEventType(event)]||1)*190*(options.reducedMotion?.55:1);
}
const basePoses={
 hero:{frontUpper:.5,frontFore:-.5,backUpper:1.9,backFore:.5,weapon:-.9,frontFoot:24,backFoot:-25,cape:0,torso:0,crouch:0,x:0,y:0,head:0,opacity:1},
 melee:{frontUpper:.5,frontFore:-.6,backUpper:1.7,backFore:1.1,weapon:-.95,frontFoot:24,backFoot:-22,cape:0,torso:.03,crouch:2,x:0,y:0,head:0,opacity:1},
 ranged:{frontUpper:-.2,frontFore:-.15,backUpper:1.1,backFore:-1.5,weapon:-1.57,frontFoot:16,backFoot:-18,cape:0,torso:-.06,crouch:0,x:0,y:0,head:0,opacity:1},
 shield:{frontUpper:.65,frontFore:-1.2,backUpper:1.8,backFore:.1,weapon:-1.35,frontFoot:29,backFoot:-28,cape:0,torso:.05,crouch:6,x:0,y:0,head:0,opacity:1},
 elite:{frontUpper:.1,frontFore:-.85,backUpper:2.2,backFore:-.7,weapon:-1.25,frontFoot:33,backFoot:-28,cape:0,torso:.02,crouch:3,x:0,y:0,head:0,opacity:1},
 boss:{frontUpper:.4,frontFore:-.2,backUpper:1.8,backFore:-.7,weapon:-1.1,frontFoot:30,backFoot:-30,cape:0,torso:0,crouch:0,x:0,y:0,head:0,opacity:1}
};
/** Local +X faces the foe; upper/forearm angles are independent joint rotations. */
export function sampleActorPose(role='hero',action='idle',progress=0,{reducedMotion=false}={}) {
 const b=basePoses[role]||basePoses.melee,pose={...b},p=clamp(progress);
 if(action==='idle'||p===0)return pose;
 const prepare=smooth(p/.3),release=smooth((p-.3)/.19),recover=smooth((p-.62)/.38),envelope=prepare*(1-recover),cut=release*(1-recover),motion=reducedMotion?0:1;
 if(action==='death'){
  pose.torso+=smooth(p)*1.3*motion;pose.crouch+=smooth(p)*48;pose.y+=smooth(p)*10;pose.opacity=1-smooth(p)*.8;pose.frontUpper+=p;pose.weapon+=p;return pose;
 }
 if(action==='hurt'){
  const hit=Math.sin(Math.PI*p);pose.x=-hit*14*motion;pose.torso-=hit*.2*(reducedMotion?.2:1);pose.head-=hit*.15;pose.frontUpper+=hit*.5;pose.cape=-hit*12*motion;return pose;
 }
 if(action==='guard'){
  pose.frontUpper-=envelope*.9;pose.frontFore-=envelope*.5;pose.torso-=envelope*.07;pose.crouch+=envelope*5;pose.weapon-=envelope*.2;return pose;
 }
 if(action==='attack'||action==='prepare'){
  const strike=action==='prepare'?0:cut;
  const strength=role==='boss'?1.25:role==='elite'?1.1:1;
  pose.x=(strike*48-prepare*(1-release)*12)*motion*strength;
  pose.torso+=(-envelope*.12+strike*.36)*strength*(reducedMotion?.2:1);
  pose.crouch+=envelope*7-strike*4;pose.frontFoot+=strike*18*motion;pose.backFoot-=envelope*8*motion;
  pose.cape=(envelope*15-strike*32)*motion;pose.head=-envelope*.1+strike*.1;
  if(role==='ranged'){
   pose.frontUpper-=envelope*.6;pose.frontFore-=envelope*.3;pose.backUpper-=envelope*2.1;pose.backFore+=envelope*2.6-strike*1.5;pose.weapon-=envelope*.1;pose.x=-strike*6*motion;
  }else if(role==='shield'){
   pose.frontUpper-=envelope*.65-strike*.9;pose.frontFore-=envelope*.5;pose.backUpper-=envelope*1.1;pose.backFore-=strike*1.2;pose.weapon+=strike*1.6;pose.x*=.55;
  }else{
   pose.frontUpper-=envelope*1.6-strike*1.8;pose.frontFore-=envelope*.9-strike*1.4;
   pose.backUpper-=envelope*.4;pose.backFore-=envelope*.6;pose.weapon-=envelope*1.1-strike*2.5*strength;
  }
 }
 // Keep the mathematical endpoint identical to rest rather than a near-zero sine remainder.
 return p===1?{...b}:pose;
}
export function sampleSceneFeedback(event={},progress=0,{reducedMotion=false}={}) {
 if(reducedMotion)return {shakeX:0,shakeY:0,flash:0,hold:0};
 const type=normalizeEventType(event),heavy=['burst','swordArray','phase'].includes(type),hit=['strike','hurt','counter','swordFocus'].includes(type),p=clamp(progress),strength=heavy?4:hit?1.5:0,decay=clamp(1-(p-.48)/.3),window=p>=.48&&p<.8?decay*decay:0;
 return {shakeX:Math.sin(p*92)*strength*window,shakeY:Math.cos(p*71)*strength*.55*window,flash:heavy&&p>=.48&&p<.53?.035:0,hold:hit&&p>=.48&&p<.56?.48:0};
}
