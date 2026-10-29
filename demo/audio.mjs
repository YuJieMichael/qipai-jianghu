import {normalizeEventType} from './choreography.mjs';
/** Original synthesized cues. Audio starts only after unlock's user gesture. */
export function createAudio(){
 let context=null,muted=false,dead=false,noiseBuffer=null;const voices=new Set();
 async function unlock(){if(dead)return false;try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;if(!context)context=new Audio();if(context.state==='suspended')await context.resume();return context.state==='running';}catch{return false;}}
 const ready=()=>context&&!muted&&!dead&&context.state==='running';
 function envelope(source,gain,at,duration,volume){
  gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(gain);gain.connect(context.destination);voices.add(source);source.onended=()=>{voices.delete(source);gain.disconnect();source.disconnect();};source.start(at);source.stop(at+duration+.015);
 }
 function tone(frequency,duration=.12,type='sine',volume=.035,slide=frequency,delay=0){if(!ready())return;try{const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+delay;oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,at);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,slide),at+duration);envelope(oscillator,gain,at,duration,volume);}catch{/* Audio cannot block the timeline. */}}
 function air(duration=.1,frequency=1300,volume=.025,delay=0){if(!ready())return;try{
  if(!noiseBuffer){noiseBuffer=context.createBuffer(1,context.sampleRate*.5,context.sampleRate);const channel=noiseBuffer.getChannelData(0);let seed=1777;for(let i=0;i<channel.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;channel[i]=(seed/4294967296)*2-1;}}
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),at=context.currentTime+delay;source.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.setValueAtTime(frequency,at);filter.frequency.exponentialRampToValueAtTime(Math.max(150,frequency*.3),at+duration);filter.Q.value=.7;source.connect(filter);
  // Source cleanup includes the filter, so mute/destroy also release scheduled cues.
  gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);filter.connect(gain);gain.connect(context.destination);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(at);source.stop(at+duration+.01);
 }catch{/* Unsupported audio nodes remain silent. */}}
 function play(event){let type=typeof event==='string'?event:normalizeEventType(event);if(type==='finish'&&event?.snapshot?.hero?.hp<=0)type='defeat';switch(type){
  case'roll':case'dice':for(let i=0;i<5;i++)tone(180+i*37,.045,'triangle',.027,85,i*.035);break;
  case'hold':case'lock':tone(680,.055,'sine',.035,910);break;
  case'windup':air(.09,550,.014);break;
  case'intent':tone(130,.09,'triangle',.025,170);break;
  case'strike':case'hurt':air(.075,1100,.037);tone(135,.095,'triangle',.055,43,.018);tone(1900,.035,'sine',.018,450,.02);break;
  case'sword':air(.14,2700,.025);tone(550,.13,'sine',.03,1500);tone(1500,.12,'triangle',.014,700,.035);break;
  case'swordFocus':air(.17,3600,.03);tone(1600,.18,'sine',.035,2200);tone(270,.09,'triangle',.04,70,.055);break;
  case'swordEcho':for(let i=0;i<3;i++){tone(790+i*130,.15,'sine',.022,1450+i*100,i*.035);air(.08,2100,.016,i*.035);}break;
  case'swordArray':tone(196,.25,'triangle',.036,392);for(let i=0;i<5;i++){air(.09,1700+i*450,.021,i*.025);tone(880+i*190,.16,'sine',.018,530,i*.025);}tone(78,.2,'triangle',.04,35,.12);break;
  case'poisonApply':air(.11,4300,.022);tone(1500,.09,'sine',.025,620);tone(970,.09,'sine',.016,510,.03);break;
  case'poisonTick':tone(315,.17,'sine',.022,155);tone(630,.14,'sine',.013,420,.025);air(.1,550,.008);break;
  case'burst':tone(115,.24,'sawtooth',.029,32);air(.22,1100,.043);tone(1174,.2,'sine',.025,210);break;
  case'shield':if(typeof event==='object'&&event.value<0){tone(330,.12,'triangle',.04,220);tone(1320,.16,'sine',.026,1047);air(.045,2700,.015);}else{tone(294,.22,'sine',.04,294);tone(588,.2,'triangle',.018,660);}break;
  case'counter':air(.1,1400,.035);tone(220,.16,'triangle',.045,440);tone(880,.21,'sine',.024,660,.035);break;
  case'ascension':for(const [i,f]of [294,440,587].entries())tone(f,.3,'sine',.025,f*1.05,i*.055);air(.25,1500,.015);break;
  case'phase':case'boss':tone(70,.35,'triangle',.05,45);tone(105,.33,'sine',.03,70);air(.19,470,.025);break;
  case'heal':tone(523,.2,'sine',.03,659);tone(784,.25,'sine',.02,880,.07);break;
  case'victory':case'finish':for(const [i,f]of [392,523,659,784].entries())tone(f,.3,'sine',.028,f,i*.08);break;
  case'defeat':tone(196,.4,'triangle',.035,65);break;
  case'death':air(.12,420,.025);tone(150,.16,'triangle',.03,42);break;
  default:break;
 }}
 function stopVoices(){for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
 return {unlock,play,setMuted(value){muted=Boolean(value);if(muted)stopVoices();},destroy(){if(dead)return;dead=true;stopVoices();context?.close().catch(()=>{});context=null;noiseBuffer=null;}};
}
