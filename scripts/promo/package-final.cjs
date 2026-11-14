// 스토어 업로드 최종 묶음: 실제 캡처로 교체한 휴대전화 4장 + 그래픽 이미지 + 아이콘 + 등록정보 글.
// 사용: node scripts/promo/package-final.cjs <나갈 폴더>   (먼저 compose.cjs --device 로 verification/promo/store-v3 를 찍어 둔다)
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2]);
const commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
const src = path.join(root, 'verification/promo/store-v3');
const dev = path.join(root, 'verification/promo/device');
const mk = d => (fs.mkdirSync(d, { recursive: true }), d);
const S = mk(path.join(out, 'sources'));
const fin = (a, b, w, h, max) => execFileSync('node', [path.join(root, 'scripts/store-finalize.cjs'), a, b, String(w), String(h), String(max)], { stdio: 'inherit' });
fin(path.join(src, 'feature-graphic-1024x500.png'), path.join(out, 'feature-graphic-1024x500.png'), 1024, 500, 1024 * 1024);
for (const n of [1, 2, 3, 4]) fin(path.join(src, `phone-0${n}.png`), path.join(out, `phone-0${n}.png`), 1080, 1920, 8 * 1024 * 1024);
fs.copyFileSync(path.join(root, 'assets/store/play-icon-512.png'), path.join(out, 'play-icon-512.png'));
fs.copyFileSync(path.join(root, 'docs/store/store-listing-ko.txt'), path.join(out, 'store-listing-ko.txt'));
const C = mk(path.join(S, 'device-captures-emulator'));
for (const n of [1, 2, 3, 4]) fs.copyFileSync(path.join(dev, `phone-${n}.png`), path.join(C, `phone-${n}.png`));
const G = mk(path.join(S, 'engine-gif-unedited'));
for (const f of ['bounce-excited.gif', 'shake-pouty.gif', 'part-wave-hello.gif', 'engine-motion.json']) fs.copyFileSync(path.join(root, 'assets/promo/motion', f), path.join(G, f));
const H = mk(path.join(S, 'html'));
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.html'))) fs.copyFileSync(path.join(src, f), path.join(H, f));
fs.copyFileSync(path.join(root, 'assets/promo/backup/emoti-promo-backup-mongi-day.zip'), path.join(S, 'emoti-promo-backup-mongi-day.zip'));
fs.writeFileSync(path.join(out, 'README.txt'), `emoti 이모티 · Play 스토어 그림 최종 묶음 (${commit})

올릴 파일
  feature-graphic-1024x500.png   스토어 등록정보 › 그래픽 › 그래픽 이미지
  phone-01.png ~ phone-04.png    스토어 등록정보 › 휴대전화 스크린샷(번호 순서)
  play-icon-512.png              앱 아이콘
  store-listing-ko.txt           등록정보 글

휴대전화 4장의 앱 화면 = 실제 캡처(대체 렌더 아님, DRAFT 없음)
  - 이 PC 의 Android 에뮬레이터(Android 14 x86_64, AVD emoti_promo_x86 — 사용자 휴대폰과 무관한 별도 테스트 기기)에서 앱을 실행해 찍었다.
  - 앱: 검토용 빌드와 같은 소스(앱 코드는 1b625a1 이후 변경 없음)를 에뮬레이터용(x86_64)으로만 다시 빌드.
    기존 arm64 APK 는 에뮬레이터의 ARM 변환에서 libreactnative.so 를 불러오지 못해 실행되지 않았다.
  - 데이터: sources/emoti-promo-backup-mongi-day.zip 을 앱의 '설정 › 백업에서 되살리기'로 실제 가져온 세트 '몽이의 하루'.
  - 화면: ① 02칸 움직이기(통통 선택, 세기 세게/속도 보통) ② 10칸 그리기 ③ 01칸 부분만 움직이기(손 회전) ④ 보드(12개 완성 / 32칸)
  - ③은 PRO 기능 — 검토용 빌드의 '검수용 PRO'를 켜고 찍었다(출시본에는 이 스위치가 없다).
  - 상태 표시줄(시계·아이콘)은 잘라 냈다. 원본 캡처: sources/device-captures-emulator/

위쪽 캐릭터 그림 = 홍보용 재구성(캐릭터 벡터 원본 + 앱 엔진이 계산한 움직임 값)
  - 통통: 같은 세로축(엔진 값 좌우 이동 0) · 부분 움직임: 손 레이어만 −30°/0°/+30°
  - 엔진 출력 그대로의 GIF: sources/engine-gif-unedited/
`);
console.log(out);
