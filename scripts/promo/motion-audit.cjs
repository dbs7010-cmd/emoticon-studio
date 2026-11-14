// 움직임 효과 전수 점검(2026-10-04 실기기 신고 대응). 앱의 실제 엔진(canvas-html.ts)을 Edge 헤드리스로 돌려,
// 효과마다 **내보내기와 같은 프레임**(buildLoop 의 360×360 PNG 프레임 — GIF·WebP 가 이 프레임으로 만들어진다)을 받아
//   · 움직임 여부: 정지 그림과 다른 프레임이 있는가(없으면 '미작동')
//   · 경계: 프레임마다 잉크 상자(투명하지 않은 픽셀)와 캔버스 가장자리에 닿는지(닿으면 잘림)
//   · 엔진 자체 경고 motionClips()
// 를 잰다. 사용: node scripts/promo/motion-audit.cjs <그림 png> <나갈 json> [세기들 예: 0.5,1]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { loader } = require('../load-ts.cjs');
const [pngPath, outPath, strengthsArg] = process.argv.slice(2);
const strengths = (strengthsArg || '0.5,1').split(',').map(Number);
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const { MOTION_PRESETS } = loader()('src/types.ts');
const data = 'data:image/png;base64,' + fs.readFileSync(pngPath).toString('base64');
const CASES = [];
for (const preset of MOTION_PRESETS) for (const strength of strengths) CASES.push({ preset, strength });
const hooks = "window.__build=(fps)=>buildLoop(fps,true);window.__clips=()=>motionClips();";
const driver = `<script>(async()=>{
const ready=()=>new Promise(r=>{const t=setInterval(()=>{if(window.messages.some(m=>m.type==='ready')){clearInterval(t);r();}},20);});
await ready();
const box=async(url)=>{const im=new Image();await new Promise(r=>{im.onload=r;im.src=url;});const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(d[(y*c.width+x)*4+3]>16){if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;}}return x1<0?null:{x0,y0,x1,y1,w:c.width,h:c.height};};
const layer={id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0,data:${JSON.stringify(data)}};
await window.command({type:'init',layers:[layer],references:[],activeLayerId:'draw-1',caption:null,color:'#242424',penWidth:8,eraserWidth:20});
await window.command({type:'motion',motion:null});
const still=window.__build(12).sheets[0];const stillBox=await box(still);
const out={stillBox,cases:[]};
for(const c of ${JSON.stringify(CASES)}){
  await window.command({type:'motion',motion:{version:1,preset:c.preset,speed:.5,strength:c.strength,captionMoves:false}});
  const loop=window.__build(12);const boxes=[];let moving=0;
  for(const f of loop.sheets){boxes.push(await box(f));if(f!==still)moving++;}
  out.cases.push({...c,frames:loop.count,loop:loop.loop,moving,clips:window.__clips(),boxes});
}
const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
})().catch(e=>{const pre=document.createElement('pre');pre.id='out';pre.textContent=JSON.stringify({error:String(e&&e.stack||e)});document.body.appendChild(pre);});</script>`;
const html = canvasHtml.replace("window.addEventListener('resize',size);", hooks + "window.addEventListener('resize',size);")
  .replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>')
  .replace('</body>', driver + '</body>');
const page = path.join(os.tmpdir(), 'emoti-motion-audit.html');
fs.writeFileSync(page, html);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
(async () => {
  const port = 9556, prof = fs.mkdtempSync(path.join(os.tmpdir(), 'emoti-audit-'));
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
    if (!result) throw new Error('시간 초과');
    if (result.error) throw new Error(result.error);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
    const S = result.stillBox;
    console.log('정지 잉크 상자', JSON.stringify(S));
    for (const c of result.cases) {
      const valid = c.boxes.filter(Boolean);
      const edge = valid.filter(b => b.x0 <= 0 || b.y0 <= 0 || b.x1 >= b.w - 1 || b.y1 >= b.h - 1).length;
      const maxW = Math.max(...valid.map(b => b.x1 - b.x0 + 1)), maxH = Math.max(...valid.map(b => b.y1 - b.y0 + 1));
      const grow = Math.max(maxW / (S.x1 - S.x0 + 1), maxH / (S.y1 - S.y0 + 1));
      console.log(`${c.preset.padEnd(8)} 세기${c.strength}  프레임${c.frames} 움직임${c.moving}/${c.frames}  빈프레임${c.boxes.length - valid.length}  가장자리닿음${edge}  최대크기x${grow.toFixed(2)}  엔진경고${c.clips}`);
    }
  } finally { proc.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
