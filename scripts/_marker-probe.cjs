// 마커 빗살(획 가장자리 톱니) 조사용 탐침. **제품 엔진을 고치지 않는다** —
// 현재 엔진 소스를 메모리에서만 갈아 끼워 후보안을 그려 보고, 같은 잣대로 잰다.
//
// 재는 것:
//   둘레/넓이 — 톱니가 생기면 잉크 넓이는 그대로인데 둘레가 길어진다. 매끈한 획일수록 1에 가깝다
//                (같은 굵기·길이의 이상적인 띠 둘레로 나눈 값).
//   톱니 깊이 — 획을 가로지르는 줄마다 위·아래 가장자리를 찾아, 이웃 줄과의 차이가 튀는 자리를 센다.
//
// 쓰는 법: node scripts/_marker-probe.cjs [포트] [출력폴더]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { loader } = require('./load-ts.cjs');

const PORT = Number(process.argv[2] || 4750);
const OUT = process.argv[3] || 'verification/round45_30';
const base = loader({})('src/painter/canvas-html.ts').canvasHtml;

// ── 후보안 ────────────────────────────────────────────────────────────────────────────────────
// 지금 코드: 3px 짜리 토막을 하나씩 따로 stroke 한다. cap 이 'butt' 라 굽은 자리에서 토막끼리
// 바깥쪽이 벌어지고, stroke 를 따로 부르니 lineJoin 도 걸리지 않는다 — 그게 빗살이다.
const CUR = `   else{g.beginPath();g.moveTo(from.x,from.y);g.lineTo(to.x,to.y);g.stroke();}`;

// A. 한 번의 inkSegment 안에서 토막을 **한 path 로 이어** 긋는다(lineJoin 이 걸린다).
//    호출 사이 이음매는 여전히 따로다.
const A = (src) => {
  const before = ` const distance=Math.hypot(b.x-a.x,b.y-a.y),spacing=P&&P.soft?Math.max(.8,g.lineWidth*.18):3,steps=Math.max(1,Math.ceil(distance/spacing));
 let from=a;`;
  const after = ` const distance=Math.hypot(b.x-a.x,b.y-a.y),spacing=P&&P.soft?Math.max(.8,g.lineWidth*.18):3,steps=Math.max(1,Math.ceil(distance/spacing));
 if(P&&P.joined&&!P.soft&&!P.taper){g.beginPath();g.moveTo(a.x,a.y);for(let i=1;i<=steps;i++){const t=i/steps;g.lineTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);}g.stroke();strokeLen+=distance;return;}
 let from=a;`;
  if (!src.includes(before)) throw new Error('A anchor');
  return src.replace(before, after).replace(` marker:{alpha:.55,width:2,cap:'butt'},`, ` marker:{alpha:.55,width:2,cap:'butt',joined:true},`);
};

// B. 획 전체를 들고 있다가 매번 **처음부터 한 path 로** 다시 긋는다(테두리 펜과 같은 방식).
//    이음매가 아예 없어진다. 젖은 버퍼를 지우고 다시 그리므로 겹침으로 진해지지도 않는다.
const B = (src) => {
  const before = ` if(P&&P.outline){strokePath.push(b);strokeLen+=Math.hypot(b.x-a.x,b.y-a.y);drawOutline(g);return;}`;
  const after = ` if(P&&P.outline){strokePath.push(b);strokeLen+=Math.hypot(b.x-a.x,b.y-a.y);drawOutline(g);return;}
 if(P&&P.repath){strokePath.push(b);strokeLen+=Math.hypot(b.x-a.x,b.y-a.y);
  g.save();g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.lineJoin='round';
  if(strokePath.length===1){g.beginPath();g.arc(strokePath[0].x,strokePath[0].y,g.lineWidth/2,0,Math.PI*2);g.fill();}
  else{g.beginPath();g.moveTo(strokePath[0].x,strokePath[0].y);for(let i=1;i<strokePath.length;i++)g.lineTo(strokePath[i].x,strokePath[i].y);g.stroke();}
  g.restore();return;}`;
  if (!src.includes(before)) throw new Error('B anchor');
  let out = src.replace(before, after).replace(` marker:{alpha:.55,width:2,cap:'butt'},`, ` marker:{alpha:.55,width:2,cap:'butt',repath:true},`);
  // 획을 시작할 때도 자취에 첫 점을 넣어 둔다.
  const s0 = ` if(P0&&P0.outline){strokePath=[p];drawOutline(g);}`;
  const s1 = ` if(P0&&P0.outline){strokePath=[p];drawOutline(g);}
 else if(P0&&P0.repath){strokePath=[p];g.beginPath();g.arc(p.x,p.y,g.lineWidth/2,0,Math.PI*2);g.fill();}`;
  if (!out.includes(s0)) throw new Error('B start anchor');
  return out.replace(s0, s1);
};

