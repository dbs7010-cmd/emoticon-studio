// Notion 20: reuse approved artwork, localize lettering only. No app selection/build code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url'),{loader}=require('./load-ts.cjs');
const {chromium}=require('C:/Users/민건/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const COPY=require('./localized-media-copy.json'),root=path.resolve(__dirname,'..'),proof=path.join(root,'verification/localized-media-20261030');
fs.mkdirSync(proof,{recursive:true});
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const topics=[['first-set','APP BASICS','wave','#F8F1DD'],['brush-layer','DRAWING TOOLS','base','#F0EDF7'],['motion','MOTION CLASS','cheer','#F0EDF7'],['speech','SPEECH LINES','shy','#F5EEF2'],['animation','FRAME ANIMATION','nod','#EDF2F1'],['export','EXPORT GUIDE','wave','#EDF2F1'],['contest','CONTEST GUIDE','cheer','#F5EEF2'],['character','CHARACTER DESIGN','base','#F8F1DD'],['expressions','EXPRESSION CLASS','heart','#F8F1DD'],['set-plan','SET PLANNING','cheer','#EEF2E9'],['make-lesson','CREATOR GUIDE','base','#F0EDF7']];
const locked=[...topics.map(x=>path.join(root,'assets/lessons/thumbs',x[0]+'.png')),...fs.readdirSync(path.join(root,'dist/store-intro-20261028')).filter(x=>x.endsWith('.png')).map(x=>path.join(root,'dist/store-intro-20261028',x)),...fs.readdirSync(path.join(root,'assets/mascot')).filter(x=>x.endsWith('.png')).map(x=>path.join(root,'assets/mascot',x))];
const baseline=locked.map(file=>({file,sha256:hash(file)}));
const records=[],fontCache=new Map();
// Read cmap only; fonts stay in Windows and are never copied into the deliverables.
function fontHas(file,code){
 let maps=fontCache.get(file);if(!maps){const b=fs.readFileSync(file),off=b.toString('ascii',0,4)==='ttcf'?b.readUInt32BE(12):0;let cmap;
  for(let i=0;i<b.readUInt16BE(off+4);i++){const p=off+12+i*16;if(b.toString('ascii',p,p+4)==='cmap')cmap=b.readUInt32BE(p+8);}
  if(cmap===undefined)throw Error('No font cmap');maps=[];
  for(let i=0;i<b.readUInt16BE(cmap+2);i++){const r=cmap+4+i*8,p=cmap+b.readUInt32BE(r+4),format=b.readUInt16BE(p);if(format===4||format===12)maps.push({b,p,format});}fontCache.set(file,maps);
 }
 return maps.some(({b,p,format})=>{
  if(format===12){for(let i=0;i<b.readUInt32BE(p+12);i++){const q=p+16+i*12,start=b.readUInt32BE(q),end=b.readUInt32BE(q+4);if(code>=start&&code<=end)return b.readUInt32BE(q+8)+code-start!==0;}return false;}
  if(code>65535)return false;const n=b.readUInt16BE(p+6)/2;
  for(let i=0;i<n;i++){const end=b.readUInt16BE(p+14+i*2),start=b.readUInt16BE(p+16+n*2+i*2);if(code<start||code>end)continue;const delta=b.readInt16BE(p+16+n*4+i*2),q=p+16+n*6+i*2,range=b.readUInt16BE(q);if(!range)return((code+delta)&65535)!==0;const glyph=b.readUInt16BE(q+range+(code-start)*2);return glyph!==0&&((glyph+delta)&65535)!==0;}return false;
 });
}
async function checked(page,locale,label,titleSelector){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()));});
 if(titleSelector)await page.locator(titleSelector).evaluate(el=>{for(let size=parseFloat(getComputedStyle(el).fontSize);size>=38;size--){el.style.fontSize=size+'px';const range=document.createRange();range.selectNodeContents(el);const rects=[...range.getClientRects()].filter(r=>r.width>0);const ys=new Set(rects.map(r=>Math.round(r.top)));if(ys.size<=2&&rects.every(r=>r.right<=el.getBoundingClientRect().right+1))return;}throw Error('Title does not fit two lines');});
 const check=await page.evaluate(()=>{const bad=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(!node.textContent.trim()||['STYLE','SCRIPT'].includes(node.parentElement.tagName)||!node.parentElement.getClientRects().length)continue;const r=document.createRange();r.selectNodeContents(node);for(const box of r.getClientRects())if(box.width>0&&(box.left<-.5||box.top<-.5||box.right>innerWidth+.5||box.bottom>innerHeight+.5))bad.push(node.textContent);}return{bad,text:document.body.innerText};});
 if(check.bad.length)throw Error(label+' clipped: '+check.bad.join('|'));
 if(/[가-힣]/.test(check.text))throw Error(label+' Korean remains');
 const c=COPY[locale],chars=[...new Set([...check.text].filter(x=>!/[\s\u200b]/.test(x)))];
 for(const face of [c.regular,c.bold]){const missing=chars.filter(ch=>!fontHas('C:/Windows/Fonts/'+face,ch.codePointAt(0)));if(missing.length)throw Error(label+' missing glyphs '+face+': '+missing.join(''));}
 return {text:check.text,font:c.font,fontCmapCoverage:'PASS',textBounds:'PASS'};
}
function rgb(src,dest,w,h){cp.execFileSync(process.execPath,[path.join(root,'scripts/store-finalize.cjs'),src,dest,String(w),String(h),'20000000']);fs.unlinkSync(src);}
async function thumbs(browser,locale,ids){
 const c=COPY[locale],load=loader({'expo-localization':{getLocales:()=>[{languageCode:locale==='ja'?'ja':'zh',regionCode:locale==='ja'?'JP':'TW'}]}}),lessons=load('src/constants/lessons.ts').LESSONS;
 const dir=path.join(root,'assets/lessons/thumbs',locale);fs.mkdirSync(dir,{recursive:true});const page=await browser.newPage({viewport:{width:960,height:540}});
 for(const[id,category,pose,bg]of topics.filter(x=>!ids||ids.includes(x[0]))){const lesson=lessons.find(x=>x.id===id);if(!lesson)throw Error('Unknown lesson '+id);const art='data:image/png;base64,'+fs.readFileSync(path.join(root,'assets/mascot/corn-'+pose+'.png')).toString('base64');
  await page.setContent(`<html lang="${locale}"><meta charset="utf-8"><style>body{margin:0;font-family:'${c.font}',sans-serif}#cover{width:960px;height:540px;background:${bg};position:relative;overflow:hidden}#words{position:absolute;left:58px;top:119px;z-index:1;width:510px}small{display:block;font-size:21px;letter-spacing:2px;color:#887957;margin-bottom:32px}strong{display:block;font-size:61px;line-height:1.36;letter-spacing:-2px;overflow-wrap:anywhere;color:#29272e;font-weight:700}img{position:absolute;right:10px;bottom:0;width:465px;height:520px;object-fit:contain}</style><div id="cover"><div id="words"><small>${category}</small><strong></strong></div><img src="${art}" alt=""></div></html>`);
  const prefix=c.thumbBreakAfter[id];if(prefix&&!lesson.title.startsWith(prefix))throw Error('Stale line break '+id);
  await page.locator('strong').evaluate((el,{title,prefix})=>{if(!prefix){el.style.whiteSpace='nowrap';el.textContent=title;return;}el.replaceChildren(document.createTextNode(prefix),document.createElement('br'),document.createTextNode(title.slice(prefix.length)));},{title:lesson.title,prefix});const checks=await checked(page,locale,id,'strong');
  const file=path.join(dir,id+'.png'),tmp=path.join(proof,locale+'-'+id+'.png');await page.screenshot({path:tmp});rgb(tmp,file,960,540);
  const actual=await page.locator('strong').textContent();if(actual!==lesson.title)throw Error('Lesson title differs');
  records.push({file:path.relative(root,file).replaceAll('\\','/'),locale,kind:'lesson-thumbnail',size:[960,540],title:actual,titleMatchesRuntime:true,sha256:hash(file),checks});
 }await page.close();
}
async function play(browser,locale){
 const c=COPY[locale],dir=path.join(root,'dist/store-intro-20261028',locale);fs.mkdirSync(path.join(dir,'assets'),{recursive:true});
 function img(file){const name=path.basename(file);fs.copyFileSync(file,path.join(dir,'assets',name));return `<img src="assets/${name}" alt="">`;}
 const mascot=key=>img(path.join(root,'assets/mascot/corn-'+key+'.png'));
 const art=key=>img(path.join(root,'dist/store-intro-20261028/source/art/intro-'+key+'.png'));
 let layout=fs.readFileSync(path.join(root,'dist/store-intro-20261028/source/intro-layout.html'),'utf8').replace(/@font-face\{[^}]*\}/g,'').replace(/\bMalgun\b/g,`'${c.font}'`).replace('lang="ko"',`lang="${locale}"`);
 layout=layout.replace('</style>',`.draft-mark{position:absolute;bottom:18px;left:76px;right:30px;font-size:18px;color:#a24935}.feature .draft-mark{left:49px;bottom:10px;font-size:13px}.copy h1{overflow-wrap:anywhere}.footer{bottom:76px}</style>`);
 const themes=['#faf8f1','#fff1c4','#edf0e5','#f2edfa','#faf6e9'],halos=['#fff0ba','#fff8e9','#fff4d0','#fbf6ff','#efe9fa'];
 const page=await browser.newPage({viewport:{width:1080,height:1920}});
 for(let i=0;i<5;i++){
  const gallery=i===2?`<div class="gallery">${['wave','heart','cheer','sleep','sorry','no'].map((key,n)=>`<div class="tile">${mascot(key)}<span>${c.gallery[n]}</span></div>`).join('')}</div>`:'';
  const artBlock=i!==2?`<div class="art ${i===1?'motion':i===3?'guide':i===4?'export':''}">${art(i===1?'motion':i===4?'export':'draw')}</div>`:'';
  const bottom=i===1?`<div class="bottom"><div class="chips">${c.chips.map(x=>'<span>'+x+'</span>').join('')}</div><p>${c.notes[i]}</p></div>`:i===3?`<div class="guide-steps">${c.steps.map((x,n)=>`<div><small>0${n+1}</small><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('')}</div>`:`<div class="bottom"><strong>${c.bottom[i]}</strong><p>${c.notes[i]}</p></div>`;
  const main=`<main style="--paper:${themes[i]};--halo:${halos[i]}"><div class="brand"><strong>emoti</strong></div><div class="issue">0${i+1} / 05</div><div class="copy"><div class="category">${c.tags[i]}</div><h1>${c.titles[i]}</h1><p>${c.sub[i]}</p></div>${artBlock}${gallery}${bottom}<div class="footer"><b>${c.footer}</b><span>emoti</span></div><div class="draft-mark">${c.draft}</div></main>`;
  const name=`intro-0${i+1}-${['draw','motion','set','guide','export'][i]}`,html=path.join(dir,name+'.html');fs.writeFileSync(html,layout.replace('@@CONTENT@@',main));await page.goto(pathToFileURL(html).href);const checks=await checked(page,locale,name,'h1');const tmp=path.join(proof,locale+'-'+name+'.png'),file=path.join(dir,name+'.png');await page.screenshot({path:tmp});rgb(tmp,file,1080,1920);records.push({file:path.relative(root,file).replaceAll('\\','/'),locale,kind:'play-intro-DRAFT',size:[1080,1920],sha256:hash(file),checks});
 }
 await page.setViewportSize({width:1024,height:500});const html=path.join(dir,'feature-graphic.html');fs.writeFileSync(html,layout.replace('@@CONTENT@@',`<main class="feature"><div class="brand"><strong>emoti</strong></div><div class="copy"><h1>${c.featureTitle}</h1><p>${c.featureSub}</p></div><div class="art">${art('draw')}</div><div class="draft-mark">${c.draft}</div></main>`));await page.goto(pathToFileURL(html).href);const checks=await checked(page,locale,'feature','h1');const tmp=path.join(proof,locale+'-feature.png'),file=path.join(dir,'feature-graphic.png');await page.screenshot({path:tmp});rgb(tmp,file,1024,500);records.push({file:path.relative(root,file).replaceAll('\\','/'),locale,kind:'play-feature-DRAFT',size:[1024,500],sha256:hash(file),checks});await page.close();
}
module.exports={checked,fontHas,thumbs,records};
if(require.main===module)(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const locale of Object.keys(COPY)){await thumbs(browser,locale);await play(browser,locale);}}finally{await browser.close();}
 for(const locale of Object.keys(COPY)){cp.execFileSync(process.execPath,[path.join(root,'scripts/render-appstore-cards.cjs'),'--lang',locale],{stdio:'inherit'});const m=JSON.parse(fs.readFileSync(path.join(root,'dist/appstore-20261029',locale,'manifest.json')));records.push(...m.records.map(x=>({...x,file:'dist/appstore-20261029/'+locale+'/'+x.file,locale,kind:'appstore-card-DRAFT'})));}
 for(const x of baseline)if(hash(x.file)!==x.sha256)throw Error('Approved Korean/character artwork changed: '+x.file);
 fs.writeFileSync(path.join(proof,'manifest.json'),JSON.stringify({status:'THUMBNAILS_READY_STORE_CARDS_DRAFT',records,protectedOriginals:baseline.map(x=>({...x,unchanged:true})),fontFilesCopied:false},null,2));
 console.log('PASS: '+records.length+' localized assets; approved originals unchanged. Store cards are DRAFT.');
})().catch(e=>{console.error(e);process.exitCode=1;});
