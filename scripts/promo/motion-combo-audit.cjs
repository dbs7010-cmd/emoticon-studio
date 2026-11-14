// 움직임 조합 점검(2026-10-05): 부분 움직임(회전·이동·크기) · 전체+부분 조합 · 함께/차례로 · 두 모습 번갈아 · 세기/속도 끝값.
// 앱 엔진(canvas-html.ts)을 Edge 헤드리스로 돌려 **내보내기와 같은 프레임(buildLoop)** 을 받아 잰다.
//   moving   정지 그림과 다른 프레임 수(0 이면 그 설정은 화면에 아무 변화가 없다)
//   distinct 서로 다른 프레임 수
//   detach   전체 효과와 부분 효과를 겹칠 때, 몸과 손이 붙는 점(손 회전 중심)이 두 레이어에서 얼마나 어긋나는가(px, 최대)
//   seqGap   함께/차례로 프레임 차이(같으면 차례로가 눈에 안 띈다)
// 사용: node scripts/promo/motion-combo-audit.cjs <몸 png> <손 png> <나갈 json>
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { loader } = require('../load-ts.cjs');
const [bodyPng, armPng, outPath] = process.argv.slice(2);
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const d = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const PIV = [250 / 360, 222 / 360];
const rot = (extra = {}) => ({ id: 'p1', layerId: 'draw-2', effect: 'rotate', pivotX: PIV[0], pivotY: PIV[1], amount: 30, angle: 0, speed: .6, delay: 0, ...extra });
const CASES = [
  ['부분 회전(손)', { version: 1, speed: .5, strength: .5, parts: [rot()] }],
  ['부분 이동(손)', { version: 1, speed: .5, strength: .5, parts: [rot({ effect: 'move', amount: .08, angle: -90 })] }],
  ['부분 크기(손)', { version: 1, speed: .5, strength: .5, parts: [rot({ effect: 'scale', amount: .3 })] }],
  ['부분 회전 · 세기0', { version: 1, speed: .5, strength: 0, parts: [rot()] }],
  ['통통 + 손 회전', { version: 1, preset: 'bounce', speed: .5, strength: .7, parts: [rot()] }],
  ['쿵쿵(pulse) + 손 회전', { version: 1, preset: 'pulse', speed: .5, strength: 1, parts: [rot()] }],
  ['까딱(tilt) + 손 회전', { version: 1, preset: 'tilt', speed: .5, strength: 1, parts: [rot()] }],
  ['쾅(punch) + 손 회전', { version: 1, preset: 'punch', speed: .5, strength: 1, parts: [rot()] }],
  ['두 부분 함께', { version: 1, speed: .5, strength: .5, play: 'together', parts: [rot(), { ...rot({ id: 'p2', layerId: 'draw-1', effect: 'scale', amount: .1, pivotX: .5, pivotY: .8 }) }] }],
  ['두 부분 차례로(간격 .15)', { version: 1, speed: .5, strength: .5, play: 'sequence', stagger: .15, parts: [rot(), { ...rot({ id: 'p2', layerId: 'draw-1', effect: 'scale', amount: .1, pivotX: .5, pivotY: .8, delay: .15 }) }] }],
  ['두 부분 차례로(간격 .6)', { version: 1, speed: .5, strength: .5, play: 'sequence', stagger: .6, parts: [rot(), { ...rot({ id: 'p2', layerId: 'draw-1', effect: 'scale', amount: .1, pivotX: .5, pivotY: .8, delay: .6 }) }] }],
  ['두 모습 번갈아', { version: 1, speed: .5, strength: .5, alternate: { poseB: ['draw-2'], interval: .4 } }],
  ['통통 · 세기0', { version: 1, preset: 'bounce', speed: .5, strength: 0 }],
  ['통통 · 세기0.05', { version: 1, preset: 'bounce', speed: .5, strength: .05 }],
  ['통통 · 속도0', { version: 1, preset: 'bounce', speed: 0, strength: .5 }],
  ['통통 · 속도1', { version: 1, preset: 'bounce', speed: 1, strength: .5 }],
];
const hooks = "window.__build=(fps)=>buildLoop(fps,true);window.__delta=(id,t)=>{const l=layers.find(x=>x.id===id);return l?deltaFor(l,t):null;};window.__loop=()=>loopSeconds();";
const driver = `<script>(async()=>{
const ready=()=>new Promise(r=>{const t=setInterval(()=>{if(window.messages.some(m=>m.type==='ready')){clearInterval(t);r();}},20);});
await ready();
const L=(id,name,data)=>({id,name,visible:true,opacity:1,x:0,y:0,scale:1,rotation:0,data});
await window.command({type:'init',layers:[L('draw-1','몸',${JSON.stringify(d(bodyPng))}),L('draw-2','손',${JSON.stringify(d(armPng))})],references:[],activeLayerId:'draw-2',caption:null,color:'#242424',penWidth:8,eraserWidth:20});
await window.command({type:'motion',motion:null});
const still=window.__build(12).sheets[0];
const map=(dd,x,y)=>{if(!dd)return [x,y];const r=dd.rot*Math.PI/180,ox=(x-dd.px)*dd.sx,oy=(y-dd.py)*dd.sy;return [dd.px+dd.dx+ox*Math.cos(r)-oy*Math.sin(r),dd.py+dd.dy+ox*Math.sin(r)+oy*Math.cos(r)];};
const out=[];let seqFrames={};
for(const [name,m] of ${JSON.stringify(CASES)}){
  await window.command({type:'motion',motion:m});
  const loop=window.__build(12),L2=window.__loop();
  const moving=loop.sheets.filter(f=>f!==still).length,distinct=new Set(loop.sheets).size;
  // 손이 몸에 붙는 점: 손 회전 중심(어깨). 몸 레이어가 그 점을 옮기는 곳과 손 레이어가 옮기는 곳의 거리.
  let detach=0;const P=[${PIV[0]}*360,${PIV[1]}*360];
  for(let i=0;i<24;i++){const t=L2*i/24,b=window.__delta('draw-1',t),a=window.__delta('draw-2',t);const pb=map(b,P[0],P[1]),pa=map(a&&a.part?null:a,P[0],P[1]);const pa2=a&&a.part?map(a,...map(a.part,P[0],P[1])):pa;detach=Math.max(detach,Math.hypot(pb[0]-pa2[0],pb[1]-pa2[1]));}
  out.push({name,frames:loop.count,loop:+L2.toFixed(3),moving,distinct,detach:+detach.toFixed(1),clipped:loop.clipped,sheets:/차례로|함께/.test(name)?loop.sheets:undefined});
}
const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
})().catch(e=>{const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify({error:String(e&&e.stack||e)});document.body.appendChild(pre);});</script>`;
const html = canvasHtml.replace("window.addEventListener('resize',size);", hooks + "window.addEventListener('resize',size);")
  .replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>')
  .replace('</body>', driver + '</body>');
