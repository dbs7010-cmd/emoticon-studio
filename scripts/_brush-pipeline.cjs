// 브러시 속성이 어디까지 따라가는지 한 줄로 본다:
//   ① 입력 중 보이는 것 → ② 손을 뗀 뒤 확정된 것 → ③ 저장했다 다시 열어 저장한 것.
// 같은 곡선·같은 굵기(14)·같은 색으로 펜·붓·연필을 각각 긋고 세 단계를 모두 받아 견준다.
//
// 주의: 엔진의 window.command 는 약속으로 줄 세워 처리한다. 기다리지 않고 획을 그으면
// **앞 브러시 설정으로** 그어진다 — 45.25 의 '붓이 펜과 같다'는 보고가 이 함정에서 나왔다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const OUT = 'verification/round45_26';
const PORT = Number(process.argv[2] || 4671);
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>브러시 전달 경로</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log = document.getElementById('log'), engine = document.getElementById('engine');
const kinds = ['pen', 'brush', 'pencil'];
let token = 0, waiting = null;
const post = m => engine.contentWindow.command(m);      // 약속을 돌려준다 — 반드시 await
const wait = type => new Promise(r => { waiting = { type, r }; });
const rest = (ms = 60) => new Promise(r => setTimeout(r, ms));
window.addEventListener('message', e => {
  let m; try { m = JSON.parse(e.data); } catch { return; }
  if (waiting && m.type === waiting.type) { const r = waiting.r; waiting = null; r(m); }
  if (m.type === 'ready') run();
});
const dom = () => engine.contentDocument;
function ev(type, p, up) {
  const canvas = dom().getElementById('drawing'), r = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new (dom().defaultView.PointerEvent)(type, { pointerId: 1, pointerType: 'pen', isPrimary: true,
    bubbles: true, cancelable: true, pressure: up ? 0 : .5, clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height }));
}
const curve = [];
for (let i = 0; i <= 40; i++) { const t = i / 40; curve.push([0.08 + 0.84 * t, 0.5 + 0.26 * Math.sin(t * Math.PI * 1.6 - 0.5)]); }
// 화면에 지금 보이는 그대로(입력 중). 엔진의 캔버스 요소를 그대로 읽는다.
const onScreen = () => dom().getElementById('drawing').toDataURL('image/png');

async function saveNow() { await post({ type: 'save', token: ++token }); const m = await wait('save'); await post({ type: 'saved', token: m.token }); return m; }
async function fresh(kind, data) {
  await post({ type: 'init', id: 'p-' + kind, color: '#17191D', penWidth: 14,
    brush: { preset: null, opacity: 1, stabilizer: 'light', smoothing: true },
    layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, data: data || undefined }] });
  await wait('initialized');
  await post({ type: 'brush', brush: kind });
  await post({ type: 'tool', tool: 'pen' });
  await rest();
}
async function run() {
  const out = {};
  for (const kind of kinds) {
    await fresh(kind, null);
    // ① 입력 중: 손을 떼기 전에 화면을 읽는다.
    ev('pointerdown', curve[0]);
    for (const p of curve.slice(1)) ev('pointermove', p);
    await rest(120);
    const during = onScreen();
    // ② 확정: 손을 떼고 저장한다.
    ev('pointerup', curve.at(-1), true);
    await rest(150);
    const committed = await saveNow();
    // ③ 저장했다 다시 열고 그대로 다시 저장한다(그림에 손대지 않는다).
    await fresh(kind, committed.data);
    const reopened = await saveNow();
    out[kind] = { during, committed: committed.data, reopened: reopened.data };
    log.textContent += '\\n' + kind + ' — 입력 중 · 확정 · 재열기 세 장 받음';
  }
  await fetch('/result', { method: 'POST', body: JSON.stringify(out) });
  log.textContent += '\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/result') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const out = JSON.parse(body);
      fs.mkdirSync(OUT, { recursive: true });
      for (const [kind, stages] of Object.entries(out))
        for (const [stage, data] of Object.entries(stages))
          fs.writeFileSync(path.join(OUT, 'stroke-' + kind + '-' + stage + '.png'), Buffer.from(data.split(',')[1], 'base64'));
      console.log('  ' + Object.keys(out).length * 3 + '장 저장 → ' + OUT);
      res.end('ok');
      setTimeout(() => process.exit(0), 300);
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ 를 열면 세 단계를 받는다'));
