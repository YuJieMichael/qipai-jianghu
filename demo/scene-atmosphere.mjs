const TAU=Math.PI*2;
/** Fixed seeds are arithmetic constants: weather never borrows the combat RNG. */
export function sampleBambooAtmosphere(time=0,{reducedMotion=false}={}){
 const t=reducedMotion||!Number.isFinite(time)?0:time;
 return {
  shafts:[{top:[669,122],bottom:[431,416],width:84,alpha:.038},{top:[707,119],bottom:[672,411],width:126,alpha:.026},{top:[729,128],bottom:[857,405],width:41,alpha:.035}],
  fog:[{x:365+Math.sin(t*.12)*19,y:306,rx:420,ry:35,alpha:.055},{x:772+Math.sin(t*.1+1)*23,y:365,rx:345,ry:24,alpha:.043},{x:107+Math.sin(t*.09+2)*11,y:398,rx:247,ry:13,alpha:.04}],
  ripples:Array.from({length:9},(_,i)=>{const p=((t*.64+i*.173)%1+1)%1;return{x:33+i*27,y:438+(i*13)%36,rx:3+p*19,ry:1+p*4.1,alpha:(1-p)*.31};})
 };
}
function polygon(c,points,fill){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();}
function line(c,x,y,X,Y,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();}

export function drawBambooAtmosphere(c,time,options={},layer='distance'){
 const sample=sampleBambooAtmosphere(time,options);c.save();
 if(layer==='distance'){
  // Shafts stop at the clearing and stay dim enough for the fighters to lead.
  for(const shaft of sample.shafts){c.globalAlpha=shaft.alpha;const [x,y]=shaft.top,[X,Y]=shaft.bottom;polygon(c,[[x-5,y],[x+5,y],[X+shaft.width,Y],[X-shaft.width,Y]],'#c2dfc9');}
  for(const fog of sample.fog){c.globalAlpha=fog.alpha;c.save();c.translate(fog.x,fog.y);c.scale(1,fog.ry/fog.rx);const gradient=c.createRadialGradient(0,0,1,0,0,fog.rx);gradient.addColorStop(0,'#bfd8c4');gradient.addColorStop(1,'#bfd8c400');c.fillStyle=gradient;c.fillRect(-fog.rx,-fog.rx,fog.rx*2,fog.rx*2);c.restore();}
 }else if(layer==='water'){
  // Broken reflected stems and warm lantern streaks anchor the small rain pool.
  c.globalAlpha=.38;
  for(let i=0;i<12;i++){const x=20+i*24;line(c,x,438,x-8,466+i%3*7,'#71908655',2);}
  for(let i=0;i<6;i++){const y=437+i*5;line(c,81-i*2,y,103+i*3,y,'#d5b97b66',1.5);}
  for(const ripple of sample.ripples){c.globalAlpha=ripple.alpha;c.strokeStyle='#b4d6c4';c.lineWidth=.9;c.beginPath();c.ellipse(ripple.x,ripple.y,ripple.rx,ripple.ry,0,0,TAU);c.stroke();}
 }else if(layer==='foreground'){
  // Low roots and fern silhouettes frame the clearing without covering silhouettes.
  polygon(c,[[0,503],[33,494],[65,507],[116,503],[157,540],[0,540]],'#071e23b0');
  polygon(c,[[846,540],[891,508],[940,518],[975,500],[1000,505],[1000,540]],'#071e23b0');
  for(const [x,face]of [[18,1],[983,-1]])for(let i=0;i<5;i++){const y=513-i*8;line(c,x,536,x+face*(12+i*7),y,'#2b4a3b',1.5);polygon(c,[[x+face*5,y+7],[x+face*(20+i*8),y-8],[x+face*(10+i*5),y+9]],'#214334');}
 }
 c.restore();
}
