// 바이럴 기획 A 「선 몇 개가 인사가 되기까지」(승인 2026-10-21) — 결과 먼저 · 루프 구성의 세로 쇼츠.
// 장면: ① 0~1.6초 완성된 캐릭터가 통통(결과 먼저) ② 빈 칸에서 손가락으로 그리는 과정(실제 녹화, 빠르게) ③ '움직이기' → 통통 고르기
//       ④ 다시 통통(끝 = 처음, 반복 시청) . 화면은 모두 에뮬레이터 실제 녹화(합성 UI 없음). 자막은 위 띠에 2줄 이내.
// 원본: <작업>/draw.mp4(adb screenrecord, 그리기 — 정지 그림이라 adb 로도 충분) · <작업>/bounce.webm(에뮬레이터 녹화, 움직이는 캔버스)
//       · <작업>/tab.mp4(움직이기 탭으로 넘어가는 장면). 버전 2개: hook-result(결과 먼저) · hook-question(질문 먼저).
// 사용: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/promo/short-a.cjs <나갈 폴더> <작업 폴더>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const [out, work] = process.argv.slice(2).map(p => path.resolve(p));
fs.mkdirSync(out, { recursive: true });
const INK = '#191F28', HI = '#FFE14D';
const FONT = '@font-face{font-family:Jua;src:url(data:font/ttf;base64,' + fs.readFileSync(path.join(ROOT, 'assets/fonts/Jua-Regular.ttf')).toString('base64') + ')}';
const outlined = size => `font-family:Jua;font-size:${size}px;line-height:${Math.round(size * 1.12)}px;color:#fff;-webkit-text-stroke:${Math.round(size * .14)}px ${INK};paint-order:stroke fill;text-shadow:0 ${Math.round(size * .09)}px 0 ${INK}`;
const hi = t => `<span style="color:${HI}">${t}</span>`;
// 화면: 1080×1920. 위 380px = 자막 띠(노랑), 아래 = 앱 화면(1080 폭, 캔버스 부분 위주로 잘라 1540px)
const TOP = 380, APP_H = 1540;
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);

// 원본 앱 영상(1080×2400) → 캔버스 중심으로 자른 1080×1540
const crop = 'crop=1080:1540:0:300';
const seg = (name, src, { ss, t, speed = 1, extra = '' }) => {
  const f = path.join(work, name + '.mp4');
  ff(['-ss', String(ss), '-t', String(t), '-i', src, '-an', '-vf', `${crop},setpts=PTS/${speed},fps=30,scale=1080:1540,setsar=1${extra}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', f]);
  return f;
};

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage();
  const band = async (html, file, bg = HI) => {
    await page.setViewportSize({ width: 1080, height: TOP });
    await page.setContent(`<!doctype html><html><head><style>${FONT}body{margin:0}</style></head><body><div id="a" style="width:1080px;height:${TOP}px;background:${bg};display:flex;align-items:center;justify-content:center;text-align:center">${html}</div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#a').screenshot({ path: file });
  };
  try {
    // 자막 띠들
    const bands = {
      result: `<div style="${outlined(104)}">이거 ${hi('폰으로')} 그렸어요</div>`,
      question: `<div style="${outlined(96)}">선 몇 개가<br>${hi('인사')}가 될까?</div>`,
      draw: `<div style="${outlined(96)}">손가락으로 ${hi('쓱쓱')}</div>`,
      tap: `<div style="${outlined(96)}">'움직이기'에서 ${hi('톡')}</div>`,
      done: `<div style="${outlined(84)}">내 그림이 ${hi('인사해요')}<br><span style="font-size:52px">emoti · Google Play</span></div>`,
    };
    for (const [k, h] of Object.entries(bands)) await band(h, path.join(work, `band-${k}.png`));
    // 장면 조각(실제 녹화)
    const bounce = path.join(work, 'bounce.webm'), draw = path.join(work, 'draw.mp4'), tab = path.join(work, 'tab.mp4');
    const pieces = {
      bounceA: seg('p-bounce-a', bounce, { ss: 2.0, t: 1.6 }),          // 결과 먼저
      drawFast: seg('p-draw', draw, { ss: 2.5, t: 110, speed: 18 }),    // 약 6초(실제 그리기 1:50 → 18배)
      tab: seg('p-tab', tab, { ss: 1.0, t: 2.2 }),                       // 움직이기 탭으로
      bounceB: seg('p-bounce-b', bounce, { ss: 2.0, t: 3.2 }),          // 다시 통통(끝 = 처음)
    };
    const stack = (piece, bandPng, name) => {
      const f = path.join(work, name + '.mp4');
      ff(['-i', piece, '-i', bandPng, '-filter_complex', `[1:v]scale=1080:${TOP}[b];[b][0:v]vstack=2,format=yuv420p`, '-c:v', 'libx264', '-crf', '18', '-r', '30', f]);
      return f;
    };
    const versions = {
      'short-a-hook-result': ['result', 'draw', 'tap', 'done'],
      'short-a-hook-question': ['question', 'draw', 'tap', 'done'],
    };
    for (const [id, [first, ...rest]] of Object.entries(versions)) {
      const parts = [
        stack(pieces.bounceA, path.join(work, `band-${first}.png`), `${id}-0`),
        stack(pieces.drawFast, path.join(work, `band-${rest[0]}.png`), `${id}-1`),
        stack(pieces.tab, path.join(work, `band-${rest[1]}.png`), `${id}-2`),
        stack(pieces.bounceB, path.join(work, `band-${rest[2]}.png`), `${id}-3`),
      ];
      const list = path.join(work, id + '.txt');
      fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
      const dest = path.join(out, id + '.mp4');
      ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', dest]);
      console.log(path.relative(ROOT, dest), (fs.statSync(dest).size / 1024).toFixed(0) + 'KB');
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stderr ? String(e.stderr) : e); process.exit(1); });
