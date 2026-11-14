// '칸 밖으로 나가요' 경고 = 실제 출력 잘림인지 점검(2026-10-06). 앱 엔진(canvas-html.ts)을 Edge 헤드리스로 돌린다.
// 그림마다 효과 20종 × 세기 0.05·0.5·1 을 걸고,
//   경고: 엔진의 motionClips()(움직이기 판의 경고 줄·빨간 띠·칸 안에 맞추기가 쓰는 판단)
//   실제: 내보내기와 같은 시점(12·24fps)·같은 그리기(composite)로 여백 있는 큰 캔버스에 그려, 360×360 밖으로 나간 픽셀 수
// 를 비교한다. 등장 효과(쓱·빼꼼·쿵)는 들어오고 나가는 동안 칸 밖이 의도이므로 비교에서 뺀다(ENTRANCE_REST/EXIT).
// 예전 판단(잉크 상자 네 모서리)은 빙글에서 그림이 칸 안에 있어도 경고했다 — 이 점검이 그 오탐과 놓침을 함께 잡는다.
// 사용: node scripts/promo/clip-warning-check.cjs [그림 png …]  (없으면 scripts/promo/fixtures 의 시험 그림 4장)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const assert = require('node:assert/strict');
const { loader } = require('../load-ts.cjs');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const { MOTION_PRESETS } = loader()('src/types.ts');
const { ENTRANCE_REST } = loader()('src/motion-math.ts');
const fx = n => path.join(__dirname, 'fixtures', n);
const drawings = process.argv.slice(2).length ? process.argv.slice(2) : [fx('fit-body.png'), fx('clip-circle.png'), fx('clip-square.png'), fx('clip-corner.png')];
const d = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const hooks = "window.__clips=()=>motionClips();window.__overflow=(fps)=>{const L=loopSeconds(),count=Math.max(2,Math.min(MAX_FRAMES,Math.round(L*Math.max(6,Math.min(24,fps)))));const M=80;let worst=0;for(let i=0;i<count;i++){const c=document.createElement('canvas');c.width=W+2*M;c.height=H+2*M;const g=c.getContext('2d');g.translate(M,M);layers.forEach(l=>composite(g,l,deltaFor(l,L*i/count)));const px=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(x>=M&&y>=M&&x<M+W&&y<M+H)continue;if(px[(y*c.width+x)*4+3]>0)n++;}worst=Math.max(worst,n);}return worst;};";
const driver = `<script>(async()=>{
const ready=()=>new Promise(r=>{const t=setInterval(()=>{if(window.messages.some(m=>m.type==='ready')){clearInterval(t);r();}},20);});
await ready();
const out=[];
for(const [name,data] of ${JSON.stringify(drawings.map(p => [path.basename(p), d(p)]))}){
 await window.command({type:'init',layers:[{id:'draw-1',name:'그림',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0,data}],references:[],activeLayerId:'draw-1',caption:null,color:'#242424',penWidth:8,eraserWidth:20});
 for(const p of ${JSON.stringify(MOTION_PRESETS)})for(const st of [.05,.5,1]){
  await window.command({type:'motion',motion:{version:1,preset:p,speed:.5,strength:st,parts:[]}});
  out.push([name,p,st,window.__clips(),Math.max(window.__overflow(12),window.__overflow(24))]);
 }
}
const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
})().catch(e=>{const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify({error:String(e&&e.stack||e)});document.body.appendChild(pre);});</script>`;
const html = canvasHtml.replace("window.addEventListener('resize',size);", hooks + "window.addEventListener('resize',size);")
  .replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>')
  .replace('</body>', driver + '</body>');
const page = path.join(os.tmpdir(), 'emoti-clip-warning.html');
fs.writeFileSync(page, html);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
(async () => {
  // 포트를 매번 바꾸고, 끝나면 이 실행의 프로필을 쓰는 Edge 를 모두 닫는다(FAIL-039: 남은 headless 가 포트를 잡아 다음 실행이 멈춤).
  const port = 9600 + Math.floor(Math.random() * 300), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'emoti-sf-'));
  const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--window-size=390,600', 'file:///' + page.split(path.sep).join('/')], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) { await new Promise(r => setTimeout(r, 200)); try { target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page'); } catch {} }
    const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const evaluate = expr => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
    let rows;
    for (let i = 0; i < 1200 && !rows; i++) { const res = await evaluate("(document.getElementById('out')||{}).textContent||''"); const t = res.result?.result?.value; if (t) rows = JSON.parse(t); else await new Promise(x => setTimeout(x, 500)); }
    ws.close();
    if (!rows || rows.error) throw new Error(rows ? rows.error : '시간 초과');
    const entrance = new Set(Object.keys(ENTRANCE_REST));
    const compared = rows.filter(([, p]) => !entrance.has(p));
    const falseAlarm = compared.filter(([, , , warn, over]) => warn && over === 0), missed = compared.filter(([, , , warn, over]) => !warn && over > 0);
    for (const name of drawings.map(p => path.basename(p))) {
      const spin = rows.filter(r => r[0] === name && r[1] === 'spin').map(([, , st, warn, over]) => `${st}:${warn ? '경고' : '-'}/${over}px`).join(' ');
      console.log(`${name.padEnd(16)} 빙글 ${spin}`);
    }
    console.log(`비교 ${compared.length}건(등장 효과 ${rows.length - compared.length}건 제외) · 오탐 ${falseAlarm.length} · 놓침 ${missed.length}`);
    assert.equal(missed.length, 0, '실제로 잘리는데 경고가 없는 경우: ' + JSON.stringify(missed));
    assert.equal(falseAlarm.length, 0, '잘리지 않는데 경고하는 경우: ' + JSON.stringify(falseAlarm));
    assert.ok(rows.some(([n, p, , warn, over]) => n === 'clip-square.png' && p === 'spin' && warn && over > 0), '시험 조건: 큰 네모(모서리가 가운데에서 212px)는 빙글에서 실제로 잘리고 경고도 뜬다');
    assert.ok(rows.some(([n, p, , warn, over]) => n === 'clip-circle.png' && p === 'spin' && !warn && over === 0), '시험 조건: 큰 원은 빙글에서 잘리지 않고 경고도 없다');
    console.log('PASS: 경고 = 실제 출력 잘림(12·24fps 내보내기 프레임, 등장 효과 제외) — 오탐 0 · 놓침 0');
  } finally {
    proc.kill();
    if (process.platform === 'win32') try { execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error(e); process.exit(1); });
