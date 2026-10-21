// Google Play 스토어 등록 그림(emoti 이모티) — 2026-10-20 다시(사용자: 예전 노란 단색판이 밋밋함).
//   · 그래픽 이미지 1024×500 · 휴대전화 스크린샷 1080×1920 다섯 장.
//   · 구성(강좌 썸네일 scripts/lessons/topic-art.cjs 와 같은 말투): 진한 바탕 + 방사 줄무늬 · 굵은 외곽선 제목(Jua)
//     · 기울인 휴대폰 속 실제 앱 화면(합성·없는 UI 추가 없음) · 짚어 주는 빨간 동그라미 · 흰 테두리 스티커 캐릭터.
// 앱 화면은 --captures 폴더의 capture-01.png ~ capture-05.png(검수 빌드 에뮬레이터 캡처 1080×2400).
// 사용: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/store-graphics.cjs <나갈 폴더> --captures <폴더>
//   → <나갈 폴더>/feature-graphic-1024x500.png · phone-0N.png. 업로드 전 scripts/store-finalize.cjs 로 RGB 로 굳힌다.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || 'verification/store');
const capIdx = process.argv.indexOf('--captures');
if (capIdx < 0) throw new Error('--captures <폴더> 가 필요해요(실제 앱 캡처만 쓴다)');
const capDir = path.resolve(process.argv[capIdx + 1]);
fs.mkdirSync(out, { recursive: true });

const INK = '#191F28', RED = '#FF4D5E', HI = '#FFE14D';
const data = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const capture = n => { const f = path.join(capDir, `capture-0${n}.png`); if (!fs.existsSync(f)) throw new Error('캡처가 없어요: ' + f); return data(f); };
const mascot = n => data(path.join(root, 'assets/mascot', (/^(goguma|kong)-/.test(n) ? n : 'corn-' + n) + '.png'));
const FONT = '@font-face{font-family:Jua;src:url(data:font/ttf;base64,' + fs.readFileSync(path.join(root, 'assets/fonts/Jua-Regular.ttf')).toString('base64') + ')}';

const backdrop = (c, ray, at = '50% 62%') => `background-color:${c};background-image:repeating-conic-gradient(from 0deg at ${at},${ray} 0deg 7deg,transparent 7deg 14deg)`;
// 휴대폰: 실제 화면(1080 폭)을 cropTop 부터. ring = 화면 좌표(px)의 [x, y, w, h].
const phone = (img, { x, y, w, rot, cropTop = 0, ring, bezel = 0.03 }) => {
  const k = (w * (1 - bezel * 2)) / 1080;
  const r = ring ? `<div style="position:absolute;left:${ring[0] * k}px;top:${(ring[1] - cropTop) * k}px;width:${ring[2] * k}px;height:${ring[3] * k}px;border:${Math.round(w * .02)}px solid ${RED};border-radius:999px;box-sizing:border-box"></div>` : '';
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${Math.round(w * 2.1)}px;border-radius:${w * .12}px;background:${INK};padding:${w * bezel}px;box-sizing:border-box;transform:rotate(${rot}deg);box-shadow:${w * .05}px ${w * .06}px 0 rgba(25,31,40,.22)"><div style="width:100%;height:100%;border-radius:${w * .095}px;overflow:hidden;background:#fff;position:relative"><img src="${img}" style="position:absolute;left:0;top:${-cropTop * k}px;width:100%">${r}</div></div>`;
};
const sticker = (n, s, x, y, rot, edge = 9) => `<img src="${mascot(n)}" width="${s}" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${rot}deg);filter:drop-shadow(${edge}px 0 0 #fff) drop-shadow(-${edge}px 0 0 #fff) drop-shadow(0 ${edge}px 0 #fff) drop-shadow(0 -${edge}px 0 #fff) drop-shadow(${edge}px ${edge * 1.8}px 0 rgba(25,31,40,.22))">`;
const outlined = (size, style) => `font-family:Jua;font-size:${size}px;line-height:${Math.round(size * 1.1)}px;color:#fff;-webkit-text-stroke:${Math.round(size * .14)}px ${INK};paint-order:stroke fill;text-shadow:0 ${Math.round(size * .09)}px 0 ${INK};${style}`;
const hi = t => `<span style="color:${HI}">${t}</span>`;
const tag = (text, x, y, rot, size = 40) => `<div style="position:absolute;left:${x}px;top:${y}px;height:${size * 1.9}px;padding:0 ${size * .75}px;border-radius:${size}px;background:${RED};color:#fff;font:900 ${size}px 'Malgun Gothic';display:flex;align-items:center;border:${size * .15}px solid ${INK};transform:rotate(${rot}deg)">${text}</div>`;

