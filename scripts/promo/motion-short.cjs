// 클릭 반응형 모션 쇼츠(HQ 요청 emoti-kon-motion-20261026, 2026-10-26) — 실제 앱 녹화로 만드는 15초 세로 영상.
// 장면표(노션): 0–2초 실제 효과 칸 누르기 → 2–5초 같은 결과를 확대 → 다음 효과 누르기 → 다른 동작 → 9–12초 고구마·완두콩 매치 컷
//   → 짧게 셋이 함께 → 첫 장면 효과로 돌아와 반복. 나레이션 없음 · 무음(음악은 HQ 편집에서).
// 실제 기능: 모든 캐릭터 움직임은 앱 '움직이기' 효과를 에뮬레이터에서 그대로 녹화한 것(scripts/promo/record-kon.cjs).
// 편집 효과(실제 기능 아님): 탭 위치 링 · 확대(크롭) · 컷 · 배경·글자 · 탭 뒤 효과가 켜지기까지 기다리는 시간 잘라냄.
// 사용: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/promo/motion-short.cjs <나갈 폴더> [원본 폴더=C:/build-temp/motion-raw]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { FFMPEG } = require('../lessons/rec.cjs');
const ROOT = path.resolve(__dirname, '..', '..');
const out = path.resolve(process.argv[2]);
const raw = path.resolve(process.argv[3] || 'C:/build-temp/motion-raw');
const work = path.join(out, 'work');
fs.mkdirSync(work, { recursive: true });
const ff = args => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

const INK = '#191F28', HI = '#FFE14D';
const CANVAS = { x: 24, y: 478, s: 1032 };     // 움직이기 화면의 캔버스(1080×2400 녹화 안 위치)
const FOCUS = { x: 176, y: 620, s: 760 };      // 확대할 곳: 캐릭터와 움직임 범위(점선 상자)만 — 캐릭터가 크게 보이게
const UI_TOP = 360;                             // 앱 화면 장면: 녹화의 y 360~2280 을 1080×1920 으로
const CARD = { x: 70, y: 470, s: 940 };         // 확대 장면: 캔버스를 이 크기로
// 장면표 — src 는 녹화 안의 초. kind: ui(앱 화면, 탭 링) · zoom(캔버스 확대) · trio(셋이 함께)
const SCENES = [
  { kind: 'ui', clip: 'kon', from: 2.1, dur: 0.9, tap: 0 },
  { kind: 'zoom', clip: 'kon', from: 4.6, dur: 2.8, label: '통통' },
  { kind: 'ui', clip: 'kon', from: 6.15, dur: 0.85, tap: 1 },
  { kind: 'zoom', clip: 'kon', from: 8.6, dur: 2.4, label: '폴짝' },
  { kind: 'ui', clip: 'kon', from: 10.15, dur: 0.85, tap: 2 },
  { kind: 'zoom', clip: 'kon', from: 12.6, dur: 1.9, label: '까딱' },
  { kind: 'zoom', clip: 'goguma', from: 4.6, dur: 1.9, label: '들썩' },
  { kind: 'zoom', clip: 'kong', from: 4.6, dur: 1.9, label: '폴짝' },
  { kind: 'trio', dur: 1.0 },
  { kind: 'zoom', clip: 'kon', from: 4.6, dur: 1.2, label: '통통' },
];
const taps = Object.fromEntries(['kon', 'goguma', 'kong'].map(n => [n, JSON.parse(fs.readFileSync(path.join(raw, n + '.json'), 'utf8')).taps]));
const src = n => path.join(raw, n + '.webm');

