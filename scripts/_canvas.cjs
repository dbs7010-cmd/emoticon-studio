// 검토 렌더의 캔버스 자리에 넣을 시험 그림을, **기존 엔진으로** 만든다.
// 가짜 캔버스를 따로 그리지 않는다: src/painter/canvas-html.ts 를 그대로 띄우고,
// 앱이 보내는 것과 같은 init → caption → save 를 보내 엔진이 돌려준 합성 PNG 를 받는다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

// node scripts/_canvas.cjs [포트] [폴더]. 폴더를 주지 않으면 회차와 무관한 한 곳에 둔다 —
// _screens.cjs 가 거기서 가져간다. 회차 폴더마다 따로 돌리는 것을 잊어 빈 캔버스로 찍던 일(45.36)을 막는다.
const PORT = Number(process.argv[2] || 4641);
const OUT = process.argv[3] || 'verification/engine-sample';
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

// 시험 그림: 이미 저장소에 있는 표현 가이드 그림을 레이어로 넣는다(새로 그리지 않는다).
const ART = path.resolve(__dirname, '..', 'assets', 'expression-guides', 'greeting-thanks-polite.png');
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(ART).toString('base64');

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>엔진 시험 그림</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log = document.getElementById('log'), engine = document.getElementById('engine');
const art = ${JSON.stringify(dataUrl)};
let done = false;
function post(m) { engine.contentWindow.command(m); }
window.addEventListener('message', async e => {
  let m; try { m = JSON.parse(e.data); } catch { return; }
  if (m.type === 'ready') {
    log.textContent += '\\n엔진이 준비됐다. 앱과 같은 init 을 보낸다.';
    post({ type: 'init', id: 'sample',
      layers: [{ id: 'draw-1', name: '그림 1', data: art, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }],
      caption: { text: '고마워요', place: 'bottom', color: '#242424' },
      color: '#242424', penWidth: 6 });
  }
  if (m.type === 'initialized') { log.textContent += '\\n초기화 끝. 저장을 요청한다(앱과 같은 경로).'; post({ type: 'save', token: 1 }); }
  if (m.type === 'save' && !done) {
    done = true;
    log.textContent += '\\n엔진이 합성 PNG 를 돌려줬다. 덮인 면적 ' + Math.round((m.metrics?.coverage ?? 0) * 100) + '%';
    await fetch('/save/canvas-sample', { method: 'POST', body: m.data });
    // 엔진 화면 자체(투명 바둑판·종이결 포함)도 한 장 남긴다.
    await fetch('/done', { method: 'POST' });
    log.textContent += '\\n끝났습니다.';
  }
});
</script></body></html>`;

// 엔진은 window.ReactNativeWebView 로 말한다. 그 통로만 부모창으로 이어 준다 — 엔진 코드는 건드리지 않는다.
const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const id = req.url.slice(6).replace(/[^a-z0-9-]/gi, '');
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(body.split(',')[1], 'base64'));
      console.log('  ' + id + '.png  (엔진이 합성한 그림)');
      res.end('ok');
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') { res.end('ok'); setTimeout(() => process.exit(0), 300); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ 를 열면 엔진이 시험 그림을 만든다'));
