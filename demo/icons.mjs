/** Original cut-paper SVG inventory art. Inputs select local shapes; none become markup. */
const tones=['#8dada0','#a3c9aa','#92c5d1','#c0a4dd','#e0ba76','#e9cfa0'];
const hash=value=>{let n=0;for(const c of String(value??'').slice(0,160))n=(Math.imul(n,31)+c.charCodeAt(0))>>>0;return n;};
const path=(d,fill,stroke='#d9d7af',width=1.5)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle=(x,y,r,fill,stroke='none',width=1.5)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const line=(x,y,X,Y,color='#d9d7af',width=1.5)=>`<path d="M${x} ${y}L${X} ${Y}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
function equipment(slot,weapon,accent){
 if(slot==='armor')return path('M19 14L27 11L32 18L37 11L45 14L50 29L43 32L43 50L21 50L21 32L14 29Z','#547578',accent)+path('M25 17L32 24L39 17L37 39L43 49L32 46L21 49L27 39Z','#b4c0a5')+line(23,37,41,37,'#ddb98a',3);
 if(slot==='ring')return circle(32,35,15,'none','#ad925d',7)+circle(32,35,15,'none','#e5d4a3',2)+path('M24 17L32 11L40 17L37 27L27 27Z',accent)+path('M32 12L32 26L25 18L39 18','none','#f2e4bb',1);
 if(slot==='boots')return path('M20 14L35 15L34 36L47 42L49 49L19 49L17 42Z','#5f6b68',accent)+path('M19 17L34 18L33 30L19 29Z','#9aa58e')+line(20,35,32,36)+line(19,40,34,41)+line(19,47,47,47,'#d8c7a0',2);
 if(slot==='scarf')return path('M15 20Q30 10 46 18L48 28L37 29L44 49L34 45L31 51L27 29L17 31Z','#537c7d',accent)+path('M18 21Q31 16 44 21L42 25L19 27Z','#aac7b3')+line(32,33,39,46,accent,1);
 if(slot==='amulet')return path('M22 13Q32 4 42 13L37 28L27 28Z','none','#b69c70',2)+path('M32 23L44 34L40 47L32 53L23 47L20 34Z','#608d83',accent)+path('M32 29L37 36L32 44L27 36Z','#c7d5b0')+line(32,46,32,57,'#c7b17e',2)+line(28,50,27,56,'#c7b17e',1);
 if(weapon==='staff')return line(18,51,43,15,'#847d5c',5)+line(18,50,42,16,'#d9cfa2',1)+path('M36 9L48 9L52 20L42 28L32 20Z','#517f7b',accent)+circle(42,17,5,'#caead2')+line(37,29,46,32,accent,2);
 if(weapon==='hammer')return line(18,50,41,20,'#8a7456',7)+line(19,50,39,23,'#d5be87',1)+path('M34 9L45 10L56 21L54 33L44 35L26 20Z','#71918b',accent,2)+path('M33 11L30 20L45 32L50 28Z','#a3afa0')+line(15,46,24,52,'#ceb27c',3);
 return path('M21 43L44 12L52 8L50 19L27 47Z','#d2e9da',accent)+line(27,41,48,14,'#779f99',1)+line(17,39,30,49,'#d6bd83',4)+line(17,49,23,42,'#876e4f',5)+line(14,51,18,54,'#d6bd83',3);
}
function relic(id,accent,n){
 if(id.includes('flute'))return path('M17 48L45 14L49 18L22 52Z','#99b4a0',accent)+[0,1,2,3].map(i=>circle(27+i*4,41-i*5,1.2,'#233e42')).join('');
 if(id.includes('bell'))return path('M20 42L24 23Q32 11 40 23L44 42Z','#6f8881',accent)+path('M18 42L46 42L44 47L20 47Z','#b4b39a')+line(32,15,32,10,accent,3)+circle(32,49,3,'#cfb17a');
 if(id.includes('lamp')||id.includes('cup'))return path('M20 42L16 31L48 31L44 42L35 45L35 50L42 53L22 53L29 50L29 45Z','#7d8c7a',accent)+path('M26 28Q21 19 32 10Q31 21 38 20Q42 25 36 29Z','#deb675','#f5dba1');
 if(id.includes('seal'))return path('M18 24L46 24L47 48L17 48Z','#76928b',accent)+path('M24 23L25 16L31 11L39 16L40 23Z','#a1b8a0')+path('M24 31L38 31L34 36L39 41L25 41L29 36Z','none','#e4d9ac',2);
 return circle(32,32,20,'#55736e',accent,2)+circle(32,32,14,'none','#d8c99b')+Array.from({length:8},(_,i)=>`<g transform="rotate(${i*45} 32 32)">${path('M32 10L35 23L32 19L29 23Z',i%2?accent:'#d5c89c','none')}</g>`).join('')+circle(32,32,5,n%2?'#c6d5b2':'#be9e70');
}
function pet(id,accent){
 if(id==='crane')return path('M19 35Q30 23 36 32Q40 34 43 31L40 16Q39 10 44 10L47 12L44 15L47 32Q43 43 31 41L19 44Z','#c6d6c4',accent)+line(29,41,27,53,'#caa782',2)+line(36,42,38,53,'#caa782',2)+path('M45 11L55 15L46 15Z','#b78d62','none')+path('M22 36L33 29L38 37L30 39Z','#42636a')+circle(44,12,1,'#183b43');
 if(id==='turtle')return path('M16 39Q12 22 31 20Q48 21 47 40Z','#527b6b',accent)+path('M31 21L23 30L27 39L38 39L42 30Z','none','#b3c29b')+path('M17 37L11 40L14 44L22 41M39 40L46 45L50 41L45 37','#95ac82',accent)+circle(49,32,6,'#b3c0a0',accent)+circle(51,31,1,'#183b43');
 if(id==='moth')return path('M30 29Q12 8 11 26Q10 43 29 37Q13 49 23 52Q31 51 32 37Q35 52 43 51Q53 45 35 36Q55 41 54 24Q52 8 34 29Z','#9e97b2',accent)+line(32,23,32,43,'#d9d7bd',3)+line(31,24,26,18)+line(33,24,38,18)+circle(20,28,4,'#d0c7c2')+circle(45,28,4,'#d0c7c2');
 const lynx=id==='lynx';return path('M28 39Q17 28 10 35Q3 48 17 51Q29 51 35 44L43 44L43 31L47 23L44 12L37 20L26 18L19 11L19 27Q20 37 28 39Z',lynx?'#9d9f81':'#b78665',accent)+path('M11 38Q9 47 22 47L28 42L20 40Z','#d6d1b0','none')+path('M23 28L29 25L37 27L39 36L31 40L24 35Z','#dfd9b8','none')+circle(27,29,1.4,'#233b40')+circle(36,29,1.4,'#233b40')+path('M29 34L34 34L32 37Z','#3b4241','none')+line(29,43,27,51,'#d2c2a0',3)+line(41,43,42,51,'#d2c2a0',3);
}
function chapter(id,accent){
 const common=line(10,51,54,51,'#8caa9d');
 const shapes={
 bamboo:line(23,48,23,12,'#a0be96',4)+line(40,48,40,8,'#789b86',4)+[19,30,41].map(y=>line(19,y,27,y,'#d3d6ab')+path(`M24 ${y}L12 ${y-10}L17 ${y+1}Z`,'#719f87','none')+path(`M40 ${y-3}L53 ${y-12}L48 ${y}Z`,'#91b197','none')).join(''),
 temple:path('M14 30L32 21L51 30L44 32L44 49L20 49L20 32Z','#6c887c',accent)+path('M11 28L20 19L43 19L54 28L42 26L22 26Z','#3d6267',accent)+path('M20 17L32 10L46 17Z','#79998a',accent)+path('M27 49L27 35L37 35L37 49Z','#183b43','none'),
 gate:path('M17 27L47 27L47 49L39 49L39 34L25 34L25 49L17 49Z','#769486',accent)+path('M10 25L18 17L46 17L55 25Z','#41646b',accent)+path('M16 15L24 10L40 10L49 15Z','#759182',accent)+line(11,31,11,47,'#bfa472',2)+line(53,31,53,47,'#bfa472',2),
 desert:circle(45,18,7,'#d8bb87')+path('M8 46Q22 24 39 37Q47 29 56 36L56 52L8 52Z','#b18c63','#cfb58b')+path('M16 42L17 20L23 20L25 44M16 20L28 16L34 20L22 25','#79654f','#d4b58a')+path('M8 49Q34 35 56 45','none','#ead0a0'),
 lake:circle(46,15,6,'#c6d6bb')+path('M8 31L56 31L56 52L8 52Z','#3c727c','none')+path('M8 40Q32 19 56 40L56 45Q32 28 8 45Z','#acbba3',accent)+path('M12 49L23 49M29 47L40 47M43 51L53 51','none','#a7cdbd'),
 tomb:path('M9 51L13 17L23 8L46 12L55 51Z','#4b4856',accent)+path('M23 48L23 26Q32 13 41 26L41 48Z','#182b3c','#b29b78')+path('M12 43L10 35L15 27L19 37L18 43Z','#cf9661','#e8c486')+path('M48 43L45 36L50 28L54 37L53 43Z','#cf9661','#e8c486'),
 peak:path('M8 51L27 12L37 33L45 19L57 51Z','#7996a4',accent)+path('M19 29L27 12L35 30L29 27L26 31L23 26Z','#d7dfd2','none')+path('M38 34L45 19L51 36L45 32L42 35Z','#d7dfd2','none')+path('M10 45Q23 41 38 45T56 44','none','#b5d1c7',2)
 };return common+(Object.hasOwn(shapes,id)?shapes[id]:shapes.bamboo);
}
/** Stable card API; ids only select authored geometry and deterministic decoration. */
export function iconMarkup({kind='equipment',slot,weaponType,id,quality=0,size=40}={}){
 const numericSize=Number(size),dimension=Number.isFinite(numericSize)?Math.max(16,Math.min(128,Math.round(numericSize))):40,q=Number.isFinite(Number(quality))?Math.max(0,Math.min(5,Math.floor(Number(quality)))):0,accent=tones[q],n=hash(id),alias={pets:'pet',relics:'relic',runes:'rune',chapters:'chapter',sects:'sect',skills:'skill',materials:'dice',marks:'rune',gems:'gem',gold:'coin'},type=alias[kind]||kind;
 let art;
 if(type==='equipment')art=equipment(slot||'weapon',['sword','staff','hammer'].includes(weaponType)?weaponType:'sword',accent);
 else if(type==='chapter')art=chapter(id,accent);
 else if(type==='pet')art=pet(id,accent);
 else if(type==='relic')art=relic(String(id??''),accent,n);
 else if(type==='coin')art=circle(32,33,20,'#a78f58','#e4cc8d',2)+circle(32,33,15,'none','#dbc38a')+path('M27 28L37 28L37 38L27 38Z','#25464a','#e7cf97');
 else if(type==='loot')art=path('M13 29L21 18L44 18L52 29L52 49L13 49Z','#677e6a',accent)+path('M13 29L52 29L52 35L13 35Z','#a18b60',accent)+line(23,20,23,48,accent,3)+line(43,20,43,48,accent,3)+path('M28 30L37 30L37 40L28 40Z','#cfb77d','#f0dba1');
 else if(type==='gem')art=path('M20 17L43 17L52 30L32 52L12 30Z',id==='ruby'?'#a86b70':id==='amber'?'#bb965e':'#78a898',accent)+path('M20 17L25 30L32 52L40 30L43 17M12 30L52 30M25 30L32 17L40 30','none','#e3d6b3',1);
 else if(type==='dice')art=path('M17 14L44 14L51 22L51 48L24 48L17 40Z','#c5ceb0',accent)+path('M17 14L24 22L51 22M24 22L24 48','none','#647e75')+circle(32,30,2,'#35565b')+circle(43,41,2,'#35565b')+circle(43,30,2,'#35565b')+circle(32,41,2,'#35565b');
 else if(type==='rune')art=path('M25 9L43 14L46 46L32 55L18 45L20 18Z','#4f7772',accent)+path(['M27 20L38 25L28 32L38 39L29 45','M32 18L24 30L40 30L32 45','M24 24L39 24L28 36L38 43L24 43'][n%3],'none','#d8d4aa',3)+line(23,16,38,17,'#9bb59d',1);
 else if(type==='sect'||type==='skill')art=circle(32,32,21,'#355d62',accent)+path(['M21 43L39 16L34 32L44 31L25 49L29 35Z','M17 34Q22 18 33 29T48 26M18 41Q27 26 39 38T48 34','M24 17L24 47M40 15L40 46M24 27L13 20L19 31M40 30L51 21L46 34'][n%3],'none','#cfddba',2.5);
 else art=equipment('amulet','sword',accent);
 const marker=n%2?path('M9 15L9 9L15 9M49 55L55 55L55 49','none',accent,1):path('M9 49L9 55L15 55M49 9L55 9L55 15','none',accent,1);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">${path('M11 3L53 3L61 11L61 53L53 61L11 61L3 53L3 11Z','#14343d',accent,1)}${path('M12 7L52 7L57 12L57 52L52 57L12 57L7 52L7 12Z','#1d4047','#557369',.7)}${art}${marker}</svg>`;
}
