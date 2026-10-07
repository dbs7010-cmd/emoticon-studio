// 공모전 접수 용량 측정(2026-10-07, vc4 준비). 앱의 실제 엔진(canvas-html.ts)과 실제 내보내기 규칙으로 '세트 전체' 묶음의 크기를 잰다.
//   정지 세트: 완성 PNG 32개 + 아이콘·공유 이미지
//   움직임 세트: 움직이는 칸 24개 — 엔진 buildLoop(12fps, 앱의 baker 와 같은 값)로 만든 WebP(제출 파일) + 공식 도구용 프레임 PNG(webp-animator/)
//                + 작업용 GIF(백업·공유용, ZIP 에는 WebP 가 있으면 들어가지 않음)
// 그림은 실제 작품 파일(인자로 준 폴더의 PNG)을 돌려 쓰고, 효과는 20종을 차례로 건다(세기 0.5·속도 0.5).
// 사용: node scripts/promo/set-size-measure.cjs <PNG 폴더> <결과 json>
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const { loader } = require('../load-ts.cjs');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const { MOTION_PRESETS } = loader()('src/types.ts');
const [dir, outPath] = process.argv.slice(2);
const pngs = fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => path.join(dir, f));
if (!pngs.length) throw new Error('PNG 가 없어요: ' + dir);
const d = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const driver = `<script>(async()=>{
const ready=()=>new Promise(r=>{const t=setInterval(()=>{if(window.messages.some(m=>m.type==='ready')){clearInterval(t);r();}},20);});
await ready();
const drawings=${JSON.stringify(pngs.map(d))}, presets=${JSON.stringify(MOTION_PRESETS)};
const bytes=u=>Math.floor((u.length-u.indexOf(',')-1)*3/4)-((u.endsWith('=='))?2:(u.endsWith('=')?1:0));
const out=[];
for(let i=0;i<24;i++){
 await window.command({type:'init',layers:[{id:'draw-1',name:'그림',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0,data:drawings[i%drawings.length]}],references:[],activeLayerId:'draw-1',caption:null,color:'#242424',penWidth:8,eraserWidth:20});
 await window.command({type:'motion',motion:{version:1,preset:presets[i%presets.length],speed:.5,strength:.5,parts:[]}});
 const loop=window.__build(12);
 out.push({preset:presets[i%presets.length],frames:loop.count,gif:loop.bytes,webp:loop.webpBytes,sheets:loop.sheets.map(bytes)});
}
const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
})().catch(e=>{const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify({error:String(e&&e.stack||e)});document.body.appendChild(pre);});</script>`;
const html = canvasHtml.replace("window.addEventListener('resize',size);", "window.__build=(fps)=>buildLoop(fps,true);window.addEventListener('resize',size);")
  .replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>')
  .replace('</body>', driver + '</body>');
const page = path.join(os.tmpdir(), 'emoti-set-size.html');
fs.writeFileSync(page, html);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
(async () => {
  const port = 9600 + Math.floor(Math.random() * 300), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'emoti-sf-'));
  const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--window-size=390,600', 'file:///' + page.split(path.sep).join('/')], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) { await new Promise(r => setTimeout(r, 200)); try { target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page'); } catch {} }
    const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const evaluate = expr => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
    let moving;
    for (let i = 0; i < 1200 && !moving; i++) { const res = await evaluate("(document.getElementById('out')||{}).textContent||''"); const t = res.result?.result?.value; if (t) moving = JSON.parse(t); else await new Promise(x => setTimeout(x, 500)); }
    ws.close();
    if (!moving || moving.error) throw new Error(moving ? moving.error : '시간 초과');
    const sum = a => a.reduce((x, y) => x + y, 0), KB = n => +(n / 1024).toFixed(1), MB = n => +(n / 1048576).toFixed(2);
    const stills = Array.from({ length: 32 }, (_, i) => fs.statSync(pngs[i % pngs.length]).size);
    const extra = 2 * Math.max(...stills);                 // 아이콘·공유 이미지(실측 PNG 중 큰 값으로 잡음)
    const overhead = n => n * 130;                          // ZIP 항목 머리(로컬+중앙, 이름 포함) 근사
    const still = sum(stills) + extra + overhead(34);
    const webp = sum(moving.map(m => m.webp)), frames = sum(moving.map(m => sum(m.sheets))), frameCount = sum(moving.map(m => m.sheets.length));
    const movingZip = webp + frames + extra + overhead(24 + frameCount + 3);
    const result = {
      measuredAt: new Date().toISOString(), drawings: pngs.length,
      stillPngKB: { avg: KB(sum(stills) / 32), max: KB(Math.max(...stills)) },
      moving: { webpKB: { avg: KB(webp / 24), max: KB(Math.max(...moving.map(m => m.webp))) }, gifKB: { avg: KB(sum(moving.map(m => m.gif)) / 24) }, frameCount, framePngKB: { avg: KB(frames / frameCount) } },
      stillSetZipMB: MB(still), movingSetZipMB: MB(movingZip), movingSetWithoutFramesMB: MB(webp + extra + overhead(27)),
      perCut: moving.map(m => ({ preset: m.preset, frames: m.frames, webpKB: KB(m.webp), gifKB: KB(m.gif), framesKB: KB(sum(m.sheets)) })),
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ stillSetZipMB: result.stillSetZipMB, movingSetZipMB: result.movingSetZipMB, movingSetWithoutFramesMB: result.movingSetWithoutFramesMB, stillPngKB: result.stillPngKB, moving: result.moving }));
  } finally {
    proc.kill();
    if (process.platform === 'win32') try { execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error(e); process.exit(1); });
