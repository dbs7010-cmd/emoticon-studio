// 강좌 그림(그리기 기초 · 세트 구성)을 대표 캐릭터 콘으로 만든다(2026-10-16). 콘 그림은 assets/mascot/corn-*.png(scripts/mascot-render.cjs).
// 크기는 예전 그림과 같게 둔다(강좌 화면 비율이 그대로). 글자는 넣지 않는다 — 설명은 강좌 본문이 한다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/lessons/corn-art.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const ROOT = path.join(__dirname, '..', '..');
const corn = name => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'mascot', /^(goguma|kong)-/.test(name) ? `${name}.png` : `corn-${name}.png`)).toString('base64');
const img = (name, size, extra = '') => `<img src="${corn(name)}" width="${size}" height="${size}" style="display:block${extra}">`;
const tile = (name, size, mark = '') => `<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size * .16)}px;background:#F7F8FA;display:flex;align-items:center;justify-content:center;${mark}">${img(name, Math.round(size * .86))}</div>`;

const cover = (pose, mark) => `<div style="position:relative;width:100%;height:100%;background:#FFF1BF;display:flex;align-items:center;justify-content:center"><div style="position:absolute;right:-40px;top:-40px;width:220px;height:220px;border-radius:110px;background:rgba(255,255,255,.5)"></div><div style="width:280px;height:280px;border-radius:140px;background:#FFFFFF;display:flex;align-items:center;justify-content:center">${img(pose, 250)}</div><div style="position:absolute;left:34px;bottom:30px;width:96px;height:96px;border-radius:30px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(120,100,70,.18)">${mark}</div></div>`;

const ART = {
  // 캐릭터 정하기 ① 기준 한 장: 정면 · 웃는 얼굴 · 전신
  'character/step1.png': [720, 720, `<div style="display:flex;align-items:center;justify-content:center;height:100%">${img('base', 600)}</div>`],
  // ② 바꾸지 않을 것: 표정·자세가 달라도 몸 비율·눈·새싹·손은 그대로
  'character/step2.png': [1080, 360, `<div style="display:flex;align-items:center;justify-content:space-around;height:100%">${img('base', 320)}${img('wave', 320)}${img('cheer', 320)}</div>`],
  // ③ 작게 봐도 알아보게: 큰 그림 · 아이콘 크기(78) · 채팅 속 작은 크기(36)
  'character/step3.png': [760, 520, `<div style="display:flex;align-items:flex-end;justify-content:center;gap:56px;height:100%;padding-bottom:70px;box-sizing:border-box">${img('base', 400)}${img('base', 78)}${img('base', 36)}</div>`],
  // 표정 24가지 ① 자주 쓰는 마음 여덟: 안녕 · 고마워 · 미안 · 좋아 / 응 · 아니 · 화남 · 슬픔
  'expressions/step1.png': [720, 720, `<div style="display:grid;grid-template-columns:repeat(4,160px);gap:16px;justify-content:center;align-content:center;height:100%">${['wave', 'bow', 'sorry', 'cheer', 'nod', 'no', 'angry', 'sad'].map(n => tile(n, 160)).join('')}</div>`],
  // ③ 같은 고마워, 다른 몸짓: 꾸벅 · 하트 · 수줍게 · 두 손 번쩍
  'expressions/step3.png': [720, 720, `<div style="display:grid;grid-template-columns:repeat(2,320px);gap:24px;justify-content:center;align-content:center;height:100%">${['bow', 'heart', 'shy', 'cheer'].map(n => tile(n, 320)).join('')}</div>`],
  // 승인에 가까운 세트 ① 겹치지 않게: 보드에서 같은 칸 둘(빨간 점선)
  'set-plan/step1.png': [720, 720, `<div style="display:grid;grid-template-columns:repeat(3,200px);gap:20px;justify-content:center;align-content:center;height:100%">${['wave', 'bow', 'cheer', 'sad', 'nod', 'angry', 'shy', 'cheer', 'no'].map((n, i) => tile(n, 200, i === 2 || i === 7 ? 'outline:5px dashed #E5484D;outline-offset:4px' : '')).join('')}</div>`],
  // 강좌 표지 4장(480×360): 노란 바탕 + 콘 한 장 + 그 강좌를 뜻하는 작은 표시
  'first-set/cover.png': [480, 360, cover('wave', '<svg width="70" height="70" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#191F28" stroke-width="2.6" stroke-linecap="round"/></svg>')],
  'brush-layer/cover.png': [480, 360, cover('base', '<svg width="70" height="70" viewBox="0 0 24 24" fill="none"><path d="M4 20l4-1 11-11-3-3L5 16z" stroke="#191F28" stroke-width="2" stroke-linejoin="round"/></svg>')],
  'motion/cover.png': [480, 360, cover('cheer', '<svg width="70" height="70" viewBox="0 0 24 24" fill="none"><path d="M4 16c3-6 6-6 8 0s5 6 8 0" stroke="#5B57D9" stroke-width="2.4" stroke-linecap="round"/></svg>')],
  'animation/cover.png': [480, 360, cover('nod', '<svg width="70" height="70" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="7" height="12" rx="2" stroke="#191F28" stroke-width="2"/><rect x="14" y="6" width="7" height="12" rx="2" stroke="#191F28" stroke-width="2"/></svg>')],
};

// 강좌 썸네일 16:9(960×540)는 2026-10-20부터 scripts/lessons/topic-art.cjs 가 강좌 주제별 장면으로 만든다.

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    for (const [file, [w, h, body]] of Object.entries(ART)) {
      await page.setViewportSize({ width: w, height: h });
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#FFFFFF"><div id="a" style="width:${w}px;height:${h}px">${body}</div></body></html>`);
      await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
      const out = path.join(ROOT, 'assets', 'lessons', file);
      await page.locator('#a').screenshot({ path: out });
      console.log(file, w + '×' + h, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
