// Google Play 기본 스토어 등록 그림 만들기(emoti 이모티).
//   · 그래픽 이미지 1024×500 — 디자인 캔버스의 피처 그래픽 후보(Feature-A) 구도를 그대로 쓰고 이름·색·문구만 바꾼다.
//   · 휴대전화 스크린샷 1080×1920 네 장 — 위에 핵심 문구 하나, 아래에 앱 화면 한 장(합성·없는 UI 추가 없음).
// 앱 화면은 --captures 폴더의 capture-01.png ~ capture-04.png 를 쓴다.
//   · 실기기 캡처: 폰에서 찍은 화면 그대로(상태바 포함 가능). → 결과는 업로드용(phone-0N.png).
//   · --draft: 대체 렌더(verification/round45_45/after/png 의 화면)를 잘라 쓴다. 실기기 캡처가 아니므로
//     결과 파일 이름에 -DRAFT 가 붙고 그림 오른쪽 위에 'DRAFT · 대체 렌더' 표시가 들어간다(업로드 금지).
// 사용: node scripts/store-graphics.cjs <나갈 폴더> [--draft | --captures <폴더>]
//   → <나갈 폴더>/*.html 을 만든다. PNG 는 Edge 헤드리스로 찍고 scripts/store-finalize.cjs 로 RGB 로 굳힌다.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || 'verification/round45_45/store');
const draft = process.argv.includes('--draft');
const capIdx = process.argv.indexOf('--captures');
const capDir = capIdx > 0 ? path.resolve(process.argv[capIdx + 1]) : null;
fs.mkdirSync(out, { recursive: true });
const url = p => 'file:///' + p.replace(/\\/g, '/');
const LEMON = '#F5E642', LEMON_SOFT = '#FAF2A0', INK = '#2A2320';
const FONT = `@font-face{font-family:Jua;src:url('${url(path.join(root, 'assets/fonts/Jua-Regular.ttf'))}')}
body{margin:0;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:${INK}}`;

// 캐릭터: 대표 캐릭터 콘(2026-10-16, assets/mascot · scripts/mascot-render.cjs)
// 친구(고구마 · 완두콩)는 양옆 칸에.
const friend = name => `<img src="${url(path.join(root, 'assets/mascot', name + '.png'))}" width="130" height="130">`;
const face = (eyes = 'dot') => `<img src="${url(path.join(root, 'assets/mascot', eyes === 'dot' ? 'corn-base.png' : 'corn-cheer.png'))}" width="130" height="130">`;
// 움직임 표시(정지 그림이라 움직임을 짧은 선으로만 보인다)
const motionLines = `<svg width="60" height="40" viewBox="0 0 60 40" style="position:absolute;left:-30px;top:30px"><path d="M8 8h22M4 20h26M8 32h22" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></svg>`;

// ── 그래픽 이미지 1024×500(Feature-A 구도: 왼쪽 글자 · 오른쪽 스티커 카드 셋 · 오른쪽 위 둥근 밝은 원) ──
const feature = `<!doctype html><meta charset="utf-8"><style>${FONT}
.c{width:1024px;height:500px;box-sizing:border-box;background:${LEMON};position:relative;overflow:hidden;display:flex;align-items:center;padding:0 56px;gap:32px}
.blob{position:absolute;right:-60px;top:-80px;width:420px;height:420px;border-radius:210px;background:${LEMON_SOFT}}
.t{position:relative;flex:1;display:flex;flex-direction:column;gap:16px;min-width:0}
.brand{display:flex;align-items:baseline;gap:12px}.brand b{font-family:Jua;font-weight:400;font-size:84px;line-height:1}.brand span{font-family:Jua;font-size:34px;color:#5A5040}
.msg{font-size:31px;line-height:1.35;font-weight:800;letter-spacing:-.5px}
.chips{display:flex;gap:10px;margin-top:4px}.chips span{height:42px;padding:0 18px;border-radius:21px;background:#fff;border:3px solid ${INK};display:flex;align-items:center;font-size:18px;font-weight:800;white-space:nowrap}
.cards{position:relative;display:flex;gap:16px;align-items:flex-end}
.card{width:150px;border-radius:26px;background:#fff;border:4px solid ${INK};box-shadow:6px 6px 0 ${INK};display:flex;align-items:center;justify-content:center;position:relative}
</style><div class="c"><div class="blob"></div>
<div class="t"><div class="brand"><b>emoti</b><span>이모티</span></div>
<div class="msg">내 그림을<br>움직이는 이모티콘으로</div>
<div class="chips"><span>그리기</span><span>움직이기</span><span>파일 묶음</span></div></div>
<div class="cards"><div class="card" style="height:190px">${friend('goguma-wave')}</div><div class="card" style="height:230px">${motionLines}${face('smile')}</div><div class="card" style="height:190px">${friend('kong-cheer')}</div></div>
</div>`;
fs.writeFileSync(path.join(out, 'feature-graphic-1024x500.html'), feature);

