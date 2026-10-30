// 강좌 ⑩ '강좌 만드는 법'의 사진 두 장을 지금 강좌 화면에서 찍는다(2026-10-30). 예전 사진은 옛 강좌 화면 + 옛 콘 선 그림이었다.
//   step2: 강좌 '첫 세트' 2단계(영상 + 단계 설명) — 영상에서 선이 가장 많이 그려진 순간을 고른다.
//   step3: 같은 강좌 끝(핵심 정리 + 바로 해 보기).
// 실행: LESSON_LANG=ja node scripts/lessons/capture-lesson-photos.cjs  → assets/lessons/make-lesson/[ja/]step2.png · step3.png
// 준비: 폰 에뮬레이터(1080×2400)에 지금 검수 빌드(그 언어 강좌 영상이 들어 있어야 한다).
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { PNG } = require('pngjs');
const r = require('./rec.cjs'), u = require('./ui.cjs');
const lang = process.env.LESSON_LANG || 'ko';
const APP = 'com.emoticonstudio.app';
const out = name => r.langOut(path.join(__dirname, '..', '..', 'assets', 'lessons', 'make-lesson', name));
const shot = () => r.adb(['exec-out', 'screencap', '-p']);
// 1080×2400 화면에서 잘라 반으로 줄여 저장(예전 사진과 같은 540 폭).
function save(buf, name, y, h) {
  const tmp = path.join(r.RAW || 'C:/build-temp/lesson-raw', 'photo-' + lang + '-' + name);
  fs.writeFileSync(tmp, buf);
  execFileSync(r.FFMPEG, ['-y', '-loglevel', 'error', '-i', tmp, '-vf', `crop=1080:${h}:0:${y},scale=540:-1`, out(name)]);
  console.log('  ' + out(name));
}
// 영상 속 캔버스(화면 110~970 × 496~1356)의 갈색 선 픽셀 수.
function ink(buf) {
  const png = PNG.sync.read(buf); let n = 0;
  for (let y = 496; y < 1356; y += 2) for (let x = 110; x < 970; x += 2) {
    const k = (y * png.width + x) * 4; if (Math.abs(png.data[k] - 0x76) + Math.abs(png.data[k + 1] - 0x50) + Math.abs(png.data[k + 2] - 0x44) < 60) n++;
  }
  return n;
}

r.adb(['shell', 'cmd', 'locale', 'set-app-locales', APP, '--locales', { ko: 'ko-KR', ja: 'ja-JP', 'zh-Hant': 'zh-TW' }[lang]]);
r.adb(['shell', 'am', 'force-stop', APP]);
r.adb(['shell', 'monkey', '-p', APP, '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
r.sleep(14000);
u.tap('강좌', 3000);
r.tap(540, 713, 4000);                       // 맨 위 강좌 '첫 세트'
u.tap('다음 단계', 2500);                        // 2단계 · 그리기
let best = null, bestInk = -1;
for (let i = 0; i < 14; i++) { r.sleep(1500); const b = shot(), n = ink(b); if (n > bestInk) { best = b; bestInk = n; } }
console.log('  2단계 선 픽셀 ' + bestInk);
if (bestInk < 3000) throw new Error('영상 속 그림이 안 보인다');
save(best, 'step2.png', 120, 1800);
for (let i = 0; i < 3 && u.has('다음 단계'); i++) u.tap('다음 단계', 2500);
r.sleep(1500);
save(shot(), 'step3.png', 880, 840);
