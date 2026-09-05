#!/usr/bin/env node
// Original SVG artwork and blocking authored directly in Codex. No model API calls.
// Rebuild with: node scripts/build-description.mjs
// With locally synthesized WAVs in artifacts/description/audio, also embeds processed MP3s.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'theDescription';
const N = '#203449', C = '#fff4dd', GOLD = '#f1b754';
const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, value); };
const json = value => JSON.stringify(value, null, 2) + '\n';
const uri = value => `data:image/svg+xml;base64,${Buffer.from(value).toString('base64')}`;
const svg = (box, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" fill="none" stroke="${N}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ellipse = (cx,cy,rx,ry,fill,extra='') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
function wheel(cx) {
  let spokes = '';
  for(let a=0;a<180;a+=22.5) {
    const r=a*Math.PI/180, dx=18.3*Math.cos(r), dy=18.3*Math.sin(r);
    spokes += `<path d="M${cx-dx} ${126-dy}L${cx+dx} ${126+dy}" stroke="#9caeae" stroke-width=".6"/>`;
  }
  return `<g>${ellipse(cx,126,21,21,N)}${ellipse(cx,126,18.7,18.7,'#e5dfc9')}${ellipse(cx,126,17.7,17.7,'#b9d2ce', 'fill-opacity=".23"')}${spokes}${ellipse(cx,126,2,2,GOLD)}</g>`;
}
const bicycle = `${wheel(23)}${wheel(78)}
 <path d="M8 104H32M10 106H30M12 105L22 125M29 105L32 118" stroke-width="1.3"/>
 <path d="M23 126L40 98L56 126H23L38 104L72 101L56 126M72 101L78 126M40 98L37 91M70 96L75 89" stroke="${N}" stroke-width="4.5"/>
 <path d="M23 126L40 98L56 126H23L38 104L72 101L56 126M72 101L78 126" stroke="#439d9e" stroke-width="2.7"/>
 <path d="M40 99L69 103" stroke="#91d2c1" stroke-width=".7"/>
 <path d="M32 90Q40 87 48 90L47 93H33Z" fill="#724d3f"/>
 <path d="M72 99L75 89L87 87Q92 88 89 92" stroke-width="2.5"/>
 <path d="M84 86L89 85" stroke="#92584a" stroke-width="3"/>
 ${ellipse(56,126,6,6,'#f8d17c')}${ellipse(56,126,3.7,3.7,'#596c73')}
 <path d="M23 123L54 120Q64 119 63 127Q62 133 54 132L23 129Z" stroke="#617072" stroke-width=".9"/>
 <path d="M56 126L64 117M56 126L48 135" stroke-width="1.8"/>
 <path d="M60 117H69M44 135H52" stroke-width="2.2"/>
 <path d="M71 105Q75 97 85 96" stroke-width=".7"/>
 ${ellipse(82,85,2.5,1.4,GOLD)}
 <path d="M53 128L49 146" stroke-width="1.5"/>`;

function pelican(pose) {
  const dressed = pose !== 'burglar', hiding = ['hidden','turned'].includes(pose), turned = pose === 'turned';
  const shirt = 'M30 61Q41 56 52 64L64 74L57 92Q42 103 25 91L22 76Z';
  let flowers='';
  for(const [x,y] of [[32,68],[47,73],[30,85],[47,91],[57,80]]) {
    flowers += `<g transform="translate(${x} ${y})" fill="#fff0d4" stroke="none">${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-2" rx="1.25" ry="2" transform="rotate(${a})"/>`).join('')}<circle r="1" fill="#f4bd58"/></g>`;
  }
  const eyes = `${ellipse(38,35,4.1,5.1,'#fffdf1','id="eye-left-white"')}${ellipse(49,35,4.2,5.1,'#fffdf1','id="eye-right-white"')}
   <circle id="eye-left-pupil" class="pupil" cx="39" cy="35.2" r="2" fill="${N}" stroke="none"/>
   <circle id="eye-right-pupil" class="pupil" cx="50" cy="35.2" r="2" fill="${N}" stroke="none"/>
   <circle id="eye-left-highlight" cx="39.6" cy="34.5" r=".7" fill="white" stroke="none" opacity="0"/>
   <circle id="eye-right-highlight" cx="50.6" cy="34.5" r=".7" fill="white" stroke="none" opacity="0"/>`;
  return svg('0 0 100 150', `<defs>
   <linearGradient id="feather" x2=".8" y2="1"><stop stop-color="#fffdf0"/><stop offset="1" stop-color="#e1d8bc"/></linearGradient>
   <linearGradient id="bill" x2="0" y2="1"><stop stop-color="#ffcb67"/><stop offset="1" stop-color="#ed9850"/></linearGradient>
   <clipPath id="shirt-clip"><path d="${shirt}"/></clipPath>
   </defs>
   <g id="body" style="animation:none">
   ${ellipse(50,148,45,1.3,N,'opacity=".12" stroke="none"')}
   ${bicycle}
   ${hiding ? `<path d="M51 73Q65 76 67 94Q65 103 50 99L46 82L47 74Z" fill="#c38e59"/><path d="M49 78L58 78M60 92L63 95" stroke="#99673e"/>` : ''}
   <path d="M30 84L24 90L16 88L21 96L33 96" fill="#e9e4cb"/>
   <path d="M46 89Q54 94 61 108L64 115L72 117Q73 121 67 121L58 119L53 108L39 100" fill="#de944f"/>
   <path d="M36 88Q42 100 48 111L43 129L38 133L46 135L51 133L55 113Q56 108 48 95" fill="#f5b95b"/>
   <path d="M41 131L45 132M46 130L49 131" stroke-width=".7"/>
   <path d="M31 56Q42 51 50 60L60 73L56 91Q44 100 30 94Q19 88 23 74Z" fill="url(#feather)"/>
   <path d="${shirt}" fill="${dressed ? '#d95845' : '#f6efdd'}"/>
   <g clip-path="url(#shirt-clip)" stroke="none">${dressed ? flowers : [64,74,84,94].map(y=>`<path d="M19 ${y}L67 ${y+3}L67 ${y+8}L19 ${y+5}Z" fill="${N}"/>`).join('')}</g>
   <path d="${shirt}"/>
   ${dressed?'<path d="M35 60L39 71L44 66L49 72L48 62M44 68L47 96" stroke="#993f39" stroke-width=".8"/><circle cx="45" cy="77" r=".8" fill="#f8ddb1" stroke="none"/><circle cx="46" cy="86" r=".8" fill="#f8ddb1" stroke="none"/>':''}
   ${hiding ? '<path d="M49 70Q59 70 62 81L65 91L58 95L52 88L48 83Z" fill="url(#feather)"/><path d="M59 87L62 90M57 89L60 92" stroke-width=".8"/>' : '<path d="M48 68Q55 66 61 75L78 82L82 88L77 91L69 84L54 82Q43 79 48 68Z" fill="url(#feather)"/><path d="M75 85L79 88M72 86L75 89" stroke-width=".8"/>'}
   </g>
   <g id="head-turn" transform="${turned ? 'translate(80 0) scale(-0.8 1)' : 'translate(0 0)'}">
   <g id="head-top">
   <path d="M30 44Q25 36 28 27L25 25L29 23Q27 15 38 14Q52 12 57 25L56 42L48 57L33 59Z" fill="url(#feather)"/>
   <path d="M28 24Q23 15 32 10Q45 6 54 13L57 24Z" fill="${N}"/>
   <path d="M27 21Q41 18 57 22L57 27Q42 24 27 27Z" fill="#405066"/>
   <path d="M31 12L31 19M36 10L36 18M42 10L42 18M48 11L48 19M53 14L53 20" stroke="#607084" stroke-width=".7"/>
   ${!dressed ? '<path d="M29 30Q43 26 57 30L56 42Q49 45 44 40Q36 44 29 40Z" fill="#263545"/>' : ''}
   ${eyes}
   ${dressed ? '<path d="M32 31L43 31L43 39Q36 43 32 38ZM45 31L56 31L55 38Q48 43 45 38Z" fill="#4ba7a5" fill-opacity=".35" stroke-width="2"/><path d="M43 33H45M29 31H33M35 32L33 36M48 32L46 36" stroke="#d4eae0" stroke-width=".6"/>' : ''}
   <path id="brow-left" d="M33 28Q38 26 42 28" stroke-width="1.5"/>
   <path id="brow-right" d="M46 28Q51 26 55 28" stroke-width="1.5"/>
   </g>
   <g id="head-bottom">
   <path d="M33 42Q42 40 55 43L94 45Q96 48 91 50L52 54Q44 70 34 57Q31 51 33 42Z" fill="url(#bill)"/>
   <path d="M35 47L87 48Q76 57 51 61Q39 64 35 55Z" fill="#f4b35b" stroke-width="1.1"/>
   <path d="M38 43Q65 44 89 46" stroke="#ffe5a2" stroke-width="1"/>
   <path d="M36 47L87 48" stroke="#b27242" stroke-width=".7"/>
   <path id="mouth-closed" d="M39 53Q47 57 55 53" stroke-width="1.4"/>
   <ellipse id="mouth-open" cx="47" cy="54" rx="5" ry="2.3" fill="#5c3334" stroke-width="1" opacity="0"/>
   <path d="M36 55Q37 59 40 60" stroke="#ffce79" stroke-width="1"/>
   </g></g>`);
}

const radioArt = `<path d="M12 20L8 2" stroke-width="3"/><path d="M9 8L7 2" stroke="#718089" stroke-width=".8"/>
 <rect x="5" y="18" width="23" height="36" rx="4" fill="#344a59"/>
 <path d="M8 23H25V34H8Z" fill="#acd4a1" stroke-width=".9"/>
 <path d="M10 27H23M10 30H19M10 38H23M10 41H23M10 44H23M10 47H20" stroke-width=".9"/>
 <circle class="radio-led" cx="24" cy="21" r="1.7" fill="#e97057" stroke="none"/>
 <path d="M9 51H20" stroke="#b8c8c4" stroke-width=".7"/>`;

function officer(down=false) {
 return svg('0 0 100 150', `<defs><linearGradient id="uniform" x2="1" y2="1"><stop stop-color="#416a80"/><stop offset="1" stop-color="#253d57"/></linearGradient></defs>
 <g id="body" style="animation:none">
 ${ellipse(50,148,25,1.5,N,'opacity=".12" stroke="none"')}
 <path d="M34 95L49 97L46 139L32 139ZM51 97L65 95L68 139L54 139Z" fill="#273e56"/>
 <path d="M39 102L38 135M60 102L61 135" stroke="#66828b" stroke-width=".8"/>
 <path d="M31 137L45 137L46 146H24Q21 141 31 137ZM54 137H68L77 142L76 146H53Z" fill="#1f2e40"/>
 <path d="M30 59Q48 52 67 60L68 99Q51 106 32 98Z" fill="url(#uniform)"/>
 <path d="M39 57L46 67L51 61L56 68L62 58" fill="#90a9ac"/>
 <path d="M49 64L53 64L55 87L50 92L46 87Z" fill="#223247"/>
 <path d="M34 76H43V83H34ZM57 76H64V83H57" fill="#31516a" stroke-width=".8"/>
 <path d="M37 68L39 65L41 68L44 69L42 72L42 75L39 74L36 75L36 72L34 69Z" fill="${GOLD}" stroke-width=".8"/>
 <path d="M31 94L68 94L69 100L31 100Z" fill="#202f42"/><rect x="46" y="94" width="9" height="6" rx="1" fill="${GOLD}"/>
 <path d="M65 62Q74 63 73 77L69 91L62 87L64 76Z" fill="#34556e"/>
 <path d="M62 85L70 89L68 97Q62 103 60 95Z" fill="#e4b38e"/>
 ${down ? '<path d="M32 61Q24 65 25 80L28 95L36 91L34 75Z" fill="#416a80"/>' : '<path d="M33 61Q25 60 23 69L19 57L12 60Q15 84 24 85Q33 85 37 72Z" fill="#416a80"/>'}
 <g transform="${down?'translate(17 76) scale(.48)':'translate(4 30) scale(.48)'}">${radioArt}</g>
 ${down?'<path d="M27 89L34 87L36 96Q32 102 27 98Z" fill="#e4b38e"/>':'<path d="M12 59L10 50Q11 46 14 48L16 53L20 51Q25 54 21 61L17 64Z" fill="#e4b38e"/>'}
 </g>
 <g id="head-top">
 <path d="M33 28Q34 16 49 16Q66 16 67 30L65 49L58 59H42L34 49Z" fill="#e7b996"/>
 <path d="M34 35Q28 29 30 41L35 44M65 35Q72 29 69 41L65 44" fill="#e7b996"/>
 <path d="M32 25L35 34L38 27M62 27L65 35L68 25" fill="#6a574c"/>
 <path d="M29 22L24 15Q50 2 75 15L69 23Z" fill="#34536e"/>
 <path d="M30 21H69L68 28H31Z" fill="#1d3046"/>
 <path d="M31 27Q50 23 68 27L62 32Q46 28 34 31Z" fill="#405e71"/>
 <path d="M46 14L50 11L55 14L54 21L50 24L46 21Z" fill="${GOLD}" stroke-width=".8"/>
 <path d="M49 15L52 15M50 14V19" stroke="#fff0aa" stroke-width=".8"/>
 ${ellipse(41,38,3.8,4.2,'#fff8e7','id="eye-left-white"')}${ellipse(58,38,3.8,4.2,'#fff8e7','id="eye-right-white"')}
 <circle id="eye-left-pupil" class="pupil" cx="40" cy="38" r="1.7" fill="${N}"/>
 <circle id="eye-right-pupil" class="pupil" cx="57" cy="38" r="1.7" fill="${N}"/>
 <circle id="eye-left-highlight" cx="40.6" cy="37.3" r=".6" fill="white" opacity="0" stroke="none"/>
 <circle id="eye-right-highlight" cx="57.6" cy="37.3" r=".6" fill="white" opacity="0" stroke="none"/>
 <path id="brow-left" d="M37 33L45 33" stroke-width="1.7"/><path id="brow-right" d="M54 33L62 33" stroke-width="1.7"/>
 <path d="M49 38L47 45L52 46" stroke="#b98265" stroke-width="1"/>
 </g>
 <g id="head-bottom">
 <path d="M34 46Q49 43 65 46L63 53Q58 61 49 61Q39 60 35 52Z" fill="#e7b996" stroke="none"/>
 <path d="M34 46L35 52Q39 60 49 61Q58 61 63 53L65 46"/>
 <path d="M42 48Q46 45 50 48Q54 45 58 48L56 51L50 50L44 51Z" fill="#655447" stroke="none"/>
 <path id="mouth-closed" d="M44 53Q50 54 56 53" stroke-width="1.2"/>
 <ellipse id="mouth-open" cx="50" cy="53" rx="4" ry="2" fill="#633d37" stroke-width=".8" opacity="0"/>
 </g>`);
}

function background() {
 let windows='';
 for(const x of [7,26,49,70,302,321,347,370,392]) windows += `<rect x="${x}" y="45" width="10" height="19" rx="4" fill="#719692" stroke="#e3c99f" stroke-width="2"/><path d="M${x+5} 46V63M${x} 54H${x+10}" stroke="#ddd9b9" stroke-width=".5"/>`;
 let paving='';
 for(let y=184;y<225;y+=13) paving+=`<path d="M0 ${y}H400" stroke="#ccbca1" stroke-width=".65"/>`;
 for(let x=0;x<430;x+=36) paving+=`<path d="M${x} 184L${x-18} 225" stroke="#ccbca1" stroke-width=".6"/>`;
 return svg('0 0 400 225', `<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#ecd7b2"/><stop offset="1" stop-color="#fbedd0"/></linearGradient><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#609da1"/><stop offset="1" stop-color="#9ebcb0"/></linearGradient></defs>
 <rect width="400" height="225" fill="url(#sky)" stroke="none"/>
 <circle cx="241" cy="47" r="23" fill="#fff2c7" stroke="none"/>
 <path d="M91 69Q123 50 150 67Q167 57 187 71H91ZM266 32Q281 21 295 31Q308 25 319 34H266Z" fill="#faf0d9" stroke="none"/>
 <path d="M0 95L89 94L130 84L173 94L219 85L254 92L302 78L400 90V145H0Z" fill="#91aea4" stroke="none"/>
 <path d="M0 110H400V154H0Z" fill="url(#sea)" stroke="none"/>
 <path d="M83 119H133M154 125H191M241 117H280M311 132H340M178 138H221M25 136H68" stroke="#d2ded0" stroke-width="1"/>
 <g stroke="#af916f" stroke-width=".9"><path d="M-10 27L34 17L86 30V123H-10Z" fill="#d9b992"/><path d="M-10 27L34 14L88 28L87 34L34 22L-10 34Z" fill="#b9765e"/>
 <path d="M295 30L349 16L410 34V125H295Z" fill="#dec59e"/><path d="M289 30L349 12L413 31L413 36L349 21L294 36Z" fill="#b9765e"/>${windows}
 <path d="M8 123V86Q8 73 19 73Q30 73 30 86V123ZM51 123V86Q51 73 62 73Q73 73 73 86V123Z" fill="#7e9a95"/>
 <path d="M319 125V89Q319 74 332 74Q345 74 345 89V125Z" fill="#7e9a95"/><path d="M359 82H395V113H359Z" fill="#688983"/></g>
 <path d="M0 147H400V161H0Z" fill="#e6d5b4" stroke="#a99b85" stroke-width="1"/>
 <path d="M0 159H400V225H0Z" fill="#e8d7b8" stroke="none"/>
 <path d="M0 177H400" stroke="#bfad8e" stroke-width="1.2"/>${paving}
 <g fill="#b8bca5" stroke="#718e85" stroke-width=".8">${[5,51,98,145,192,239,286,333,380].map(x=>`<path d="M${x} 150V130H${x+3}V150Z"/><path d="M${x} 130H${x+46}"/>`).join('')}</g>
 <g stroke-width="1.3"><path d="M222 150V75M219 151H225"/><path d="M217 62H227L225 77H219Z" fill="#f8dda0"/><path d="M216 62L222 57L228 62M222 54V58"/><path d="M220 65V73M224 65V73" stroke-width=".6"/></g>
 <path d="M97 45Q102 40 107 45Q112 40 117 45M169 29Q174 25 179 29Q184 25 189 29" stroke="#728c86" stroke-width="1"/>
 <path d="M264 150Q259 143 263 138Q265 132 269 143Q267 130 272 130Q277 132 272 146Q282 134 284 141Q283 148 277 150" fill="#7d9b83" stroke="#678677" stroke-width=".7"/>`);
}

const sprites = {
 'description-burglar':pelican('burglar'),
 'description-disguise':pelican('disguise'),
 'description-hidden':pelican('hidden'),
 'description-turned':pelican('turned'),
 'description-officer':officer(),
 'description-officer-lowered':officer(true)
};
const props = {
 'description-scanner':svg('0 0 42 60', `${radioArt}<g class="radio-signal" stroke="#f19b42" stroke-width="2.2"><path d="M31 22Q36 28 31 34"/><path d="M36 18Q43 28 36 38"/></g>`),
 'description-loot':svg('0 0 50 60', `<path d="M16 11L11 3Q19 0 25 5Q32 0 39 4L33 12L34 18Q48 33 44 48Q41 58 24 57Q5 58 5 46Q3 32 17 18Z" fill="#d3a064"/><path d="M17 13H33M16 17L34 18" stroke="#845c40" stroke-width="2"/><path d="M17 22Q10 34 11 44M35 23Q40 37 38 48" stroke="#edbd7e" stroke-width="1.2"/><path d="M32 15Q43 11 39 19L34 18M34 17L39 25" stroke="#8c6546" stroke-width="1"/><text x="25" y="40" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="11" fill="#483e35" stroke="none" transform="rotate(-5 25 36)">LOOT</text><path d="M15 47L34 46" stroke="#aa764a" stroke-width=".6"/>`)
};
const bg = background();
const provenance={creator:'Sam Patt with Codex (direct SVG and script authorship)',license:'Original creative asset; see ASSET-LICENSE.md',generation:'No OpenRouter, OpenAI API, or image generation service used.'};
for(const [name,art] of Object.entries(sprites)) {
 await write(path.join(ROOT,'src/sprites',name,'front.svg'),art.replace(/[ \t]+$/gm, '')+'\n');
 await write(path.join(ROOT,'src/sprites',name,'meta.json'),json({name:name.replaceAll('-',' '),type:name.includes('officer')?'human':'creature',variants:['front'],voice:{id:name.includes('officer')?'javert':'marius',speed:1,pitch:0},provenance}));
}
for(const [name,art] of Object.entries(props)) {
 await write(path.join(ROOT,'src/props',name,'prop.svg'),art.replace(/[ \t]+$/gm, '')+'\n');
 await write(path.join(ROOT,'src/props',name,'meta.json'),json({name:name.replaceAll('-',' '),defaultScale:1,holdOffset:[0,0],provenance}));
}
await write(path.join(ROOT,'src/backgrounds/description-harbor/landscape.svg'), bg+'\n');
await write(path.join(ROOT,'src/backgrounds/description-black/landscape.svg'),svg('0 0 400 225','<rect width="400" height="225" fill="#111c27" stroke="none"/>')+'\n');
const castConfig=(sprite,x,voice,hidden=true)=>({sprite,x,y:79,scale:1.2,voice,speed:1,pitch:0,startOffscreen:hidden});
const cast={
 burglar:castConfig('description-burglar',68,'marius',false),
 disguise:castConfig('description-disguise',68,'marius'),
 hidden:castConfig('description-hidden',68,'marius'),
 turned:castConfig('description-turned',68,'marius'),
 officer:castConfig('description-officer',21,'javert'),
 officerPlain:castConfig('description-officer-lowered',21,'javert')
};
const cut=(...show)=>({do:'background',name:'description-harbor',orientation:'landscape',show});
const shot=(type,who)=>({do:'shot',type,...(who?{who}:{})});
const say=(who,line)=>({do:'say',who,line});
const look=(who,at)=>({do:'look',who,at});
const emote=(who,emotion)=>({do:'emote',who,emotion});
const pause=duration=>({do:'pause',duration});
const mount=who=>({do:'prop-hold',what:'scanner',who,svgMount:[77,75,.32]});
const transmit=line=>[{do:'prop-animate',what:'scanner',animation:'radio',duration:30},say('officer',line),{do:'prop-animate',what:'scanner',animation:null}];
const script=[
 cut('burglar','officer'),shot('medium','burglar'),{do:'face',who:'burglar',dir:'right'},{do:'face',who:'officer',dir:'right'},look('officer','burglar'),
 {do:'spawn',what:'scanner',at:[74.3,59.5]},{do:'spawn',what:'loot',at:[62.5,63.8]},mount('burglar'),
 emote('burglar','smug'),look('burglar','scanner'),pause(1.2),
 ...transmit('Suspect is a pelican on a bike wearing a striped shirt and a mask.'),
 emote('burglar','worried'),look('burglar','down'),pause(.6),say('burglar',"Oh man, I'd better change."),pause(1.35),
 cut('disguise','officer'),mount('disguise'),{do:'face',who:'disguise',dir:'right'},emote('disguise','smug'),look('disguise','right'),pause(1.4),
 ...transmit('Suspect now wearing a red floral shirt and sunglasses.'),
 emote('disguise','surprised'),look('disguise','right'),pause(.65),look('disguise','up'),pause(.65),look('disguise','scanner'),pause(.65),
 look('disguise','loot'),emote('disguise','worried'),pause(.35),say('disguise',"I'd better hide this."),
 {do:'prop-move',what:'loot',to:[70.2,63.8],duration:1.1},pause(1.1),
 {do:'despawn',what:'loot'},cut('hidden','officer'),mount('hidden'),{do:'face',who:'hidden',dir:'right'},look('hidden','down'),emote('hidden','smug'),pause(.5),
 ...transmit("Suspect concealing a sack marked 'loot.'"),
 emote('hidden','surprised'),look('hidden','scanner'),pause(.9),
 look('hidden','left'),pause(.5),shot('wide'),pause(.65),
 cut('turned','officer'),mount('turned'),{do:'face',who:'turned',dir:'right'},look('turned','right'),emote('turned','surprised'),pause(.65),
 ...transmit('Suspect has finally noticed me.'),
 cut('turned','officerPlain'),{do:'face',who:'officerPlain',dir:'right'},look('officerPlain','turned'),
 look('turned','right'),pause(1),emote('turned','worried'),
 say('turned',"You could've said something."),pause(1),
 say('officerPlain','I have been.'),pause(.65),
 {do:'despawn',what:'scanner'},{do:'background',name:'description-black',orientation:'landscape',show:[]},pause(.4)
];
const assets={sprites:Object.fromEntries(Object.entries(sprites).map(([id,art])=>[id+'-front',uri(art)])),spriteMeta:{},backgrounds:{'description-harbor':uri(bg),'description-black':uri(svg('0 0 400 225','<rect width="400" height="225" fill="#111c27" stroke="none"/>'))},props:Object.fromEntries(Object.entries(props).map(([id,art])=>[id,uri(art)])),propMeta:{},audio:{}};
for(const name of Object.keys(sprites)) assets.spriteMeta[name]=JSON.parse(await fs.readFile(path.join(ROOT,'src/sprites',name,'meta.json'),'utf8'));
for(const name of Object.keys(props)) assets.propMeta[name]=JSON.parse(await fs.readFile(path.join(ROOT,'src/props',name,'meta.json'),'utf8'));
const lines=script.filter(b=>b.do==='say');
let previous;
try { previous=JSON.parse(await fs.readFile(path.join(ROOT,'src/published',ID+'.json'),'utf8')); } catch(e) { if(e.code!=='ENOENT')throw e; }
const previousLines=previous?.script?.filter(b=>b.do==='say') || [];
for(let i=0;i<lines.length;i++) {
 try {
  assets.audio['line-'+i]='data:audio/mpeg;base64,'+(await fs.readFile(path.join(ROOT,'artifacts/description/audio',`line-${i}.mp3`))).toString('base64');
 } catch(e) {
  if(e.code!=='ENOENT')throw e;
  const oldLine=previousLines[i], line=lines[i];
  if(oldLine?.line===line.line && oldLine.who===line.who && previous.cast?.[oldLine.who]?.voice===cast[line.who].voice && previous.assets?.audio?.['line-'+i]) {
   assets.audio['line-'+i]=previous.assets.audio['line-'+i];
  }
 }
}
const skit={meta:{title:'The Description',description:'A burglar pelican keeps changing his disguise. The police scanner keeps up.',author:'Sam Patt',provenance},stage:{background:'description-harbor',orientation:'landscape'},cast,props:{scanner:{prop:'description-scanner',x:74.3,y:59.5,scale:.48,visible:true,layer:'foreground'},loot:{prop:'description-loot',x:62.5,y:63.8,scale:.91,visible:true}},script,assets};
await write(path.join(ROOT,'src/published',ID+'.json'),json(skit));
await write(path.join(ROOT,'data/skits',ID+'.json'),json({...skit,assets:undefined}));
await write(path.join(ROOT,'data/published',ID+'.json'),json(skit));
await write(path.join(ROOT,'artifacts/description/dialogue.json'),json(lines.map((b,i)=>({index:i,...b,voice:cast[b.who].voice,radio:b.who==='officer'}))));
console.log(`Built ${ID}: ${Object.keys(sprites).length} poses, ${Object.keys(props).length} props, ${lines.length} lines (${Object.keys(assets.audio).length} voiced).`);
