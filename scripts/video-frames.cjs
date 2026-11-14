// 영상에서 프레임을 뽑는다. ffmpeg 가 없어도 Chrome 은 H.264 를 디코딩할 수 있으므로,
// 이미 검증에 쓰고 있는 브라우저를 디코더로 쓴다. 새로 설치하는 것이 없다.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

const video = process.argv[2];
const outDir = process.argv[3] || 'frames';
const count = Number(process.argv[4] || 24);
if (!video || !fs.existsSync(video)) { console.error('영상 파일을 찾지 못했습니다: ' + video); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const server = await chromium.launchServer({ headless: true, args: ['--allow-file-access-from-files'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const browser = await chromium.connect(server.wsEndpoint());
  try {
    const page = await browser.newPage({ viewport: { width: 480, height: 1000 } });
    // file:// 미디어는 about:blank 페이지에서 막힌다. 영상 옆에 페이지를 하나 놓고 그것을 연다.
    const holder = path.resolve(outDir, '_player.html');
    // 한글이 섞인 경로는 file:// URL 에서 그대로 못 쓴다. 영상을 페이지 옆으로 복사해 ASCII 이름으로 연다.
    const local = path.resolve(outDir, '_clip' + path.extname(video));
    if (!fs.existsSync(local) || fs.statSync(local).size !== fs.statSync(video).size) fs.copyFileSync(video, local);
    fs.writeFileSync(holder, `<body style="margin:0;background:#000"><video id="v" src="${path.basename(local)}" preload="auto"></video></body>`);
    // 경로에 한글이 있으면 그대로는 열리지 않는다. 파일 URL 규칙대로 인코딩해서 연다.
    await page.goto(require('node:url').pathToFileURL(holder).href);
    const meta = await page.evaluate(async () => {
      const v = document.getElementById('v');
      // 이미 읽혔을 수 있다. 그때는 이벤트가 다시 오지 않으므로 먼저 상태를 본다.
      if (v.readyState < 1) await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = () => no(new Error('디코드 실패: ' + (v.error && v.error.message))); setTimeout(() => no(new Error('메타데이터 시간 초과')), 20000); });
      return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
    });
    console.log(`영상: ${meta.width}×${meta.height} · ${meta.duration.toFixed(1)}초`);
    for (let i = 0; i < count; i++) {
      const at = meta.duration * (i + .5) / count;
      const data = await page.evaluate(async when => {
        const v = document.getElementById('v');
        await new Promise((ok, no) => { v.onseeked = ok; v.currentTime = when; setTimeout(() => no(new Error('탐색 시간 초과')), 15000); });
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        return c.toDataURL('image/jpeg', .8);
      }, at);
      const name = path.join(outDir, `t${String(Math.round(at * 10)).padStart(5, '0')}.jpg`);
      fs.writeFileSync(name, Buffer.from(data.split(',')[1], 'base64'));
      console.log(`  ${at.toFixed(1)}초 → ${name}`);
    }
  } finally {
    await browser.close();
    if (process.platform === 'win32') server.process().kill('SIGKILL'); else await server.close();
  }
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
