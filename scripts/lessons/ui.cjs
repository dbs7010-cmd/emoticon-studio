// 강좌 녹화용 화면 조작(2026-10-28, v24 화면). 좌표 대신 접근성 이름으로 누른다 — 화면 배치가 바뀌어도 녹화 대본이 그대로 돈다.
//   const u = require('./ui.cjs'); u.tap('새 세트 만들기'); u.waitFor('저장');
const r = require('./rec.cjs');

// 지금 화면의 노드(이름 · 글자 · 위치). uiautomator 덤프를 바로 읽는다.
function nodes() {
  // 화면이 움직이는 중이면 덤프가 실패하고 예전 파일이 남는다 — 지우고 될 때까지 다시 뜬다.
  let xml = '';
  for (let i = 0; i < 8 && !xml.includes('<hierarchy'); i++) {
    r.adb(['shell', 'rm', '-f', '/sdcard/ui.xml']);
    try { r.adb(['shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], { stdio: ['ignore', 'pipe', 'ignore'] }); xml = r.adb(['shell', 'cat', '/sdcard/ui.xml'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8'); } catch { xml = ''; }
    if (!xml.includes('<hierarchy')) r.sleep(500);
  }
  const out = [];
  for (const m of xml.matchAll(/<node [^>]*>/g)) {
    const a = m[0], get = k => (a.match(new RegExp(k + '="([^"]*)"')) || [])[1] || '';
    const b = get('bounds').match(/\d+/g); if (!b) continue;
    const [x0, y0, x1, y1] = b.map(Number);
    out.push({ desc: get('content-desc'), text: get('text'), x: (x0 + x1) >> 1, y: (y0 + y1) >> 1, w: x1 - x0, h: y1 - y0 });
  }
  return out;
}
function find(label, { exact = true } = {}) {
  const hit = nodes().filter(n => n.w > 0 && n.h > 0 && (exact ? n.desc === label || n.text === label : n.desc.includes(label) || n.text.includes(label)));
  return hit[0] || null;
}
function tap(label, wait = 900, opts) {
  const n = find(label, opts);
  if (!n) throw new Error('화면에 없음: ' + label);
  r.tap(n.x, n.y, wait);
  return n;
}
function has(label, opts) { return !!find(label, opts); }
function waitFor(label, ms = 15000, opts) {
  const end = Date.now() + ms;
  for (;;) { if (find(label, opts)) return true; if (Date.now() > end) throw new Error('기다려도 안 나옴: ' + label); r.sleep(700); }
}
// 녹화 전 처음 상태: 앱 데이터를 비우고(에뮬레이터 전용) 첫 화면의 '시작하기'까지 지난 빈 홈.
function fresh() {
  r.adb(['shell', 'pm', 'clear', 'com.emoticonstudio.app']);
  r.adb(['shell', 'monkey', '-p', 'com.emoticonstudio.app', '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
  // 첫 화면은 그림이 계속 움직여 화면 읽기(uiautomator)가 멈춰 있는 순간을 못 잡는다 — 시간으로 기다린 뒤 '시작하기' 자리를 누른다.
  // 데이터를 비운 첫 실행은 그림 엔진 준비로 시작 화면이 늦게(에뮬레이터 1분 가까이) 뜰 때가 있다 — 될 때까지 누르고 확인한다.
  const end = Date.now() + 120000;
  // 비운 뒤 첫 실행이 시작 그림에서 멈출 때가 있다(에뮬레이터) — 40초가 지나면 앱을 다시 띄운다.
  let since = Date.now();
  for (;;) { r.sleep(6000); r.tap(540, 2199, 2500); if (has('새 세트 만들기')) break; if (Date.now() > end) throw new Error('홈이 안 열림');
    if (Date.now() - since > 40000) { r.adb(['shell', 'am', 'force-stop', 'com.emoticonstudio.app']); r.adb(['shell', 'monkey', '-p', 'com.emoticonstudio.app', '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' }); since = Date.now(); } }
}
module.exports = { nodes, find, tap, has, waitFor, fresh };
