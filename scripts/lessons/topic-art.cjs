// 강좌 썸네일(960×540)과 홈 공지 배경 그림(1170×390)을 만든다(2026-10-20, 사용자: "단순하고 허접" → 다시).
// 구성: 진한 바탕 + 방사 줄무늬 · 기울인 휴대폰 속 실제 앱 화면(docs/design/lesson-thumb-shots, 검수 빌드 에뮬레이터 캡처)
//       · 흰 테두리 스티커 캐릭터 · 굵은 외곽선 제목(Jua) · 짚어 주는 빨간 동그라미.
// 화면 캡처가 없는 강좌(그리기 기초 · 공모전)는 강좌 그림(assets/lessons/*/step*.png)이나 접수 카드 축소판을 쓴다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/lessons/topic-art.cjs [하나만: id 또는 book.png]
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const ROOT = path.join(__dirname, '..', '..');
const INK = '#191F28', RED = '#FF4D5E', HI = '#FFE14D';
const data = file => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, file)).toString('base64');
const shot = name => data(`docs/design/lesson-thumb-shots/${name}.png`);
const mascot = name => data(`assets/mascot/${/^(goguma|kong)-/.test(name) ? name : 'corn-' + name}.png`);
const FONT = `@font-face{font-family:Jua;src:url(${'data:font/ttf;base64,' + fs.readFileSync(path.join(ROOT, 'assets/fonts/Jua-Regular.ttf')).toString('base64')})}`;

