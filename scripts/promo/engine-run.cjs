// 앱의 실제 움직임 엔진(src/painter/canvas-html.ts)으로 홍보용 움직임을 만든다.
// 엔진 HTML 에 운전 스크립트를 붙여 Edge 헤드리스로 돌리고(--dump-dom), 엔진이 만든 GIF 와
// 같은 엔진의 deltaFor()가 계산한 순간별 변환값(위치·회전·크기)을 꺼낸다. 앱에 없는 효과는 쓰지 않는다:
//   bounce(통통) · shake(흔들기) — 무료 전체 움직임 / parts rotate — PRO 부분 움직임(레이어 하나만 회전)
// 사용: node scripts/promo/engine-run.cjs <캐릭터 png 폴더> <나갈 폴더>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loader } = require('../load-ts.cjs');
const { SHOULDER_R } = require('./character.cjs');
const pngDir = path.resolve(process.argv[2] || 'verification/promo/png');
const out = path.resolve(process.argv[3] || 'verification/promo/motion');
fs.mkdirSync(out, { recursive: true });
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const data = n => 'data:image/png;base64,' + fs.readFileSync(path.join(pngDir, n + '.png')).toString('base64');
const layer = (id, name, n) => ({ id, name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, data: data(n) });
// 순간: 한 바퀴(loop) 중 몇 분의 몇 지점인가
const CASES = [
  { name: 'bounce-excited', label: '통통(무료)', layers: [layer('draw-1', '그림 1', 'mongi-excited')],
    motion: { version: 1, preset: 'bounce', speed: .5, strength: .7, captionMoves: false }, ts: [0, .25, .5, .75] },
  { name: 'shake-pouty', label: '흔들기(무료)', layers: [layer('draw-1', '그림 1', 'mongi-pouty')],
    motion: { version: 1, preset: 'shake', speed: .5, strength: .7, captionMoves: false }, ts: [0, .125, .25, .375, .5] },
  { name: 'part-wave-hello', label: '손만 까딱(PRO 부분 움직임)', layers: [layer('draw-1', '몸', 'mongi-hello-layer-body'), layer('draw-2', '손', 'mongi-hello-layer-arm')],
    motion: { version: 1, speed: .5, strength: .5, captionMoves: false, parts: [{ id: 'p1', layerId: 'draw-2', effect: 'rotate', pivotX: SHOULDER_R[0] / 360, pivotY: SHOULDER_R[1] / 360, amount: 30, angle: 0, speed: .6, delay: 0 }] },
    ts: [0, .25, .5, .75] },
];
const hooks = "window.__loop=()=>loopSeconds();window.__delta=(id,t)=>{const l=layers.find(x=>x.id===id);return l?deltaFor(l,t):null;};window.__frameAt=(t)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');layers.forEach(l=>composite(g,l,motion?deltaFor(l,t):null));return c.toDataURL('image/png');};";
const driver = `<script>(async()=>{
const ready=()=>new Promise(r=>{const t=setInterval(()=>{if(window.messages.some(m=>m.type==='ready')){clearInterval(t);r();}},20);});
await ready();const out={};
for(const c of ${JSON.stringify(CASES)}){
  await window.command({type:'init',layers:c.layers,references:[],activeLayerId:c.layers[0].id,caption:null,color:'#242424',penWidth:8,eraserWidth:20});
  await window.command({type:'motion',motion:c.motion});
  await window.command({type:'frames',fps:12});
  const gif=window.messages.filter(m=>m.type==='frames').at(-1).gif;
  const loop=window.__loop();
  out[c.name]={label:c.label,loop,count:gif.count,gif:gif.data,moments:c.ts.map(f=>({f,t:f*loop,deltas:c.layers.map(l=>({id:l.id,d:window.__delta(l.id,f*loop)})),png:window.__frameAt(f*loop)}))};
}
const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
})().catch(e=>{const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify({error:String(e&&e.stack||e)});document.body.appendChild(pre);});</script>`;
const html = canvasHtml.replace("window.addEventListener('resize',size);", hooks + "window.addEventListener('resize',size);")
  .replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>')
  .replace('</body>', driver + '</body>');
const page = path.join(out, 'engine-run.html');
fs.writeFileSync(page, html);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
// Edge 헤드리스를 DevTools 포트로 띄우고, 운전 스크립트가 결과를 다 쓸 때까지 기다렸다 읽는다(--dump-dom 은 비동기 작업을 기다리지 않는다).
const { spawn } = require('child_process');
async function runEngine() {
  const port = 9555, prof = path.join(require('os').tmpdir(), 'emoti-engine-profile');
  const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--window-size=390,600', 'file:///' + page.replace(/\\/g, '/')], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) { await new Promise(r => setTimeout(r, 200)); try { target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page'); } catch {} }
    if (!target) throw new Error('DevTools 에 연결하지 못했다');
    const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const evaluate = expr => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
    for (let i = 0; i < 600; i++) {
      const res = await evaluate("(document.getElementById('out')||{}).textContent||''");
      const text = res.result && res.result.result && res.result.result.value;
      if (text) { ws.close(); return JSON.parse(text); }
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('엔진 결과를 기다리다 시간이 지났다');
  } finally { proc.kill(); }
}
(async () => {
const result = await runEngine();
if (result.error) throw new Error(result.error);
const summary = {};
for (const [name, r] of Object.entries(result)) {
  fs.writeFileSync(path.join(out, name + '.gif'), Buffer.from(r.gif.split(',')[1], 'base64'));
  r.moments.forEach((mo, i) => fs.writeFileSync(path.join(out, `${name}-t${i}.png`), Buffer.from(mo.png.split(',')[1], 'base64')));
  summary[name] = { label: r.label, loopSeconds: r.loop, gifFrames: r.count, moments: r.moments.map(mo => ({ f: mo.f, t: +mo.t.toFixed(3), deltas: mo.deltas })) };
}
fs.writeFileSync(path.join(out, 'engine-motion.json'), JSON.stringify(summary, null, 1));
for (const [n, s] of Object.entries(summary)) console.log(n, s.label, 'loop', s.loopSeconds, 's · GIF', s.gifFrames, '프레임');
})().catch(e => { console.error(e); process.exit(1); });
