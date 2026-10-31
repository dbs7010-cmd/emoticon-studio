// Final Google Play listing delivery: approved palette/copy + real Android phone captures.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/민건/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {checked}=require('./render-localized-media.cjs');
const copy=require('./localized-media-copy.json');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/구글스토어-업로드용-일본-대만'),proof=path.join(root,'verification/play-final-20261031');
fs.mkdirSync(proof,{recursive:true});
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const data=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
const records=[];
async function main(){
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const locale of ['ja','zh-Hant']){
  const c=copy[locale],dir=path.join(out,locale==='ja'?'일본어':'대만-번체');fs.mkdirSync(dir,{recursive:true});
  const p=await b.newPage({viewport:{width:1080,height:1920}});
  for(let i=0;i<5;i++){
   const name=['01-draw','02-motion','03-set','04-guide','05-export'][i],capture=path.join(root,'verification/play-phone-20261031',locale,name+'.png');
   if(!fs.existsSync(capture))throw Error('Missing native phone capture '+capture);
   const pixels=require('pngjs').PNG.sync.read(fs.readFileSync(capture));let colored=0;for(let n=0;n<pixels.data.length;n+=64){const c=pixels.data.subarray(n,n+4);if(c[3]>200&&Math.max(...c.subarray(0,3))-Math.min(...c.subarray(0,3))>25)colored++;}if(colored<150)throw Error('Invalid blank capture '+capture);
   const bg=['#faf8f1','#fff1c4','#edf0e5','#f2edfa','#faf6e9'][i];
   await p.setContent(`<html lang="${locale}"><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{font-family:'${c.font}',sans-serif;color:#332b24}main{width:1080px;height:1920px;position:relative;overflow:hidden;background:${bg}}.brand{position:absolute;left:64px;top:50px;font-size:36px;font-weight:700}.count{position:absolute;right:64px;top:62px;font-size:20px;color:#887b6b}.copy{position:absolute;left:64px;right:64px;top:137px}.tag{font-size:22px;letter-spacing:3px;color:#7561b0;font-weight:700}h1{margin:22px 0 0;font-size:70px;line-height:1.25;letter-spacing:-2px}p{margin:22px 0 0;font-size:26px;line-height:1.6;color:#756b60}.screen{position:absolute;left:150px;right:150px;top:500px;height:1240px;border:2px solid #ded8ce;background:white;border-radius:26px;overflow:hidden;display:flex;justify-content:center;align-items:center;box-shadow:0 16px 40px #332b2410}.crop{width:744px;height:1240px;overflow:hidden;position:relative}.crop img{position:absolute;width:744px;height:auto;top:-44.1px;left:0}.foot{position:absolute;left:64px;right:64px;top:1790px;border-top:1px solid #332b2420;padding-top:25px;font-size:22px;color:#756b60}</style><main><div class="brand">emoti</div><div class="count">0${i+1} / 05</div><div class="copy"><div class="tag">${c.tags[i]}</div><h1>${c.titles[i]}</h1><p>${c.sub[i]}</p></div><div class="screen"><div class="crop"><img src="${data(capture)}"></div></div><div class="foot">${c.footer}</div></main>`);
   const check=await checked(p,locale,name,'h1');if(/DRAFT|キャプチャ待ち|尚未插入/.test(check.text))throw Error('Draft text remains');
   const target=path.join(dir,'03-휴대전화-스크린샷',String(i+1).padStart(2,'0')+'.png');fs.mkdirSync(path.dirname(target),{recursive:true});
   await p.screenshot({path:target});records.push({locale,file:target,capture,captureSha256:hash(capture),checks:check});
  }
  await p.setViewportSize({width:1024,height:500});
  await p.goto(pathToFileURL(path.join(root,'dist/store-intro-20261028',locale,'feature-graphic.html')).href);
  await p.locator('.draft-mark').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
  const featureCheck=await checked(p,locale,'feature','h1');if(/DRAFT/.test(featureCheck.text))throw Error('Feature draft remains');
  await p.screenshot({path:path.join(dir,'02-그래픽이미지.png')});
  await p.close();
  for(const [source,target] of [['7-inch','04-7인치-태블릿'],['10-inch','05-10인치-태블릿']]){
   const dest=path.join(dir,target);fs.mkdirSync(dest,{recursive:true});
   for(const name of fs.readdirSync(path.join(root,'dist/google-play-tablets-20261031',locale,source)).filter(n=>n.endsWith('.png')))fs.copyFileSync(path.join(root,'dist/google-play-tablets-20261031',locale,source,name),path.join(dest,name));
  }
 }}finally{await b.close();}
 fs.writeFileSync(path.join(proof,'composition-checks.json'),JSON.stringify({status:'RENDERED_NEEDS_PIXEL_VALIDATION',records},null,2));
 console.log('Rendered Japanese / Traditional Chinese final phone cards and feature graphics.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
