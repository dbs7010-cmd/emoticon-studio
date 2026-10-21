// 칸마다 **제품명과 엔진 ID 를 적은** 격자. 45.32 의 이름 없는 격자(sheet-small.png)를 대신한다.
// 휴대폰에서 읽히도록 한 장에 네 칸씩 끊는다 — 전체를 작게 줄이지 않는다.
// 쓰는 법: node scripts/_brush-grid.cjs <나갈폴더> <장면폴더> <굵기> <제목> [칸당열] [ID,ID,...]
const fs = require('node:fs'), path = require('node:path');
const { LIST } = require('./_brush30.cjs');

const OUT = process.argv[2] || 'verification/round45_33/grid';
const SRC = process.argv[3] || 'verification/round45_33/scenes-small';
const WIDTH = process.argv[4] || '4';
const TITLE = process.argv[5] || '굵기 4 — 작은 크기 가독성';
const COLS = Number(process.argv[6] || 2);
const ONLY = (process.argv[7] || '').split(',').filter(Boolean);

// 엔진 ID 는 구성표에서 그대로 가져온다 — 문서 ID 를 엔진 ID 로 쓰지 않는다.
const ENGINE = Object.fromEntries(LIST.map(r => [r[0], r[3].preset || (r[3].base === 'pen' ? '(기본 pen)' : r[3].base || '?')]));
const NAME = Object.fromEntries(LIST.map(r => [r[0], r]));
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const ids = (ONLY.length ? ONLY : LIST.map(r => r[0])).filter(id => fs.existsSync(path.join(SRC, id + '.png')));
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
for (const id of ids) fs.copyFileSync(path.join(SRC, id + '.png'), path.join(OUT, 'img', id + '.png'));

const perPage = COLS * 2;   // 한 장에 두 줄
const pages = [];
for (let i = 0; i < ids.length; i += perPage) pages.push(ids.slice(i, i + perPage));

const screens = [];
pages.forEach((page, n) => {
  const cells = page.map(id => {
    const [, name, tier] = NAME[id];
    return `<div class="cell">
      <img src="img/${id}.png" alt="">
      <div class="nm">${esc(name)}<span class="tag ${tier === 'pro' ? 'pro' : tier === 'legacy' ? 'old' : 'free'}">${tier === 'pro' ? 'PRO' : tier === 'legacy' ? '구형' : '무료'}</span></div>
      <div class="id">${id} · 엔진 <b>${esc(ENGINE[id])}</b></div>
    </div>`;
  }).join('\n');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(TITLE)} ${n + 1}/${pages.length}</title>
<style>
 body{margin:0;background:#14161A;font:15px/1.6 -apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif}
 .phone{width:720px;background:#fff;padding:22px 24px;box-sizing:border-box;color:#17191D}
 h1{margin:0 0 3px;font-size:22px}
 .sub{margin:0 0 18px;font-size:14px;color:#8A919C}
 .grid{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:18px}
 .cell img{width:100%;border:1px solid #E7E9EE;border-radius:10px;background:#fff;display:block}
 .nm{font-size:18px;font-weight:800;margin-top:8px}
 .tag{font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;margin-left:7px;vertical-align:3px}
 .free{background:#F2F3F5;color:#6B7280}.pro{background:#FFE9A8;color:#5C4A00}.old{background:#E3ECFF;color:#2B4A8A}
 .id{font-size:13px;color:#8A919C;margin-top:1px}
 .id b{color:#17191D}
 .note{font-size:13px;color:#8A919C;margin-top:18px;border-top:1px solid #E7E9EE;padding-top:10px}
</style></head><body><div class="phone">
<h1>${esc(TITLE)} <span style="font-size:15px;color:#8A919C;font-weight:600">${n + 1} / ${pages.length}</span></h1>
<p class="sub">같은 조건 — 같은 입력 경로 · 색 #17191D · 굵기 ${esc(WIDTH)}(넓은 칠 ×3.2, 질감 ×2.6) · 불투명도 100% · 선 보정 약.
한 칸에 다섯 장면: A 얼굴 외곽선과 눈·입 · B 손글씨 안녕! · C 볼터치와 넓은 채색·겹침 · D 질감 색면과 해칭 · E 효과선.</p>
<div class="grid">${cells}</div>
<p class="note">모두 앱 엔진 출력이다. 한글은 글꼴을 찍지 않고 같은 손글씨 획 경로를 엔진이 그었다.</p>
</div></body></html>`;
  const file = 'grid-' + (n + 1) + '.html';
  fs.writeFileSync(path.join(OUT, file), html);
  screens.push({ id: path.basename(OUT) + '-' + (n + 1), file, title: TITLE + ' ' + (n + 1) });
});
fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify(screens, null, 2));
console.log('  ' + screens.length + '장 · ' + ids.length + '칸 · ' + path.join(OUT, 'screens.json'));
