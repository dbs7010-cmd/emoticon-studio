// 휴대폰에서 읽히는 **여러 장**의 비교 자료. 한 장에 한 브러시씩, 칸마다 제품명과 엔진 ID 를 적는다.
// 그림은 엔진이 그린 PNG 를 옮겨 놓을 뿐이다. _shots.cjs 가 이 HTML 들을 PNG 로 굳힌다.
// 쓰는 법: node scripts/_brush-pages.cjs <나갈폴더> <전폴더> <후폴더>
const fs = require('node:fs'), path = require('node:path');
const { LIST } = require('./_brush30.cjs');

const OUT = process.argv[2] || 'verification/round45_33/pages';
const BEFORE = process.argv[3] || 'verification/round45_33/scenes-4532';
const AFTER = process.argv[4] || 'verification/round45_33/scenes-now';

// 이번 회차에 실제로 손댄 것만 한 장씩. [문서ID, 엔진ID, 무엇이 문제였나, 왜 그랬나, 무엇을 고쳤나, 확대할 자리]
const PAGES = [
  ['F06', 'colorpencil', '굵은 가로획이 **동그란 도장이 꿰인 줄**로 보였다', '종이결을 dab 하나마다 알파에 곱했다. 한 dab 이 통째로 옅어지니 진한 dab 만 동그랗게 드러났다', '결을 dab 에서 떼어 **획을 다 그은 뒤 픽셀 단위로** 판다. dab 은 고르게 찍히고 결만 남는다', 'C'],
  ['P05', 'crayon', '같은 원형 도장 자국 — 왁스 덩어리가 아니라 구슬을 꿴 줄이었다', '같은 원인(결을 dab 알파에 곱함). 크레용은 결 세기가 1.0 이라 가장 심했다', '같은 수정. 솟은 결은 색을 다 받고 골만 비도록 해 왁스가 눌린 면이 나온다', 'C'],
  ['P07', 'pastel', '같은 원형 도장 자국', '같은 원인. 결 세기 0.8', '같은 수정', 'C'],
  ['P09', 'pencilside', '세로 줄무늬처럼 보였다', '같은 원인 + 납작한 dab 이라 자국이 세로로 길게 났다', '같은 수정', 'C'],
  ['P16', 'oilpastel', '가장자리에 약한 도장 자국', '같은 원인. 결 세기 0.35 라 약했다', '같은 수정', 'C'],
  ['F03', 'ink', '짧은 획과 손글씨가 **양 끝이 뾰족한 나뭇잎**이 됐다', '테이퍼 길이가 26px 로 고정이라 짧은 획은 전부가 테이퍼였다. 끝 굵기 바닥값 22% 도 바늘처럼 가늘었다', '① 테이퍼를 획 길이의 30% 로 묶어 가운데 40% 는 제 굵기를 낸다 ② 짧을수록 바닥값을 올린다 — 붓이 들릴 틈이 없으니까 ③ 테이퍼 26→18, 바닥 .22→.38', 'B'],
  ['F04', 'brushpen2', '짧은 획이 뾰족했고, 긴 획은 **애벌레처럼** 울퉁불퉁했다', '테이퍼가 고정 길이였다. 굵기 물결의 마디가 6~12px 이라 획 하나에 여러 번 출렁였다', '테이퍼 길이·바닥값 규칙을 함께 받고, 물결 마디를 15px 이상으로 늘렸다 — 한 획에 한두 번만 출렁인다', 'B'],
  ['F02', 'inknatural', '(지목되지 않았지만 같이 확인됨) 긴 획이 애벌레처럼 울퉁불퉁했다', '붓펜과 같은 원인 — 굵기 물결의 마디가 너무 짧았다', '물결 마디를 늘렸다. 값(물결 세기 .16)은 그대로다', 'B'],
];

const NAME = Object.fromEntries(LIST.map(r => [r[0], r]));
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const bold = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
// 장면이 캔버스(360×360) 어디에 있는지 — 확대해서 보여 줄 자리
const ZONE = { A: [20, 10, 170, 130], B: [195, 35, 165, 120], C: [20, 130, 180, 110], D: [200, 135, 150, 115], E: [20, 235, 330, 105] };
const ZONENAME = { A: 'A 얼굴 외곽선과 눈·입', B: 'B 손글씨 안녕!', C: 'C 볼터치·넓은 채색·겹침', D: 'D 질감 색면과 해칭', E: 'E 효과선' };

fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const copy = (from, to) => { if (!fs.existsSync(from)) return false; fs.copyFileSync(from, path.join(OUT, 'img', to)); return true; };

