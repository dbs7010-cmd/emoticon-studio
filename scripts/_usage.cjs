// 실제 쓰임 두 장을 **앱 엔진으로** 그린다. 시험 격자가 아니라 완성된 한 칸과 손글씨 한 장이다.
//   illust    — 360×360 이모티콘 한 칸(출력 크기 그대로)
//   writing   — 손글씨 한 장. 한글은 글꼴을 찍지 않고 획 경로를 엔진이 긋는다.
// 쓴 브러시·색·굵기는 steps.json 으로 함께 내보낸다 — 자료에 적기 위해서다.
// 쓰는 법: node scripts/_usage.cjs <포트> <나갈폴더>
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const PORT = Number(process.argv[2] || 4870);
const OUT = process.argv[3] || 'verification/round45_33/usage';
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

const ring = (cx, cy, r, ry, n = 44) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n * Math.PI * 2; return [cx + r * Math.cos(t), cy + (ry ?? r) * Math.sin(t)]; });
const arc = (cx, cy, r, a0, a1, n = 16, ry) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(t), cy + (ry ?? r) * Math.sin(t)]; });
const line = (x0, y0, x1, y1, n = 10) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
// 손으로 쓴 느낌 — 곧은 획을 살짝 휘게 한다.
const bow = (x0, y0, x1, y1, k = .015, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, s = Math.sin(t * Math.PI) * k;
  return [x + (-dy / L) * s, y + (dx / L) * s];
});

// 손글씨 한 장 — 같은 '안녕!' 을 네 가지 펜으로. 획 경로는 장면 B 에서 쓰던 것과 같다(글꼴 아님).
// 원래 좌표의 테두리는 x .559~.903 · y .134~.295 다. 그 상자를 원하는 자리로 옮겨 키운다.
const WORD_SRC = [
  ring(.600, .175, .026, .026, 22), bow(.585, .215, .585, .285), bow(.585, .245, .625, .245),
  bow(.645, .205, .645, .285), bow(.645, .285, .695, .285),
  bow(.735, .160, .735, .215), bow(.735, .215, .775, .215),
  bow(.800, .160, .800, .235), bow(.800, .175, .845, .175), bow(.800, .210, .845, .210),
  ring(.790, .275, .024, .024, 22),
  bow(.900, .155, .895, .245), ring(.893, .285, .010, .010, 14),
];
const place = (dx, dy, k) => WORD_SRC.map(pts => pts.map(([x, y]) => [(x - .559) * k + dx, (y - .134) * k + dy]));
// [제품명, 엔진ID, 쓰임, 색, 굵기, 경로들]
const ILLUST = [
  // 목도리를 먼저 둔다 — 머리가 그 위를 덮어야 목에 감긴 것처럼 보인다.
  ['크레용', 'crayon', '목도리 — 왁스가 눌린 색면(머리 뒤에 먼저)', '#D9655A', 17, [
    line(.372, .706, .628, .700, 12), line(.378, .736, .622, .730, 12),
    line(.600, .742, .642, .812, 8)]],
  ['불투명 채색붓', 'opaque', '몸을 채운다 — 외곽선 안쪽까지만', '#F7DDA0', 30, [ring(.50, .50, .160, .155), ring(.50, .50, .095, .090), ring(.50, .50, .030, .028)]],
  ['불투명 채색붓', 'opaque', '귀', '#F7DDA0', 20, [ring(.335, .378, .022), ring(.665, .378, .022)]],
  ['색연필', 'colorpencil', '귀 안쪽 — 결이 보이는 색', '#D99A74', 12, [ring(.335, .378, .020), ring(.665, .378, .020)]],
  ['에어브러시', 'airbrush', '볼터치', '#F2A08E', 20, [ring(.383, .556, .016), ring(.617, .556, .016)]],
  ['연필', 'pencil2', '턱 밑 음영 — 결이 곱다', '#B08A55', 14, [arc(.50, .50, .150, .70, Math.PI - .70, 16, .145)]],
  ['기본 펜', 'pen', '외곽선', '#2B2A28', 6, [ring(.50, .50, .202, .197), ring(.335, .375, .050), ring(.665, .375, .050)]],
  ['자연 잉크', 'inknatural', '눈', '#2B2A28', 8, [ring(.437, .478, .0175), ring(.563, .478, .0175)]],
  ['자연 잉크', 'inknatural', '입', '#2B2A28', 6, [arc(.50, .527, .040, .28, Math.PI - .28, 14, .034)]],
  ['테이퍼 펜', 'ink', '수염 — 끝이 가늘어져야 한다', '#2B2A28', 5, [
    line(.295, .510, .215, .492, 6), line(.293, .535, .208, .535, 6),
    line(.705, .510, .785, .492, 6), line(.707, .535, .792, .535, 6)]],
  ['평행선 펜', 'parallelpen', '효과선', '#C9A659', 5, [line(.115, .265, .205, .325, 8), line(.885, .265, .795, .325, 8)]],
  ['발광 펜', 'glowpen', '반짝임', '#F2C24B', 7, [ring(.185, .205, .010), ring(.835, .195, .010)]],
  ['붓펜', 'brushpen2', '손글씨 — 획 중간 굵기가 변한다', '#2B2A28', 8, place(.330, .815, 0.92)],
];


