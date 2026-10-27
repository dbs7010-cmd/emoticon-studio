// 채널별 추가 홍보물(2026-10-21, 대표 "인스타·쓰레드·유튜브 자료 잘 정리 제작") — 키트(kit.cjs)에 더하는 것.
//   threads/  1080×1350 대화형 카드 4장(질문 · 전후 비교 · 표정 8칸 · 만드는 중)
//   stories/  1080×1920 인스타 스토리 배경 3장(새 영상 알림 · 투표 · 강좌) — 투표·링크 스티커는 인스타 앱에서 붙일 빈 자리를 남김
// 그림: 대표 캐릭터 콘·친구(assets/mascot) · 실제 앱 화면(docs/design/lesson-thumb-shots, <작업>/caps). 합성 UI 없음.
// 사용: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/promo/kit-channels.cjs <나갈 폴더> <작업 폴더>
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const [out, work] = process.argv.slice(2).map(p => path.resolve(p));
for (const d of ['threads', 'stories']) fs.mkdirSync(path.join(out, d), { recursive: true });
const INK = '#191F28', HI = '#FFE14D', RED = '#FF4D5E';
const data = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const mascot = n => data(path.join(ROOT, 'assets/mascot', (/^(goguma|kong)-/.test(n) ? n : 'corn-' + n) + '.png'));
const cap = n => data(path.join(work, 'caps', n + '.png'));
const FONT = '@font-face{font-family:Jua;src:url(data:font/ttf;base64,' + fs.readFileSync(path.join(ROOT, 'assets/fonts/Jua-Regular.ttf')).toString('base64') + ')}';
const rays = (c, ray = 'rgba(255,255,255,.16)', at = '50% 55%') => `background-color:${c};background-image:repeating-conic-gradient(from 0deg at ${at},${ray} 0deg 7deg,transparent 7deg 14deg)`;
const outlined = (size, extra = '') => `font-family:Jua;font-size:${size}px;line-height:${Math.round(size * 1.14)}px;color:#fff;-webkit-text-stroke:${Math.round(size * .14)}px ${INK};paint-order:stroke fill;text-shadow:0 ${Math.round(size * .09)}px 0 ${INK};${extra}`;
const hi = t => `<span style="color:${HI}">${t}</span>`;
const glow = e => `filter:drop-shadow(${e}px 0 0 #fff) drop-shadow(-${e}px 0 0 #fff) drop-shadow(0 ${e}px 0 #fff) drop-shadow(0 -${e}px 0 #fff) drop-shadow(${e}px ${e * 1.6}px 0 rgba(25,31,40,.2))`;
const sticker = (n, s, x, y, rot, e = 9) => `<img src="${mascot(n)}" width="${s}" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${rot}deg);${glow(e)}">`;
const card = (inner, { x, y, w, h, rot = 0 }) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:40px;background:#fff;border:8px solid ${INK};box-sizing:border-box;overflow:hidden;transform:rotate(${rot}deg);box-shadow:20px 24px 0 rgba(25,31,40,.2)">${inner}</div>`;
const shotCrop = (img, w, cropTop) => `<img src="${img}" style="position:absolute;left:0;top:${-cropTop * w / 1080}px;width:100%">`;
const handle = (y, size = 40) => `<div style="position:absolute;left:0;right:0;top:${y}px;text-align:center;${outlined(size)}">emoti · #emoti로그린</div>`;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage();
  const render = async (w, h, body, file) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html><head><style>${FONT}body{margin:0}</style></head><body><div id="a" style="position:relative;width:${w}px;height:${h}px;overflow:hidden">${body}</div></body></html>`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
    await page.locator('#a').screenshot({ path: file });
    console.log(path.relative(ROOT, file));
  };
  try {
    // ── 쓰레드 4장 ──
    await render(1080, 1350, `<div style="position:absolute;inset:0;${rays(HI, 'rgba(255,255,255,.35)')}"></div>
      <div style="position:absolute;left:0;right:0;top:130px;text-align:center;${outlined(100)}">이모티콘 만들어 보고<br>싶었는데 ${hi('못 한 이유')}는?</div>
      ${['그림 실력', '아이패드가 없음', '움직이게 하는 법', '어디서부터?'].map((t, i) => `<div style="position:absolute;left:${i % 2 ? 560 : 80}px;top:${560 + Math.floor(i / 2) * 170}px;width:440px;height:130px;border-radius:65px;background:#fff;border:7px solid ${INK};box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:800 44px 'Malgun Gothic';color:${INK}">${String.fromCharCode(65 + i)}. ${t}</div>`).join('')}
      ${sticker('shy', 300, 390, 920, 0)}${handle(1260)}`, path.join(out, 'threads', 't1-못한이유.png'));
    await render(1080, 1350, `<div style="position:absolute;inset:0;${rays('#8B7BFF')}"></div>
      <div style="position:absolute;left:0;right:0;top:110px;text-align:center;${outlined(96)}">선만 그려도 OK<br>${hi('색까지')} 칠하면?</div>
      ${card(shotCrop(cap('a1'), 440, 470) , { x: 70, y: 560, w: 440, h: 440, rot: -4 })}
      ${card(shotCrop(cap('hero'), 440, 470), { x: 570, y: 560, w: 440, h: 440, rot: 4 })}
      <div style="position:absolute;left:150px;top:1060px;${outlined(56)}">선 그림</div><div style="position:absolute;left:680px;top:1060px;${outlined(56)}">${hi('색칠')}</div>
      ${handle(1260)}`, path.join(out, 'threads', 't2-선만vs색까지.png'));
    const faces = [['wave', '안녕'], ['bow', '고마워'], ['sorry', '미안'], ['cheer', '좋아'], ['nod', '응'], ['no', '아니'], ['sad', '슬퍼'], ['angry', '화나']];
    await render(1080, 1350, `<div style="position:absolute;inset:0;${rays('#22B573')}"></div>
      <div style="position:absolute;left:0;right:0;top:90px;text-align:center;${outlined(92)}">인사 8칸 중<br>제일 어려운 ${hi('표정')}은?</div>
      <div style="position:absolute;left:70px;top:420px;display:grid;grid-template-columns:repeat(4,220px);gap:14px">${faces.map(([n, t]) => `<div style="height:300px;border-radius:30px;background:#fff;border:6px solid ${INK};box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px"><img src="${mascot(n)}" width="190"><b style="font:900 36px 'Malgun Gothic';color:${INK}">${t}</b></div>`).join('')}</div>
      <div style="position:absolute;left:0;right:0;top:1090px;text-align:center;${outlined(52)}">댓글로 골라 주세요 👇</div>${handle(1260)}`, path.join(out, 'threads', 't3-표정8칸.png'));
    await render(1080, 1350, `<div style="position:absolute;inset:0;${rays('#3D8BFF')}"></div>
      <div style="position:absolute;left:0;right:0;top:110px;text-align:center;${outlined(92)}">폰으로 만드는<br>${hi('이모티콘 앱')} 만드는 중</div>
      ${card(shotCrop(cap('capture-02'), 560, 120), { x: 260, y: 430, w: 560, h: 780, rot: -3 })}
      ${sticker('wave', 230, 40, 960, -8)}${sticker('kong-cheer', 200, 850, 990, 8)}${handle(1260)}`, path.join(out, 'threads', 't4-만드는중.png'));

    // ── 인스타 스토리 배경 3장(가운데 아래 비워 둠: 투표·링크 스티커 자리) ──
    const story = (bg, title, body, file) => render(1080, 1920, `<div style="position:absolute;inset:0;${rays(bg)}"></div>
      <div style="position:absolute;left:0;right:0;top:250px;text-align:center;${outlined(110)}">${title}</div>${body}`, path.join(out, 'stories', file));
    await story(HI, `새 영상<br>${hi('올라왔어요!')}`, `${card(shotCrop(cap('hero'), 600, 470), { x: 240, y: 620, w: 600, h: 590, rot: -3 })}`, 's1-새영상.png');
    await story('#8B7BFF', `어떤 움직임이<br>${hi('더 좋아요?')}`, `${sticker('cheer', 400, 90, 700, -8)}${sticker('wave', 400, 590, 700, 8)}
      <div style="position:absolute;left:150px;top:1150px;${outlined(64)}">통통</div><div style="position:absolute;left:690px;top:1150px;${outlined(64)}">손 흔들기</div>`, 's2-투표.png');
    await story('#FF7A59', `처음이라면<br>${hi('무료 강좌 10편')}`, `${card(shotCrop(cap('capture-04'), 640, 300), { x: 220, y: 600, w: 640, h: 680, rot: 3 })}`, 's3-강좌.png');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
