// Final localized launch assets, using the newly recorded real app videos only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {render,shell,top,info,copy}=require('./jp-tw-launch.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/민건/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'dist/promo-jp-tw-20261030'),source=path.join(out,'source');
function run(args){
 // Existing tutorials are retained by decision. Show the export preview region,
 // omitting the obsolete flat button row rather than inventing replacement UI.
 const input=args[args.lastIndexOf('-i')+1];
 if(/[/\\]export[/\\](ja|zh-Hant)[/\\]step1\.mp4$/.test(input||'')){
  const filter=args.indexOf('-filter_complex');
  if(filter>=0)args[filter+1]=args[filter+1].replace('[1:v]setpts','[1:v]crop=iw:550:0:0,setpts').replace('scale=900:1200:flags=lanczos','scale=900:-2:flags=lanczos');
  else args.splice(args.indexOf('-frames:v'),0,'-vf','crop=iw:550:0:0');
 }
 return cp.execFileSync(process.env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','pipe','pipe'],maxBuffer:8e6});
}
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const url=f=>require('node:url').pathToFileURL(f).href;
const state={sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()};
if(cp.execFileSync('git',['diff','--name-only','--','assets/lessons'],{cwd:root,encoding:'utf8'}).trim())throw Error('Use committed lesson recordings; deferred rerecordings must be restored first');
const wanted=process.argv[2]?[process.argv[2]]:['ja','zh-Hant'];
if(wanted.some(l=>!['ja','zh-Hant'].includes(l)))throw Error('Locale must be ja or zh-Hant');
const scenes=['first-set/step2','brush-layer/step2','motion/step2','speech/step2','export/step1'];
const stills=['first-set/step2','motion/step2','first-set/step3','export/step1'];
const file=(l,id)=>{const [group,name]=id.split('/');return path.join(root,'assets/lessons',group,l,name+'.mp4')};
const frame=(l,id)=>path.join(source,`final-${l}-${id.replace('/','-')}.png`);
async function main(){fs.mkdirSync(source,{recursive:true});const records=[],sources=[];const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const locale of wanted){const c={...copy[locale]};delete c.draft;delete copy[locale].draft;
const dir=path.join(out,locale);fs.mkdirSync(dir,{recursive:true});
for(const id of new Set([...stills,...scenes])){const src=file(locale,id);sources.push({file:path.relative(root,src).replaceAll('\\','/'),sha256:hash(src)});if(stills.includes(id))run(['-sseof','-0.6','-i',src,'-frames:v','1',frame(locale,id)]);}
for(let i=0;i<4;i++){const output=path.join(dir,`carousel-0${i+1}.png`);await render(b,locale,output,1080,1350,shell(locale,1080,1350,`${top(c,`0${i+1} / 04`)}<div class="eyebrow">${c.eyebrow}</div><h1>${c.titles[i]}</h1><p class="sub">${c.subtitles[i]}</p><div class="shot" style="position:absolute;left:222px;top:438px;width:636px;height:756px"><img src="${url(frame(locale,stills[i]))}"></div><div class="foot">${c.foot}<br>${i===3?c.disclaimer:c.app}</div>`));records.push({locale,file:`${locale}/carousel-0${i+1}.png`,width:1080,height:1350});}
await render(b,locale,path.join(dir,'square-01.png'),1080,1080,shell(locale,1080,1080,`${top(c,'')}<div class="eyebrow" style="margin-top:34px">${c.eyebrow}</div><h1 style="font-size:65px">${c.squareTitle}</h1><p class="sub">${c.squareSub}</p><div style="position:absolute;left:90px;right:90px;top:420px;display:flex;gap:24px"><div class="shot" style="width:438px;height:490px"><img src="${url(frame(locale,stills[0]))}"></div><div class="shot" style="width:438px;height:490px"><img src="${url(frame(locale,stills[1]))}"></div></div><div class="foot">${c.app}<br>${c.foot}</div>`));records.push({locale,file:`${locale}/square-01.png`,width:1080,height:1080});
for(let i=0;i<5;i++){const bg=path.join(source,`final-${locale}-bg-${i}.png`);await render(b,locale,bg,1080,1920,shell(locale,1080,1920,`${top(c,`0${i+1} / 05`)}<div class="eyebrow" style="margin-top:70px">${c.eyebrow}</div><h1 style="font-size:76px;margin-top:20px">${c.stages[i]}</h1><p class="sub" style="font-size:28px">${c.stageSubs[i]}</p><div class="foot" style="bottom:95px;font-size:23px">${c.app}<br>${locale==='ja'?'実際の操作を抜粋・一部早送り／音楽なし':'節錄實際操作，部分加速／無配樂'}<br>${i===4?c.disclaimer:c.foot}</div>`));const src=file(locale,scenes[i]),duration=Number(info(src).format.duration),speed=i<2?duration/3.6:1,start=i<2?0:Math.max(0,duration-4.2);run(['-loop','1','-i',bg,'-ss',String(start),'-i',src,'-filter_complex',`[1:v]setpts=(PTS-STARTPTS)/${speed},scale=900:1200:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=4[v];[0:v][v]overlay=90:480:shortest=1,format=yuv420p[out]`,'-map','[out]','-t','3.6','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','20','-movflags','+faststart',path.join(source,`final-${locale}-${i}.mp4`)]);}
const list=path.join(source,`final-${locale}-concat.txt`);fs.writeFileSync(list,Array.from({length:5},(_,i)=>`file 'final-${locale}-${i}.mp4'`).join('\n'));const video=path.join(dir,'reel-18s.mp4');run(['-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',video]);const vi=info(video),v=vi.streams.find(x=>x.codec_type==='video');if(v.width!==1080||v.height!==1920||vi.streams.some(x=>x.codec_type==='audio')||Math.abs(Number(vi.format.duration)-18)>.15)throw Error('Video specs');records.push({locale,file:`${locale}/reel-18s.mp4`,width:1080,height:1920,duration:Number(vi.format.duration),audio:false});
const alts=c.alts.map(x=>x.replace('；目前取自日文版錄影。','。').replace('；繁體中文畫面待補。','。'));fs.writeFileSync(path.join(dir,'captions.md'),`# ${c.app}\n\n${Object.entries(c).filter(([k])=>['instagram','x','facebook','threads','videoCaption'].includes(k)).map(([k,v])=>`## ${k}\n\n${v}`).join('\n\n')}\n\n## Image descriptions\n\n${alts.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n## Per-card captions\n\n${c.titles.map((title,i)=>`### ${i+1}\n\n${title.replaceAll('\n','')}\n${c.subtitles[i]}\n${c.app}\n#emoti ${locale==='ja'?'#スタンプ作り #お絵かき':'#貼圖製作 #手繪'}`).join('\n\n')}\n`);console.log('FINAL '+locale+' images 5 + silent reel 18 seconds');}
}finally{await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]);}
for(const s of sources)if(hash(path.join(root,s.file))!==s.sha256)throw Error('Source changed');
fs.writeFileSync(path.join(out,'final-manifest.json'),JSON.stringify({status:'READY_MEDIA_NOT_PUBLISHED',sourceCommit:state.sourceCommit,records:records.map(r=>({...r,sha256:hash(path.join(out,r.file)),bytes:fs.statSync(path.join(out,r.file)).size})),sources,checks:{textBounds:true,imageLoads:true,noVisibleHangul:true,dimensions:true,audio:false},pending:['Publisher chooses release date and store links','Actual posting remains with owner']},null,2));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>emoti JP / TW</title><style>body{font-family:Arial;background:#f7f5ef;padding:30px}section{display:flex;gap:14px;flex-wrap:wrap}img{width:220px}video{width:280px}</style><h1>emoti · 日本 / 台灣</h1><p>Real localized app footage. Silent 18-second videos. Not published.</p>${wanted.map(l=>`<h2>${l}</h2><p><a href="${l}/captions.md">Captions</a></p><section>${records.filter(r=>r.locale===l&&r.file.endsWith('.png')).map(r=>`<a href="${r.file}"><img src="${r.file}"></a>`).join('')}</section><video controls src="${l}/reel-18s.mp4"></video>`).join('')}`);
process.exit(0);}
main().catch(e=>{console.error(e.stderr?.toString()||e);process.exit(1)});
