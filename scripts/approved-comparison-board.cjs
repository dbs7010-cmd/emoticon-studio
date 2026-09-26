// 승인 시안 원본과 최신 390×844 대체 렌더를 같은 판에 놓아 육안 비교한다.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'verification', 'round45_36', 'comparisons');
const SCREEN = path.join(ROOT, 'verification', 'round45_36', 'screens');
const APPROVED = path.join(ROOT, 'docs', 'design', 'approved-tool-design-board.webp');
const items = [
  ['workspace', '작업 화면', 'draw-base.png'],
  ['brush', '브러시 창', 'draw-brush.png'],
  ['color', '색상 판', 'draw-color.png'],
  ['layers', '레이어 판', 'draw-layers.png'],
  ['selection', '선택 상태', 'draw-selection.png'],
];

fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
fs.copyFileSync(APPROVED, path.join(OUT, 'img', 'approved-tool-design-board.webp'));
for (const [, , file] of items) fs.copyFileSync(path.join(SCREEN, file), path.join(OUT, 'img', file));

for (const [id, title, file] of items) {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title} 시안 대조</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#202329;font:14px/1.4 -apple-system,"Segoe UI","Noto Sans KR",sans-serif}.phone{width:1240px;height:920px;padding:20px}.head{display:flex;justify-content:space-between;align-items:end;margin-bottom:12px}h1{margin:0;font-size:24px}.note{color:#626872}.grid{display:grid;grid-template-columns:800px 390px;gap:18px;align-items:start}.card{background:#fff;border:1px solid #dfe2e7;border-radius:16px;padding:12px;box-shadow:0 2px 8px rgba(20,24,31,.08)}.label{font-weight:700;margin-bottom:8px}.approved{width:776px;height:775px;object-fit:contain;object-position:center top;background:#fff}.actual{width:390px;height:844px;object-fit:contain;object-position:center top;background:#fff}.actualCard{padding:0;overflow:hidden}.actualCard .label{padding:12px 12px 0}.actualCard img{display:block}
</style></head><body><div class="phone"><div class="head"><h1>${title} — 승인 시안 / 실제 구현</h1><div class="note">실제 구현은 390×844 대체 렌더 · 실기기 캡처 아님</div></div><div class="grid"><div class="card"><div class="label">승인 기준 원본</div><img class="approved" src="img/approved-tool-design-board.webp"></div><div class="card actualCard"><div class="label">현재 구현</div><img class="actual" src="img/${file}"></div></div></div></body></html>`;
  fs.writeFileSync(path.join(OUT, `${id}.html`), html);
}
fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify(items.map(([id, title]) => ({ id, file: `${id}.html`, title })), null, 2));
console.log(`${items.length}개 대조판 · ${OUT}`);
