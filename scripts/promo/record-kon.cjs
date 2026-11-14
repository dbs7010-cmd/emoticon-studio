// 클릭 반응형 모션 쇼츠(HQ 요청 emoti-kon-motion-20261026) 원본 녹화 — 에뮬레이터 전용.
// 움직이기 화면(동작 묶음이 열린 상태)에서 효과 칸을 차례로 누르고, 누른 시각을 기록한다(편집에서 탭 링을 그 시각·위치에 맞춘다).
// 캔버스가 움직이는 장면은 adb screenrecord 가 프레임을 놓쳐 에뮬레이터 자체 녹화를 쓴다(§62).
// 사용: node scripts/promo/record-kon.cjs <이름> <효과,효과,...>   효과 = 통통 둥실 까딱 폴짝 끄덕 꾸벅 들썩 살랑
const { execFileSync } = require('child_process');
const fs = require('fs');
const ADB = 'C:\\Android\\Sdk\\platform-tools\\adb.exe';
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const adb = (...a) => execFileSync(ADB, ['-s', 'emulator-5554', ...a]).toString();
// 동작 묶음 칸 위치(1080×2400 화면, 2026-10-26 vc16 실제 화면에서 잼)
const TILE = { 통통: [156, 1836], 둥실: [412, 1836], 까딱: [668, 1836], 폴짝: [926, 1836], 끄덕: [156, 2072], 꾸벅: [412, 2072], 들썩: [668, 2072], 살랑: [926, 2072] };
const [name, list] = process.argv.slice(2);
const effects = list.split(',');
const file = `C:/build-temp/motion-raw/${name}.webm`;
fs.mkdirSync('C:/build-temp/motion-raw', { recursive: true });
const hold = 3600, lead = 2600;
const total = Math.ceil((lead + effects.length * hold + 800) / 1000);
adb('emu', 'screenrecord', 'start', '--time-limit', String(total), file);
const t0 = Date.now();
sleep(lead);
const taps = [];
for (const e of effects) {
  const [x, y] = TILE[e];
  taps.push({ effect: e, x, y, t: (Date.now() - t0) / 1000 });
  adb('shell', 'input', 'tap', String(x), String(y));
  sleep(hold);
}
sleep(800);
adb('emu', 'screenrecord', 'stop');
sleep(1500);
fs.writeFileSync(`C:/build-temp/motion-raw/${name}.json`, JSON.stringify({ name, file, taps }, null, 1));
console.log(JSON.stringify(taps));