(async () => {
  // 1) 글자·배경 그림(Chrome) — 앱 화면이 아닌 편집 요소
  const FONT = '@font-face{font-family:Jua;src:url(data:font/ttf;base64,' + fs.readFileSync(path.join(ROOT, 'assets/fonts/Jua-Regular.ttf')).toString('base64') + ')}';
  const outlined = (size, extra = '') => `font-family:Jua;font-size:${size}px;line-height:${Math.round(size * 1.15)}px;color:#fff;-webkit-text-stroke:${Math.round(size * .14)}px ${INK};paint-order:stroke fill;text-shadow:0 ${Math.round(size * .08)}px 0 ${INK};${extra}`;
  const title = top => `<div style="position:absolute;left:0;right:0;top:${top}px;text-align:center"><div style="${outlined(120)}">이모티</div><div style="${outlined(52, 'margin-top:6px')}">내가 그린 그림을 <span style="color:${HI}">쉽게 움직이는</span> 앱</div></div>`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage();
  const png = async (w, h, body, file, transparent = true) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html><head><style>${FONT}body{margin:0;background:transparent}</style></head><body><div id="a" style="position:relative;width:${w}px;height:${h}px;overflow:hidden">${body}</div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#a').screenshot({ path: file, omitBackground: transparent });
  };
  const rays = `background-color:${HI};background-image:repeating-conic-gradient(from 0deg at 50% 52%,rgba(255,255,255,.4) 0deg 7deg,transparent 7deg 14deg)`;
  await png(1080, 1920, `<div style="position:absolute;inset:0;${rays}"></div>${title(70)}
    <div style="position:absolute;left:${CARD.x - 10}px;top:${CARD.y - 10}px;width:${CARD.s + 20}px;height:${CARD.s + 20}px;border-radius:56px;background:#fff;border:10px solid ${INK};box-sizing:border-box;box-shadow:18px 22px 0 rgba(25,31,40,.22)"></div>`, path.join(work, 'bg-zoom.png'), false);
  await png(1080, 1920, `<div style="position:absolute;inset:0;${rays}"></div>${title(70)}
    ${[0, 1, 2].map(i => `<div style="position:absolute;left:${28 + i * 348}px;top:700px;width:330px;height:330px;border-radius:36px;background:#fff;border:8px solid ${INK};box-sizing:border-box"></div>`).join('')}`, path.join(work, 'bg-trio.png'), false);
  // 앱 화면 장면 위쪽 띠(앱의 '효과를 고르면…' 안내 줄을 덮음 — 앱 조작 부분은 가리지 않음)
  await png(1080, 1920, `<div style="position:absolute;left:0;right:0;top:0;height:118px;background:${HI}"></div><div style="position:absolute;left:0;right:0;top:20px;text-align:center;${outlined(44)}">이모티 · 내가 그린 그림을 <span style="color:#fff">쉽게 움직이는</span> 앱</div>`, path.join(work, 'band.png'));
  for (const l of new Set(SCENES.filter(s => s.label).map(s => s.label)))
    await png(1080, 200, `<div style="position:absolute;left:0;right:0;top:20px;text-align:center"><span style="display:inline-block;padding:14px 46px;border-radius:80px;background:#fff;border:8px solid ${INK};font:900 64px 'Malgun Gothic';color:${INK}">${l}</span></div>`, path.join(work, `label-${l}.png`));
  // 탭 링(편집 효과): 실제로 누른 자리에 0.45초
  await png(220, 220, `<div style="position:absolute;left:20px;top:20px;width:160px;height:160px;border-radius:50%;border:12px solid #FF4D5E;box-sizing:border-box;box-shadow:0 0 0 8px rgba(255,255,255,.9)"></div>`, path.join(work, 'ring.png'));
  await browser.close();

  // 2) 장면별 조각(30fps, 1080×1920, 무음)
  const enc = ['-an', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium'];
  const parts = [];
  SCENES.forEach((s, i) => {
    const file = path.join(work, `part-${String(i).padStart(2, '0')}.mp4`);
    if (s.kind === 'ui') {
      const t = taps[s.clip][s.tap], at = Math.max(0, t.t - s.from);
      // 마지막 0.25초는 캔버스 쪽으로 밀어 들어가 다음 확대 장면과 이어짐(편집 효과)
      const z0 = s.dur - 0.25;
      ff(['-ss', String(s.from), '-t', String(s.dur), '-i', src(s.clip), '-loop', '1', '-i', path.join(work, 'ring.png'), '-loop', '1', '-i', path.join(work, 'band.png'), '-filter_complex',
        `[0:v]fps=30,crop=1080:1920:0:${UI_TOP},setpts=PTS-STARTPTS[ui];` +
        `[ui][1:v]overlay=${t.x - 110}:${t.y - UI_TOP - 110}:enable='between(t,${at.toFixed(2)},${(at + 0.45).toFixed(2)})'[r];` +
        `[r][2:v]overlay=0:0[b];` +
        `[b]scale=w='1080*(1+if(gt(t,${z0}),(t-${z0})/0.25*0.6,0))':h=-2:eval=frame,crop=1080:1920:'(in_w-1080)/2':'(in_h-1920)*${((CANVAS.y + CANVAS.s / 2 - UI_TOP) / 1920).toFixed(3)}'[v]`,
        '-map', '[v]', '-t', String(s.dur), ...enc, file]);
    } else if (s.kind === 'zoom') {
      // 확대 장면: 첫 0.2초 살짝 커지며 들어옴(편집 효과)
      ff(['-ss', String(s.from), '-t', String(s.dur), '-i', src(s.clip), '-loop', '1', '-i', path.join(work, 'bg-zoom.png'), '-loop', '1', '-i', path.join(work, `label-${s.label}.png`), '-filter_complex',
        `[0:v]fps=30,crop=${FOCUS.s}:${FOCUS.s}:${FOCUS.x}:${FOCUS.y},setpts=PTS-STARTPTS,scale=w='${CARD.s}*(0.9+0.1*min(1,t/0.2))':h=-2:eval=frame[c];` +
        `[1:v][c]overlay=x='${CARD.x}+(${CARD.s}-overlay_w)/2':y='${CARD.y}+(${CARD.s}-overlay_h)/2':shortest=1[b];[b][2:v]overlay=0:${CARD.y + CARD.s + 40}[v]`,
        '-map', '[v]', '-t', String(s.dur), ...enc, file]);
    } else {
      // 셋이 함께(짧게): 같은 시각의 세 녹화
      const c = (k, n) => `[${k}:v]fps=30,crop=${FOCUS.s}:${FOCUS.s}:${FOCUS.x}:${FOCUS.y},setpts=PTS-STARTPTS,scale=314:314[${n}]`;
      ff(['-ss', '5.4', '-t', String(s.dur), '-i', src('kon'), '-ss', '5.0', '-t', String(s.dur), '-i', src('goguma'), '-ss', '5.0', '-t', String(s.dur), '-i', src('kong'), '-loop', '1', '-i', path.join(work, 'bg-trio.png'), '-filter_complex',
        `${c(0, 'a')};${c(1, 'b')};${c(2, 'c')};[3:v][a]overlay=36:708:shortest=1[x];[x][b]overlay=384:708[y];[y][c]overlay=732:708[v]`,
        '-map', '[v]', '-t', String(s.dur), ...enc, file]);
    }
    parts.push(file);
  });
  // 3) 이어 붙이기 → 무음 1차 편집본
  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const final = path.join(out, 'emoti-motion-short-v1-silent.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', '-an', final]);
  // 장면표(실제 기능 / 편집 효과 구분)
  let t = 0;
  const rows = SCENES.map(s => { const a = t; t += s.dur; return { start: +a.toFixed(2), end: +t.toFixed(2), kind: s.kind, clip: s.clip || 'kon+goguma+kong', srcFrom: s.from ?? null,
    real: s.kind === 'ui' ? `실제 앱 화면 · '${taps[s.clip][s.tap].effect}' 칸 실제 탭` : s.kind === 'zoom' ? `실제 앱 '${s.label}' 효과 결과(캔버스 확대)` : '세 캐릭터 실제 효과 결과(같은 녹화)',
    edit: s.kind === 'ui' ? '탭 링 0.45초 · 위 글자 띠 · 끝 0.25초 확대 전환' : s.kind === 'zoom' ? '캔버스 크롭 확대 · 들어올 때 0.9→1배 · 배경·글자·효과 이름표' : '배경·배치' }; });
  fs.writeFileSync(path.join(out, 'scene-table.json'), JSON.stringify({ total: +t.toFixed(2), note: '탭 뒤 효과가 켜지기까지(에뮬레이터 약 1.5초)는 잘라냄', rows }, null, 1));
  console.log(path.relative(ROOT, final), t.toFixed(2) + 's');
})().catch(e => { console.error(e); process.exit(1); });
