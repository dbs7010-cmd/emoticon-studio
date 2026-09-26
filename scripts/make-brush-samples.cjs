// 브러시 목록의 획 견본을 **넓은 띠**로 다시 만든다. 실제 엔진이 그은 획이다 — 꾸민 그림이 아니다.
//
// 왜 다시 만드는가: 45.35 승인 시안의 목록은 "이름 + 넓은 실제 획 견본" 이다. 그런데 지금 견본
// 파일은 360×360(또는 320×200)에 가까운 네모라, 줄 안에서 높이에 맞춰 줄이면 34×34 짜리 작은
// 도장이 된다 — 넓은 획이 아니라 점처럼 보인다(대체 렌더는 늘여 붙이느라 이 문제를 가렸다).
// 그래서 같은 엔진·같은 프리셋으로 **띠 모양 경로**를 긋고 그 띠만 잘라 낸다.
//
// 엔진 자체는 건드리지 않는다. 바꾸는 것은 견본을 만들 때 쓰는 입력 경로와 굵기뿐이고,
// 그 값은 사용자 브러시 설정과 아무 관계가 없다.
//
//   node scripts/make-brush-samples.cjs [포트]
//   그리고 http://localhost:<포트>/ 를 연다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');
const { read, write } = require('./_png.cjs');

const PORT = Number(process.argv[2] || 4770);
const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'verification', 'round45_35', 'samples-raw');
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

// 브러시 표는 painter.tsx 의 CATALOG 한 곳에서 읽는다. 여기에 목록을 또 적으면 둘이 갈라진다.
function catalog() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'painter', 'painter.tsx'), 'utf8');
  const start = src.indexOf('const CATALOG:');
  const end = src.indexOf('\n];', start);
  if (start < 0 || end < 0) throw new Error('CATALOG 를 못 찾았다');
  const out = [];
  for (const line of src.slice(start, end).split('\n')) {
    const key = /key: '([^']+)'/.exec(line);
    const stroke = /stroke: require\('[^']*\/([^'\/]+\.png)'\)/.exec(line);
    if (!key || !stroke) continue;
    out.push({
      key: key[1],
      title: (/title: '([^']+)'/.exec(line) ?? [])[1],
      group: (/group: '([^']+)'/.exec(line) ?? [])[1],
      base: (/base: '([^']+)'/.exec(line) ?? [])[1] ?? null,
      preset: (/preset: '([^']+)'/.exec(line) ?? [])[1] ?? null,
      file: stroke[1],
    });
  }
  if (out.length !== 30) throw new Error('브러시가 30종이 아니다: ' + out.length);
  return out;
}
const LIST = catalog();

// 잘라 낼 띠: 그림 한가운데의 가로 띠. 360 × 86 ≈ 4.2 : 1 이라 줄 안에서 넓은 획으로 읽힌다.
const BAND_TOP = 137, BAND_H = 86;

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>획 견본</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const list=${JSON.stringify(LIST)};
let token=0,waiting=null;
const post=m=>engine.contentWindow.command(m);
const wait=t=>new Promise(r=>{waiting={type:t,r};});
// 창이 숨겨져 있으면 크롬이 setTimeout 을 1초로 늦춘다. 메시지 한 바퀴는 늦춰지지 않으므로 그걸로 센다.
const tick=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const rest=async(ms=60)=>{const t0=performance.now();while(performance.now()-t0<ms)await tick();};
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}
 if(m.type==='ready')start();});
