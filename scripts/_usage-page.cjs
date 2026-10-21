// 실제 쓰임 두 장을 **쓴 브러시·색·굵기와 함께** 보여 주는 장. steps.json 을 그대로 표에 옮긴다.
// 쓰는 법: node scripts/_usage-page.cjs <쓰임폴더> <나갈폴더>
const fs = require('node:fs'), path = require('node:path');
const { LIST } = require('./_brush30.cjs');

const SRC = process.argv[2] || 'verification/round45_33/usage';
const OUT = process.argv[3] || 'verification/round45_33/usage-page';
const steps = JSON.parse(fs.readFileSync(path.join(SRC, 'steps.json'), 'utf8'));

const DOC = Object.fromEntries(LIST.map(r => [r[3].preset || (r[3].base === 'pen' ? 'pen' : r[3].base), r[0]]));
const TIER = Object.fromEntries(LIST.map(r => [r[3].preset || (r[3].base === 'pen' ? 'pen' : r[3].base), r[2]]));
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const PAGES = [
  ['illust', '이모티콘 한 칸', '360×360 출력 크기 그대로. 브러시를 제 쓰임대로 섞어 쓴 완성본이다.'],
  ['writing', '손글씨', '같은 손글씨 획 경로를 네 가지 펜으로 그었다. 글꼴을 찍은 것이 아니다.'],
];

const screens = [];
for (const [key, title, lead] of PAGES) {
  if (!fs.existsSync(path.join(SRC, key + '.png'))) continue;
  fs.copyFileSync(path.join(SRC, key + '.png'), path.join(OUT, 'img', key + '.png'));
  const rows = steps[key].map(s => {
    const doc = DOC[s.engine] || '', tier = TIER[s.engine] || 'free';
    return `<tr>
      <td class="nm">${esc(s.name)}<span class="tag ${tier === 'pro' ? 'pro' : 'free'}">${tier === 'pro' ? 'PRO' : '무료'}</span></td>
      <td class="id">${esc(doc)} · <b>${esc(s.engine)}</b></td>
      <td class="use">${esc(s.use)}</td>
      <td class="set"><span class="sw" style="background:${esc(s.color)}"></span>${esc(s.color)} · 굵기 ${s.width} · ${s.strokes}획</td>
    </tr>`;
  }).join('\n');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
 body{margin:0;background:#14161A;font:15px/1.6 -apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif}
 .phone{width:720px;background:#fff;padding:24px 26px;box-sizing:border-box;color:#17191D}
 h1{margin:0 0 4px;font-size:24px}
 .sub{margin:0 0 18px;font-size:14px;color:#8A919C}
 .shot{text-align:center;margin:0 0 6px}
 .shot img{width:360px;height:360px;border:1px solid #E7E9EE;border-radius:12px;background:#fff}
 .cap{text-align:center;font-size:13px;color:#8A919C;margin-bottom:20px}
 table{width:100%;border-collapse:collapse;font-size:14px}
 th{text-align:left;font-size:12px;color:#8A919C;font-weight:700;padding:0 8px 6px 0;border-bottom:1px solid #E7E9EE}
 td{padding:7px 8px 7px 0;border-bottom:1px solid #F2F3F5;vertical-align:top}
 .nm{font-weight:800;white-space:nowrap}
 .tag{font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;margin-left:6px;vertical-align:2px}
 .free{background:#F2F3F5;color:#6B7280}.pro{background:#FFE9A8;color:#5C4A00}
 .id{color:#8A919C;font-size:13px;white-space:nowrap}.id b{color:#17191D}
 .use{color:#3A4049}
 .set{color:#6B7280;font-size:13px;white-space:nowrap}
 .sw{display:inline-block;width:11px;height:11px;border-radius:3px;border:1px solid #D7DAE0;margin-right:5px;vertical-align:-1px}
 .note{font-size:13px;color:#8A919C;margin-top:16px;border-top:1px solid #E7E9EE;padding-top:10px}
</style></head><body><div class="phone">
<h1>${esc(title)}</h1>
<p class="sub">${esc(lead)}</p>
<div class="shot"><img src="img/${key}.png" alt=""></div>
<p class="cap">원본 크기 360×360 — 줄이거나 키우지 않았다</p>
<table>
 <tr><th>브러시</th><th>ID</th><th>쓰임</th><th>설정</th></tr>
 ${rows}
</table>
<p class="note">앱 엔진이 그린 것이다. 이미지 생성이나 외부 완성 그림이 아니다.
한글은 글꼴을 찍지 않고 획 경로를 엔진이 그었다.</p>
</div></body></html>`;
  const file = 'usage-' + key + '.html';
  fs.writeFileSync(path.join(OUT, file), html);
  screens.push({ id: 'usage-' + key, file, title });
}
fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify(screens, null, 2));
console.log('  ' + screens.length + '장 · ' + path.join(OUT, 'screens.json'));