const screens = [];
for (const [id, engine, problem, cause, fix, zone] of PAGES) {
  const [, name, tier] = NAME[id];
  const okB = copy(path.join(BEFORE, id + '.png'), id + '-b.png');
  const okA = copy(path.join(AFTER, id + '.png'), id + '-a.png');
  const [zx, zy, zw, zh] = ZONE[zone];
  // 확대는 CSS 로 자른다 — 그림을 다시 만들지 않는다. 360 원본을 2.6배로 키우고 자리만 밀어 놓는다.
  const K = 2.6, boxW = Math.round(zw * K), boxH = Math.round(zh * K);
  const zoomBox = (file) => `<div class="zoom" style="width:${boxW}px;height:${boxH}px">
      <img src="img/${file}" style="width:${360 * K}px;height:${360 * K}px;margin-left:${-zx * K}px;margin-top:${-zy * K}px">
    </div>`;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(name)} 수정 전후</title>
<style>
 body{margin:0;background:#14161A;font:15px/1.65 -apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif}
 .phone{width:720px;background:#fff;padding:24px 26px;box-sizing:border-box;color:#17191D}
 .nm{font-size:27px;font-weight:800;letter-spacing:-.4px}
 .tag{font-size:13px;font-weight:800;padding:3px 9px;border-radius:7px;margin-left:9px;vertical-align:5px}
 .free{background:#F2F3F5;color:#6B7280}.pro{background:#FFE9A8;color:#5C4A00}
 .cond{font-size:15px;color:#8A919C;margin:4px 0 16px}
 .cond b{color:#17191D}
 .blk{margin:0 0 11px;font-size:16px;line-height:1.55}
 .blk .k{font-weight:800}
 .p .k{color:#B23A2F}.c .k{color:#8A6D00}.f .k{color:#1F6F43}
 .h{font-size:14px;font-weight:800;color:#6B7280;margin:20px 0 8px;letter-spacing:.3px}
 .pair{display:flex;gap:14px}
 .cell{flex:1;min-width:0}
 .cell img.full{width:100%;border:1px solid #E7E9EE;border-radius:10px;background:#fff;display:block}
 .cap{font-size:15px;font-weight:800;margin-top:6px}
 .capb{color:#B23A2F}.capa{color:#1F6F43}
 .zoom{overflow:hidden;border:1px solid #E7E9EE;border-radius:10px;background:#fff;position:relative}
 .zoom img{display:block;image-rendering:auto}
 .note{font-size:13px;color:#8A919C;margin-top:14px;border-top:1px solid #E7E9EE;padding-top:10px}
 .none{font-size:14px;color:#9AA1AC;padding:60px 0;text-align:center}
</style></head><body><div class="phone">
 <div class="nm">${esc(name)}<span class="tag ${tier === 'pro' ? 'pro' : 'free'}">${tier === 'pro' ? 'PRO' : '무료'}</span></div>
 <div class="cond">문서 ID <b>${id}</b> · 엔진 ID <b>${engine}</b> · 굵기 10(넓은 칠 32, 질감 26) · 불투명도 100% · 색 #17191D · 선 보정 약</div>
 <p class="blk p"><span class="k">문제</span> · ${bold(problem)}</p>
 <p class="blk c"><span class="k">원인</span> · ${bold(cause)}</p>
 <p class="blk f"><span class="k">수정</span> · ${bold(fix)}</p>
 <div class="h">원본 크기 360×360 — 같은 입력 경로</div>
 <div class="pair">
  <div class="cell">${okB ? `<img class="full" src="img/${id}-b.png">` : '<div class="none">전 그림 없음</div>'}<div class="cap capb">45.32 (수정 전)</div></div>
  <div class="cell">${okA ? `<img class="full" src="img/${id}-a.png">` : '<div class="none">후 그림 없음</div>'}<div class="cap capa">45.33 (수정 후)</div></div>
 </div>
 <div class="h">확대 2.6배 — ${esc(ZONENAME[zone])}</div>
 <div class="pair">
  <div class="cell">${okB ? zoomBox(id + '-b.png') : '<div class="none">전 그림 없음</div>'}<div class="cap capb">45.32 (수정 전)</div></div>
  <div class="cell">${okA ? zoomBox(id + '-a.png') : '<div class="none">후 그림 없음</div>'}<div class="cap capa">45.33 (수정 후)</div></div>
 </div>
 <p class="note">그림은 모두 앱 엔진이 그린 것이다. 한글은 글꼴을 찍지 않고 같은 손글씨 획 경로를 엔진이 그었다.
 확대는 같은 PNG 를 잘라 키운 것이고 다시 그린 것이 아니다.</p>
</div></body></html>`;
  const file = 'page-' + id + '.html';
  fs.writeFileSync(path.join(OUT, file), html);
  screens.push({ id: 'brush-' + id + '-' + engine, file, title: name + ' 수정 전후' });
}

fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify(screens, null, 2));
console.log('  ' + screens.length + '장 · ' + path.join(OUT, 'screens.json'));