// C. 참고용: 끝 모양만 둥글게. 톱니는 줄지만 마커의 납작한 끝 성격이 사라진다.
const C = (src) => src.replace(` marker:{alpha:.55,width:2,cap:'butt'},`, ` marker:{alpha:.55,width:2,cap:'round'},`);

const VARIANTS = { now: s => s, A, B, C };
for (const k of Object.keys(VARIANTS)) { if (!base.includes(CUR)) throw new Error('현재 코드 확인 실패'); }

// ── 잣대 ──────────────────────────────────────────────────────────────────────────────────────
function rgba(buf) {
  let off = 8, w = 0, h = 0; const idat = [];
  while (off < buf.length) { const len = buf.readUInt32BE(off), tag = buf.slice(off + 4, off + 8).toString('latin1'), d = buf.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); } if (tag === 'IDAT') idat.push(d); if (tag === 'IEND') break; off += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p++];
    for (let x = 0; x < stride; x++) { const cur = raw[p + x], a = x >= bpp ? out[y * stride + x - bpp] : 0, bb = y > 0 ? out[(y - 1) * stride + x] : 0, c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
      let v; if (f === 0) v = cur; else if (f === 1) v = cur + a; else if (f === 2) v = cur + bb; else if (f === 3) v = cur + ((a + bb) >> 1);
      else { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c); v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      out[y * stride + x] = v & 255; } p += stride; }
  return { w, h, d: out };
}
function measure(buf) {
  const { w, h, d } = rgba(buf);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 96;
  let ink = 0, edge = 0, maxA = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = d[(y * w + x) * 4 + 3]; if (a > maxA) maxA = a;
    if (!on(x, y)) continue; ink++;
    if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) edge++;
  }
  // 획을 세로로 가로지르는 줄마다 위·아래 가장자리를 찾아, 이웃 줄과 1px 넘게 튀는 자리를 센다.
  let jitter = 0, cols = 0;
  let prevTop = null, prevBot = null;
  for (let x = 0; x < w; x++) {
    let top = -1, bot = -1;
    for (let y = 0; y < h; y++) if (on(x, y)) { if (top < 0) top = y; bot = y; }
    if (top < 0) { prevTop = prevBot = null; continue; }
    cols++;
    if (prevTop !== null) { if (Math.abs(top - prevTop) > 1) jitter++; if (Math.abs(bot - prevBot) > 1) jitter++; }
    prevTop = top; prevBot = bot;
  }
  // 같은 잉크 넓이를 가진 '매끈한 띠'의 둘레로 나눈다. 띠 길이 L, 굵기 T 면 넓이 L·T, 둘레 ≈ 2(L+T).
  const thickness = cols ? ink / cols : 1, smooth = 2 * (cols + thickness);
  return { ink, edge, maxA, cols, thickness: +thickness.toFixed(1), roughness: +(edge / Math.max(1, smooth)).toFixed(2), jitter, jitterPerCol: +(jitter / Math.max(1, cols)).toFixed(3) };
}

