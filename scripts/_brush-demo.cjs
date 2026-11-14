// 실제 이모티콘 한 칸을 **앱 엔진으로** 그린다. 각 브러시를 제 쓰임에 맞게 쓴다:
// 외곽선 · 눈/입 · 채색 · 볼터치 · 손글씨 · 털/그림자 · 효과선.
// 꾸민 그림이 아니라 엔진이 돌려준 합성 PNG 를 그대로 받는다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const PORT = Number(process.argv[2] || 4800);
const OUT = process.argv[3] || 'verification/round45_31';
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

// [브러시, 색, 굵기, 경로들]. 경로는 0~1 비율 좌표.
const ring = (cx, cy, r, ry, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n * Math.PI * 2; return [cx + r * Math.cos(t), cy + (ry ?? r) * Math.sin(t)]; });
const arc = (cx, cy, r, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
const line = (x0, y0, x1, y1, n = 8) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);

const STEPS = [
  // 1) 몸을 채운다 — 불투명 채색붓(F07). 선을 긋기 전에 아래에 깔린다.
  ['opaque', null, '#F6D98A', 46, [ring(.5, .52, .20, .21), ring(.5, .52, .13, .14), ring(.5, .52, .06, .07)]],
  ['opaque', null, '#F6D98A', 34, [ring(.33, .40, .05), ring(.67, .40, .05)]],   // 귀
  // 2) 볼터치 — 에어브러시(F09).
  ['airbrush', 'airbrush', '#F2907F', 26, [ring(.39, .58, .022), ring(.61, .58, .022)]],
  // 3) 외곽선 — 기본 펜(F01).
  ['pen', null, '#2B2A28', 6, [ring(.5, .52, .205), ring(.33, .40, .052), ring(.67, .40, .052)]],
  // 4) 눈·입 — 자연 잉크(F02). 작은 닫힌 곡선에 구멍·돌기가 없어야 한다.
  ['inknatural', 'inknatural', '#2B2A28', 7, [ring(.435, .49, .018), ring(.565, .49, .018)]],
  ['inknatural', 'inknatural', '#2B2A28', 5, [arc(.5, .55, .045, .25, Math.PI - .25)]],
  // 5) 털·그림자 — 연필(F05)로 턱 밑 음영, 색연필(F06)로 귀 안쪽.
  ['pencil2', 'pencil2', '#8A7A5E', 16, [arc(.5, .52, .17, .55, Math.PI - .55)]],
  ['colorpencil', 'colorpencil', '#C98F6A', 10, [ring(.33, .40, .022), ring(.67, .40, .022)]],
  // 6) 손글씨 — 붓펜(F04). 획 중간에서 굵기가 변해야 글씨로 읽힌다.
  ['brushpen2', 'brushpen2', '#2B2A28', 9, [
    line(.30, .80, .30, .87), line(.295, .80, .345, .80), line(.295, .835, .345, .835),   // ㄱ 비슷한 획 묶음
    arc(.44, .835, .035, -Math.PI * .8, Math.PI * .8), line(.52, .78, .52, .89),
    line(.60, .80, .68, .80), line(.64, .80, .64, .89)]],
  // 7) 효과선 — 평행선 펜(P19)과 발광 펜(P20).
  ['parallelpen', 'parallelpen', '#8A7A5E', 5, [line(.10, .26, .22, .34), line(.90, .26, .78, .34)]],
  ['glowpen', 'glowpen', '#F2C24B', 7, [ring(.19, .20, .012), ring(.83, .19, .012)]],
];

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>브러시로 그린 한 칸</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const steps=${JSON.stringify(STEPS)};
let waiting=null,token=0;
const post=m=>engine.contentWindow.command(m);
const wait=t=>new Promise(r=>{waiting={type:t,r};});
const rest=(ms=60)=>new Promise(r=>setTimeout(r,ms));
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}
 if(m.type==='ready')start();});
const dom=()=>engine.contentDocument;
function ev(type,p){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
function draw(pts){ev('pointerdown',pts[0]);for(const p of pts.slice(1))ev('pointermove',p);ev('pointerup',pts.at(-1));}
async function start(){
 await post({type:'init',id:'demo',color:'#2B2A28',penWidth:6,
  brush:{preset:null,opacity:1,stabilizer:'light',smoothing:true},
  layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
 await wait('initialized');
 await post({type:'tool',tool:'pen'});
 for(const [key,preset,color,width,paths] of steps){
  await post({type:'brushSettings',preset:preset,opacity:1,stabilizer:'light',smoothing:true});
  await post({type:'brush',brush:preset?'pen':(key==='pen'?'pen':'pen')});
  await post({type:'color',color:color});
  await post({type:'width',tool:'pen',width:width});
  await rest(40);
  for(const p of paths){draw(p);await rest(70);}
  log.textContent+='\\n'+key+' — '+paths.length+'획';
 }
 await rest(200);
 await post({type:'save',token:++token});
 const saved=await wait('save');
 post({type:'saved',token:saved.token});
 await fetch('/save',{method:'POST',body:saved.data});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => { fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, 'emoticon-demo.png'), Buffer.from(body.split(',')[1], 'base64'));
      console.log('  emoticon-demo.png → ' + OUT); res.end('ok'); setTimeout(() => process.exit(0), 300); });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ 를 열면 한 칸을 그린다'));
