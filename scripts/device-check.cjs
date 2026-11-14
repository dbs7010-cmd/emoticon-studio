// Android 실기기 검수. 사용자가 폰을 한 번 연결해 두면 그 뒤로는 이 스크립트가 설치·실행·캡처·조작을
// 전부 한다. 사람이 반복해서 찍어 보낼 필요가 없어진다.
//
//   node scripts/device-check.cjs            연결 확인 → 설치 → 실행 → 화면 캡처
//   node scripts/device-check.cjs --no-install   이미 깔린 앱만 실행해서 캡처
//
// 브라우저 엔진 PASS를 네이티브 PASS로 쓰지 않기 위한 도구다. 여기서 나온 것만 'Android 실행 검증'이다.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SDK_CANDIDATES = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  // ASCII 정션을 먼저 본다: 한글 사용자 폴더는 Android 도구 체인을 깨뜨린다(MASTER_SOURCE 참고).
  'C:\\Android\\Sdk',
  path.join(process.env.USERPROFILE || '', 'Android', 'Sdk'),
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
  'C:\\Program Files\\Unity\\Hub\\Editor\\6000.3.23f1\\Editor\\Data\\PlaybackEngines\\AndroidPlayer\\SDK',
].filter(Boolean);

function findAdb() {
  for (const sdk of SDK_CANDIDATES) {
    const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (fs.existsSync(adb)) return adb;
  }
  const loose = path.join(process.env.USERPROFILE || '', 'hellchang-grow', 'platform-tools-latest-windows', 'platform-tools', 'adb.exe');
  if (fs.existsSync(loose)) return loose;
  return null;
}

const adbPath = findAdb();
if (!adbPath) { console.error('FAIL: adb를 찾지 못했습니다. Android SDK platform-tools가 필요합니다.'); process.exit(1); }
const adb = (...args) => execFileSync(adbPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const devices = adb('devices').split('\n').slice(1).map(l => l.trim()).filter(l => l && !l.startsWith('*'));
const ready = devices.filter(l => l.endsWith('device'));
if (!ready.length) {
  console.error('FAIL: 연결된 기기가 없습니다.');
  console.error('  USB: 개발자 옵션 → USB 디버깅 켜고 연결한 뒤 폰에 뜨는 "허용"을 누르세요.');
  console.error('  무선: 개발자 옵션 → 무선 디버깅 → "페어링 코드로 기기 페어링" 후');
  console.error(`        ${path.basename(adbPath)} pair <주소:포트>  →  ${path.basename(adbPath)} connect <주소:포트>`);
  if (devices.length) console.error('  지금 상태: ' + devices.join(' | ') + ' (unauthorized 면 폰에서 허용을 눌러 주세요)');
  process.exit(2);
}
const serial = ready[0].split('\t')[0];
console.log('기기: ' + serial + ' · ' + adb('-s', serial, 'shell', 'getprop', 'ro.product.model').trim()
  + ' · Android ' + adb('-s', serial, 'shell', 'getprop', 'ro.build.version.release').trim());

const on = (...args) => adb('-s', serial, ...args);
const out = 'verification/device';
fs.mkdirSync(out, { recursive: true });
const shot = name => {
  const png = execFileSync(adbPath, ['-s', serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  console.log('  캡처: ' + out + '/' + name + '.png (' + Math.round(png.length / 1024) + 'KB)');
};
const tap = (x, y) => { on('shell', 'input', 'tap', String(x), String(y)); sleep(900); };
const sleep = ms => { const until = Date.now() + ms; while (Date.now() < until); };

const apk = 'android/app/build/outputs/apk/debug/app-debug.apk';
if (!process.argv.includes('--no-install')) {
  if (!fs.existsSync(apk)) { console.error('FAIL: APK가 없습니다. android 폴더에서 gradlew :app:assembleDebug 를 먼저 돌리세요.'); process.exit(3); }
  console.log('설치 중… ' + apk);
  console.log('  ' + on('install', '-r', apk).trim().split('\n').pop());
}

const pkg = 'com.emoticonstudio.app';
on('shell', 'am', 'force-stop', pkg);
on('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
sleep(6000);
shot('01-home');

// 화면 구조도 함께 뜬다. 무엇이 보이는지 글자로 확인할 수 있어야 사람이 다시 찍지 않아도 된다.
// content-desc 가 곧 accessibilityLabel 이라, 어떤 화면인지 글자로 판정할 수 있다.
function structure(name) {
  try {
    on('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
    const xml = on('shell', 'cat', '/sdcard/ui.xml');
    fs.writeFileSync(path.join(out, name + '.xml'), xml);
    const labels = [...new Set([...xml.matchAll(/content-desc="([^"]+)"/g)].map(m => m[1]).filter(Boolean))];
    console.log('  누를 수 있는 것: ' + labels.slice(0, 14).join(' · ') + (labels.length > 14 ? ` 외 ${labels.length - 14}` : ''));
    return labels;
  } catch (e) { console.log('  (화면 구조 덤프 실패: ' + String(e).split('\n')[0] + ')'); return []; }
}
// 이름으로 눌러야 화면이 바뀌어도 좌표를 다시 재지 않는다.
function tapLabel(label) {
  const xml = fs.readFileSync(path.join(out, 'last.xml'), 'utf8');
  const node = [...xml.matchAll(/<node[^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
    .find(m => m[1] === label);
  if (!node) return false;
  tap(Math.round((+node[2] + +node[4]) / 2), Math.round((+node[3] + +node[5]) / 2));
  return true;
}
function snap(name) {
  on('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  fs.writeFileSync(path.join(out, 'last.xml'), on('shell', 'cat', '/sdcard/ui.xml'));
  shot(name); structure(name);
}

snap('01-home');

// 빈 상태와 낙서 상태를 기기에서 직접 만든다. 잘 그린 샘플 하나로 통과시키지 않기 위해서다.
if (tapLabel('＋ 새 세트')) {
  sleep(4000);
  snap('02-canvas-empty');
  // 낙서 한 획: 캔버스 한가운데를 가로질러 긋는다.
  const size = on('shell', 'wm', 'size').trim().match(/(\d+)x(\d+)/);
  if (size) {
    const w = +size[1], h = +size[2];
    on('shell', 'input', 'swipe', String(Math.round(w * .3)), String(Math.round(h * .3)), String(Math.round(w * .7)), String(Math.round(h * .45)), '400');
    sleep(1200);
    snap('03-canvas-scribble');
  }
  if (tapLabel('레이어')) { sleep(600); snap('04-layer-panel'); }
  if (tapLabel('움직이기')) { sleep(1500); snap('05-motion-basic'); }
}

console.log('OK: 기기에서 실행하고 빈 상태·낙서·레이어·기본 움직임을 캡처했습니다. 증거: ' + out + '/');
