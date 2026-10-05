// 그림 전체 크기·칸 안에 맞추기 점검(2026-10-05). 앱 엔진(canvas-html.ts)을 Edge 헤드리스로 돌린다.
//  1) scaleAll 0.9: 모든 레이어 크기·위치 ×0.9, 부분 움직임 회전 중심도 같은 배율 → 손 회전 중심이 몸의 같은 점에 붙어 있다
//  2) 되돌리기: 레이어 변환·움직임이 정확히 이전 값
//  3) fitMotion: 쾅(세기 1)+손 회전처럼 잘리는 움직임 → 잘림 없음, 배율 < 1(키우지 않음)
//  4) 미리보기 안내선(drawExtent)은 내보내기 프레임에 들어가지 않는다: 재생 중 만든 프레임 = 멈춘 상태에서 만든 프레임
// 사용: node scripts/promo/scale-fit-check.cjs <몸 png> <손 png>
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const assert = require('node:assert/strict');
const { loader } = require('../load-ts.cjs');
const [bodyPng, armPng] = process.argv.slice(2);
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const d = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const hooks = "window.__build=(fps)=>buildLoop(fps,true);window.__state=()=>({layers:layers.map(meta),motion:JSON.parse(JSON.stringify(motion)),clips:motionClips()});window.__play=(on)=>on?startPlaying():stopPlaying();";
const driver = `<script>(async()=>{
const ready=()=>new Promise(r=>{const t=setInterval(()=>{if(window.messages.some(m=>m.type==='ready')){clearInterval(t);r();}},20);});
await ready();
const L=(id,name,data)=>({id,name,visible:true,opacity:1,x:0,y:0,scale:1,rotation:0,data});
await window.command({type:'init',layers:[L('draw-1','몸',${JSON.stringify(d(bodyPng))}),L('draw-2','손',${JSON.stringify(d(armPng))})],references:[],activeLayerId:'draw-2',caption:null,color:'#242424',penWidth:8,eraserWidth:20});
const part={id:'p1',layerId:'draw-2',effect:'rotate',pivotX:250/360,pivotY:222/360,amount:30,angle:0,speed:.6,delay:0};
await window.command({type:'motion',motion:{version:1,preset:'punch',speed:.5,strength:1,parts:[part]}});
const r={};
r.before=window.__state();
await window.command({type:'scaleAll',factor:.9});
r.scaled=window.__state();
await window.command({type:'undo'});
r.undone=window.__state();
await window.command({type:'fitMotion'});
r.fitted=window.__state();r.fitMsg=window.messages.filter(m=>m.type==='fitted').at(-1);
window.__play(false);const a=window.__build(12).sheets;window.__play(true);await new Promise(x=>setTimeout(x,300));const b=window.__build(12).sheets;window.__play(false);
r.sameFrames=a.length===b.length&&a.every((f,i)=>f===b[i]);
const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify(r);document.body.appendChild(pre);
})().catch(e=>{const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify({error:String(e&&e.stack||e)});document.body.appendChild(pre);});</script>`;
const html = canvasHtml.replace("window.addEventListener('resize',size);", hooks + "window.addEventListener('resize',size);")
  .replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>')
  .replace('</body>', driver + '</body>');
const page = path.join(os.tmpdir(), 'emoti-scale-fit.html');
fs.writeFileSync(page, html);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
(async () => {
  const port = 9558, prof = fs.mkdtempSync(path.join(os.tmpdir(), 'emoti-sf-'));
  const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--window-size=390,600', 'file:///' + page.replace(/\\/g, '/')], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) { await new Promise(r => setTimeout(r, 200)); try { target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page'); } catch {} }
    const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const evaluate = expr => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
    let r;
    for (let i = 0; i < 600 && !r; i++) { const res = await evaluate("(document.getElementById('out')||{}).textContent||''"); const t = res.result?.result?.value; if (t) r = JSON.parse(t); else await new Promise(x => setTimeout(x, 500)); }
    ws.close();
    if (!r || r.error) throw new Error(r ? r.error : '시간 초과');
    const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
    // 1) 배율
    r.scaled.layers.forEach((l, i) => { near(l.scale, r.before.layers[i].scale * .9, '레이어 크기 ×0.9'); near(l.x, r.before.layers[i].x * .9, '위치 ×0.9'); });
    const p0 = r.before.motion.parts[0], p1 = r.scaled.motion.parts[0];
    near(p1.pivotX, .5 + (p0.pivotX - .5) * .9, '회전 중심 X 도 같은 배율'); near(p1.pivotY, .5 + (p0.pivotY - .5) * .9, '회전 중심 Y 도 같은 배율');
    // 2) 되돌리기
    assert.deepEqual(r.undone.layers, r.before.layers, '되돌리기 — 레이어 변환 그대로');
    assert.deepEqual(r.undone.motion, r.before.motion, '되돌리기 — 움직임 그대로');
    // 3) 맞추기
    assert.equal(r.before.clips, true, '시험 조건: 쾅(세기 1)+손 회전은 칸 밖으로 나간다');
    assert.ok(r.fitMsg && r.fitMsg.factor > 0 && r.fitMsg.factor < 1, '맞추기 배율 0~1(키우지 않음): ' + JSON.stringify(r.fitMsg));
    assert.equal(r.fitted.clips, false, '맞춘 뒤 잘림 없음');
    // 4) 안내선은 내보내기 프레임 밖
    assert.equal(r.sameFrames, true, '재생 중(안내선 켜짐) 만든 프레임 = 멈춘 상태 프레임');
    console.log(`PASS: scaleAll(레이어·위치·회전 중심 ×0.9, 되돌리기 정확) · fitMotion(쾅+손 회전 잘림 → 배율 ${r.fitMsg.factor.toFixed(3)} 로 잘림 없음) · 안내선은 내보내기 프레임에 없음`);
  } finally { proc.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
