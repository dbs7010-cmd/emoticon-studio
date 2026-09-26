// 30종 번들 견본을 앱 표시 크기와 2배 크기로 나란히 검수하는 보드.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'verification', 'round45_36', 'brush-samples');
const src = fs.readFileSync(path.join(ROOT, 'src', 'painter', 'painter.tsx'), 'utf8');
const start = src.indexOf('const CATALOG:');
const end = src.indexOf('\n];', start);
const rows = [];
for (const line of src.slice(start, end).split('\n')) {
  const key = /key: '([^']+)'/.exec(line), title = /title: '([^']+)'/.exec(line), group = /group: '([^']+)'/.exec(line);
  const file = /stroke: require\('[^']*\/([^'\/]+\.png)'\)/.exec(line);
  const preset = /preset: '([^']+)'/.exec(line), base = /base: '([^']+)'/.exec(line);
  if (key && title && group && file) rows.push({ key: key[1], title: title[1], group: group[1], file: file[1], engine: preset?.[1] ?? base?.[1] ?? 'pen' });
}
if (rows.length !== 30) throw new Error('브러시 30종을 읽지 못했다: ' + rows.length);
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
for (const row of rows) fs.copyFileSync(path.join(ROOT, 'assets', 'art', row.file), path.join(OUT, 'img', row.file));
const conditions = {
  pen:'12 · 완만 · 보통', inknatural:'15 · 물결 큼 · 느림', ink:'18 · 짧은 완만 · 빠름', brushpen2:'26 · 물결 큼 · 느림', flat:'30 · 거의 직선 · 보통',
  pencil2:'18 · 잔물결 · 느림', opaque:'22 · 긴 획+짧은 겹침 · 보통', marker2:'32 · 거의 직선 · 빠름', dryflat:'28 · 물결 큼 · 보통', pointil:'24 · 잔물결 · 느림', spray:'30 · 완만 · 보통',
  dotted:'18 · 거의 직선 · 느림', parallelpen:'24 · 물결 · 보통', glowpen:'22 · 완만 · 보통', outline:'28 · 완만 · 보통'
};
const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const cells = rows.map((r, i) => `<div class="row"><div class="meta"><b>${i + 1}. ${esc(r.title)}</b><span>${esc(r.key)} · ${esc(r.group)} · 엔진 ${esc(r.engine)}</span><span>굵기·경로·속도 ${esc(conditions[r.key] ?? (r.group === '채색' ? '28 · 겹친 두 획 · 보통' : r.group === '질감' ? '25 · 잔물결 · 느림' : r.group === '효과' ? '20 · 완만 · 보통' : '14 · 완만 · 보통'))}</span></div><div class="actual"><img src="img/${r.file}"><small>행 표시 크기</small></div><div class="zoom"><img src="img/${r.file}"><small>2×</small></div></div>`).join('');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>브러시 견본 30종</title><style>
body{margin:0;background:#fff;color:#202329;font:13px/1.35 -apple-system,"Segoe UI","Noto Sans KR",sans-serif}.phone{width:900px;padding:20px;box-sizing:border-box}h1{font-size:22px;margin:0 0 4px}.note{color:#626872;margin:0 0 16px}.row{height:92px;display:grid;grid-template-columns:230px 210px 380px;align-items:center;gap:14px;border-bottom:1px solid #e5e7eb}.meta{display:flex;flex-direction:column;gap:2px}.meta b{font-size:15px}.meta span{font-size:11px;color:#626872}.actual,.zoom{display:flex;flex-direction:column;gap:3px}.actual img{width:180px;height:43px;object-fit:contain}.zoom img{width:360px;height:86px;object-fit:contain}small{color:#8b93a0}img{filter:none}
</style></head><body><div class="phone"><h1>실제 엔진 획 견본 30종</h1><p class="note">앱과 같은 고정 압력 0.5. 지원하지 않는 압력 변화는 사용하지 않았다. 차이는 경로·굵기·이벤트 간격뿐이다.</p>${cells}</div></body></html>`;
fs.writeFileSync(path.join(OUT, 'brush-samples.html'), html);
fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify([{ id: 'brush-samples', file: 'brush-samples.html', title: '브러시 견본 30종' }], null, 2));
console.log(path.join(OUT, 'brush-samples.html'));
