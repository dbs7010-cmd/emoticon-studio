// 공식 가이드는 JS 로 그려지는 Notion 문서라 텍스트 요청으로는 빈 껍데기만 온다. 브라우저로 열어
// 실제로 그려진 글을 읽는다. 2차 출처를 제품 규격으로 삼지 않기 위한 도구다.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const url = process.argv[2];
const grep = process.argv[3];
(async () => {
  const server = await chromium.launchServer({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const browser = await chromium.connect(server.wsEndpoint());
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 2000 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Notion 은 스크롤해야 아래쪽을 그린다.
    await page.waitForTimeout(6000);
    for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 1600); await page.waitForTimeout(500); }
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const out = grep ? lines.filter(l => new RegExp(grep).test(l)) : lines;
    console.log(out.join('\n'));
  } finally {
    await browser.close();
    if (process.platform === 'win32') server.process().kill('SIGKILL'); else await server.close();
  }
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
