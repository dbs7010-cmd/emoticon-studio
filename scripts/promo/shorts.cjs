// 출시 쇼츠(1080×1920, 9:16) — 실제 앱 화면 녹화 위에 제목 띠와 휴대폰 틀만 얹는다(합성 UI 없음). 2026-10-21.
// 틀 PNG(가운데 화면 자리는 투명)를 Chrome 으로 그리고, ffmpeg 로 영상을 그 자리에 넣는다. 끝 2초는 이름 카드.
// 사용: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/promo/shorts.cjs <나갈 폴더> <작업 폴더>
//   작업 폴더에 s1.mp4 · s2a.mp4 · s3.mp4(에뮬레이터 화면 녹화 1080×2400)가 있어야 한다. s2b 는 앱 강좌 영상 원본을 쓴다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const [out, work] = process.argv.slice(2).map(p => path.resolve(p));
fs.mkdirSync(out, { recursive: true });
const INK = '#191F28', HI = '#FFE14D';
const data = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const mascot = n => data(path.join(ROOT, 'assets/mascot', (/^(goguma|kong)-/.test(n) ? n : 'corn-' + n) + '.png'));
const FONT = '@font-face{font-family:Jua;src:url(data:font/ttf;base64,' + fs.readFileSync(path.join(ROOT, 'assets/fonts/Jua-Regular.ttf')).toString('base64') + ')}';
const backdrop = c => `background-color:${c};background-image:repeating-conic-gradient(from 0deg at 50% 60%,rgba(255,255,255,.14) 0deg 7deg,transparent 7deg 14deg)`;
const outlined = size => `font-family:Jua;font-size:${size}px;line-height:${Math.round(size * 1.1)}px;color:#fff;-webkit-text-stroke:${Math.round(size * .14)}px ${INK};paint-order:stroke fill;text-shadow:0 ${Math.round(size * .09)}px 0 ${INK}`;
const sticker = (n, s, x, y, rot) => `<img src="${mascot(n)}" width="${s}" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${rot}deg);filter:drop-shadow(8px 0 0 #fff) drop-shadow(-8px 0 0 #fff) drop-shadow(0 8px 0 #fff) drop-shadow(0 -8px 0 #fff) drop-shadow(8px 14px 0 rgba(25,31,40,.2))">`;
// 화면 자리(투명): x 168, y 520, 744×1300
const WIN = { x: 168, y: 520, w: 744, h: 1300 };
const frame = (bg, title, sub, a, b) => `<div style="position:relative;width:1080px;height:1920px;overflow:hidden;${backdrop(bg)};-webkit-mask:linear-gradient(#000,#000),linear-gradient(#000,#000);-webkit-mask-composite:xor;mask-composite:exclude;-webkit-mask-size:100% 100%,${WIN.w}px ${WIN.h}px;-webkit-mask-position:0 0,${WIN.x}px ${WIN.y}px;-webkit-mask-repeat:no-repeat">
  <div style="position:absolute;left:0;right:0;top:90px;text-align:center;${outlined(118)}">${title}</div>
  <div style="position:absolute;left:50%;top:400px;transform:translateX(-50%);height:76px;padding:0 32px;border-radius:22px;background:${INK};color:#fff;font:800 36px 'Malgun Gothic';display:flex;align-items:center;white-space:nowrap">${sub}</div>
  <div style="position:absolute;left:${WIN.x - 22}px;top:${WIN.y - 22}px;width:${WIN.w + 44}px;height:${WIN.h + 44}px;border-radius:64px;background:${INK}"></div>
  <div style="position:absolute;left:0;right:0;bottom:30px;text-align:center"><span style="${outlined(56)}">emoti</span></div>
</div>
<div style="position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none">${sticker(a, 230, 10, 1560, -8)}${sticker(b, 200, 870, 1610, 8)}</div>`;
const endCard = (bg) => `<div style="position:relative;width:1080px;height:1920px;overflow:hidden;${backdrop(bg)};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px">
  ${`<img src="${mascot('cheer')}" width="420" style="filter:drop-shadow(10px 0 0 #fff) drop-shadow(-10px 0 0 #fff) drop-shadow(0 10px 0 #fff) drop-shadow(0 -10px 0 #fff)">`}
  <div style="${outlined(150)}">emoti</div>
  <div style="${outlined(76)};text-align:center">폰으로 만드는<br><span style="color:${HI}">움직이는 이모티콘</span></div>
  <div style="height:90px;padding:0 40px;border-radius:45px;background:${INK};color:#fff;font:800 42px 'Malgun Gothic';display:flex;align-items:center">Google Play에서 'emoti 이모티'</div>
</div>`;