const dom=()=>engine.contentDocument;
function ev(type,p){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
// 앱은 압력 입력을 지원하지 않는다. 모든 견본도 실제 앱과 같은 고정 pressure=.5만 보내며,
// 차이는 사용자가 실제로 만들 수 있는 경로·굵기·속도(이벤트 간격)로만 만든다.
async function draw(pts,delay){ev('pointerdown',pts[0]);for(const p of pts.slice(1)){ev('pointermove',p);if(delay)await rest(delay);}ev('pointerup',pts.at(-1));}
// 띠 안을 지나는 완만한 물결 하나. 가로를 넓게 쓰되 세로로는 띠를 벗어나지 않는다.
function wave(amp,from,to,turns=1.7,count=56,base=.5){const a=[];for(let i=0;i<=count;i++){const t=i/count;a.push([from+(to-from)*t,base+amp*Math.sin(t*Math.PI*turns-.35)]);}return a;}
// 분류마다 보여 줄 것이 다르다(45.35 §6): 선은 선의 성격, 채색은 넓은 획과 겹침,
// 질감은 재료감, 효과는 그 효과의 실제 특징.
function planFor(b){
 const named={
  pen:{width:12,amp:.045,turns:1.7,count:64,delay:1}, inknatural:{width:15,amp:.075,turns:2.2,count:78,delay:2},
  ink:{width:18,amp:.05,turns:1.35,count:24,delay:0}, brushpen2:{width:26,amp:.08,turns:1.8,count:34,delay:2},
  flat:{width:30,amp:.025,turns:1.15,count:28,delay:1}, pencil2:{width:18,amp:.065,turns:2.5,count:88,delay:2},
  marker2:{width:32,amp:.02,turns:1.0,count:36,delay:0}, dryflat:{width:28,amp:.07,turns:2.0,count:42,delay:1},
  pointil:{width:24,amp:.09,turns:2.8,count:30,delay:2}, spray:{width:30,amp:.055,turns:1.5,count:70,delay:1},
  dotted:{width:18,amp:.035,turns:1.2,count:38,delay:2}, parallelpen:{width:24,amp:.06,turns:1.9,count:56,delay:1},
  glowpen:{width:22,amp:.035,turns:1.4,count:72,delay:1}, outline:{width:28,amp:.045,turns:1.7,count:52,delay:1}
 };
 const n=named[b.key]; if(n)return {...n,paths:[wave(n.amp,.05,.95,n.turns,n.count)]};
 // 불투명 붓도 실제 겹침을 보이되, 두 획이 띠 대부분을 칠해 버리지 않게 두 번째 획은 짧게 둔다.
 if(b.key==='opaque')return {width:22,delay:1,paths:[wave(.035,.05,.95,1.5,48,.47),wave(-.025,.42,.78,1.1,24,.55)]};
 // 채색은 넓은 획과 **겹침**을 보여 준다. 다만 띠를 통째로 덮으면 획이 아니라 색 덩어리로 보인다 —
 // 두 번째 획을 짧고 살짝 어긋나게 겹쳐 경계가 읽히게 한다.
 if(b.group==='채색')return {width:28,delay:1,paths:[wave(.035,.05,.95,1.5,48,.46),wave(-.025,.34,.98,1.2,34,.56)]};
 if(b.group==='질감')return {width:25,delay:2,paths:[wave(.07,.05,.95,2.4,72)]};
 if(b.group==='효과')return {width:20,delay:1,paths:[wave(.045,.05,.95,1.7,52)]};
 return {width:14,delay:1,paths:[wave(.05,.05,.95,1.7,56)]};
}
async function start(){
 for(const b of list){
  const plan=planFor(b);
  await post({type:'init',id:'s-'+b.key,color:'#17191D',penWidth:plan.width,
   brush:{preset:b.preset,opacity:1,stabilizer:'light',smoothing:true},
   layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
  await wait('initialized');
  await post({type:'brush',brush:b.base??'pen'});
  await post({type:'tool',tool:'pen'});
  await post({type:'width',tool:'pen',width:plan.width});
  await rest(50);
  for(const pts of plan.paths){await draw(pts,plan.delay);await rest(90);}
  await rest(160);
  await post({type:'save',token:++token});
  const saved=await wait('save');
  post({type:'saved',token:saved.token});
  await fetch('/save/'+b.key,{method:'POST',body:saved.data});
  log.textContent+='\\n'+b.key+' '+b.title+' ('+b.group+')';
 }
 await fetch('/done',{method:'POST'});
 log.textContent+='\\n끝났습니다. 창을 닫아도 됩니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;

// 받은 360×360 에서 띠만 잘라 견본 파일로 굳힌다. 알파는 그대로 둔다 — 앱이 지금 색으로 물들인다.
function bandOf(key) {
  const img = read(path.join(RAW, key + '.png'));
  const out = { w: img.w, h: BAND_H, d: Buffer.alloc(img.w * BAND_H * 4) };
  for (let y = 0; y < BAND_H; y++) img.d.copy(out.d, y * img.w * 4, (BAND_TOP + y) * img.w * 4, (BAND_TOP + y + 1) * img.w * 4);
  return out;
}

let saved = 0;
fs.mkdirSync(RAW, { recursive: true });
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const key = req.url.slice(6).replace(/[^a-z0-9]/gi, '');
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => { fs.writeFileSync(path.join(RAW, key + '.png'), Buffer.from(body.split(',')[1], 'base64')); saved++; res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') {
    res.end('ok');
    let wrote = 0, thin = [];
    for (const b of LIST) {
      const band = bandOf(b.key);
      let ink = 0; for (let i = 0; i < band.w * band.h; i++) if (band.d[i * 4 + 3] > 8) ink++;
      // 띠 안에 잉크가 거의 없으면 경로가 띠를 벗어난 것이다 — 조용히 빈 견본을 내보내지 않는다.
      if (ink < band.w * band.h * .01) { thin.push(b.title + ' ' + (ink / (band.w * band.h) * 100).toFixed(2) + '%'); continue; }
      write(path.join(ROOT, 'assets', 'art', b.file), band);
      wrote++;
    }
    console.log('  견본 ' + wrote + '장 (' + band0() + ')');
    if (thin.length) console.log('  띠에 잉크가 모자란 것: ' + thin.join(', '));
    setTimeout(() => process.exit(0), 300);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
const band0 = () => '360×' + BAND_H;
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ 를 열면 30종 견본을 다시 만든다'));