const backdrop = (color, ray, cx = '76%', cy = '46%') => `background-color:${color};background-image:repeating-conic-gradient(from 0deg at ${cx} ${cy},${ray} 0deg 9deg,transparent 9deg 18deg)`;
// 휴대폰: 실제 화면(1080 폭)을 cropTop 부터. ring = 화면 좌표(px)의 [x, y, w, h] — 기울어진 화면과 함께 돈다.
const phone = (name, { x, y, w = 300, rot = -7, cropTop = 0, ring }) => {
  const k = (w * 0.93) / 1080;
  const r = ring ? `<div style="position:absolute;left:${ring[0] * k}px;top:${(ring[1] - cropTop) * k}px;width:${ring[2] * k}px;height:${ring[3] * k}px;border:7px solid ${RED};border-radius:999px;box-sizing:border-box"></div>` : '';
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${Math.round(w * 2.15)}px;border-radius:${w * .14}px;background:${INK};padding:${w * .035}px;box-sizing:border-box;transform:rotate(${rot}deg);box-shadow:18px 24px 0 rgba(25,31,40,.2)">
    <div style="width:100%;height:100%;border-radius:${w * .11}px;overflow:hidden;background:#fff;position:relative"><img src="${shot(name)}" style="position:absolute;left:0;top:${-cropTop * k}px;width:100%">${r}</div></div>`;
};
// 큰 카드(강좌 그림 · 축소판): 흰 바탕 · 검은 테두리 · 기울임
const board = (inner, { x, y, w, h, rot = 5 }) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:28px;background:#fff;border:6px solid ${INK};box-sizing:border-box;overflow:hidden;transform:rotate(${rot}deg);box-shadow:16px 20px 0 rgba(25,31,40,.2)">${inner}</div>`;
const sticker = (name, size, x, y, rot = 0) => `<img src="${mascot(name)}" width="${size}" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${rot}deg);filter:drop-shadow(5px 0 0 #fff) drop-shadow(-5px 0 0 #fff) drop-shadow(0 5px 0 #fff) drop-shadow(0 -5px 0 #fff) drop-shadow(6px 10px 0 rgba(25,31,40,.2))">`;
const title = (html, x, y, size = 92) => `<div style="position:absolute;left:${x}px;top:${y}px;font-family:Jua;font-size:${size}px;line-height:${Math.round(size * 1.08)}px;color:#fff;letter-spacing:-1px;-webkit-text-stroke:${Math.round(size * .15)}px ${INK};paint-order:stroke fill;text-shadow:0 ${Math.round(size * .1)}px 0 ${INK};white-space:nowrap">${html}</div>`;
const hi = t => `<span style="color:${HI}">${t}</span>`;
const badge = (text, x = 56, y = 52) => `<div style="position:absolute;left:${x}px;top:${y}px;height:48px;padding:0 22px;border-radius:24px;background:${RED};color:#fff;font:900 24px 'Malgun Gothic';display:flex;align-items:center;border:4px solid ${INK};box-shadow:0 5px 0 ${INK}">${text}</div>`;
const sub = (text, x = 56, y = 412) => `<div style="position:absolute;left:${x}px;top:${y}px;height:56px;padding:0 22px;border-radius:14px;background:${INK};color:#fff;font:800 26px 'Malgun Gothic';display:flex;align-items:center;white-space:nowrap">${text}</div>`;
const thumb = (bg, body) => `<div style="position:relative;width:960px;height:540px;overflow:hidden;${bg}">${body}</div>`;
const free = () => badge('▶&nbsp; 무료 강좌');   // 시간은 앱 목록이 썸네일 오른쪽 아래에 붙인다
const trophy = w => `<svg width="${w}" height="${w * 1.2}" viewBox="0 0 120 144"><path d="M30 8 h60 v38 a30 30 0 0 1-60 0z" fill="${HI}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M30 18 h-14 a14 14 0 0 0 14 26 M90 18 h14 a14 14 0 0 1-14 26" fill="none" stroke="${INK}" stroke-width="6"/><path d="M52 76 h16 v26 h-16z" fill="${HI}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><rect x="30" y="102" width="60" height="22" rx="6" fill="#5B57D9" stroke="${INK}" stroke-width="6"/><path d="M60 22 l5 10 11 1.6-8 7.8 2 11-10-5.2-10 5.2 2-11-8-7.8 11-1.6z" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/></svg>`;

const THUMBS = {
  'first-set': thumb(backdrop('#FFB51E', 'rgba(255,255,255,.22)'),
    phone('board', { x: 600, y: 30, rot: 6, cropTop: 150 }) + free(2) + title(`첫 세트,<br>${hi('첫 칸')} 그리기`, 52, 118) + sub('세트 만들기 → 그리기 → 저장') + sticker('wave', 200, 440, 300, -6)),
  'brush-layer': thumb(backdrop('#8B7BFF', 'rgba(255,255,255,.14)'),
    phone('layers', { x: 590, y: 26, rot: -6, cropTop: 1150, ring: [20, 1800, 1040, 150] }) + free(3) + title(`${hi('레이어')}로<br>나눠 그리기`, 52, 118) + sub('펜 · 연필 · 마커 · 색 채우기') + sticker('goguma-wave', 180, 470, 250, 6)),
  'motion': thumb(backdrop('#3D8BFF', 'rgba(255,255,255,.14)'),
    phone('motion', { x: 560, y: 40, rot: -7, cropTop: 250, ring: [40, 1730, 230, 220] }) + free(3) + title(`톡 누르면<br>${hi('움직여요!')}`, 52, 118, 96) + sub('뿅 · 통통 · 둥실 · 손그림 떨림') + sticker('cheer', 200, 400, 300, 8)),
  'animation': thumb(backdrop('#FF7A59', 'rgba(255,255,255,.16)'),
    phone('animation', { x: 600, y: 24, rot: 6, cropTop: 1210, ring: [235, 1760, 180, 180] }) + free(4) + title(`장마다 그려<br>${hi('애니메이션')}`, 52, 118, 88) + sub('1장 → 2장 → ▶ 재생') + sticker('nod', 190, 430, 300, -4)),
  'export': thumb(backdrop('#22B573', 'rgba(255,255,255,.16)'),
    phone('export', { x: 596, y: 20, rot: -6, cropTop: 1250, ring: [40, 1795, 1000, 160] }) + free(3) + title(`카카오 제안<br>${hi('파일')} 만들기`, 52, 118, 88) + sub('PNG · WebP · 아이콘 한 번에') + sticker('goguma-cheer', 190, 430, 300, 6)),
  'contest': thumb(backdrop('#FF5C8A', 'rgba(255,255,255,.16)'),
    `<div style="position:absolute;left:600px;top:20px">${trophy(230)}</div>` +
    board(`<div style="padding:22px 24px;display:flex;flex-direction:column;gap:14px;font-family:'Malgun Gothic'">
      <div style="display:flex;align-items:center;justify-content:space-between"><b style="font-size:28px">공모전 접수</b><span style="height:38px;padding:0 14px;border-radius:19px;background:${RED};color:#fff;font-size:22px;font-weight:900;display:flex;align-items:center">D-7</span></div>
      <div style="display:flex;gap:10px">${['wave', 'heart', 'cheer', 'shy'].map(n => `<div style="width:66px;height:66px;border-radius:14px;background:#F2F4F6;display:flex;align-items:center;justify-content:center"><img src="${mascot(n)}" width="58"></div>`).join('')}</div>
      <div style="height:54px;border-radius:27px;background:${HI};border:4px solid ${INK};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900">이 세트로 접수</div></div>`, { x: 570, y: 280, w: 350, h: 236, rot: -4 }) +
    free(2) + title(`세트 하나로<br>${hi('공모전')} 접수`, 52, 118, 88) + sub('열린 공모전을 앱에서 바로') + sticker('kong-cheer', 170, 400, 320, -6)),
  'character': thumb(backdrop('#19B5C9', 'rgba(255,255,255,.16)'),
    board(`<img src="${data('assets/lessons/character/step2.png')}" style="width:100%;display:block;margin-top:14px">`, { x: 470, y: 60, w: 470, h: 190, rot: 5 }) +
    board(`<img src="${data('assets/lessons/character/step3.png')}" style="width:100%;display:block">`, { x: 580, y: 280, w: 330, h: 226, rot: -4 }) +
    free(3) + title(`내 캐릭터<br>${hi('먼저')} 정하기`, 52, 118) + sub('비율 · 눈 · 손은 끝까지 그대로') + sticker('kong-wave', 150, 830, 390, 6)),
  'expressions': thumb(backdrop('#F2994A', 'rgba(255,255,255,.16)'),
    board(`<img src="${data('assets/lessons/expressions/step1.png')}" style="width:100%;display:block">`, { x: 560, y: 40, w: 370, h: 370, rot: 5 }) +
    free(4) + title(`자주 쓰는<br>${hi('표정 24가지')}`, 52, 118, 84) + sub('안녕 · 고마워 · 미안 · 좋아') + sticker('shy', 180, 470, 330, -6)),
  'set-plan': thumb(backdrop('#5DB83E', 'rgba(255,255,255,.16)'),
    board(`<img src="${data('assets/lessons/set-plan/step1.png')}" style="width:100%;display:block">`, { x: 560, y: 50, w: 370, h: 370, rot: -5 }) +
    `<div style="position:absolute;left:780px;top:22px;height:52px;padding:0 20px;border-radius:26px;background:${RED};color:#fff;font:900 26px 'Malgun Gothic';display:flex;align-items:center;border:4px solid ${INK};transform:rotate(6deg)">겹침 빼기!</div>` +
    free(3) + title(`승인에 가까운<br>${hi('세트')} 구성`, 52, 118, 80) + sub('겹치는 표정 없이 24칸 채우기') + sticker('cheer', 170, 480, 340, 6)),
  'make-lesson': thumb(backdrop('#2B2F3A', 'rgba(255,225,77,.12)'),
    phone('lesson-view', { x: 600, y: 24, rot: 6, cropTop: 150 }) + badge('▶&nbsp; 작가용') + title(`나만의<br>${hi('강좌')} 만들기`, 52, 118, 96) +
    `<div style="position:absolute;left:56px;top:412px;height:56px;padding:0 22px;border-radius:14px;background:#fff;color:${INK};font:800 26px 'Malgun Gothic';display:flex;align-items:center">녹화 → 목차 → 설명</div>` + sticker('goguma-cheer', 190, 430, 300, -6)),
};

// 홈 공지 배경(1170×390 = 390×130 의 3배). 왼쪽 55% 는 앱이 글자(제목)를 얹는 자리라 비워 둔다.
const banner = (color, ray, art) => `<div style="position:relative;width:1170px;height:390px;overflow:hidden;${backdrop(color, ray, '82%', '50%')}"><div style="position:absolute;left:0;top:0;width:700px;height:390px;background:${color};clip-path:polygon(0 0,100% 0,86% 100%,0 100%)"></div>${art}</div>`;
const NOTICES = {
  'book.png': banner('#FFD43B', 'rgba(255,255,255,.28)',
    phone('guidebook', { x: 720, y: 40, w: 250, rot: 8, cropTop: 60 }) + sticker('wave', 230, 900, 130, -6)),
  'contest.png': banner('#B9B3FF', 'rgba(255,255,255,.3)',
    `<div style="position:absolute;left:740px;top:40px">${trophy(230)}</div>` + sticker('kong-cheer', 200, 930, 160, 6) + sticker('cheer', 170, 650, 190, -8)),
  // 알림 배너는 운영자 그림 자리(noticeArtwork)를 그대로 쓴다 — 배경 그림을 만들지 않는다.
};

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    const render = async (w, h, body, out) => {
      await page.setViewportSize({ width: w, height: h });
      await page.setContent(`<!doctype html><html><head><style>${FONT}body{margin:0}</style></head><body><div id="a" style="width:${w}px;height:${h}px">${body}</div></body></html>`);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.locator('#a').screenshot({ path: out });
      console.log(path.relative(ROOT, out), w + '×' + h, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
    };
    const only = process.argv[2];
    for (const [id, body] of Object.entries(THUMBS)) if (!only || only === id) await render(960, 540, body, path.join(ROOT, 'assets', 'lessons', 'thumbs', `${id}.png`));
    for (const [file, body] of Object.entries(NOTICES)) if (!only || only === file) await render(1170, 390, body, path.join(ROOT, 'assets', 'notices', file));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
