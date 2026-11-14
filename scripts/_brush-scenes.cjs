// 브러시마다 **쓰임이 드러나는 다섯 장면**을 한 캔버스에 그린다. 이름 없는 S곡선 격자를 대신한다.
//   A 둥근 얼굴 외곽선 + 작은 눈·입   B 손글씨 '안녕!'   C 볼터치 + 넓은 채색 + 겹침
//   D 질감 색면 + 해칭                E 효과선
// 모든 브러시에 **같은 경로·같은 색·같은 굵기**를 쓴다(동일 조건 비교).
// 한글은 글꼴을 찍지 않는다 — 같은 손글씨 획 경로를 엔진이 긋는다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const PORT = Number(process.argv[2] || 4820);
const OUT = process.argv[3] || 'verification/round45_32/scenes';
const ONLY = (process.argv[4] || '').split(',').filter(Boolean);   // 비우면 전체
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');
const { LIST } = require('./_brush30.cjs');

// ── 경로 만들기 (0~1 비율) ────────────────────────────────────────────────────────────────────
const ring = (cx, cy, r, n = 48) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n * Math.PI * 2; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
const arc = (cx, cy, r, a0, a1, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
const seg = (x0, y0, x1, y1, n = 10) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
// 손글씨 '안녕!' — 곧은 획 대신 살짝 휘어 손으로 쓴 느낌을 낸다.
const bow = (x0, y0, x1, y1, k = .012, n = 12) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, s = Math.sin(t * Math.PI) * k;
  return [x + (-dy / L) * s, y + (dx / L) * s];
});

// 다섯 장면. [장면 이름, 굵기 배수, 경로들]
const SCENES = [
  ['A 얼굴 외곽선과 눈·입', 1, [
    ring(.24, .22, .145),                       // 얼굴
    ring(.195, .20, .017, 20), ring(.285, .20, .017, 20),   // 눈 — 작은 닫힌 곡선
    arc(.24, .245, .042, .35, Math.PI - .35),   // 입
  ]],
  ['B 손글씨 안녕!', 1, [
    // 안
    ring(.60, .175, .026, 20), bow(.585, .215, .585, .285), bow(.585, .245, .625, .245),
    bow(.645, .205, .645, .285), bow(.645, .285, .695, .285),
    // 녕
    bow(.735, .16, .735, .215), bow(.735, .215, .775, .215),
    bow(.80, .16, .80, .235), bow(.80, .175, .845, .175), bow(.80, .21, .845, .21),
    ring(.79, .275, .024, 20),
    // !
    bow(.90, .155, .895, .245), ring(.893, .285, .010, 14),
  ]],
  ['C 볼터치·넓은 채색·겹침', 3.2, [
    seg(.10, .43, .36, .43), seg(.10, .49, .36, .49), seg(.10, .55, .36, .55),   // 넓은 채색
    seg(.14, .40, .30, .58),                                                      // 겹치는 획
    ...ring(.44, .49, .035, 8).length ? [ring(.44, .49, .022, 24)] : [],           // 볼터치
  ]],
  ['D 질감 색면과 해칭', 2.6, [
    seg(.60, .42, .92, .42), seg(.60, .47, .92, .47), seg(.60, .52, .92, .52),   // 색면
    seg(.62, .585, .74, .505), seg(.66, .60, .78, .52), seg(.70, .615, .82, .535),
    seg(.74, .63, .86, .55), seg(.78, .645, .90, .565),                            // 해칭
  ]],
  ['E 효과선', 1, [
    seg(.10, .74, .30, .70), seg(.10, .79, .32, .755), seg(.12, .84, .30, .81),
    arc(.52, .78, .07, -Math.PI * .8, Math.PI * .3),
    seg(.68, .70, .74, .84), seg(.80, .70, .86, .84), seg(.66, .78, .88, .76),
  ]],
];

const BRUSHES = LIST.filter(r => r[2] !== 'legacy').filter(r => !ONLY.length || ONLY.includes(r[0]));

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>장면 비교</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const list=${JSON.stringify(BRUSHES)};
const scenes=${JSON.stringify(SCENES)};
const WIDTH=${Number(process.argv[5] || 10)};
let token=0,waiting=null,started=false;
// 엔진이 답을 먼저 보내고 우리가 나중에 기다리면 영영 못 받는다. 온 것을 담아 두고 기다릴 때 꺼낸다.
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
// 엔진이 'ready' 를 먼저 보내고 우리가 나중에 들으면 영영 못 받는다. 한 번 더 확인해 시작한다.
setTimeout(()=>{if(!started&&engine.contentDocument&&engine.contentDocument.getElementById('drawing'))start();},1200);
const dom=()=>engine.contentDocument;
function ev(type,p){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
function draw(pts){if(pts.length===1){ev('pointerdown',pts[0]);ev('pointerup',pts[0]);return;}
 ev('pointerdown',pts[0]);for(const p of pts.slice(1))ev('pointermove',p);ev('pointerup',pts.at(-1));}
async function start(){
 if(started)return;started=true;
 for(const [id,name,tier,how] of list){
  await post({type:'init',id:'sc-'+id,color:'#17191D',penWidth:WIDTH,
   brush:{preset:how.preset??null,opacity:1,stabilizer:'light',smoothing:true},
   layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
  await wait('initialized');
  await post({type:'brush',brush:how.base??'pen'});
  await post({type:'tool',tool:'pen'});
  for(const [label,mul,paths] of scenes){
   await post({type:'width',tool:'pen',width:Math.max(1,Math.round(WIDTH*mul))});
   await rest(30);
   for(const p of paths){draw(p);await rest(45);}
  }
  await rest(150);
  await post({type:'save',token:++token});
  const saved=await wait('save');
  post({type:'saved',token:saved.token});
  await fetch('/save/'+id,{method:'POST',body:saved.data});
  log.textContent+='\\n'+id+' '+name;
 }
 await fetch('/done',{method:'POST'});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
if (require.main === module) {
  let n = 0;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/save/')) {
      const id = req.url.slice(6).replace(/[^A-Z0-9]/gi, '');
      let body = ''; req.on('data', c => { body += c; });
      req.on('end', () => { fs.mkdirSync(OUT, { recursive: true });
        fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(body.split(',')[1], 'base64')); n++; res.end('ok'); });
      return;
    }
    if (req.method === 'POST' && req.url === '/done') { res.end('ok'); console.log('  ' + n + '장 → ' + OUT); setTimeout(() => process.exit(0), 300); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
  });
  server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ · ' + BRUSHES.length + '종 × 5장면'));
}
module.exports = { SCENES, BRUSHES };
