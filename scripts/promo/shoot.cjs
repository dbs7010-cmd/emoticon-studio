// HTML 을 Edge 헤드리스로 PNG 로 찍는다. 사용: node scripts/promo/shoot.cjs <html> <png> <폭> <높이> [배율]
// Edge 가 가끔 그림을 남기지 않고 끝난다(앞 실행의 프로필이 아직 잡혀 있을 때) — 실행마다 새 프로필, 없으면 다시 찍는다.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const [html, png, w, h, scale = '1'] = process.argv.slice(2);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const target = path.resolve(png);
if (fs.existsSync(target)) fs.unlinkSync(target);
for (let i = 0; i < 4 && !fs.existsSync(target); i++) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'emoti-shoot-'));
  try {
    execFileSync(edge, ['--headless=new', '--disable-gpu', '--user-data-dir=' + prof, '--hide-scrollbars', '--force-device-scale-factor=' + scale, '--virtual-time-budget=4000',
      `--window-size=${w},${h}`, '--screenshot=' + target, 'file:///' + path.resolve(html).replace(/\\/g, '/')], { stdio: 'ignore', timeout: 60000 });
  } catch {}
  // msedge.exe 는 실제 브라우저에 넘기고 바로 끝난다 — 파일이 생길 때까지 기다린다.
  for (let k = 0; k < 60 && !fs.existsSync(target); k++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
}
if (!fs.existsSync(target)) { console.error('찍지 못했다: ' + png); process.exit(1); }
console.log(png);
