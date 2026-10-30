// Google Play 소개 카드에 넣을 실제 앱 화면(2026-10-30). 강좌 녹화로 채운 세트(01 선 그림 · 02 색칠한 콘 + 하트 · 움직임 · 애니메이션)에서
// 그 언어 화면 다섯 장을 찍는다. Codex 카드 순서와 같다: 01 그리기 · 02 움직이기 · 03 보드 · 04 표현 가이드 · 05 내보내기.
// 실행: LESSON_LANG=ja node scripts/lessons/capture-store-screens.cjs  → verification/store-captures/<lang>/01~05.png (1080×2400 원본)
// 준비: record-first-set → brush-layer → motion → animation → export 를 그 언어로 찍은 직후(앱이 그 언어로 열려 있다).
const fs = require('node:fs'), path = require('node:path');
const r = require('./rec.cjs'), u = require('./ui.cjs');
const lang = process.env.LESSON_LANG || 'ko';
const dir = path.join(__dirname, '..', '..', 'verification', 'store-captures', lang);
fs.mkdirSync(dir, { recursive: true });
const shot = name => { fs.writeFileSync(path.join(dir, name), r.adb(['exec-out', 'screencap', '-p'])); console.log('  ' + lang + '/' + name); };
const APP = 'com.emoticonstudio.app';
// 앱을 다시 띄워 홈에서 시작한다(어느 화면에 있었든).
r.adb(['shell', 'am', 'force-stop', APP]);
r.adb(['shell', 'monkey', '-p', APP, '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
r.sleep(14000);
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);
r.tap(280, 1100, 5000);                       // 홈 첫 세트 → 보드
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);
shot('03-board.png');
r.tap(413, 860, 8000);                        // 02번 칸(색칠한 콘)
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);
shot('01-draw.png');
u.tap('움직이기', 3500);
r.sleep(2500);                                // 효과가 움직이는 중간 장면
shot('02-motion.png');
u.tap('그리기 닫기', 3000);
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);
u.tap('내보내기', 3500);
shot('05-export.png');
u.tap('뒤로', 2500);
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);
u.tap('표현 가이드', 3500);
shot('04-guide.png');
r.adb(['shell', 'input', 'keyevent', '4']); r.sleep(1500);
