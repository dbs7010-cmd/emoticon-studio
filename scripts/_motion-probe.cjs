// 전체 움직임 여섯이 **실제로 서로 다른가**. 이름만 다르고 같은 움직임을 새 종류로 세지 않기 위해,
// 엔진이 굽는 **내보내기 GIF** 를 그대로 받아 프레임마다 그림의 자리·크기·기울기를 읽어 견준다.
//   · rAF(화면 재생)에 기대지 않는다 — 숨은 창에서는 브라우저가 rAF 를 멈춘다(검수 환경 문제).
//   · 엔진 내부 함수를 꺼내 쓰지 않는다 — 제품 코드를 검사용으로 고치지 않는다.
//   · 덤으로 프레임 수·간격·투명도까지 같은 자리에서 확인한다.
// 쓰는 법: node scripts/_motion-probe.cjs <포트> <나갈폴더>
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');
const { decode, compose } = require('./_gif.cjs');

const PORT = Number(process.argv[2] || 4920);
const OUT = process.argv[3] || 'verification/round45_34/motion';
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');
// 45.39: 스무 가지 전부(저장 목록을 그대로 읽는다).
const { MOTION_PRESETS } = loader({})('src/types.ts');
const PRESETS = [...MOTION_PRESETS];
const NAME = { float: '둥실', bounce: '통통', pulse: '두근거리기', tilt: '까딱', shake: '흔들기', jitter: '부르르', pop: '뿅', slide: '쓱', peek: '빼꼼', drop: '쿵', vanish: '사라지기', hop: '폴짝', nod: '끄덕', bow: '꾸벅', dance: '들썩', sway: '살랑', spin: '빙글', shiver: '덜덜', punch: '쾅', stretch: '쭈욱' };

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>움직임 여섯</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const presets=${JSON.stringify(PRESETS)};
let waiting=null,started=false,token=0;const inbox={};
const post=m=>engine.contentWindow.command(m);
const wait=t=>new Promise(r=>{if(inbox[t]){const m=inbox[t];delete inbox[t];r(m);return;}waiting={type:t,r};});
const tick=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const rest=async(ms=40)=>{const t0=performance.now();while(performance.now()-t0<ms)await tick();};
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}else inbox[m.type]=m;
 if(m.type==='ready')start();});
