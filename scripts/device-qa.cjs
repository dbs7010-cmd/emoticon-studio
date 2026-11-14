#!/usr/bin/env node
// Round 39 실기기 검수 러너 — ADB(무선 디버깅 포함)로 연결된 Android 기기 한 대를 현재 UI(38.5차) 기준으로 직접 조작한다.
//
// 설계
//   - 추가 설치 없음: adb 만 쓴다. 화면 요소는 `uiautomator dump` 의 content-desc(= accessibilityLabel)로 찾고,
//     누르기·끌기는 `input tap/swipe`, 증거는 `screencap` PNG 와 logcat 으로 남긴다.
//   - 합격을 꾸미지 않는다. 단계마다 ok / fail / skipped(이유) 를 report.json 에 남기고, 한 단계가 막혀도 다음으로 간다.
//   - 이 파일이 쓰는 모든 라벨은 `--dry` 로 소스(App.tsx · painter · motion-panel)에 실제로 있는지 검사한다.
//     UI 가 바뀌어 라벨이 사라지면 기기에 붙기 전에 여기서 먼저 실패한다(npm test 의 device-qa-labels 검사).
//
// 쓰는 법(PC 에서)
//   node scripts/device-qa.cjs --dry                           라벨 자기검사(기기 불필요)
//   node scripts/device-qa.cjs --pair HOST:PORT CODE           무선 디버깅 페어링(기기 화면의 '페어링 코드로 기기 페어링')
//   node scripts/device-qa.cjs --connect HOST:PORT             무선 디버깅 연결
//   node scripts/device-qa.cjs --run [--apk path] [--serial S] 설치 → 시작 배경 → 홈 → 그리기 → 굵기 → 색 → 문구 → 움직이기 → 보드 → 내보내기
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE = 'com.emoticonstudio.app';
const ACTIVITY = `${PACKAGE}/.MainActivity`;
const ADB = process.env.ADB || path.join(process.env.ANDROID_HOME || 'C:\\Android\\Sdk', 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');

// 현재 UI 라벨(38.5차). 옛 라벨(펜 굵기·저장·제출 준비·문구 위치 조절·움직임 적용·＋ 새 세트)은 쓰지 않는다.
const L = {
  newSet: '새 세트 만들기',fromImage: '내 그림으로 시작', settings: '설정', proEntry: 'PRO 보기',
  toolPen: '그리기 도구 펜', toolEraser: '지우개', toolFill: '채우기', toolSelect: '선택', color: '색',
  brushAll: '브러시 전체', quickPen: '기본 펜', favPin: '즐겨찾기에 고정 크레용',
  tabDraw: '그리기', tabMotion: '움직이기', reference: '참고', layers: '레이어', caption: '문구',
  complete: '저장', close: '그리기 닫기', more: '더보기', undo: '되돌리기', redo: '다시 실행',
  brushClose: '브러시 닫기', pencil: '연필', brushVariant: '브러시 자연 잉크', proBrush: '브러시 크레용', brushDetail: '세부 설정',
  brushSize: '브러시 굵기', eraserSize: '지우개 굵기',
  swatch: '색 #54A9E8', recentPrefix: '최근 색 ', paletteClose: '팔레트 닫기',
  previousStart: '이전 칸 그림으로 시작', previousSkip: '이전 칸 그림 안 쓰기',
  captionInput: '문구 내용', captionApply: '문구 적용', captionEditAgain: '문구 내용 고치기', captionDone: '문구 선택 끝', captionClose: '문구 닫기',
  presetNone: '움직임 없음', presetBounce: '통통', presetShake: '흔들기', presetPulse: '두근거리기', captionMoves: '글씨도 같이 움직이기',
  previousMotion: '직전 칸 움직임 다시 쓰기', parts: '부분만 움직이기', proClose: 'PRO 닫기',
  back: '뒤로', setMenu: '세트 메뉴', continueDraw: '이어서 그리기', firstDraw: '첫 칸 그리기', exportEntry: '내보내기',
  makeBundle: '파일 묶음 만들기', detailsOpen: '자세히 보기', detailsClose: '자세히 접기', saveMark: '저장됨',
};
// 소스에 없어도 되는 라벨(동적으로 조립되는 것). 접두사만 소스에 있으면 된다.
const DYNAMIC = new Set(['swatch', 'recentPrefix', 'saveMark']);

function labelsMissingFromSource() {
  const source = ['App.tsx', 'src/painter/painter.tsx', 'src/painter/motion-panel.tsx', 'src/components/ui.tsx'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  return Object.entries(L).filter(([key, label]) => {
    if (key === 'swatch') return !source.includes("'색 ' + c");
    if (key === 'recentPrefix') return !source.includes("'최근 색 ' + c");
    if (key === 'saveMark') return !source.includes("'저장됨'");
    // 브러시 이름은 목록에서 '브러시 ' + 이름으로 조립된다. 접두사와 그 이름이 소스에 있으면 된다.
    // 45.34: 압정을 견본마다 겹쳐 두지 않고 '즐겨찾기 편집' 모드로 옮겼다(§6). 고정하는 자리는
    // 줄을 누른 뒤 뜨는 '1·2·3번 칸' 이므로, 확인할 것은 그 편집 길이 소스에 있는가다.
    if (key === 'favPin') return !(source.includes("'즐겨찾기 편집'") && source.includes("'즐겨찾기에 넣기 '"));
    if (key === 'brushVariant' || key === 'proBrush')
      return !(source.includes("+ b.title") && source.includes("'브러시 '") && source.includes("'" + label.replace('브러시 ', '') + "'"));
    // 시트 제목이 모드에 따라 바뀌므로(브러시 / 즐겨찾기 편집) 닫기 이름을 따로 넘긴다.
    if (key === 'brushClose') return !source.includes('closeLabel="브러시 닫기"');
    return !(source.includes(`"${label}"`) || source.includes(`'${label}'`) || source.includes(`>${label}<`) || source.includes(`\`${label}\``) || new RegExp(`[\\['"]${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(source));
  }).map(([key, label]) => `${key}=${label}`);
}

// ── adb ──────────────────────────────────────────────────────────────────────────────────────
let SERIAL = process.env.ANDROID_SERIAL || '';
const adb = (args, opts = {}) => execFileSync(ADB, [...(SERIAL ? ['-s', SERIAL] : []), ...args], { encoding: opts.binary ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: opts.timeout ?? 60000 });
const shell = cmd => adb(['shell', cmd]);
const sleep = ms => spawnSync(process.execPath, ['-e', `setTimeout(()=>{},${ms})`]);

// ── PNG(8-bit RGB/RGBA) 판독: 어두운 화소 비율로 검은 화면을 잡는다 ────────────────────────────
function decodePng(buf) {
  let p = 8, width = 0, height = 0, type = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); type = data[9]; if (data[8] !== 8) throw new Error('8-bit PNG only'); }
    if (kind === 'IDAT') idat.push(data);
    if (kind === 'IEND') break;
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error('RGB/RGBA PNG only');
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * bpp, out = Buffer.alloc(width * height * bpp);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), prev = y ? out.subarray((y - 1) * stride, y * stride) : null, cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0;
      const pr = a + b - c, pa = Math.abs(pr - a), pb = Math.abs(pr - b), pc = Math.abs(pr - c);
      cur[x] = (row[x] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0)) & 255;
    }
  }
  return { width, height, bpp, data: out };
}
// 두 캡처 사이 화면 세로 구간 [y0, y1](비율)에서 바뀐 화소 비율 — 미리보기가 실제로 움직이는지.
function regionChange(a, b, y0, y1) {
  let changed = 0, n = 0;
  for (let y = Math.floor(a.height * y0); y < Math.floor(a.height * y1); y += 6) for (let x = 0; x < a.width; x += 6) {
    const i = (y * a.width + x) * a.bpp; n++;
    if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 36) changed++;
  }
  return n ? Number((changed / n).toFixed(4)) : 0;
}
function darkRatio(png) {
  let dark = 0, n = 0;
  for (let i = 0; i < png.data.length; i += png.bpp * 16) { n++; if (png.data[i] < 40 && png.data[i + 1] < 40 && png.data[i + 2] < 40) dark++; }
  return n ? dark / n : 0;
}

// ── 화면 요소 ────────────────────────────────────────────────────────────────────────────────
// 계속 움직이는 화면(움직이기 효과 견본)에서는 uiautomator 가 idle 을 못 잡고 **이전 덤프 파일**을 남긴다.
// 옛 파일을 지우고, 실패하면 다시 시도하고, 끝내 못 읽으면 조용히 옛 화면을 쓰지 않고 busy 오류를 낸다.
function nodes() {
  let xml = '';
  for (let i = 0; i < 3 && !xml; i++) {
    const out = shell('rm -f /sdcard/emoticon-ui.xml; uiautomator dump /sdcard/emoticon-ui.xml 2>&1; true');
    if (!/could not get idle state|ERROR/.test(out)) { const text = shell('cat /sdcard/emoticon-ui.xml 2>/dev/null; true'); if (text.includes('<hierarchy')) xml = text; }
    if (!xml) sleep(700);
  }
  if (!xml) { const e = new Error('화면 요소를 읽지 못함(계속 움직이는 화면 — uiautomator idle 없음)'); e.busy = true; throw e; }
  return [...xml.matchAll(/<node [^>]*>/g)].map(m => {
    const attr = name => (m[0].match(new RegExp(`${name}="([^"]*)"`)) || [])[1] ?? '';
    const b = attr('bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/) || [0, 0, 0, 0, 0];
    return { desc: attr('content-desc'), text: attr('text'), cls: attr('class'), clickable: attr('clickable') === 'true', x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4] };
  });
}
const find = (label, list = nodes()) => list.find(n => n.desc === label) || list.find(n => n.text === label);
const center = n => ({ x: Math.round((n.x1 + n.x2) / 2), y: Math.round((n.y1 + n.y2) / 2) });

// ── 보고 ─────────────────────────────────────────────────────────────────────────────────────
function runner(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const report = { startedAt: new Date().toISOString(), steps: [] };
  const shot = name => { try { const png = adb(['exec-out', 'screencap', '-p'], { binary: true }); fs.writeFileSync(path.join(outDir, name + '.png'), png); return png; } catch { return null; } };
  const step = (name, fn) => {
    const started = Date.now();
    try { const detail = fn(); report.steps.push({ name, status: 'ok', ms: Date.now() - started, detail: detail ?? null }); shot(name); }
    catch (e) { report.steps.push({ name, status: 'fail', ms: Date.now() - started, error: String(e.message || e) }); shot(name + '-fail'); }
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  };
  const tap = label => { const n = find(label); if (!n) throw new Error('보이지 않음: ' + label); const c = center(n); shell(`input tap ${c.x} ${c.y}`); sleep(450); return c; };
  const must = label => { if (!find(label)) throw new Error('보이지 않음: ' + label); };
  const swipeOn = (label, dy) => { const n = find(label); if (!n) throw new Error('보이지 않음: ' + label); const c = center(n); shell(`input swipe ${c.x} ${c.y} ${c.x} ${c.y + dy} 600`); sleep(500); };
  return { report, shot, step, tap, must, swipeOn, outDir };
}

function run(argv) {
  const outDir = path.join(ROOT, argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'verification/round39/device');
  const apk = argv.includes('--apk') ? argv[argv.indexOf('--apk') + 1] : path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
  const r = runner(outDir);
  r.report.device = { model: shell('getprop ro.product.model').trim(), android: shell('getprop ro.build.version.release').trim(), size: shell('wm size').trim(), density: shell('wm density').trim() };
  r.report.apk = { path: path.relative(ROOT, apk), sha256: crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex') };
  r.step('00-install', () => adb(['install', '-r', '--user', '0', apk], { timeout: 300000 }).trim().split('\n').at(-1));
  r.step('01-installed-build', () => {
    const info = shell(`dumpsys package ${PACKAGE} | grep -E "versionName|versionCode|lastUpdateTime" | head -3`).trim();
    if (!/versionName=/.test(info)) throw new Error('설치 정보를 읽지 못함');
    return info;
  });
  // 시작 배경: 강제 종료 → 시작 직후 연속 캡처 → 어두운 화소 비율. 콜드 스타트 3회 + 백그라운드 복귀 1회.
  r.step('02-startup-background', () => {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      shell(`am force-stop ${PACKAGE}`); sleep(800);
      adb(['shell', 'am', 'start', '--user', '0', '-n', ACTIVITY]);
      for (let k = 0; k < 6; k++) { const png = adb(['exec-out', 'screencap', '-p'], { binary: true }); samples.push(Number(darkRatio(decodePng(png)).toFixed(3))); }
      sleep(2500);
    }
    shell('input keyevent KEYCODE_HOME'); sleep(1200); adb(['shell', 'am', 'start', '--user', '0', '-n', ACTIVITY]);
    for (let k = 0; k < 4; k++) samples.push(Number(darkRatio(decodePng(adb(['exec-out', 'screencap', '-p'], { binary: true }))).toFixed(3)));
    const worst = Math.max(...samples);
    if (worst > .6) throw new Error('어두운 프레임: 최대 어두운 화소 비율 ' + worst + ' · ' + samples.join(','));
    return { samples, worst };
  });
  r.step('03-home', () => { sleep(1500); r.must(L.newSet); r.must(L.fromImage); });
  r.step('04-new-set-canvas', () => { r.tap(L.newSet); sleep(3500); for (const l of [L.toolPen, L.toolEraser, L.toolFill, L.toolSelect, L.color, L.brushAll, L.quickPen, L.pencil, L.reference, L.layers, L.caption, L.tabMotion, L.complete, L.undo, L.redo]) r.must(l); });
  // 40차: 캔버스가 영역 가운데로 옮겨졌다. 고정 좌표 대신 실제 캔버스(가장 큰 WebView) 안 가운데에 긋는다.
  r.step('05-draw-stroke', () => {
    const web = nodes().filter(n => /WebView/.test(n.cls)).sort((a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1))[0];
    if (!web || web.x2 - web.x1 < 200) throw new Error('캔버스 WebView 를 찾지 못함');
    // 가운데에서 비켜 긋는다(왼쪽 위 → 가운데 조금 못 미쳐). 두근거리기는 캔버스 가운데를 중심으로 커지므로, 가운데에 걸친 선은 거의 움직이지 않는다.
    const w = web.x2 - web.x1, h = web.y2 - web.y1;
    shell(`input swipe ${web.x1 + Math.round(w * .18)} ${web.y1 + Math.round(h * .18)} ${web.x1 + Math.round(w * .42)} ${web.y1 + Math.round(h * .42)} 400`); sleep(600);
    return { canvas: [web.x1, web.y1, web.x2, web.y2] };
  });
  r.step('06-brush-list-and-detail', () => { r.tap(L.brushAll); r.must(L.brushClose); r.must(L.brushVariant); r.must(L.brushDetail); r.tap(L.brushVariant); r.must(L.brushSize); r.tap(L.quickPen); r.tap(L.quickPen); r.must(L.brushDetail); r.tap(L.brushClose); });
  r.step('07-canvas-size-drag', () => { r.swipeOn(L.brushSize, -120); r.must(L.brushSize); });
  r.step('08-color-and-recent', () => { r.tap(L.color); r.tap(L.swatch); r.tap(L.color); const recent = nodes().filter(n => n.desc.startsWith(L.recentPrefix)); if (!recent.length) throw new Error('최근 색이 없음'); shell(`input keyevent KEYCODE_BACK`); sleep(400); return recent.map(n => n.desc); });
  r.step('09-eraser-same-control', () => { r.tap(L.toolEraser); r.tap(L.toolEraser); r.must(L.eraserSize); if (find(L.brushClose)) throw new Error('지우개가 시트를 열었다'); r.swipeOn(L.eraserSize, 80); r.tap(L.toolPen); r.must(L.brushSize); });
  r.step('10-undo-redo', () => { r.tap(L.undo); r.tap(L.redo); });
  r.step('11-reference-layers', () => { r.tap(L.reference); r.tap(L.reference); r.tap(L.layers); r.tap(L.layers); });
  r.step('12-caption-direct', () => {
    r.tap(L.caption); const input = find(L.captionInput); if (!input) throw new Error('문구 입력칸 없음');
    shell('input text hello'); shell('input keyevent KEYCODE_ENTER'); sleep(900);
    r.must(L.captionEditAgain); r.must(L.captionDone);
    r.tap(L.captionDone);
  });
  // 움직이기 패널은 견본이 계속 움직여 uiautomator 로 읽을 수 없다 → 화면 비율 좌표로 누르고, 캡처 두 장의 차이로 움직임을 확인.
  // 좌표 비율은 1080×2340 실기기 캡처에서 잰 값(효과 카드 줄 y .68, 카드 x .144/.384/.62/.856, 그리기 탭 .093/.131).
  const screen = () => shell('wm size').match(/(\d+)x(\d+)(?![\s\S]*\d+x\d+)/).slice(1).map(Number);
  const tapFrac = (fx, fy) => { const [w, h] = screen(); shell(`input tap ${Math.round(w * fx)} ${Math.round(h * fy)}`); sleep(900); };
  // 통통은 뛰었다 쉬는 구간이 있어 두 장만 비교하면 쉬는 순간을 잡는다 → 여러 장을 연달아 찍어 가장 큰 변화를 본다.
  // 42차: 첫 장만 기준으로 비교하면 두근거리기(가운데 기준 크기 변화)가 첫 장이 중간 크기일 때 거의 멈춘 것처럼 잰다
  // (S24 스모크 두 번 연속 .0003). 같은 칸을 16장 전부 짝지어 재면 .0013/.0015 로 돈다(verification/round42/pulse-burst).
  // 바닥값은 그대로 두고, 모든 짝을 비교해 한 주기 안의 가장 큰 변화를 본다.
  const motionDelta = () => { const frames = []; for (let k = 0; k < 8; k++) { frames.push(decodePng(adb(['exec-out', 'screencap', '-p'], { binary: true }))); sleep(120); } let best = 0; for (let i = 0; i < frames.length; i++) for (let k = i + 1; k < frames.length; k++) best = Math.max(best, regionChange(frames[i], frames[k], .15, .52)); return best; };
  // 40차 움직이기 패널: 좁은 '없음' + 효과 카드 셋(S24 Ultra 캡처 08-motion 에서 잰 값). 카드 줄 y 는 아래 tapFrac 의 .69.
  const CARD = { [L.presetNone]: .106, [L.presetBounce]: .321, [L.presetShake]: .583, [L.presetPulse]: .845 };
  r.step('13-motion-quick', () => {
    r.tap(L.tabMotion); sleep(1500);
    const moving = {};
    for (const l of [L.presetBounce, L.presetShake, L.presetPulse, L.presetNone, L.presetBounce]) { tapFrac(CARD[l], .69); moving[l] = motionDelta(); r.shot('13-motion-' + l); }
    const still = moving[L.presetNone];
    const live = [L.presetShake, L.presetPulse, L.presetBounce].filter(l => moving[l] > Math.max(.0008, still * 3));
    // 바닥값 .0008: 두근거리기는 캔버스 가운데 기준 1.14배라 가는 기본 선(6px)에서는 바뀐 화소 비율이 .0013~.0018 정도다(40차 S24 실측, '없음'은 0).
    if (live.length < 3) throw new Error('캔버스 미리보기가 움직이지 않는 효과: ' + JSON.stringify(moving));
    return { canvasChangeBetweenFrames: moving };
  });
  r.step('13b-back-to-draw', () => { tapFrac(.093, .131); sleep(900); r.must(L.toolPen); });
  r.step('14-complete-next', () => { r.tap(L.complete); sleep(3000); r.must(L.previousStart); });
  // 직전 칸 움직임 행은 움직이는 패널 안이라 읽을 수 없다 → 캡처를 남기고(사람이 아니라 AI 가 캡처를 본다), 행 유무는 product-ux-test 가 판정.
  r.step('15-previous-start-and-motion-panel', () => { r.tap(L.previousStart); sleep(1500); r.must(L.toolPen); r.tap(L.tabMotion); sleep(1500); r.shot('15-motion-with-previous'); const d = motionDelta(); tapFrac(.093, .131); r.must(L.complete); return { canvasChangeBetweenFrames: d }; });
  r.step('16-board', () => { r.tap(L.close); sleep(2500); r.must(L.continueDraw); r.must(L.exportEntry); });
  r.step('17-export', () => {
    r.tap(L.exportEntry); sleep(1500); r.shot('17-export-top');
    const [w, h] = screen(); let swipes = 0;
    while (!find(L.makeBundle) && swipes < 6) { shell(`input swipe ${w / 2} ${Math.round(h * .8)} ${w / 2} ${Math.round(h * .3)} 350`); sleep(800); swipes++; }
    r.must(L.makeBundle); r.must(L.detailsOpen);
    const copy = nodes().map(n => n.text + ' ' + n.desc).join('\n');
    const bad = copy.match(/제출 파일|작업 파일|undefined|null|NaN|Error|JSON/g);
    if (bad) throw new Error('개발자·옛 문구: ' + [...new Set(bad)].join(','));
    return { swipes };
  });
  r.step('18-logcat-errors', () => { const log = adb(['logcat', '-d', '-t', '800', '*:E']); const ours = log.split('\n').filter(l => /ReactNative|emoticon|FATAL|AndroidRuntime/.test(l)); fs.writeFileSync(path.join(outDir, 'logcat-errors.txt'), ours.join('\n')); if (ours.some(l => /FATAL|AndroidRuntime/.test(l))) throw new Error('앱 치명 오류 로그'); return ours.length; });
  r.report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(r.report, null, 2));
  const failed = r.report.steps.filter(s => s.status !== 'ok');
  console.log(`device QA: ${r.report.steps.length - failed.length}/${r.report.steps.length} ok · report ${path.relative(ROOT, outDir)}/report.json`);
  failed.forEach(s => console.log('  FAIL ' + s.name + ' — ' + s.error));
  process.exitCode = failed.length ? 1 : 0;
}

module.exports = { L, labelsMissingFromSource, decodePng, darkRatio };

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--serial')) SERIAL = argv[argv.indexOf('--serial') + 1];
  if (argv.includes('--dry')) {
    const missing = labelsMissingFromSource();
    console.log(missing.length ? 'MISSING LABELS: ' + missing.join(', ') : `labels ok: ${Object.keys(L).length} labels exist in current source`);
    process.exit(missing.length ? 1 : 0);
  } else if (argv.includes('--pair')) {
    const i = argv.indexOf('--pair');
    console.log(execFileSync(ADB, ['pair', argv[i + 1], argv[i + 2]], { encoding: 'utf8', timeout: 60000 }));
  } else if (argv.includes('--connect')) {
    console.log(execFileSync(ADB, ['connect', argv[argv.indexOf('--connect') + 1]], { encoding: 'utf8', timeout: 60000 }));
    console.log(execFileSync(ADB, ['devices', '-l'], { encoding: 'utf8' }));
  } else if (argv.includes('--run')) {
    run(argv);
  } else {
    console.log('usage: --dry | --pair HOST:PORT CODE | --connect HOST:PORT | --run [--apk path] [--serial S] [--out dir]');
  }
}