// ── 휴대전화 1080×1920 다섯 장 ──
const screen = (bg, titleHtml, sub, body) => `<div style="position:relative;width:1080px;height:1920px;overflow:hidden;${bg}">
  <div style="position:absolute;left:0;right:0;top:120px;text-align:center;${outlined(146, '')}">${titleHtml}</div>
  <div style="position:absolute;left:50%;top:480px;transform:translateX(-50%);height:84px;padding:0 36px;border-radius:24px;background:${INK};color:#fff;font:800 40px 'Malgun Gothic';display:flex;align-items:center;white-space:nowrap">${sub}</div>
  ${body}</div>`;
const PHONES = {
  1: screen(backdrop('#3D8BFF', 'rgba(255,255,255,.13)'), `내 그림이<br>${hi('톡! 움직여요')}`, '그린 칸에 움직임을 고르면 바로 미리 보기',
    phone(capture(1), { x: 250, y: 640, w: 600, rot: -5, cropTop: 200, ring: [36, 1730, 240, 210] }) + sticker('cheer', 330, 40, 1420, -8) + sticker('kong-wave', 260, 800, 1560, 8)),
  2: screen(backdrop('#FFB51E', 'rgba(255,255,255,.2)'), `이어 그리기부터<br>${hi('제안 준비')}까지`, '내 세트 · 남은 일 · 가이드북을 한 화면에',
    phone(capture(2), { x: 250, y: 640, w: 600, rot: 5, cropTop: 0, ring: [660, 1240, 380, 170] }) + sticker('wave', 320, 30, 1450, -8) + sticker('goguma-cheer', 250, 810, 1590, 8)),
  3: screen(backdrop('#8B7BFF', 'rgba(255,255,255,.13)'), `원하는 부분만<br>${hi('따로')} 움직여요`, '손 흔들기 · 통통 튀기 · 조합까지',
    phone(capture(3), { x: 250, y: 640, w: 600, rot: 5, cropTop: 200, ring: [700, 560, 260, 220] }) + tag('PRO', 70, 640, -6) + sticker('heart', 320, 730, 1450, 8) + sticker('goguma-wave', 250, 40, 1580, -8)),
  4: screen(backdrop('#FF7A59', 'rgba(255,255,255,.16)'), `무료 강좌로<br>${hi('차근차근')}`, '콘과 친구들이 알려 주는 10편',
    phone(capture(4), { x: 250, y: 640, w: 600, rot: -5, cropTop: 0 }) + tag('무료 10편', 700, 650, 6) + sticker('nod', 300, 30, 1470, -8) + sticker('kong-cheer', 250, 820, 1600, 8)),
  5: screen(backdrop('#22B573', 'rgba(255,255,255,.16)'), `한 세트로 모아<br>${hi('파일')}로 내보내기`, '보드에서 한눈에 · 파일 묶음 한 번에',
    phone(capture(5), { x: 250, y: 640, w: 600, rot: 5, cropTop: 200, ring: [720, 2160, 320, 130] }) + sticker('heart', 300, 30, 1460, -8) + sticker('goguma-wave', 240, 830, 1300, 8)),
};

// ── 그래픽 이미지 1024×500: 왼쪽 이름 + 한 줄, 오른쪽 기울인 휴대폰(움직이기 화면) + 콘 · 친구 ──
const FEATURE = `<div style="position:relative;width:1024px;height:500px;overflow:hidden;${backdrop('#FFB51E', 'rgba(255,255,255,.22)', '74% 50%')}">
  <div style="position:absolute;left:56px;top:62px;${outlined(150, 'letter-spacing:-2px')}">emoti</div>
  <div style="position:absolute;left:60px;top:250px;${outlined(64, '')}">내 그림이 ${hi('톡!')}<br>움직이는 이모티콘</div>
  ${phone(capture(1), { x: 660, y: 40, w: 230, rot: 8, cropTop: 300 })}
  ${sticker('cheer', 190, 520, 270, -8, 6)}${sticker('kong-wave', 150, 870, 330, 8, 6)}
</div>`;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    const render = async (w, h, body, file) => {
      await page.setViewportSize({ width: w, height: h });
      await page.setContent(`<!doctype html><html><head><style>${FONT}body{margin:0}</style></head><body><div id="a" style="width:${w}px;height:${h}px">${body}</div></body></html>`);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
      await page.locator('#a').screenshot({ path: path.join(out, file) });
      console.log(path.join(out, file));
    };
    await render(1024, 500, FEATURE, 'feature-graphic-1024x500.png');
    for (const [n, body] of Object.entries(PHONES)) await render(1080, 1920, body, `phone-0${n}.png`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
