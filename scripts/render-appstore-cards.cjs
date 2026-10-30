// App Store composition source. Drafts remain separate until actual captures are supplied.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {chromium}=require('C:/Users/민건/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const arg=process.argv.indexOf('--lang'),locale=arg<0?'ko':process.argv[arg+1];
const localized=locale!=='ko',copy=localized?require('./localized-media-copy.json')[locale]:null;
if(localized&&!copy)throw Error('Unsupported media locale: '+locale);
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/appstore-20261029',localized?locale:'');
const final=process.argv.includes('--final');
const deviceCompose=process.argv.includes('--compose-device-captures');
if(deviceCompose&&(!localized||final))throw Error('Device composition is a separate localized build-4 review mode, not --final');
const profileArg=process.argv.indexOf('--profile'),requestedProfile=profileArg<0?(deviceCompose?'iphone69':null):process.argv[profileArg+1];
const captureBase=deviceCompose?path.join(root,'verification/appstore','captures-iphone-'+locale):path.join(root,'verification/appstore/captures',localized?locale:'');
const captureNames=['01-draw.png','02-motion.png','03-board.png','04-lessons.png','05-export.png'];
const captureDir=p=>deviceCompose?captureBase:path.join(captureBase,p.id);
const captureFile=(p,i)=>path.join(captureDir(p),deviceCompose?captureNames[i]:`0${i+1}.png`);
const cropFor=i=>[{y:500,h:1510},{y:350,h:1930},{y:locale==='zh-Hant'?580:360,h:locale==='zh-Hant'?1720:1770},{y:190,h:2070},{y:200,h:1690}][i];
const cards=[
 {title:'내 그림으로,<br>나만의 이모티콘.',sub:'첫 표정부터 시작하는 나의 작은 작업실.',art:'draw',screen:'그리기 · 색칠한 콘',bg:'#faf8f1',tag:'그리기'},
 {title:'그리고, 톡.<br>움직임을 더해요.',sub:'그린 표정에 움직임을 고르고 미리 보세요.',art:'motion',screen:'움직이기 · 움직임 선택',bg:'#fff1c4',tag:'움직이기'},
 {title:'한 칸씩 모아,<br>한 세트로.',sub:'인사도, 고마움도. 나만의 표정을 차곡차곡.',art:'wave',screen:'보드 · 완성한 세트',bg:'#edf0e5',tag:'세트 만들기'},
 {title:'처음이어도,<br>차근차근.',sub:'막히는 순간에는 강좌와 표현 가이드를 펼쳐요.',art:'draw',screen:'강좌 또는 표현 가이드',bg:'#f2edfa',tag:'강좌 · 표현 가이드'},
 {title:'다 만들었다면,<br>파일로 꺼내요.',sub:'완성한 컷을 파일로 보관하고 공유해요.',art:'export',screen:'내보내기 · 파일 선택',bg:'#faf6e9',tag:'파일 내보내기'}
];
if(localized)cards.forEach((c,i)=>Object.assign(c,{title:copy.titles[i],sub:copy.sub[i],tag:copy.tags[i],screen:copy.screens[i]}));
const profiles=[{id:'iphone69',w:1290,h:2796},{id:'ipad13',w:2064,h:2752}].filter(p=>!requestedProfile||p.id===requestedProfile);
if(!profiles.length)throw Error('Unknown profile');
const assetDir=path.join(out,'assets');fs.mkdirSync(assetDir,{recursive:true});
for(const name of localized?[]:['malgun.ttf','malgunbd.ttf'])fs.copyFileSync('C:/Windows/Fonts/'+name,path.join(assetDir,name));
// 최종본은 out/<기종>/ 에, 시안은 out/draft/<기종>/ 에 놓이므로 assets 까지의 깊이가 다르다. 캡처는 기종마다 01~05 로 이름이 같아 기종 폴더 이름을 붙여 복사한다(10-30 Claude).
const uri=f=>{const parent=path.basename(path.dirname(f)),name=(/^0\d\.png$/.test(path.basename(f))?parent+'-':'')+path.basename(f);fs.copyFileSync(f,path.join(assetDir,name));return (final||localized?'../assets/':'../../assets/')+name;};
const art=k=>uri(k==='wave'?path.join(root,'assets/mascot/corn-wave.png'):path.join(root,`dist/store-intro-20261028/source/art/intro-${k}.png`));
function html(p,c,i,capture){
 const tablet=p.id==='ipad13',w=tablet?1032:645,h=tablet?1376:1398;
 return `<!doctype html><html lang="${locale}"><meta charset="utf-8"><style>
 ${localized?'':"@font-face{font-family:Malgun;src:url('../../assets/malgun.ttf')} @font-face{font-family:Malgun;src:url('../../assets/malgunbd.ttf');font-weight:700}"}
 *{box-sizing:border-box}body{margin:0;color:#332b24;font-family:${localized?JSON.stringify(copy.font):'Malgun'},sans-serif}main{width:${w}px;height:${h}px;background:${c.bg};position:relative;overflow:hidden}.copy{position:absolute;left:${tablet?70:44}px;top:${tablet?132:100}px;right:40px}h1{font-size:${tablet?65:53}px;line-height:1.34;letter-spacing:-2px;margin:20px 0}p{font-size:${tablet?22:20}px;color:#756b60;line-height:1.7;margin:0}.tag{font-size:17px;font-weight:700;color:#7561b0;letter-spacing:1px}.count{position:absolute;right:44px;top:45px;font-size:15px;color:#8d8174}.illustration{position:absolute;object-fit:contain;${tablet?'left:35px;top:530px;width:400px;height:500px':'right:22px;top:325px;width:205px;height:235px'};z-index:2;pointer-events:none}.halo{position:absolute;border-radius:50%;background:#fff9e7;${tablet?'left:45px;top:580px;width:365px;height:365px':'right:38px;top:363px;width:185px;height:185px'}}.frame{position:absolute;${tablet?'left:445px;top:435px;width:525px;height:820px':'left:44px;top:480px;width:557px;height:835px'};background:white;border:2px solid #ded8ce;border-radius:${tablet?30:28}px;padding:12px;box-shadow:0 18px 45px #332b2410;overflow:hidden}.screen{height:100%;width:100%;border-radius:18px;overflow:hidden;display:flex;justify-content:center;align-items:center;background:#fbfaf7}.screen img{width:100%;height:100%;object-fit:contain}.slot{padding:25px;color:#9c9387;text-align:center;font-size:20px;line-height:2}.slot b{color:#7561b0}.draft{position:absolute;bottom:13px;left:44px;font-size:13px;color:#a24935}.detail{position:absolute;left:70px;top:1100px;width:320px;font-size:20px;line-height:1.8;color:#756b60;display:${tablet?'block':'none'}}
 </style><main><div class="count">0${i+1} / 05</div><div class="copy"><div class="tag">${c.tag}</div><h1>${c.title}</h1><p>${c.sub}</p></div><div class="halo"></div><img class="illustration" src="${art(c.art)}" alt="콘 캐릭터"><div class="frame"><div class="screen">${capture?`<img src="${uri(capture)}" alt="실제 앱 화면">`:`<div class="slot"><b>${localized?copy.slot:'실제 앱 화면 삽입 위치'}</b><br>${c.screen}<br><small>${localized?copy.pending:'캡처 수신 전 · 제출용 아님'}</small></div>`}</div></div><div class="detail">${localized?copy.detail[i]:i===3?'그림이 막힐 때<br>표정과 몸짓부터 가볍게.':i===4?'각 플랫폼의 제안·심사는<br>별도로 진행해요.':'내 그림으로 채워 가는<br>나만의 이모티콘.'}</div>${!final?'<div class="draft">'+(localized?copy.draft:'구성 시안 · 실제 화면 대기 · App Store 업로드 금지')+'</div>':''}</main></html>`;
}
(async()=>{
 // Never silently turn placeholders or Android captures into a final iOS package.
 if(deviceCompose){
  if(profiles.some(p=>p.id!=='iphone69'))throw Error('iPhone captures cannot stand in for iPad');
  const v=JSON.parse(fs.readFileSync(path.join(captureBase,'capture-provenance.json')));
  if(v.platform!=='ios'||v.locale!==locale||v.captureType!=='device-screenshot')throw Error('Actual matching iPhone captures required');
  for(const name of captureNames){const f=path.join(captureBase,name),entry=v.captures?.find(x=>x.file===name);if(!entry||crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')!==entry.sha256)throw Error('Capture hash mismatch: '+name);}
 }
 if(final)for(const p of profiles){
  const dir=path.join(captureBase,p.id),e=path.join(dir,'capture-provenance.json');
  if(!fs.existsSync(e))throw Error('실제 iOS 화면 확인 기록 필요: '+e);
  const v=JSON.parse(fs.readFileSync(e));
  if(v.platform!=='ios'||v.matchesReleaseBuild!==true)throw Error('출시 iOS 화면과 일치 여부를 확인하세요.');
  if(localized&&(v.locale!==locale||v.deviceClass!==(p.id==='ipad13'?'ipad':'iphone')||!(Number(v.buildNumber)>=5)))throw Error('Matching locale, actual device class, and release build 5 or later required.');
  for(let i=1;i<=5;i++)if(!fs.existsSync(path.join(dir,`0${i}.png`)))throw Error('캡처 누락: '+p.id+'/'+i);
 }
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),records=[];
 try{for(const p of profiles){
  const dir=path.join(out,final||localized?p.id:'draft/'+p.id);fs.mkdirSync(dir,{recursive:true});
  const page=await browser.newPage({viewport:{width:p.w/2,height:p.h/2},deviceScaleFactor:2});
  for(let i=0;i<cards.length;i++){
   const capture=final||deviceCompose?captureFile(p,i):null;
   const source=html(p,cards[i],i,capture),base=`0${i+1}`;
   fs.writeFileSync(path.join(dir,base+'.html'),source);
   await page.goto(require('node:url').pathToFileURL(path.join(dir,base+'.html')).href);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()));});
   if(deviceCompose){
    const crop=cropFor(i);
    await page.evaluate(crop=>{document.querySelector('.draft')?.remove();const host=document.querySelector('.screen'),img=host.querySelector('img'),r=host.getBoundingClientRect(),scale=Math.min(r.width/img.naturalWidth,r.height/crop.h),w=img.naturalWidth*scale,h=crop.h*scale,fullH=img.naturalHeight*scale;const viewport=document.createElement('div');viewport.style.cssText=`width:${w}px;height:${h}px;position:relative;overflow:hidden;flex-shrink:0;`;img.style.cssText=`position:absolute;left:0;top:${-crop.y*scale}px;width:${w}px;height:${fullH}px;max-width:none;object-fit:fill;border-radius:0;`;host.replaceChildren(viewport);viewport.append(img);},crop);
    fs.writeFileSync(path.join(dir,base+'.html'),await page.content());
   }
   if(localized)await page.locator('h1').evaluate(el=>{for(let n=parseFloat(getComputedStyle(el).fontSize);n>=38;n--){el.style.fontSize=n+'px';const r=document.createRange();r.selectNodeContents(el);if(new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top))).size<=2)return;}throw Error('Title overflow');});
   const valid=await page.evaluate(()=>[...document.querySelectorAll('h1,p,.tag')].every(x=>{const r=x.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}));
   if(!valid)throw Error('텍스트 잘림: '+p.id+'/'+base);
   const tmp=path.join(dir,base+'-render.png'),file=path.join(dir,base+'.png');
   await page.screenshot({path:tmp});
   cp.execFileSync(process.execPath,[path.join(root,'scripts/store-finalize.cjs'),tmp,file,String(p.w),String(p.h),'20000000']);fs.unlinkSync(tmp);
   const buf=fs.readFileSync(file);records.push({file:path.relative(out,file).replaceAll('\\','/'),width:p.w,height:p.h,colorMode:'RGB',sha256:crypto.createHash('sha256').update(buf).digest('hex'),captureSource:deviceCompose?path.relative(root,capture).replaceAll('\\','/'):null,captureCrop:deviceCompose?cropFor(i):null,captureBuild:deviceCompose?'TestFlight build 4, cropped to omit obsolete export buttons and rename notice':null,status:deviceCompose?'COMPOSED_BUILD4_CROPS_REVIEW_REQUIRED':final?'composed-needs-visual-review':'DRAFT_MISSING_CAPTURE'});
  }await page.close();
 } }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({status:deviceCompose?'COMPOSED_BUILD4_CROPS_REVIEW_REQUIRED':final?'COMPOSED_REVIEW_REQUIRED':'DRAFT_NOT_FOR_UPLOAD',records},null,2));
 console.log('Rendered '+records.length+' RGB cards; status '+(deviceCompose?'BUILD4_CROPS_REVIEW_REQUIRED':final?'REVIEW_REQUIRED':'DRAFT_NOT_FOR_UPLOAD'));
})().catch(e=>{console.error(e);process.exitCode=1;});