// ── 엔진을 띄워 같은 획을 긋게 한다 ───────────────────────────────────────────────────────────
const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>마커 빗살 탐침</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const kinds=${JSON.stringify(Object.keys(VARIANTS))};
let at=0,waiting=null,token=0,ready=false;
const wait=type=>new Promise(r=>{waiting={type,r};});
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(m.type==='ready')ready=true;
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}});
const curve=[];for(let i=0;i<=40;i++){const t=i/40;curve.push([0.08+0.84*t,0.5+0.26*Math.sin(t*Math.PI*1.6-0.5)]);}
function stroke(){
 const doc=engine.contentDocument,canvas=doc.getElementById('drawing'),r=canvas.getBoundingClientRect();
 const ev=(type,p)=>canvas.dispatchEvent(new doc.defaultView.PointerEvent(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));
 ev('pointerdown',curve[0]);for(const p of curve.slice(1))ev('pointermove',p);ev('pointerup',curve.at(-1));
}
// 엔진이 'ready' 를 먼저 보내고 우리가 나중에 기다리면 영영 못 받는다. 깃발로 받아 둔다.
 const load=src=>new Promise(r=>{ready=false;engine.onload=()=>setTimeout(r,250);engine.src=src;});
 const untilReady=async()=>{for(let i=0;i<100&&!ready;i++)await new Promise(r=>setTimeout(r,50));if(!ready)throw new Error('엔진이 준비되지 않았다');};
(async()=>{
 for(const kind of kinds){
  await load('engine-'+kind+'.html');
  await untilReady();
  await engine.contentWindow.command({type:'init',id:'m-'+kind,color:'#17191D',penWidth:14,
   brush:{preset:'marker',opacity:1,stabilizer:'light',smoothing:true},
   layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
  await wait('initialized');
  await engine.contentWindow.command({type:'tool',tool:'pen'});
  await new Promise(r=>setTimeout(r,60));
  stroke();
  await new Promise(r=>setTimeout(r,220));
  await engine.contentWindow.command({type:'save',token:++token});
  const saved=await wait('save');
  engine.contentWindow.command({type:'saved',token:saved.token});
  await fetch('/save/'+kind,{method:'POST',body:saved.data});
  log.textContent+='\\n'+kind+' 받음';
 }
 await fetch('/done',{method:'POST'});
 log.textContent+='\\n끝났습니다.';
})().catch(e=>{log.textContent+='\\n실패: '+e.message;});
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
const shots = {};
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const id = req.url.slice(6).replace(/[^a-z]/gi, '');
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => { shots[id] = Buffer.from(body.split(',')[1], 'base64'); res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') {
    res.end('ok');
    fs.mkdirSync(OUT, { recursive: true });
    const rows = [];
    console.log('  안   잉크    둘레   거칠기  가장자리 튐/줄  굵기  최대 알파');
    for (const kind of Object.keys(VARIANTS)) {
      if (!shots[kind]) { console.log('  ' + kind + ' — 받지 못했다'); continue; }
      fs.writeFileSync(path.join(OUT, 'marker-' + kind + '.png'), shots[kind]);
      const m = measure(shots[kind]); rows.push({ kind, ...m });
      console.log('  ' + kind.padEnd(5) + String(m.ink).padEnd(8) + String(m.edge).padEnd(7) + String(m.roughness).padEnd(8) + String(m.jitterPerCol).padEnd(16) + String(m.thickness).padEnd(6) + m.maxA);
    }
    fs.writeFileSync(path.join(OUT, 'marker-probe.json'), JSON.stringify(rows, null, 2));
    setTimeout(() => process.exit(0), 300);
    return;
  }
  const m = /^\/engine-([A-Za-z]+)\.html$/.exec(req.url.split('?')[0]);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (m && VARIANTS[m[1]]) { res.end(VARIANTS[m[1]](base).replace('</head>', SHIM + '</head>')); return; }
  res.end(HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ 를 열면 후보안을 하나씩 그어 잰다'));
