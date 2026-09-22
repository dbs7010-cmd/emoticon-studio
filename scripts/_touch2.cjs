// 손가락 자리 보완 검사. _touch.cjs 는 스타일에 적힌 값만 봤다 — 여기서는 **브라우저가 실제로 배치한 크기**를 잰다.
// 재는 것: ① 실제 배치 가로·세로 ② hitSlop 을 더한 누를 자리 ③ 부모 경계를 넘는지(안드로이드는 부모 밖 hitSlop 을 잘라낸다)
//          ④ 이웃 누를 자리와 겹치는지.
// 대상은 **이번·지난 라운드에 고친 버튼과 크기를 적지 않은 7건**뿐이다. 203개 전체를 다시 훑지 않는다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const DIR = 'verification/round45_23/screens';
const PORT = Number(process.argv[2] || 4651);

// [화면, 접근성 이름, 왜 대상인가]
const TARGETS = [
  ['guide-emotions', '표현 가이드 기쁨·인사', '고침: 위아래 hitSlop 4'],
  ['draw-color', '팔레트', '고침: 세그먼트 위아래 hitSlop 4'],
  ['draw-color', '직접 선택', '고침: 세그먼트 위아래 hitSlop 4'],
  ['draw-color', '색 #54A9E8', '고침: 견본 36dp · 간격 12'],
  ['draw-color', '스포이드', '이번 라운드: 라벨 추가'],
  ['draw-color', '내 팔레트에 저장', '이번 라운드: 라벨 추가 · IconButton → Pressable'],
  ['draw-color', '색', '이번 라운드: 노랑 → 테두리'],
  ['draw-color', '팔레트 닫기', '고침 대상 옆자리 확인'],
  ['draw-brush', '브러시 닫기', '고침: hitSlop 2'],
  ['draw-brush', '세부 설정', '고침: 위아래 hitSlop 2'],
  ['draw-brush', '패널 닫고 그리기로', '미지정 7건'],
  ['draw-reference', '참고 닫기', '고침: hitSlop 2'],
  ['draw-layers', '레이어 닫기', '고침: hitSlop 2'],
  ['draw-selection', '내 그림으로 보관', '고침: 위아래 hitSlop 2'],
  ['draw-selection', '새 레이어로 분리', '고침: 위아래 hitSlop 2'],
  ['draw-base', '지우개', '고침: 좌우 hitSlop 1'],
  ['draw-base', '채우기', '고침: 좌우 hitSlop 1'],
  ['draw-base', '선택', '고침: 좌우 hitSlop 1'],
  ['home-work', '검토 세트 이어서 만들기', '고침: 위아래 hitSlop 2'],
  ['home-work', '검토 세트', '미지정 7건'],
  ['home-empty', '안녕 표현 보기', '미지정 7건'],
  ['home-empty', '신나 표현 보기', '미지정 7건'],
  ['home-empty', '잘 자 표현 보기', '미지정 7건'],
  ['pro', '월간 고르기', '미지정 7건'],
  ['pro', '연간 고르기', '미지정 7건'],
];

const MEASURE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>손가락 자리 재는 중</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css">
<style>body{font:13px/1.7 system-ui;background:#14161A;color:#E7E9EE;padding:16px}
#log{white-space:pre-wrap}iframe{position:fixed;left:-9999px;top:0;width:520px;height:1200px;border:0}</style></head>
<body><div id="log">시작…</div><iframe id="f"></iframe>
<script>
const targets = ${JSON.stringify(TARGETS)};
const log = document.getElementById('log'), f = document.getElementById('f');
const load = src => new Promise(r => { f.onload = () => setTimeout(r, 400); f.src = src; });
const slopOf = el => { const s = (el.dataset.slop || '0,0,0,0').split(',').map(Number); return { top: s[0], right: s[1], bottom: s[2], left: s[3] }; };
const grow = (r, s) => ({ left: r.left - s.left, right: r.right + s.right, top: r.top - s.top, bottom: r.bottom + s.bottom });
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) > 0.5
                       && Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 0.5;
