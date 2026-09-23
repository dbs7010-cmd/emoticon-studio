// 펜·붓·연필 획 미리보기를 **기존 엔진으로** 만든다. 그림을 따로 그리지 않는다:
// canvas-html.ts 를 그대로 띄우고 같은 자리·같은 굵기로 같은 곡선을 그어, 엔진이 내놓는 합성 PNG 를 받는다.
// 그래서 미리보기는 실제 획과 어긋날 수 없다 — 같은 코드가 그렸기 때문이다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const OUT = path.resolve(__dirname, '..', 'assets', 'art');
const PORT = Number(process.argv[2] || 4661);
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>획 견본</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log = document.getElementById('log'), engine = document.getElementById('engine');
// 12종. base = 엔진 기본 브러시, preset = 엔진 PRESETS key. 같은 곡선·같은 굵기로 긋는다.
const kinds = [
  ['pen', { base: 'pen' }], ['pencil', { base: 'pencil' }], ['brush', { base: 'brush' }],
  ['marker', { preset: 'marker' }], ['ink', { preset: 'ink' }], ['soft', { preset: 'soft' }], ['grain', { preset: 'grain' }],
  ['calligraphy', { preset: 'calligraphy' }], ['crayon', { preset: 'crayon' }], ['airbrush', { preset: 'airbrush' }],
  ['chisel', { preset: 'chisel' }], ['rough', { preset: 'rough' }],
];
let at = 0, waiting = null;
const post = m => engine.contentWindow.command(m);   // 약속을 돌려준다 — 반드시 await 한다
const wait = type => new Promise(r => { waiting = { type, r }; });
window.addEventListener('message', e => {
  let m; try { m = JSON.parse(e.data); } catch { return; }
  if (waiting && m.type === waiting.type) { const r = waiting.r; waiting = null; r(m); }
  if (m.type === 'ready') start();
});
// 엔진 안의 캔버스에 진짜 포인터 사건을 보낸다 — 앱에서 손가락이 닿는 길과 같다.
function stroke(points) {
  const doc = engine.contentDocument, canvas = doc.getElementById('drawing');
  const r = canvas.getBoundingClientRect();
  const ev = (type, p, extra) => canvas.dispatchEvent(new doc.defaultView.PointerEvent(type, {
    pointerId: 1, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true, pressure: .5,
    clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height, ...extra }));
  ev('pointerdown', points[0]);
  for (const p of points.slice(1)) ev('pointermove', p);
  ev('pointerup', points.at(-1));
}
// 완만한 S 곡선. 세 브러시에 똑같이 쓴다 — 달라지는 것은 엔진의 붓질뿐이다.
const curve = [];
for (let i = 0; i <= 40; i++) { const t = i / 40; curve.push([0.08 + 0.84 * t, 0.5 + 0.26 * Math.sin(t * Math.PI * 1.6 - 0.5)]); }
async function start() {
  for (const [kind, how] of kinds) {
    await post({ type: 'init', id: 'stroke-' + kind, layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }],
      color: '#17191D', penWidth: 14, brush: { preset: how.preset ?? null, opacity: 1, stabilizer: 'light', smoothing: true } });
    await wait('initialized');
    await post({ type: 'brush', brush: how.base ?? 'pen' });
    await post({ type: 'tool', tool: 'pen' });
    // 줄 세운 명령이 모두 처리된 뒤에 긋는다.
    await new Promise(r => setTimeout(r, 50));
    stroke(curve);
    await new Promise(r => setTimeout(r, 200));
    await post({ type: 'save', token: ++at });
    const saved = await wait('save');
    // 저장 잠금을 풀어 준다 — 앱이 보내는 답과 같다. 풀지 않으면 다음 획이 무시된다(loading||saving).
    post({ type: 'saved', token: saved.token });
    await fetch('/save/stroke-' + kind, { method: 'POST', body: saved.data });
    log.textContent += '\\n' + kind + ' — 덮인 넓이 ' + Math.round((saved.metrics?.coverage ?? 0) * 1000) / 10 + '%';
  }
  await fetch('/done', { method: 'POST' });
  log.textContent += '\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const id = req.url.slice(6).replace(/[^a-z0-9-]/gi, '');
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => { fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(body.split(',')[1], 'base64')); console.log('  ' + id + '.png (엔진이 그은 획)'); res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') { res.end('ok'); setTimeout(() => process.exit(0), 300); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ 를 열면 엔진이 획을 긋는다'));
