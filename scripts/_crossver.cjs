// 버전 사이 호환 확인. 예전 엔진(기본값 45.31)과 지금 엔진을 **한 페이지에 나란히 띄워**
//   ① 예전 엔진으로 그려 저장한 작품을 지금 엔진에서 열었을 때 그림이 그대로인가
//   ② 같은 경로를 그었을 때 새 획의 겉모습이 브러시마다 얼마나 달라졌는가
// 를 잰다. ②는 '값을 안 바꿨으니 그대로'가 아니라 실제 픽셀로 센다.
// 쓰는 법: node scripts/_crossver.cjs <포트> <나갈폴더> [예전커밋]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loader } = require('./load-ts.cjs');
const { SCENES } = require('./_brush-scenes.cjs');
const { LIST } = require('./_brush30.cjs');

const PORT = Number(process.argv[2] || 4860);
const OUT = process.argv[3] || 'verification/round45_33/crossver';
const OLDREF = process.argv[4] || 'e9df57f';

const newHtml = loader({})('src/painter/canvas-html.ts').canvasHtml;
// 예전 엔진은 그 시점 파일을 그대로 꺼내 쓴다. 지금 소스를 건드리지 않는다.
// 예전 파일은 옆 파일들을 상대 경로로 부르므로 **같은 폴더에** 잠깐 두었다가 곧바로 지운다.
const tmp = 'src/painter/__old-engine.ts';
fs.writeFileSync(tmp, execFileSync('git', ['show', OLDREF + ':src/painter/canvas-html.ts'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
let oldHtml;
try { oldHtml = loader({})(tmp).canvasHtml; } finally { fs.unlinkSync(tmp); }

const BRUSHES = LIST;

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>버전 사이 호환</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:inline-block;margin:0 8px;vertical-align:top}</style></head>
<body><div id="log">엔진 둘을 띄우는 중…</div>
<iframe id="old" src="engine-old.html"></iframe><iframe id="new" src="engine-new.html"></iframe>
<script>
const log=document.getElementById('log');
const F={old:document.getElementById('old'),new:document.getElementById('new')};
const list=${JSON.stringify(BRUSHES)};
const scenes=${JSON.stringify(SCENES)};
const WIDTH=10;
let token=0,started=false;
const inbox={old:{},new:{}};const waiting={old:null,new:null};
function which(w){return w===F.old.contentWindow?'old':'new';}
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 const k=which(e.source);if(!k)return;
 if(waiting[k]&&m.type===waiting[k].type){const r=waiting[k].r;waiting[k]=null;r(m);}else inbox[k][m.type]=m;
 if(m.type==='ready')maybeStart();});
let ready=0;function maybeStart(){if(++ready>=2&&!started)start();}
setTimeout(()=>{if(!started)start();},2500);
const post=(k,m)=>cap(F[k].contentWindow.command(m),25000,k+' 명령 '+m.type);
const send=(u,b)=>cap(fetch(u,{method:'POST',body:b}),25000,'저장 전송 '+u);
const wait=(k,t)=>new Promise(r=>{if(inbox[k][t]){const m=inbox[k][t];delete inbox[k][t];r(m);return;}waiting[k]={type:t,r};});
// 숨은 탭에서 setTimeout 은 1초로 늦춰진다(획마다 1초 = 한 종에 80초). 메시지 한 바퀴는 늦춰지지 않으므로
// 그걸로 시간을 센다. 하는 일은 같다 — 그 시간만큼 기다렸다가 다음 획으로 간다.
const tick=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const rest=async(ms=40)=>{const t0=performance.now();while(performance.now()-t0<ms)await tick();};
// 한 종이 영영 안 끝나면 다음 종까지 막힌다. 기다림마다 시간 제한을 둔다.
const cap=(promise,ms,what)=>Promise.race([promise,new Promise((_,x)=>setTimeout(()=>x(new Error(what+' 시간 초과')),ms))]);
window.addEventListener('unhandledrejection',e=>{log.textContent+='\\n처리 못한 오류: '+(e.reason&&e.reason.message||e.reason);});
const dom=k=>F[k].contentDocument;
function ev(k,type,p){const c=dom(k).getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom(k).defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
function draw(k,pts){ev(k,'pointerdown',pts[0]);for(const p of pts.slice(1))ev(k,'pointermove',p);ev(k,'pointerup',pts.at(-1));}
async function save(k){await cap(post(k,{type:'save',token:++token}),15000,k+' 저장 요청');const s=await cap(wait(k,'save'),20000,k+' 저장 응답');await post(k,{type:'saved',token:s.token});return s.data;}
async function init(k,id,how,data){
 await post(k,{type:'init',id:id,color:'#17191D',penWidth:WIDTH,
  brush:{preset:how.preset??null,opacity:1,stabilizer:'light',smoothing:true},
  layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0,data:data||undefined}]});
 await cap(wait(k,'initialized'),20000,k+' 초기화');
 await post(k,{type:'brush',brush:how.base??'pen'});
 await post(k,{type:'tool',tool:'pen'});
}
async function drawScenes(k){
 for(const [label,mul,paths] of scenes){
  await post(k,{type:'width',tool:'pen',width:Math.max(1,Math.round(WIDTH*mul))});
  await rest(25);
  for(const p of paths){draw(k,p);await rest(40);}
 }
 await rest(120);
}
async function start(){
 if(started)return;started=true;
 for(const [id,name,tier,how] of list){
  try{
  // ① 예전 엔진으로 그려 저장한다 = '45.31 에서 만든 작품'
  await init('old','cv-'+id,how);
  await drawScenes('old');
  const oldArt=await save('old');
  await send('/save/'+id+'__old',oldArt);
  // ② 그 작품을 지금 엔진에서 연다 — 그림이 그대로여야 한다
  await init('new','cv-'+id+'-open',how,oldArt);
  const reopened=await save('new');
  await send('/save/'+id+'__reopen',reopened);
  // ③ 같은 경로를 지금 엔진으로 새로 긋는다 — 새 획이 얼마나 달라졌는지
  await init('new','cv-'+id+'-fresh',how);
  await drawScenes('new');
  const fresh=await save('new');
  await send('/save/'+id+'__new',fresh);
  log.textContent+='\\n'+id+' '+name;
  }catch(e){log.textContent+='\\n'+id+' 실패: '+(e&&e.message||e);await fetch('/fail/'+id,{method:'POST',body:String(e&&e.message||e)});}
 }
 await fetch('/done',{method:'POST'});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
let n = 0;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const id = req.url.slice(6).replace(/[^A-Za-z0-9_-]/g, '');
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => { fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(body.split(',')[1], 'base64')); n++; res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url.startsWith('/fail/')) {
    const id = req.url.slice(6).replace(/[^A-Za-z0-9_-]/g, '');
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => { fs.mkdirSync(OUT, { recursive: true });
      fs.appendFileSync(path.join(OUT, 'failed.txt'), id + '\t' + body + '\n'); console.log('  실패 ' + id + ': ' + body); res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') { res.end('ok'); console.log('  ' + n + '장 → ' + OUT); setTimeout(() => process.exit(0), 300); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (req.url.startsWith('/engine-old')) return res.end(oldHtml.replace('</head>', SHIM + '</head>'));
  if (req.url.startsWith('/engine-new')) return res.end(newHtml.replace('</head>', SHIM + '</head>'));
  res.end(HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ · ' + BRUSHES.length + '종 × 3장 · 예전=' + OLDREF));
