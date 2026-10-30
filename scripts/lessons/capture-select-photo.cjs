// 강좌 '브러시 · 레이어 · 색' 4단계 사진(고른 부분 판)을 그 언어 화면으로 찍는다(2026-10-30).
// 준비: 강좌 녹화를 마친 세트(02번 칸 = 색칠한 콘 + 레이어 2 하트 · 애니메이션 2장)가 홈 첫 세트.
// 실행: LESSON_LANG=ja node scripts/lessons/capture-select-photo.cjs  → assets/lessons/brush-layer/[ja/]step4.png
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const r = require('./rec.cjs'), u = require('./ui.cjs');
const lang = process.env.LESSON_LANG || 'ko';
const APP = 'com.emoticonstudio.app';
r.adb(['shell', 'cmd', 'locale', 'set-app-locales', APP, '--locales', { ko: 'ko-KR', ja: 'ja-JP', 'zh-Hant': 'zh-TW' }[lang]]);
r.adb(['shell', 'am', 'force-stop', APP]);
r.adb(['shell', 'monkey', '-p', APP, '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
r.sleep(14000);
r.tap(280, 1100, 5000);                 // 홈 첫 세트 → 보드
r.tap(413, 860, 8000);                  // 02번 칸
u.tap('선택', 2000);
u.tap('레이어', 1500); u.tap('레이어 2 선택', 1000); u.tap('레이어 닫기', 1200);
r.swipe(780, 1010, 970, 1200, 800, 3000);   // 하트를 네모로 고른다
if (!u.has('적용')) throw new Error('고른 부분 판이 안 열림');
const tmp = path.join('C:/build-temp/lesson-raw', 'select-' + lang + '.png');
fs.writeFileSync(tmp, r.adb(['exec-out', 'screencap', '-p']));
const out = r.langOut(path.join(__dirname, '..', '..', 'assets', 'lessons', 'brush-layer', 'step4.png'));
// 예전 사진과 같은 자리·크기: 화면 620~1961 을 2/3 로(720×894).
execFileSync(r.FFMPEG, ['-y', '-loglevel', 'error', '-i', tmp, '-vf', 'crop=1080:1341:0:620,scale=720:894', out]);
console.log('  ' + out);
u.tap('취소', 1500);
