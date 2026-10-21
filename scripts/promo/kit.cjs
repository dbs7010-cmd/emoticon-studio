// 출시 홍보 키트(2026-10-21, 대표 지시 "홍보 비주얼 바이럴 전부 최상위로 · 바로 업로드할 수 있게").
// 만드는 것(모두 실제 앱 화면·실제 녹화 — 합성 UI 없음):
//   reels/  1080×1920 세로 영상 5편 — 전부 '결과 먼저'(첫 1.6초 = 움직이는 캐릭터 + 훅 자막) · 끝 2초 이름 카드
//   carousel/ 1080×1350 인스타 캐러셀 6장 — "폰으로 움직이는 이모티콘 만드는 법" (저장·공유형)
//   profile/ 프로필 1080×1080 · 유튜브 배너 2560×1440(안전 영역 1546×423 안에 글자)
// 원본: <작업>/hero.webm(에뮬레이터 녹화 — 색 있는 콘 '폴짝→신남'), 기존 쇼츠(dist/promo-20261020/shorts, dist/promo-20261021),
//       앱 화면 캡처(docs/design/lesson-thumb-shots, <작업>/caps).
// 사용: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/promo/kit.cjs <나갈 폴더> <작업 폴더>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const [out, work] = process.argv.slice(2).map(p => path.resolve(p));
for (const d of ['reels', 'carousel', 'profile']) fs.mkdirSync(path.join(out, d), { recursive: true });
const INK = '#191F28', HI = '#FFE14D', RED = '#FF4D5E';
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const data = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const mascot = n => data(path.join(ROOT, 'assets/mascot', (/^(goguma|kong)-/.test(n) ? n : 'corn-' + n) + '.png'));
const shot = n => data(path.join(ROOT, 'docs/design/lesson-thumb-shots', n + '.png'));
const cap = n => data(path.join(work, 'caps', n + '.png'));
const FONT = '@font-face{font-family:Jua;src:url(data:font/ttf;base64,' + fs.readFileSync(path.join(ROOT, 'assets/fonts/Jua-Regular.ttf')).toString('base64') + ')}';
const rays = (c, ray = 'rgba(255,255,255,.16)', at = '50% 55%') => `background-color:${c};background-image:repeating-conic-gradient(from 0deg at ${at},${ray} 0deg 7deg,transparent 7deg 14deg)`;
const outlined = (size, extra = '') => `font-family:Jua;font-size:${size}px;line-height:${Math.round(size * 1.12)}px;color:#fff;-webkit-text-stroke:${Math.round(size * .14)}px ${INK};paint-order:stroke fill;text-shadow:0 ${Math.round(size * .09)}px 0 ${INK};${extra}`;
const hi = t => `<span style="color:${HI}">${t}</span>`;
const sticker = (n, s, x, y, rot, e = 9) => `<img src="${mascot(n)}" width="${s}" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${rot}deg);filter:drop-shadow(${e}px 0 0 #fff) drop-shadow(-${e}px 0 0 #fff) drop-shadow(0 ${e}px 0 #fff) drop-shadow(0 -${e}px 0 #fff) drop-shadow(${e}px ${e * 1.6}px 0 rgba(25,31,40,.22))">`;
const pill = (t, x, y, size = 40, bg = INK, fg = '#fff') => `<div style="position:absolute;left:${x}px;top:${y}px;height:${size * 2}px;padding:0 ${size * .8}px;border-radius:${size}px;background:${bg};color:${fg};font:800 ${size}px 'Malgun Gothic';display:flex;align-items:center;white-space:nowrap">${t}</div>`;
// 앱 화면 카드(실제 캡처를 잘라 둥근 카드에): src 1080폭 기준 cropTop·cropH
const screenCard = (img, { x, y, w, cropTop, cropH, rot = 0, ring }) => {
  const k = w / 1080, h = Math.round(cropH * k);
  const r = ring ? `<div style="position:absolute;left:${ring[0] * k}px;top:${(ring[1] - cropTop) * k}px;width:${ring[2] * k}px;height:${ring[3] * k}px;border:10px solid ${RED};border-radius:999px;box-sizing:border-box"></div>` : '';
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:44px;overflow:hidden;border:8px solid ${INK};background:#fff;transform:rotate(${rot}deg);box-shadow:22px 26px 0 rgba(25,31,40,.2)"><img src="${img}" style="position:absolute;left:0;top:${-cropTop * k}px;width:100%">${r}</div>`;
};

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage();
  const render = async (w, h, body, file, transparent = false) => {
    await page.setViewportSize({ width: Math.min(w, 2560), height: Math.min(h, 1920) });
    await page.setContent(`<!doctype html><html><head><style>${FONT}body{margin:0;background:transparent}</style></head><body><div id="a" style="position:relative;width:${w}px;height:${h}px;overflow:hidden">${body}</div></body></html>`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
    await page.locator('#a').screenshot({ path: file, omitBackground: transparent });
    return file;
  };
  const done = [];
  try {
    // ── 1. 릴스 5편 ──
    // 오프너(1.6초): 노란 방사 배경 + 움직이는 색 콘(실제 녹화 캔버스) 크게 + 훅 자막
    const HERO = { x: 90, y: 620, w: 900, h: 848 };
    const opener = async (id, hook) => {
      const frame = await render(1080, 1920, `<div style="position:absolute;inset:0;${rays(HI, 'rgba(255,255,255,.35)')};-webkit-mask:linear-gradient(#000,#000),linear-gradient(#000,#000);-webkit-mask-composite:xor;-webkit-mask-size:100% 100%,${HERO.w}px ${HERO.h}px;-webkit-mask-position:0 0,${HERO.x}px ${HERO.y}px;-webkit-mask-repeat:no-repeat"></div>
        <div style="position:absolute;left:${HERO.x - 14}px;top:${HERO.y - 14}px;width:${HERO.w + 28}px;height:${HERO.h + 28}px;border:14px solid ${INK};border-radius:60px;box-sizing:border-box"></div>
        <div style="position:absolute;left:0;right:0;top:150px;text-align:center;${outlined(124)}">${hook}</div>`, path.join(work, id + '-op.png'), true);
      const f = path.join(work, id + '-op.mp4');
      // hero.webm 1080×2400 → 캔버스 부분(위 440부터 1100) → 900×1060 로 맞춤
      ff(['-ss', '0.4', '-t', '1.6', '-i', path.join(work, 'hero.webm'), '-i', frame, '-filter_complex',
        `color=c=white:s=1080x1920:r=30[bg];[0:v]crop=1040:980:20:500,scale=${HERO.w}:${HERO.h},setsar=1,fps=30[v];[bg][v]overlay=${HERO.x}:${HERO.y}:shortest=1[b];[b][1:v]overlay=0:0,format=yuv420p`,
        '-an', '-c:v', 'libx264', '-crf', '18', '-r', '30', f]);
      return f;
    };
    const endCard = path.join(work, 'end.mp4');
    const endPng = await render(1080, 1920, `<div style="position:absolute;inset:0;${rays(HI, 'rgba(255,255,255,.35)')};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;text-align:center">
      <img src="${mascot('cheer')}" width="420" style="filter:drop-shadow(10px 0 0 #fff) drop-shadow(-10px 0 0 #fff) drop-shadow(0 10px 0 #fff) drop-shadow(0 -10px 0 #fff) drop-shadow(10px 16px 0 rgba(25,31,40,.2))">
      <div style="${outlined(160)}">emoti</div>
      <div style="${outlined(74)}">폰으로 만드는<br>${hi('움직이는 이모티콘')}</div>
      <div style="height:96px;padding:0 44px;border-radius:48px;background:${INK};color:#fff;font:800 44px 'Malgun Gothic';display:flex;align-items:center">Google Play · emoti 이모티</div>
      <div style="${outlined(52)}">#emoti로그린</div></div>`, path.join(work, 'end.png'));
    ff(['-loop', '1', '-t', '2', '-i', endPng, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '18', endCard]);
    const body = (src, from = 0, to) => { const f = path.join(work, path.basename(src, '.mp4') + `-b${from}.mp4`);
      ff(['-ss', String(from), ...(to ? ['-to', String(to)] : []), '-i', src, '-an', '-vf', 'fps=30,scale=1080:1920,setsar=1,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-r', '30', f]); return f; };
    const concat = (parts, dest) => { const list = dest + '.txt'; fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
      ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', dest]); fs.unlinkSync(list); done.push(dest); };
    const S1 = path.join(ROOT, 'dist/promo-20261020/shorts'), S2 = path.join(ROOT, 'dist/promo-20261021');
    // 01·02: 기획 A — 이미 결과 먼저(선 그림 콘 통통) → 끝 카드만 붙임
    concat([body(path.join(S2, 'short-a-hook-result.mp4')), endCard], path.join(out, 'reels', '01-선몇개가인사가-결과먼저.mp4'));
    concat([body(path.join(S2, 'short-a-hook-question.mp4')), endCard], path.join(out, 'reels', '02-선몇개가인사가-질문먼저.mp4'));
    // 03~05: 예전 쇼츠 — 앞에 결과 오프너, 예전 끝 카드(마지막 2.2초)는 빼고 새 끝 카드
    const dur = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
    const old = [['short-1-motion', '03-톡누르면움직여요', `내 그림이<br>${hi('이렇게 움직여요')}`],
                 ['short-2-lessons', '04-무료강좌10편', `그림 못 그려도<br>${hi('따라 하면 돼요')}`],
                 ['short-3-export', '05-한세트파일로', `이 캐릭터가<br>${hi('이모티콘 한 세트로')}`]];
    for (const [src, name, hook] of old) { const f = path.join(S1, src + '.mp4');
      concat([await opener(name, hook), body(f, 0, dur(f) - 2.2), endCard], path.join(out, 'reels', name + '.mp4')); }

    // ── 2. 캐러셀 6장(1080×1350) ──
    const C = (n, html) => render(1080, 1350, html, path.join(out, 'carousel', `${String(n).padStart(2, '0')}.png`)).then(f => done.push(f));
    const step = (n, total, bg, title, sub, card) => `<div style="position:absolute;inset:0;${rays(bg)}"></div>
      ${pill(`${n} / ${total}`, 56, 56, 34)}
      <div style="position:absolute;left:56px;top:170px;${outlined(92)}">${title}</div>
      ${pill(sub, 56, 390, 34)}${card}`;
    await C(1, `<div style="position:absolute;inset:0;${rays(HI, 'rgba(255,255,255,.35)')}"></div>
      <div style="position:absolute;left:0;right:0;top:120px;text-align:center;${outlined(118)}">폰 하나로<br>${hi('움직이는 이모티콘')}<br>만드는 법</div>
      ${sticker('wave', 470, 90, 640, -8)}${sticker('goguma-cheer', 360, 610, 760, 8)}
      ${pill('저장해 두고 따라 해 보세요 →', 210, 1220, 36)}`);
    await C(2, step(1, 4, '#3D8BFF', `손가락으로<br>${hi('그려요')}`, '펜·연필·마커 · 레이어로 나눠 그리기',
      screenCard(cap('a1'), { x: 150, y: 520, w: 780, cropTop: 470, cropH: 1050, rot: -3 })));
    await C(3, step(2, 4, '#8B7BFF', `효과를 ${hi('톡')}<br>고르면 움직여요`, '무료 6종 · 부분만 움직이기는 PRO',
      screenCard(cap('capture-01'), { x: 240, y: 510, w: 600, cropTop: 470, cropH: 1500, rot: 3, ring: [40, 1730, 240, 220] })));
    await C(4, step(3, 4, '#22B573', `칸을 모아<br>${hi('한 세트')}로`, '24~32칸 보드에서 한눈에',
      screenCard(cap('capture-05'), { x: 150, y: 520, w: 780, cropTop: 700, cropH: 1050, rot: -3 })));
    await C(5, step(4, 4, '#FF7A59', `${hi('제안 규격')}<br>파일로 내보내기`, '카카오 이모티콘 스튜디오 규격 파일 묶음',
      screenCard(shot('export'), { x: 150, y: 520, w: 780, cropTop: 1300, cropH: 1050, rot: 3, ring: [40, 1795, 1000, 160] })));
    await C(6, `<div style="position:absolute;inset:0;${rays(HI, 'rgba(255,255,255,.35)')}"></div>
      <div style="position:absolute;left:0;right:0;top:150px;text-align:center;${outlined(104)}">처음이어도 괜찮아요<br>${hi('무료 강좌 10편')}</div>
      ${screenCard(cap('capture-04'), { x: 190, y: 520, w: 700, cropTop: 300, cropH: 860, rot: -2 })}
      ${sticker('kong-cheer', 210, 840, 900, 10, 8)}
      <div style="position:absolute;left:0;right:0;top:1210px;text-align:center;${outlined(46)}">Google Play · emoti 이모티 · ${hi('#emoti로그린')}</div>`);

    // ── 3. 프로필 · 배너 ──
    done.push(await render(1080, 1080, `<div style="position:absolute;inset:0;background:${HI};display:flex;align-items:center;justify-content:center"><img src="${mascot('wave')}" width="820"></div>`, path.join(out, 'profile', 'profile-1080.png')));
    done.push(await render(2560, 1440, `<div style="position:absolute;inset:0;${rays(HI, 'rgba(255,255,255,.35)', '50% 50%')}"></div>
      <div style="position:absolute;left:507px;top:508px;width:1546px;height:423px;display:flex;align-items:center;justify-content:center;gap:50px">
        <img src="${mascot('wave')}" width="360" style="filter:drop-shadow(9px 0 0 #fff) drop-shadow(-9px 0 0 #fff) drop-shadow(0 9px 0 #fff) drop-shadow(0 -9px 0 #fff)">
        <div><div style="${outlined(150)}">emoti</div><div style="${outlined(70)}">폰으로 만드는 ${hi('움직이는 이모티콘')}</div></div>
        <img src="${mascot('goguma-cheer')}" width="260" style="filter:drop-shadow(8px 0 0 #fff) drop-shadow(-8px 0 0 #fff) drop-shadow(0 8px 0 #fff) drop-shadow(0 -8px 0 #fff)"></div>`, path.join(out, 'profile', 'youtube-banner-2560x1440.png')));
    for (const f of done) console.log(path.relative(ROOT, f));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stderr ? String(e.stderr) : e); process.exit(1); });