const SHORTS = [
  { id: 'short-1-motion', bg: '#3D8BFF', title: `내 그림이<br><span style="color:${HI}">톡! 움직여요</span>`, sub: '효과를 고르면 바로 미리 보기', a: 'cheer', b: 'kong-wave',
    clips: [{ file: 's1.mp4', crop: 'crop=1080:1887:0:250' }] },
  { id: 'short-2-lessons', bg: '#FF7A59', title: `처음이어도<br><span style="color:${HI}">무료 강좌 10편</span>`, sub: '앱 사용법부터 표정 그리기까지', a: 'wave', b: 'goguma-cheer',
    clips: [{ file: 's2a.mp4', crop: 'crop=1080:1887:0:150', to: 8 }, { file: path.join(ROOT, 'assets/lessons/first-set/step2.mp4'), crop: 'crop=iw:ih:0:0', pad: true }] },
  { id: 'short-3-export', bg: '#22B573', title: `한 세트로 모아<br><span style="color:${HI}">파일로 내보내기</span>`, sub: '카카오 제안 규격 파일 묶음까지', a: 'heart', b: 'goguma-wave',
    clips: [{ file: 's3.mp4', crop: 'crop=1080:1887:0:150' }] },
];

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1920 });
  const shot = async (html, file, transparent) => {
    await page.setContent(`<!doctype html><html><head><style>${FONT}body{margin:0;background:transparent}</style></head><body><div id="a" style="position:relative;width:1080px;height:1920px">${html}</div></body></html>`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
    await page.locator('#a').screenshot({ path: file, omitBackground: transparent });
  };
  try {
    for (const s of SHORTS) {
      const fr = path.join(work, s.id + '-frame.png'), end = path.join(work, s.id + '-end.png');
      await shot(frame(s.bg, s.title, s.sub, s.a, s.b), fr, true);
      await shot(endCard(s.bg), end, false);
      const parts = [];
      s.clips.forEach((c, i) => {
        const src = path.isAbsolute(c.file) ? c.file : path.join(work, c.file);
        const part = path.join(work, `${s.id}-p${i}.mp4`);
        const fit = c.pad ? `scale=${WIN.w}:-2,pad=${WIN.w}:${WIN.h}:0:(oh-ih)/2:color=0xF7F8FA` : `scale=${WIN.w}:${WIN.h}`;
        execFileSync('ffmpeg', ['-v', 'error', '-y', ...(c.to ? ['-t', String(c.to)] : []), '-i', src, '-i', fr, '-filter_complex',
          `color=c=0x191F28:s=1080x1920:r=30[bg];[0:v]${c.crop},${fit},setsar=1,fps=30[v];[bg][v]overlay=${WIN.x}:${WIN.y}:shortest=1[b];[b][1:v]overlay=0:0`,
          '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', '30', part]);
        parts.push(part);
      });
      const endPart = path.join(work, `${s.id}-end.mp4`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-t', '2.2', '-i', end, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', endPart]);
      parts.push(endPart);
      const list = path.join(work, `${s.id}-list.txt`);
      fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
      const dest = path.join(out, `${s.id}.mp4`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', dest]);
      console.log(path.relative(ROOT, dest), (fs.statSync(dest).size / 1024).toFixed(0) + 'KB');
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stderr ? String(e.stderr) : e); process.exit(1); });
