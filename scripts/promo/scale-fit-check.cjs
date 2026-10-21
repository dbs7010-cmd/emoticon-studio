// 그림 전체 크기·칸 안에 맞추기 점검(2026-10-05). 앱 엔진(canvas-html.ts)을 Edge 헤드리스로 돌린다.
//  1) scaleAll 0.9: 모든 레이어 크기·위치 ×0.9, 부분 움직임 회전 중심도 같은 배율 → 손 회전 중심이 몸의 같은 점에 붙어 있다
//  2) 되돌리기: 레이어 변환·움직임이 정확히 이전 값
//  3) fitMotion: 쾅(세기 1)+손 회전처럼 잘리는 움직임 → 잘림 없음, 배율 < 1(키우지 않음)
//  3b) (2026-10-06) 맞춘 뒤 안내선 범위(motionExtent)도 칸 안, 내보내기와 같은 시점·같은 그리기(composite)로 여백 캔버스에 그려
//      12·24fps 모든 프레임에서 칸 밖으로 나가 잘리는 픽셀이 0 (맞추기 전에는 0 이 아님을 함께 확인)
//      — 예전 점검은 잘림 판단과 같은 12곳만 봐서, 쾅의 끝이 칸 밖(maxX 367.9/360)인데도 통과했다
//  4) 미리보기 안내선(drawExtent)은 내보내기 프레임에 들어가지 않는다: 재생 중 만든 프레임 = 멈춘 상태에서 만든 프레임
// 사용: node scripts/promo/scale-fit-check.cjs scripts/promo/fixtures/fit-body.png scripts/promo/fixtures/fit-hand.png
//   (fixtures: 에뮬레이터 '몽이의 하루' 01번 칸의 몸·손 레이어 원본 — 기기에서 맞추기가 잘림을 남긴 그 그림)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const assert = require('node:assert/strict');
const { loader } = require('../load-ts.cjs');
const [bodyPng, armPng] = process.argv.slice(2);
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const d = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const hooks = "window.__build=(fps)=>buildLoop(fps,true);window.__state=()=>({layers:layers.map(meta),motion:JSON.parse(JSON.stringify(motion)),clips:motionClips(),caption:caption&&{...caption},capCenter:(()=>{const p=captionSpot(ctx);return p?[p.x,p.box.y+p.box.h/2]:null;})()});window.__play=(on)=>on?startPlaying():stopPlaying();window.__ext=()=>motionExtent();window.__overflow=(fps)=>{const L=loopSeconds(),count=Math.max(2,Math.min(MAX_FRAMES,Math.round(L*Math.max(6,Math.min(24,fps)))));const M=60,out=[];for(let i=0;i<count;i++){const c=document.createElement('canvas');c.width=W+2*M;c.height=H+2*M;const g=c.getContext('2d');g.translate(M,M);layers.forEach(l=>composite(g,l,deltaFor(l,L*i/count)));const d=g.getImageData(0,0,c.width,c.height).data;let n=0,a=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(x>=M&&y>=M&&x<M+W&&y<M+H)continue;const v=d[(y*c.width+x)*4+3];if(v>0){n++;a=Math.max(a,v);}}out.push([n,a]);}return out;};";
const driver = `<script>(async()=>{
const ready=()=>new Promise(r=>{const t=setInterval(()=>{if(window.messages.some(m=>m.type==='ready')){clearInterval(t);r();}},20);});
await ready();
const L=(id,name,data)=>({id,name,visible:true,opacity:1,x:0,y:0,scale:1,rotation:0,data});
await window.command({type:'init',layers:[L('draw-1','몸',${JSON.stringify(d(bodyPng))}),L('draw-2','손',${JSON.stringify(d(armPng))})],references:[],activeLayerId:'draw-2',caption:null,color:'#242424',penWidth:8,eraserWidth:20});
const part={id:'p1',layerId:'draw-2',effect:'rotate',pivotX:250/360,pivotY:222/360,amount:30,angle:0,speed:.6,delay:0};
await window.command({type:'motion',motion:{version:1,preset:'punch',speed:.5,strength:1,parts:[part]}});
const r={};
r.before=window.__state();r.overBefore=window.__overflow(24);
await window.command({type:'scaleAll',factor:.9});
r.scaled=window.__state();
await window.command({type:'undo'});
r.undone=window.__state();
await window.command({type:'fitMotion'});
r.fitted=window.__state();r.ext=window.__ext();
r.overBeforeKeep=r.overBefore;r.over=[...window.__overflow(12),...window.__overflow(24)];
// 문구도 함께(2026-10-07): 끄면 문구 그대로, 켜면 크기 ×0.9 · 가운데가 칸 가운데 쪽으로 ×0.9, 되돌리기로 정확히 원래대로
await window.command({type:'init',layers:[L('draw-1','몸',${JSON.stringify(d(bodyPng))})],references:[],activeLayerId:'draw-1',caption:{text:'안녕',place:'bottom',color:'#242424',dx:20,dy:0,scale:1},color:'#242424',penWidth:8,eraserWidth:20});
r.cap0=window.__state();
await window.command({type:'scaleAll',factor:.9});r.capOff=window.__state();await window.command({type:'undo'});
await window.command({type:'scaleAll',factor:.9,withCaption:true});r.capOn=window.__state();await window.command({type:'undo'});r.capUndo=window.__state();
const edgeInk=async url=>{const i=new Image();await new Promise(x=>{i.onload=x;i.onerror=x;i.src=url;});if(!i.width)return -1;const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);const d=g.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height;let n=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(x>0&&y>0&&x<w-1&&y<h-1)continue;if(d[(y*w+x)*4+3]>0)n++;}return n;};
r.edge=[];for(const fps of [12,24]){for(const u of window.__build(fps).sheets)r.edge.push(await edgeInk(u));}r.fitMsg=window.messages.filter(m=>m.type==='fitted').at(-1);
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
  // 포트를 매번 바꾸고, 끝나면 이 실행의 프로필을 쓰는 Edge 를 모두 닫는다 — headless=new 는 실제 브라우저를 다른 프로세스로 띄워
  // proc.kill 로는 남고, 남은 브라우저가 같은 포트를 잡아 다음 실행이 옛 페이지에 붙어 멈췄다(2026-10-06).
  const port = 9600 + Math.floor(Math.random() * 300), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'emoti-sf-'));
  const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--window-size=390,600', 'file:///' + page.replace(/\\/g, '/')], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) { await new Promise(r => setTimeout(r, 200)); try { target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page'); } catch {} }
    const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const evaluate = expr => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
    let r;
    for (let i = 0; i < 1800 && !r; i++) { const res = await evaluate("(document.getElementById('out')||{}).textContent||''"); const t = res.result?.result?.value; if (t) r = JSON.parse(t); else await new Promise(x => setTimeout(x, 500)); }
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
    console.log('맞추기 전 24fps 프레임별 칸 밖 픽셀[개수,최대 알파]:', JSON.stringify(r.overBeforeKeep));
    console.log('맞춘 뒤 12/24fps 프레임별 칸 밖 픽셀:', JSON.stringify(r.over), ' 가장자리 줄 잉크:', JSON.stringify(r.edge));
    assert.ok(r.ext.minX >= 0 && r.ext.minY >= 0 && r.ext.maxX <= 360 && r.ext.maxY <= 360, '맞춘 뒤 안내선 범위도 칸 안: ' + JSON.stringify(r.ext));
    assert.ok(r.overBeforeKeep.some(([n]) => n > 0), '시험 조건: 맞추기 전에는 실제로 칸 밖으로 잘리는 프레임이 있다');
    assert.ok(r.over.length > 0 && r.over.every(([n]) => n === 0), '맞춘 뒤 내보내기 프레임(12·24fps)에서 칸 밖으로 잘려 나가는 그림 없음: ' + JSON.stringify(r.over));
    // 3c) 문구도 함께
    assert.deepEqual(r.capOff.caption, r.cap0.caption, '문구도 함께를 끄면 문구는 그대로');
    near(r.capOn.caption.scale, .9, '문구 크기 ×0.9');
    near(r.capOn.capCenter[0], 180 + (r.cap0.capCenter[0] - 180) * .9, '문구 가운데 x 가 칸 가운데 쪽으로 ×0.9');
    near(r.capOn.capCenter[1], 180 + (r.cap0.capCenter[1] - 180) * .9, '문구 가운데 y 도');
    assert.deepEqual(r.capUndo.caption, r.cap0.caption, '되돌리기 한 번에 문구도 원래대로');
    // 4) 안내선은 내보내기 프레임 밖
    assert.equal(r.sameFrames, true, '재생 중(안내선 켜짐) 만든 프레임 = 멈춘 상태 프레임');
    console.log(`PASS: scaleAll(레이어·위치·회전 중심 ×0.9, 되돌리기 정확) · fitMotion(쾅+손 회전 잘림 → 배율 ${r.fitMsg.factor.toFixed(3)} 로 잘림 없음 · 안내선 범위 칸 안 · 12/24fps 프레임에서 잘려 나가는 픽셀 0) · 문구도 함께(끄면 그대로·켜면 ×0.9·되돌리기) · 안내선은 내보내기 프레임에 없음`);
  } finally {
    proc.kill();
    if (process.platform === 'win32') try { require('child_process').execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error(e); process.exit(1); });
