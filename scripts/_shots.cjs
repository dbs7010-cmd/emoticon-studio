// _screens.cjs 가 만든 화면 HTML 을 PNG 로 굳힌다. 브라우저 창에서 html2canvas 로 찍어 이 서버로 돌려보낸다.
// 그림을 새로 그리는 것이 아니라, 앞서 만든 대체 렌더를 그대로 사진 찍는 것뿐이다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const DIR = 'verification/round45_23/screens';
const PORT = Number(process.argv[2] || 4631);
const list = JSON.parse(fs.readFileSync(path.join(DIR, 'screens.json'), 'utf8'));

const CAPTURE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>찍는 중</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<style>body{font:14px/1.7 -apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif;background:#14161A;color:#E7E9EE;padding:20px}
#log{white-space:pre-wrap}iframe{position:fixed;left:-9999px;top:0;width:520px;height:1000px;border:0}</style></head>
<body><div id="log">시작…</div><iframe id="f"></iframe>
<script>
const list = ${JSON.stringify(list.map(m => ({ id: m.id, file: m.file })))};
const log = document.getElementById('log'), f = document.getElementById('f');
const load = src => new Promise(r => { f.onload = () => setTimeout(r, 450); f.src = src; });
(async () => {
  for (const item of list) {
    await load(item.file);
    const doc = f.contentDocument;
    await doc.fonts.ready; await document.fonts.ready;
    const el = doc.querySelector('.phone');
    const canvas = await html2canvas(el, { backgroundColor: '#FFFFFF', scale: 2, width: el.offsetWidth, height: el.offsetHeight, windowWidth: 520, windowHeight: 1000 });
    const data = canvas.toDataURL('image/png');
    await fetch('/save/' + item.id, { method: 'POST', body: data });
    log.textContent += '\\n' + item.id + ' ' + Math.round(data.length / 1024) + 'KB';
  }
  await fetch('/done', { method: 'POST' });
  log.textContent += '\\n끝났습니다. 창을 닫아도 됩니다.';
})().catch(e => { log.textContent += '\\n실패: ' + e.message; });
</script></body></html>`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
let saved = 0;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const id = req.url.slice(6).replace(/[^a-z0-9-]/gi, '');
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      fs.writeFileSync(path.join(DIR, id + '.png'), Buffer.from(body.split(',')[1], 'base64'));
      saved++; console.log('  ' + id + '.png');
      res.end('ok');
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') { res.end('ok'); console.log('\n  ' + saved + '장 저장'); setTimeout(() => process.exit(0), 300); return; }
  if (req.url === '/' || req.url === '/capture') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(CAPTURE); return; }
  const file = path.join(DIR, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('없음'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/capture 를 열면 찍기 시작한다'));
