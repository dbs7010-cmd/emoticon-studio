// 문구 폰트 견본 그림(2026-11-03): 문구 판의 글씨 카드에 실제 폰트 모양을 보여 준다(앱 화면은 폰트를 직접 읽지 않으므로 그림으로).
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/fonts/render-samples.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { FONT_FILES } = require('./font-list.cjs');
const SAMPLE = { ko: '가나다', ja: 'あいう', 'zh-Hant': '你好呀' };
const root = path.join(__dirname, '..', '..', 'assets', 'fonts');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    for (const f of FONT_FILES) {
      const data = fs.readFileSync(path.join(root, f.key + '.woff2')).toString('base64');
      const png = await page.evaluate(async ({ data, text }) => {
        const bin = atob(data), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const face = new FontFace('sample', buf.buffer); await face.load(); document.fonts.add(face);
        const c = document.createElement('canvas'); c.width = 168; c.height = 60; const g = c.getContext('2d');
        g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
        let px = 44; g.font = px + 'px sample'; while (g.measureText(text).width > 156 && px > 20) { px -= 2; g.font = px + 'px sample'; }
        g.fillText(text, 84, 32); document.fonts.delete(face); return c.toDataURL('image/png');
      }, { data, text: SAMPLE[f.lang] });
      fs.writeFileSync(path.join(root, 'samples', f.key + '.png'), Buffer.from(png.split(',')[1], 'base64'));
    }
    console.log('samples', FONT_FILES.length);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