const page = path.join(os.tmpdir(), 'emoti-combo-audit.html');
fs.writeFileSync(page, html);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
(async () => {
  const port = 9557, prof = fs.mkdtempSync(path.join(os.tmpdir(), 'emoti-combo-'));
  const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--window-size=390,600', 'file:///' + page.replace(/\\/g, '/')], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) { await new Promise(r => setTimeout(r, 200)); try { target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page'); } catch {} }
    if (!target) throw new Error('DevTools 연결 실패');
    const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const evaluate = expr => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
    let result;
    for (let i = 0; i < 1200 && !result; i++) { const res = await evaluate("(document.getElementById('out')||{}).textContent||''"); const t = res.result?.result?.value; if (t) result = JSON.parse(t); else await new Promise(r => setTimeout(r, 500)); }
    ws.close();
    if (!result || result.error) throw new Error(result ? result.error : '시간 초과');
    const tog = result.find(r => r.name === '두 부분 함께'), seq = result.filter(r => /차례로/.test(r.name));
    for (const s of seq) s.seqGap = s.sheets && tog.sheets ? s.sheets.filter((f, i) => f !== tog.sheets[i]).length + '/' + s.sheets.length : null;
    for (const r of result) delete r.sheets;
    fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
    for (const r of result) console.log(`${r.name.padEnd(22)} 프레임${r.frames} 한바퀴${r.loop}s 움직임${r.moving} 서로다름${r.distinct} 몸-손어긋남${r.detach}px 잘림경고${r.clipped}${r.seqGap ? ' 함께와다른프레임' + r.seqGap : ''}`);
  } finally { proc.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