const WRITING = [
  ['붓펜', 'brushpen2', '굵기 변화가 가장 크다 — 제목·인사말', '#17191D', 7, place(.16, .06, 1.25)],
  ['테이퍼 펜', 'ink', '끝이 가늘어지되 손글씨에서 뾰족하지 않다', '#17191D', 11, place(.16, .30, 1.25)],
  ['자연 잉크', 'inknatural', '굵기가 천천히 오르내린다 — 손그림 느낌', '#17191D', 11, place(.16, .54, 1.25)],
  ['기본 펜', 'pen', '굵기가 고르다 — 기준', '#17191D', 10, place(.16, .78, 1.25)],
];

const PLANS = { illust: ILLUST, writing: WRITING };

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>실제 쓰임</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const plans=${JSON.stringify(PLANS)};
let waiting=null,token=0,started=false;const inbox={};
const post=m=>engine.contentWindow.command(m);
const wait=t=>new Promise(r=>{if(inbox[t]){const m=inbox[t];delete inbox[t];r(m);return;}waiting={type:t,r};});
// 숨은 탭에서 setTimeout 은 1초로 늦춰진다(획마다 1초 = 한 종에 80초). 메시지 한 바퀴는 늦춰지지 않으므로
// 그걸로 시간을 센다. 하는 일은 같다 — 그 시간만큼 기다렸다가 다음 획으로 간다.
const tick=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const rest=async(ms=60)=>{const t0=performance.now();while(performance.now()-t0<ms)await tick();};
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}else inbox[m.type]=m;
 if(m.type==='ready')start();});
setTimeout(()=>{if(!started)start();},1500);
const dom=()=>engine.contentDocument;
function ev(type,p){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
function draw(pts){if(pts.length===1){ev('pointerdown',pts[0]);ev('pointerup',pts[0]);return;}
 ev('pointerdown',pts[0]);for(const p of pts.slice(1))ev('pointermove',p);ev('pointerup',pts.at(-1));}
async function start(){
 if(started)return;started=true;
 for(const key of Object.keys(plans)){
  await post({type:'init',id:'use-'+key,color:'#2B2A28',penWidth:6,
   brush:{preset:null,opacity:1,stabilizer:'light',smoothing:true},
   layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
  await wait('initialized');
  await post({type:'tool',tool:'pen'});
  for(const [name,engineId,use,color,width,paths] of plans[key]){
   const preset=engineId==='pen'?null:engineId;
   await post({type:'brushSettings',preset:preset,opacity:1,stabilizer:'light',smoothing:true});
   await post({type:'brush',brush:'pen'});
   await post({type:'color',color:color});
   await post({type:'width',tool:'pen',width:width});
   await rest(35);
   for(const p of paths){draw(p);await rest(55);}
   log.textContent+='\\n'+key+' · '+name+' — '+paths.length+'획';
  }
  await rest(220);
  await post({type:'save',token:++token});
  const saved=await wait('save');
  post({type:'saved',token:saved.token});
  await fetch('/save/'+key,{method:'POST',body:saved.data});
 }
 await fetch('/done',{method:'POST'});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
let n = 0;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const id = req.url.slice(6).replace(/[^a-z]/gi, '');
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => { fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(body.split(',')[1], 'base64')); n++; res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') {
    // 쓴 브러시·색·굵기를 자료에 그대로 적기 위해 함께 내보낸다.
    fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify(
      Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, v.map(([name, id, use, color, width, paths]) => ({ name, engine: id, use, color, width, strokes: paths.length }))])), null, 2));
    res.end('ok'); console.log('  ' + n + '장 + steps.json → ' + OUT); setTimeout(() => process.exit(0), 300); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ · 일러스트 1장 + 손글씨 1장'));
