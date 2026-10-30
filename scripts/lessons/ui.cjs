// 강좌 녹화용 화면 조작(2026-10-28, v24 화면). 좌표 대신 접근성 이름으로 누른다 — 화면 배치가 바뀌어도 녹화 대본이 그대로 돈다.
//   const u = require('./ui.cjs'); u.tap('새 세트 만들기'); u.waitFor('저장');
const r = require('./rec.cjs');
const { all, L } = require('./i18n-labels.cjs');
// 시스템 창(앱 응답 없음 · 알림 확인)의 버튼은 기기 언어를 따른다.
const SYSTEM = { Wait: ['Wait', '待機', '等待'], OK: ['OK', '確定'] };

// 지금 화면의 노드(이름 · 글자 · 위치). uiautomator 덤프를 바로 읽는다.
function nodes() {
  // 화면이 움직이는 중이면 덤프가 실패하고 예전 파일이 남는다 — 지우고 될 때까지 다시 뜬다.
  let xml = '';
  for (let i = 0; i < 16 && !xml.includes('<hierarchy'); i++) {
    r.adb(['shell', 'rm', '-f', '/sdcard/ui.xml']);
    try { r.adb(['shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], { stdio: ['ignore', 'pipe', 'ignore'] }); xml = r.adb(['shell', 'cat', '/sdcard/ui.xml'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8'); } catch { xml = ''; }
    if (!xml.includes('<hierarchy')) r.sleep(500);
  }
  // 계속 실패하면 빈 목록으로 넘기지 않는다 — '없음'으로 읽혀 창 닫기 같은 단계가 조용히 빠졌다(10-29).
  if (!xml.includes('<hierarchy')) throw new Error('화면 읽기 실패(uiautomator)');
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
  // 대본은 한국어 이름을 쓰고, 일본어·번체 녹화(LESSON_LANG)에서는 그 언어의 후보 이름 중 화면에 있는 것을 누른다.
  const names = SYSTEM[label] || all(label);
  const hit = nodes().filter(n => n.w > 0 && n.h > 0 && names.some(l => exact ? n.desc === l || n.text === l : n.desc.includes(l) || n.text.includes(l)));
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
  // 일본어·번체 녹화는 앱 언어만 바꾼다(에뮬레이터 시스템 언어는 그대로). 비운 뒤에도 다시 넣는다.
  const lang = process.env.LESSON_LANG || 'ko';
  r.adb(['shell', 'cmd', 'locale', 'set-app-locales', 'com.emoticonstudio.app', '--locales', { ko: 'ko-KR', ja: 'ja-JP', 'zh-Hant': 'zh-TW' }[lang]]);
  r.adb(['shell', 'monkey', '-p', 'com.emoticonstudio.app', '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
  // 첫 화면은 그림이 계속 움직여 화면 읽기(uiautomator)가 멈춰 있는 순간을 못 잡는다 — 시간으로 기다린 뒤 '시작하기' 자리를 누른다.
  // 데이터를 비운 첫 실행은 그림 엔진 준비로 시작 화면이 늦게(에뮬레이터 1분 가까이) 뜰 때가 있다 — 될 때까지 누르고 확인한다.
  const end = Date.now() + 120000;
  // 비운 뒤 첫 실행이 시작 그림에서 멈출 때가 있다(에뮬레이터) — 40초가 지나면 앱을 다시 띄운다.
  let since = Date.now();
  for (;;) { r.sleep(6000); r.tap(540, 2199, 2500); let home = false; try { if (has('Wait')) tap('Wait', 3000); home = has('새 세트 만들기'); } catch { /* 시작 그림이 움직이는 중 */ } if (home) break;   // 막 켠 에뮬레이터의 '응답 없음' 창은 기다리기 if (Date.now() > end) throw new Error('홈이 안 열림');
    if (Date.now() - since > 40000) { r.adb(['shell', 'am', 'force-stop', 'com.emoticonstudio.app']); r.adb(['shell', 'monkey', '-p', 'com.emoticonstudio.app', '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' }); since = Date.now(); } }
}
// 에뮬레이터가 느릴 때 뜨는 '저장이 늦어지고 있어요' 알림을 닫는다(화면 읽기가 안 되면 그냥 넘어간다).
function dismiss() { try { if (has('저장이 늦어지고 있어요')) { tap('OK', 1200); return true; } } catch { /* 화면이 움직이는 중 */ } return false; }
module.exports = { nodes, find, tap, has, waitFor, fresh, dismiss, L };