(async () => {
  const out = [];
  let screen = null;
  for (const [id, name, why] of targets) {
    if (screen !== id) { await load(id + '.html'); screen = id; }
    const doc = f.contentDocument;
    await doc.fonts.ready;
    const el = [...doc.querySelectorAll('[title]')].find(n => n.getAttribute('title') === name);
    if (!el) { out.push({ id, name, why, error: '못 찾음' }); continue; }
    const r = el.getBoundingClientRect();
    const slop = slopOf(el);
    const tap = grow(r, slop);
    // 부모 경계: 안드로이드는 부모 밖으로 나간 hitSlop 을 잘라낸다. 잘린 뒤 크기를 따로 센다.
    const pr = el.parentElement.getBoundingClientRect();
    const clipped = { left: Math.max(tap.left, pr.left), right: Math.min(tap.right, pr.right), top: Math.max(tap.top, pr.top), bottom: Math.min(tap.bottom, pr.bottom) };
    // 이웃: 같은 화면의 다른 누를 것 중, 누를 자리가 겹치는 것.
    const others = [...el.parentElement.children].filter(n => n !== el && n.hasAttribute && n.hasAttribute('data-press'));
    const hits = others.filter(n => overlap(tap, grow(n.getBoundingClientRect(), slopOf(n)))).map(n => n.getAttribute('title') || '(이름 없음)');
    out.push({ id, name, why,
      boxW: +r.width.toFixed(1), boxH: +r.height.toFixed(1),
      slop, tapW: +(tap.right - tap.left).toFixed(1), tapH: +(tap.bottom - tap.top).toFixed(1),
      clipW: +(clipped.right - clipped.left).toFixed(1), clipH: +(clipped.bottom - clipped.top).toFixed(1),
      overlaps: hits });
    log.textContent += '\\n' + name;
  }
  await fetch('/result', { method: 'POST', body: JSON.stringify(out) });
  log.textContent += '\\n끝났습니다.';
})().catch(e => { log.textContent += '\\n실패: ' + e.message; });
</script></body></html>`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/result') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const rows = JSON.parse(body);
      fs.writeFileSync('verification/round45_23/touch-layout.json', JSON.stringify(rows, null, 2));
      const lines = [];
      lines.push('  실제 배치로 다시 잰 손가락 자리 — 고친 버튼과 크기 미지정 7건만 (' + rows.length + '개)');
      lines.push('  이름                         배치       hitSlop      누를 자리   부모에 잘린 뒤  겹침');
      let bad = 0;
      for (const r of rows) {
        if (r.error) { lines.push('  ' + r.name.padEnd(26) + r.error); bad++; continue; }
        const s = [r.slop.top, r.slop.right, r.slop.bottom, r.slop.left].join('/');
        const fail = r.clipW < 48 || r.clipH < 48 || r.overlaps.length;
        if (fail) bad++;
        lines.push('  ' + r.name.padEnd(26) + (r.boxW + '×' + r.boxH).padEnd(11) + s.padEnd(12)
          + (r.tapW + '×' + r.tapH).padEnd(12) + (r.clipW + '×' + r.clipH).padEnd(15)
          + (r.overlaps.length ? r.overlaps.join(', ') : '없음'));
      }
      lines.push('');
      lines.push(bad ? '  손봐야 할 것 ' + bad + '개' : '  모두 48dp 이상 · 부모 경계 안 · 이웃과 겹침 없음');
      lines.push('  잰 곳은 브라우저가 실제로 배치한 상자다. **실기기 터치는 아직 검증하지 않았다.**');
      const text = lines.join('\n');
      fs.writeFileSync('verification/round45_23/touch-layout.txt', text);
      console.log(text);
      res.end('ok');
      setTimeout(() => process.exit(bad ? 2 : 0), 300);
    });
    return;
  }
  if (req.url === '/' || req.url === '/measure') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(MEASURE); return; }
  const file = path.join(DIR, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('없음'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/measure 를 열면 잰다'));
