// 지목된 결함만 확대해서 본다. 격자가 아니라 **한 획씩** 크게 그린다.
// 쓰는 법: node scripts/_probe.cjs <포트> <나갈폴더> <기획이름>
//   beads  — 굵은 가로획에서 원형 자국이 보이는지 (색연필·크레용·소프트 파스텔 + 대조군)
//   taper  — 짧은 획·손글씨에서 양 끝 테이퍼가 과한지 (테이퍼 펜·붓펜 + 대조군)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const PORT = Number(process.argv[2] || 4840);
const OUT = process.argv[3] || 'verification/round45_33/probe';
const PLAN = process.argv[4] || 'beads';
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

// 한 칸에 획 하나. [파일이름, 프리셋, 굵기, 경로]
const seg = (x0, y0, x1, y1, n) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);

const PLANS = {
  // 사용자가 본 것과 같은 굵기다: 견본은 굵기 4 로 그렸고 '넓은 채색' 장면은 ×3.2 → 13.
  beads: [
    ['colorpencil-13', 'colorpencil', 13], ['crayon-13', 'crayon', 13], ['pastel-13', 'pastel', 13],
    ['opaque-13', 'opaque', 13], ['marker2-13', 'marker2', 13],
    ['colorpencil-32', 'colorpencil', 32], ['crayon-32', 'crayon', 32], ['pastel-32', 'pastel', 32],
    ['oilpastel-13', 'oilpastel', 13], ['pencilside-13', 'pencilside', 13],
  ].map(([f, p, w]) => [f, p, w, [seg(.08, .5, .92, .5, 60)]]),
  // 짧은 획과 보통 길이 획을 나란히 둔다. 손글씨 획 길이는 대개 캔버스의 10~20% 다.
  taper: [
    ['taperpen', 'ink', 10], ['brushpen2', 'brushpen2', 10], ['inknatural', 'inknatural', 10],
    ['pen', null, 10], ['brushpen-old', 'brushpen', 10],
  ].map(([f, p, w]) => [f, p, w, [
    seg(.08, .18, .16, .18, 6),   // 아주 짧은 가로 (캔버스의 8%)
    seg(.08, .30, .24, .30, 10),  // 짧은 가로 (16%)
    seg(.08, .44, .40, .44, 20),  // 보통 (32%)
    seg(.08, .60, .92, .60, 50),  // 긴 가로 (84%)
    seg(.10, .72, .10, .92, 12),  // 짧은 세로 — 'ㅣ'
    seg(.22, .72, .36, .72, 8),   // 짧은 가로 — 'ㅡ'
    seg(.30, .70, .30, .90, 12),
  ]]),
};

const LIST = PLANS[PLAN];
if (!LIST) { console.error('모르는 기획: ' + PLAN); process.exit(1); }

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>확대 확인</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const list=${JSON.stringify(LIST)};
let token=0,waiting=null,started=false;
const inbox={};
const post=m=>engine.contentWindow.command(m);
const wait=t=>new Promise(r=>{if(inbox[t]){const m=inbox[t];delete inbox[t];r(m);return;}waiting={type:t,r};});
// 숨은 탭에서 setTimeout 은 1초로 늦춰진다(획마다 1초 = 한 종에 80초). 메시지 한 바퀴는 늦춰지지 않으므로
// 그걸로 시간을 센다. 하는 일은 같다 — 그 시간만큼 기다렸다가 다음 획으로 간다.
const tick=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const rest=async(ms=50)=>{const t0=performance.now();while(performance.now()-t0<ms)await tick();};
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}else inbox[m.type]=m;
 if(m.type==='ready')start();});
setTimeout(()=>{if(!started&&engine.contentDocument&&engine.contentDocument.getElementById('drawing'))start();},1200);
const dom=()=>engine.contentDocument;
function ev(type,p){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
function draw(pts){ev('pointerdown',pts[0]);for(const p of pts.slice(1))ev('pointermove',p);ev('pointerup',pts.at(-1));}
async function start(){
 if(started)return;started=true;
 for(const [file,preset,width,paths] of list){
  await post({type:'init',id:'pr-'+file,color:'#17191D',penWidth:width,
   brush:{preset:preset,opacity:1,stabilizer:'light',smoothing:true},
   layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
  await wait('initialized');
  await post({type:'brush',brush:'pen'});
  await post({type:'tool',tool:'pen'});
  await post({type:'width',tool:'pen',width:width});
  await rest(30);
  for(const p of paths){draw(p);await rest(50);}
  await rest(140);
  await post({type:'save',token:++token});
  const saved=await wait('save');
  post({type:'saved',token:saved.token});
  await fetch('/save/'+file,{method:'POST',body:saved.data});
  log.textContent+='\\n'+file;
 }
 await fetch('/done',{method:'POST'});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
let n = 0;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const id = req.url.slice(6).replace(/[^A-Za-z0-9-]/g, '');
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => { fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(body.split(',')[1], 'base64')); n++; res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') { res.end('ok'); console.log('  ' + n + '장 → ' + OUT); setTimeout(() => process.exit(0), 300); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ · ' + LIST.length + '획'));