setTimeout(()=>{if(!started)start();},1500);
const dom=()=>engine.contentDocument;
function ev(type,p){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
function draw(pts){ev('pointerdown',pts[0]);for(const p of pts.slice(1))ev('pointermove',p);ev('pointerup',pts.at(-1));}
const ring=(cx,cy,r,n=36)=>Array.from({length:n+1},(_,i)=>{const t=i/n*Math.PI*2;return [cx+r*Math.cos(t),cy+r*Math.sin(t)];});
const seg=(x0,y0,x1,y1,n=10)=>Array.from({length:n+1},(_,i)=>[x0+(x1-x0)*i/n,y0+(y1-y0)*i/n]);
async function start(){
 if(started)return;started=true;
 await post({type:'init',id:'motion-probe',color:'#17191D',penWidth:8,
  brush:{preset:null,opacity:1,stabilizer:'light',smoothing:true},
  layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
 await wait('initialized');
 await post({type:'tool',tool:'pen'});await post({type:'brush',brush:'pen'});
 // 머리 + 위로 뻗은 막대. 막대가 있어야 '돌았다'와 '옆으로 갔다'가 갈린다.
 draw(ring(.5,.55,.16));await rest(80);
 draw(seg(.5,.39,.5,.18));await rest(80);
 draw(ring(.44,.52,.025));draw(ring(.56,.52,.025));await rest(140);
 for(const preset of presets){
  await post({type:'motion',motion:{preset:preset,speed:.5,strength:1}});
  await rest(40);
  await post({type:'save',gif:true,token:++token});
  const s=await wait('save');
  await post({type:'saved',token:s.token});
  if(!s.gif){log.textContent+='\\n'+preset+' — GIF 없음';continue;}
  await fetch('/gif/'+preset,{method:'POST',body:JSON.stringify({data:s.gif.data,count:s.gif.count,fps:s.gif.fps,loop:s.gif.loop,delayMs:s.gif.delayMs,bytes:s.gif.bytes,clipped:s.gif.clipped})});
  log.textContent+='\\n'+preset+' 프레임 '+s.gif.count;
 }
 await post({type:'motion',motion:null});
 await fetch('/done',{method:'POST'});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

// 한 프레임에서 그림의 자리·크기·기울기를 읽는다.
function measure(rgba, W, H) {
  let n = 0, sx = 0, sy = 0, minX = W, maxX = -1, minY = H, maxY = -1;
  const ink = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = (y * W + x) * 4;
    if (rgba[d + 3] < 40) continue;
    // 흰 바탕 위에 구운 GIF 다 — 밝은 픽셀은 바탕이다.
    if (rgba[d] > 200 && rgba[d + 1] > 200 && rgba[d + 2] > 200) continue;
    n++; sx += x; sy += y; ink.push(y * W + x);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!n) return null;
  // 기울기: 위쪽 12% 잉크의 좌우 중심이 전체 중심에서 얼마나 치우쳤나.
  const cut = minY + (maxY - minY) * .12;
  let tn = 0, tsx = 0;
  for (const i of ink) { const y = Math.floor(i / W); if (y > cut) continue; tn++; tsx += i % W; }
  return { cx: sx / n, cy: sy / n, w: maxX - minX + 1, h: maxY - minY + 1, lean: tn ? (tsx / tn) - (sx / n) : 0 };
}

const got = {};
let done = false;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/gif/')) {
    const id = req.url.slice(5).replace(/[^a-z]/gi, '');
    let b = ''; req.on('data', c => { b += c; });
    req.on('end', () => { got[id] = JSON.parse(b); res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') {
    if (done) { res.end('ok'); return; } done = true;
    fs.mkdirSync(OUT, { recursive: true });
    const report = {};
    const pad = (v, n) => String(typeof v === 'number' ? v.toFixed(1) : v).padStart(n);
    console.log('효과          프레임  간격   가로   세로    폭    높이  기울기');
    for (const k of PRESETS) {
      const g = got[k];
      if (!g) { console.log((NAME[k] + '              ').slice(0, 14) + '  자료 없음'); continue; }
      const raw = Buffer.from(String(g.data).split(',').pop(), 'base64');
      fs.writeFileSync(path.join(OUT, k + '.gif'), raw);
      const { width, height, shots } = compose(decode(raw));
      const rows = shots.map(s => measure(s.rgba, width, height)).filter(Boolean);
      const span = f => Math.max(...rows.map(f)) - Math.min(...rows.map(f));
      const t = { frames: shots.length, 측정프레임: rows.length, 간격: shots[0] ? shots[0].delay : 0,
        투명: shots.some(s => s.transparent), 반복: g.loop, fps: g.fps, bytes: g.bytes,
        가로: span(r => r.cx), 세로: span(r => r.cy), 폭: span(r => r.w), 높이: span(r => r.h), 기울기: span(r => r.lean) };
      report[k] = t;
      console.log((NAME[k] + '              ').slice(0, 14) + pad(t.frames, 5) + pad(t.간격 + 'ms', 7) +
        pad(t.가로, 7) + pad(t.세로, 7) + pad(t.폭, 7) + pad(t.높이, 7) + pad(t.기울기, 8));
    }
    fs.writeFileSync(path.join(OUT, 'whole.json'), JSON.stringify(report, null, 2));
    const names = Object.keys(report);
    const sig = t => [t.가로, t.세로, t.폭, t.높이, t.기울기];
    const same = [];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = sig(report[names[i]]), c = sig(report[names[j]]);
      if (a.every((v, n) => Math.abs(v - c[n]) < 1.0)) same.push(NAME[names[i]] + ' = ' + NAME[names[j]]);
    }
    const still = names.filter(k => sig(report[k]).every(v => v < 1));
    console.log('');
    console.log('프레임 수 ' + names.map(k => report[k].frames).join('/') + ' · 간격 ' + names.map(k => report[k].간격).join('/') + 'ms · 투명 ' + names.map(k => report[k].투명 ? 'O' : 'X').join(''));
    if (still.length) console.log('움직이지 않는 효과: ' + still.map(k => NAME[k]).join(' · '));
    console.log(same.length ? '성격이 겹치는 짝: ' + same.join(' · ') : '여섯 가지가 서로 다른 움직임이다 (' + names.length + '/' + PRESETS.length + ')');
    res.end('ok');
    setTimeout(() => process.exit(same.length || still.length || names.length < PRESETS.length ? 1 : 0), 300);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', `<script>window.ReactNativeWebView={postMessage:m=>parent.postMessage(m,'*')};</script></head>`) : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ · 전체 움직임 ' + PRESETS.length + '가지 · 내보내기 GIF 로 잰다'));