// ── 휴대전화 1080×1920 네 장 ──
// 대체 렌더 PNG(2배, 500×960 창)에서 폰 화면 영역: x 110~890, y 116~1804 (780×1688)
const draftSrc = path.join(root, 'verification/round45_45/after/png');
// 2026-10-13 개편(흰 홈·공지 슬라이드·부분 움직임 안내·채팅에서 써 보기) — 다섯 장. 이전 네 장 구성은 git 이력.
const slides = [
  { n: 1, title: '내 그림이 움직이는<br>이모티콘으로', sub: '그린 칸에 움직임을 골라 바로 미리 봐요', draft: 'motion-base' },
  { n: 2, title: '이어 그리기부터<br>제안 준비까지 한눈에', sub: '내 세트 · 제안까지 남은 일 · 가이드북', draft: 'draw-base' },
  { n: 3, title: '원하는 부분만<br>따로 움직여요', sub: '손 흔들기 · 조합(등장→인사)도 바로', pro: '부분 움직임', draft: 'motion-parts' },
  { n: 4, title: '무료 강좌로<br>처음부터 차근차근', sub: '콘과 친구들이 알려 주는 10편', draft: 'set-detail' },
  { n: 5, title: '한 세트로 모아,<br>파일로 내보내기', sub: '보드에서 한눈에 보고 파일 묶음으로', draft: 'set-detail' },
];
for (const s of slides) {
  let shot;
  if (draft) shot = `<div class="scr"><img src="${url(path.join(draftSrc, s.draft + '.png'))}" style="position:absolute;width:${1000 * 660 / 780}px;left:${-110 * 660 / 780}px;top:${-116 * 660 / 780}px"></div>`;
  else {
    const f = path.join(capDir, `capture-0${s.n}.png`);
    if (!fs.existsSync(f)) throw new Error('캡처가 없어요: ' + f);
    shot = `<div class="scr"><img src="${url(f)}" style="width:100%;height:100%;object-fit:cover;object-position:top"></div>`;
  }
  const html = `<!doctype html><meta charset="utf-8"><style>${FONT}
.c{width:1080px;height:1920px;box-sizing:border-box;background:${s.n % 2 ? LEMON : '#FFFFFF'};position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;padding-top:120px}
.h{font-family:Jua;font-weight:400;font-size:84px;line-height:1.18;text-align:center;letter-spacing:-1px}
.s{margin-top:28px;font-size:36px;font-weight:700;color:#4A4236;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center;padding:0 60px}
.pro{display:inline-flex;align-items:center;gap:8px;height:52px;padding:0 20px;border-radius:14px;border:3px solid ${INK};background:#fff;font-size:30px;font-weight:800}
.pro i{font-style:normal;background:${INK};color:#fff;border-radius:8px;padding:2px 10px;font-size:24px}
.ph{margin-top:64px;width:700px;height:1428px;border-radius:56px;background:${INK};padding:20px;box-sizing:border-box;box-shadow:0 30px 60px rgba(31,29,26,.18)}
.scr{position:relative;width:660px;height:1388px;border-radius:38px;overflow:hidden;background:#fff}
.mark{position:absolute;right:24px;top:24px;background:#D2574F;color:#fff;font:800 26px sans-serif;padding:8px 16px;border-radius:10px}
</style><div class="c">
<div class="h">${s.title}</div>
<div class="s"><span>${s.sub}</span>${s.pro ? `<span class="pro"><i>PRO</i>${s.pro}</span>` : ''}</div>
<div class="ph">${shot}</div>
${draft ? '<div class="mark">DRAFT · 대체 렌더(실기기 캡처 아님)</div>' : ''}
</div>`;
  fs.writeFileSync(path.join(out, `phone-0${s.n}${draft ? '-DRAFT' : ''}.html`), html);
}
console.log(out);
