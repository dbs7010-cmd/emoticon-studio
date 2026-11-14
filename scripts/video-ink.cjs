// 영상에서 "그림이 사라지는" 순간을 눈이 아니라 숫자로 찾는다. 1초 간격으로 캔버스 영역의 진한 픽셀을
// 세고, 직전보다 크게 줄어든 지점을 보고한다. 그 지점만 꺼내 보면 되므로 사람이 영상을 훑지 않아도 된다.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const video = process.argv[2];
const outDir = process.argv[3] || 'ink';
const step = Number(process.argv[4] || 1);
if (!video || !fs.existsSync(video)) { console.error('영상 파일을 찾지 못했습니다: ' + video); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const server = await chromium.launchServer({ headless: true, args: ['--allow-file-access-from-files'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const browser = await chromium.connect(server.wsEndpoint());
  try {
    const page = await browser.newPage({ viewport: { width: 480, height: 1000 } });
    const holder = path.resolve(outDir, '_player.html');
    const local = path.resolve(outDir, '_clip' + path.extname(video));
    if (!fs.existsSync(local) || fs.statSync(local).size !== fs.statSync(video).size) fs.copyFileSync(video, local);
    fs.writeFileSync(holder, `<body style="margin:0;background:#000"><video id="v" src="${path.basename(local)}" preload="auto"></video><canvas id="c"></canvas></body>`);
    await page.goto(pathToFileURL(holder).href);
    const meta = await page.evaluate(async () => {
      const v = document.getElementById('v');
      if (v.readyState < 1) await new Promise((ok, no) => { v.onloadedmetadata = ok; setTimeout(() => no(new Error('메타데이터 시간 초과')), 20000); });
      const c = document.getElementById('c'); c.width = v.videoWidth; c.height = v.videoHeight;
      return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
    });
    // 화면 위쪽 25%는 상태표시줄과 머리, 아래 45%는 도구다. 그 사이가 캔버스다.
    const top = Math.round(meta.height * .14), bottom = Math.round(meta.height * .56);
    console.log(`영상 ${meta.width}×${meta.height} · ${meta.duration.toFixed(1)}초 · 캔버스 영역 y ${top}~${bottom}`);
    const series = [];
    for (let at = 0; at < meta.duration; at += step) {
      const ink = await page.evaluate(async arg => {
        const v = document.getElementById('v'), c = document.getElementById('c'), g = c.getContext('2d', { willReadFrequently: true });
        await new Promise((ok, no) => { v.onseeked = ok; v.currentTime = arg.at; setTimeout(() => no(new Error('탐색 시간 초과')), 15000); });
        g.drawImage(v, 0, 0);
        const d = g.getImageData(0, arg.top, c.width, arg.bottom - arg.top).data;
        let dark = 0;
        for (let i = 0; i < d.length; i += 16) if (d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110) dark++;
        return dark;
      }, { at, top, bottom });
      series.push({ at, ink });
    }
    fs.writeFileSync(path.join(outDir, 'ink.json'), JSON.stringify(series, null, 1));
    // 직전보다 60% 이상 줄어든 지점이 "사라진" 후보다.
    const drops = [];
    for (let i = 1; i < series.length; i++) {
      const was = series[i - 1].ink, now = series[i].ink;
      if (was > 400 && now < was * .4) drops.push({ at: series[i].at, was, now });
    }
    console.log(`잉크 최대 ${Math.max(...series.map(s => s.ink))} · 최소 ${Math.min(...series.map(s => s.ink))}`);
    if (!drops.length) console.log('급격히 사라지는 구간 없음 (기준: 직전 대비 60% 이상 감소)');
    for (const d of drops) console.log(`  ${d.at}초: ${d.was} → ${d.now}`);
    // 후보 지점의 전후를 그림으로 남긴다.
    for (const d of drops) {
      for (const when of [Math.max(0, d.at - step), d.at]) {
        const data = await page.evaluate(async at => {
          const v = document.getElementById('v'), c = document.getElementById('c');
          await new Promise(ok => { v.onseeked = ok; v.currentTime = at; });
          c.getContext('2d').drawImage(v, 0, 0);
          return c.toDataURL('image/jpeg', .8);
        }, when);
        fs.writeFileSync(path.join(outDir, `drop-${String(d.at).padStart(4, '0')}-at${String(when).padStart(4, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
      }
    }
    console.log('증거: ' + outDir);
  } finally {
    await browser.close();
    if (process.platform === 'win32') server.process().kill('SIGKILL'); else await server.close();
  }
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
