// 에뮬레이터 화면 조작 도우미(홍보 캡처용). 사용자 기기가 아니라 이 PC 의 에뮬레이터에만 쓴다(-s 로 대상 고정).
//   node scripts/promo/adb-ui.cjs list                 화면의 글자·설명(content-desc) 목록
//   node scripts/promo/adb-ui.cjs tap <글자|설명> [n]   일치하는 n번째(기본 0) 요소 가운데를 누른다(정확히 일치 우선, 없으면 포함)
//   node scripts/promo/adb-ui.cjs wait <글자|설명> [초]  나타날 때까지 기다린다
//   node scripts/promo/adb-ui.cjs shot <png>           화면 캡처(PNG)
const { execFileSync } = require('child_process');
const fs = require('fs');
const ADB = 'C:\\Android\\Sdk\\platform-tools\\adb.exe';
const SERIAL = process.env.EMU_SERIAL || 'emulator-5554';
const adb = (args, opts = {}) => execFileSync(ADB, ['-s', SERIAL, ...args], { maxBuffer: 64 << 20, ...opts });
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function nodes() {
  adb(['shell', 'uiautomator', 'dump', '/sdcard/ui.xml']);
  const xml = adb(['shell', 'cat', '/sdcard/ui.xml']).toString('utf8');
  const out = [];
  for (const m of xml.matchAll(/<node [^>]*>/g)) {
    const a = k => (m[0].match(new RegExp(` ${k}="([^"]*)"`)) || [])[1] || '';
    const b = a('bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!b) continue;
    const dec = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#10;/g, ' ');
    out.push({ text: dec(a('text')), desc: dec(a('content-desc')), cls: a('class'), click: a('clickable') === 'true', x: (+b[1] + +b[3]) >> 1, y: (+b[2] + +b[4]) >> 1, b: b.slice(1).map(Number) });
  }
  return out;
}
function find(label, n = 0) {
  const all = nodes();
  const exact = all.filter(x => x.text === label || x.desc === label);
  const hits = exact.length ? exact : all.filter(x => (x.text && x.text.includes(label)) || (x.desc && x.desc.includes(label)));
  return hits[n];
}
const [cmd, arg, extra] = process.argv.slice(2);
if (cmd === 'list') for (const x of nodes()) { if (x.text || x.desc) console.log(`${x.click ? '*' : ' '} [${x.x},${x.y}] ${x.text ? 't:' + x.text : ''} ${x.desc ? 'd:' + x.desc : ''}`.slice(0, 160)); }
else if (cmd === 'tap') { const x = find(arg, +(extra || 0)); if (!x) { console.error('없음: ' + arg); process.exit(1); } adb(['shell', 'input', 'tap', String(x.x), String(x.y)]); console.log('tap', arg, x.x, x.y); }
else if (cmd === 'wait') { const until = Date.now() + 1000 * +(extra || 30); let x; while (!(x = find(arg)) && Date.now() < until) sleep(1000); if (!x) { console.error('시간 초과: ' + arg); process.exit(1); } console.log('보임', arg); }
else if (cmd === 'shot') { fs.writeFileSync(arg, adb(['exec-out', 'screencap', '-p'])); console.log(arg); }
else { console.error('명령: list | tap | wait | shot'); process.exit(2); }
