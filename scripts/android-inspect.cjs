#!/usr/bin/env node
// 클라우드 실기기 한 대에 이 APK 를 올려 두고, B1 로 막혀 있던 항목만 실제 터치로 훑는다.
//
// 왜 이렇게 쓰나
//   - 합격/불합격을 매기지 않는다. **증거를 모은다.** 한 단계가 막혀도 멈추지 않고 다음으로 가고,
//     못 한 것은 report.json 에 '미실행' 이유와 함께 남는다. 앞 단계가 실패해 못 한 것과
//     해 보고 안 된 것은 다른 것이다.
//   - 무료 시간이 한정이라 세션 길이를 아낀다. 먼저 --smoke 로 자동화가 도는지 3~4분만 보고,
//     통과하면 --full 로 넓힌다. 무슨 일이 있어도 세션은 닫는다(watchdog + finally).
//   - 업체에 묶이지 않는다. Appium 2 표준만 쓴다.
//
// 자격 증명은 환경변수로만 읽는다. 화면·로그·보고서 어디에도 적지 않는다.
//   BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY
//
// 순서
//   node scripts/android-inspect.cjs --plan     계정의 무료 잔여량과 쓸 수 있는 기기를 확인
//   node scripts/android-inspect.cjs --upload   APK 를 올리고 app_url 을 받는다
//   APP_ID=bs://... node scripts/android-inspect.cjs --smoke   설치→실행→그리기→저장→재실행
//   APP_ID=bs://... node scripts/android-inspect.cjs --full    레이어·선택 변형·움직임·내보내기까지
//   node scripts/android-inspect.cjs --dry      연결하지 않고 단계만 훑는다
const fs = require('fs');
const path = require('path');
const https = require('https');

const PACKAGE = 'com.emoticonstudio.app';
const ACTIVITY = 'com.emoticonstudio.app.MainActivity';
const APK = process.env.APK_PATH || path.resolve('android/app/build/outputs/apk/release/app-release.apk');
const OUT = process.env.OUT_DIR || path.resolve('verification/android');
const HUB = process.env.APPIUM_HOST || 'hub-cloud.browserstack.com';
const API = process.env.BS_API_HOST || 'api-cloud.browserstack.com';
// 세션이 매달려 무료 시간을 먹지 않도록 못 박는다.
const BUDGET_MS = Number(process.env.BUDGET_MS || 9 * 60 * 1000);

// 화면 요소 이름. 코드에서 그대로 읽어 온 것이다(accessibilityLabel → content-desc).
// 39차: 38.5차 UI 로 갱신. 저장 버튼은 없어졌고(자동 저장) '저장'이 칸을 끝낸다.
// 무선 ADB 로 연결한 실기기 검수는 scripts/device-qa.cjs 가 맡는다(라벨은 npm test 에서 소스와 대조).
const L = {
  newSet: '새 세트',
  save: '저장',
  addLayer: '레이어 추가',
  toolSelect: '선택',
  toolPen: '브러시',
  selectApply: '선택 적용',
  selectCancel: '선택 취소',
  tabMotion: '움직이기',
  tabDraw: '그리기',
  presetBounce: '통통',
  back: '뒤로',
  review: '문구',
  exportSet: '파일 묶음 만들기',
  resume: '새 이모티콘 세트 이어서 만들기',
  layerRail: '레이어',
  exportEntry: '내보내기',
  projectCard: '새 이모티콘 세트',
  selScale: '크게',
  selRotate: '오른쪽 회전',
  selFlip: '좌우 반전',
};

// 각 단계가 B1 의 무엇을 보여 주는지. 캡처만 쌓아 놓고 무엇을 확인한 것인지 모르는 일이 없도록.
const COVERS = {
  '01-launch': 'Metro 없이 단독 실행 · 첫 화면 · 한글 렌더',
  '02-new-set': '빈 캔버스 진입 · 빈 화면 균형',
  '03-draw': '한 손가락 그리기가 실제로 획을 남기는가',
  '04-undo': '두 손가락 탭 되돌리기',
  '05-redo': '세 손가락 탭 다시 실행',
  '06-save': '저장이 끝나는가 · 저장 체감 속도',
  '07-restart': '앱을 껐다 켜도 작품이 남는가',
  '07b-reenter': '홈에서 작업하던 칸으로 다시 들어가기',
  '08-layers': '레이어 줄 · 그림 추가 · 무엇을 편집 중인지 보이는가',
  '09-select': '선택 도구로 들어올리기 · 변형 손잡이',
  '10-select-applied': '선택 적용 후 그림이 남는가',
  '11-motion': '움직이기 탭 · 효과 카드 · 버튼 중복',
  '12-motion-applied': '움직임 적용 후 미리보기',
  '12b-back-to-draw': '움직이기에서 그리기로 되돌아오기',
  '13-export': '제출 화면 · 글자 위계 · 잘림',
  '14-share': '작업 파일 만들기 → 공유 시트로 실제 전달',
  'P1-cut': '그림이 실제로 있는 칸',
  'P2-tool': '선택 도구',
  'P3-lift': '들어올림',
  'P4-move': '적용 전 이동',
  'P5-apply': '적용',
  'P6-save': '저장',
  'P7-restart': '재실행',
  'P8-reopen': '칸을 다시 열어 결과 확인',
  'S1-cut': '그림이 실제로 있는 칸',
  'S2-tool': '선택 도구 진입',
  'S3-lift': '마키로 영역 선택 · 들어올림',
  'S4-move': '이동',
  'S5-scale': '크기',
  'S6-rotate': '회전',
  'S7-flip': '좌우 반전',
  'S8-cancel': '취소 시 원본 복원',
  'S9-reselect': '다시 선택해 들어올림',
  'S9b-move': '적용 전 이동',
  'S10-apply': '적용',
  'S11-save': '저장',
  'S12-restart': '재실행에도 결과 유지',
  'S13-export': '저장·내보내기 파일에 점선·손잡이가 섞이지 않는가',
  'M1-motion-clean': '선택이 걸리지 않은 깨끗한 상태의 움직이기 탭',
  'M2-preset': '효과 카드를 실제로 누를 수 있는가',
};

const wait = ms => new Promise(r => setTimeout(r, ms));
const mode = process.argv.find(a => ['--dry', '--plan', '--upload', '--smoke', '--motion', '--select', '--persist', '--five', '--rest', '--menu', '--contrast', '--ui', '--ui2', '--fix', '--wait', '--bar', '--b9', '--r25', '--r26', '--r27', '--r27rel', '--r27color', '--r28', '--r28b', '--full'].includes(a)) || '--dry';

// 자격 증명을 얻는 길은 둘뿐이고, 둘 다 값이 대화·화면·보고서로 새지 않는다.
//   1) 환경변수 — 노트북에서 직접 설정할 수 있을 때
//   2) 파일 — 원격에서 지시만 보내는 사람이 이미 쓰는 동기화 폴더(OneDrive 등)에 떨어뜨릴 때.
//      `BROWSERSTACK_USERNAME=...` 형식 두 줄이면 된다. 읽고 나서 지운다(BS_CRED_KEEP=1 이면 남긴다).
// 이 함수 밖으로 값이 나가지 않는다. 로그에도 보고서에도 길이조차 적지 않는다.
const credFile = () => process.env.BS_CRED_FILE
  || (process.env.OneDrive ? path.join(process.env.OneDrive, 'browserstack.txt') : '');
const creds = () => {
  let user = process.env.BROWSERSTACK_USERNAME, key = process.env.BROWSERSTACK_ACCESS_KEY;
  const file = process.env.BS_ENV_ONLY === '1' ? '' : credFile();
  if ((!user || !key) && file && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const at = line.indexOf('=');
      if (at < 1) continue;
      const name = line.slice(0, at).trim().toUpperCase(), value = line.slice(at + 1).trim();
      if (name === 'BROWSERSTACK_USERNAME') user = user || value;
      if (name === 'BROWSERSTACK_ACCESS_KEY') key = key || value;
    }
    if (user && key && process.env.BS_CRED_KEEP !== '1') {
      try { fs.rmSync(file); console.log('자격 증명 파일을 읽고 지웠습니다: ' + path.basename(file)); }
      catch (e) { console.log('자격 증명 파일을 지우지 못했습니다 — 직접 지워 주세요: ' + file); }
    }
  }
  if (!user || !key) {
    console.error('자격 증명을 찾지 못했습니다. 둘 중 하나면 됩니다:');
    console.error('  1) 환경변수 BROWSERSTACK_USERNAME / BROWSERSTACK_ACCESS_KEY');
    console.error('  2) 파일 ' + (file || '(OneDrive 경로를 찾지 못함)') + ' 에 두 줄:');
    console.error('     BROWSERSTACK_USERNAME=...');
    console.error('     BROWSERSTACK_ACCESS_KEY=...');
    console.error('값은 이 스크립트가 화면에도 보고서에도 적지 않습니다.');
    process.exit(2);
  }
  return { user, key };
};
// 자격 증명은 헤더로만 나간다. 어떤 출력에도 담기지 않는다.
const auth = () => { const { user, key } = creds(); return 'Basic ' + Buffer.from(user + ':' + key).toString('base64'); };

const getJson = (host, route) => new Promise((resolve, reject) => {
  https.get({ host, path: route, headers: { Authorization: auth() } }, res => {
    let body = '';
    res.on('data', c => (body += c));
    res.on('end', () => {
      if (res.statusCode !== 200) return reject(new Error(route + ' → HTTP ' + res.statusCode));
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
  }).on('error', reject);
});

async function showPlan() {
  const plan = await getJson(API, '/app-automate/plan.json');
  console.log('App Automate 계정 상태 (공식 API 가 돌려준 값 그대로)');
  for (const [k, v] of Object.entries(plan)) console.log('  ' + k.padEnd(26) + ' ' + JSON.stringify(v));
  const devices = await getJson(API, '/app-automate/devices.json');
  const android = devices.filter(d => String(d.os).toLowerCase() === 'android');
  console.log('');
  console.log('쓸 수 있는 Android 실기기 ' + android.length + '종 (전체 ' + devices.length + '종)');
  const recent = android.filter(d => Number(String(d.os_version).split('.')[0]) >= 12);
  for (const d of recent.slice(0, 25)) console.log('  ' + String(d.device).padEnd(30) + ' Android ' + d.os_version + (d.realMobile === false ? '  (실기기 아님)' : ''));
  if (recent.length > 25) console.log('  … 외 ' + (recent.length - 25) + '종');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify({ plan, androidDevices: android.length, checkedAt: new Date().toISOString() }, null, 2));
}

function uploadApk() {
  return new Promise((resolve, reject) => {
    const bytes = fs.readFileSync(APK);
    const boundary = '----emoticon' + Date.now().toString(36);
    const head = Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="app-release.apk"\r\nContent-Type: application/vnd.android.package-archive\r\n\r\n');
    const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
    const body = Buffer.concat([head, bytes, tail]);
    const req = https.request({
      host: API, path: '/app-automate/upload', method: 'POST',
      headers: { Authorization: auth(), 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length },
    }, res => {
      let text = '';
      res.on('data', c => (text += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('업로드 실패 HTTP ' + res.statusCode + ' ' + text));
        try { resolve(JSON.parse(text)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

if (mode === '--dry') {
  console.log('패키지   ' + PACKAGE);
  console.log('APK      ' + APK + (fs.existsSync(APK) ? '  (' + fs.statSync(APK).size.toLocaleString() + ' bytes)' : '  — 없음'));
  console.log('캡처     ' + OUT);
  console.log('');
  console.log('--smoke 가 도는 단계');
  for (const id of ['01-launch', '02-new-set', '03-draw', '04-undo', '05-redo', '06-save', '07-restart']) console.log('  ' + id + '  ' + COVERS[id]);
  console.log('--full 이 더 도는 단계');
  for (const id of ['08-layers', '09-select', '10-select-applied', '11-motion', '12-motion-applied', '13-export', '14-share']) console.log('  ' + id + '  ' + COVERS[id]);
  console.log('');
  console.log('연결하지 않았다. 자격 증명이 준비되면 --plan → --upload → --smoke → --full 순서로 쓴다.');
  process.exit(0);
}

(async () => {
  if (mode === '--plan') return showPlan();
  if (mode === '--upload') {
    const hash = () => require('crypto').createHash('sha256').update(fs.readFileSync(APK)).digest('hex');
    const before = hash();
    const out = await uploadApk();
    if (!out.app_url || hash() !== before) throw new Error('업로드 응답 또는 APK 해시 검증 실패');
    console.log('올렸습니다. 다음 단계에 이 값을 씁니다:');
    console.log('  APP_ID=' + out.app_url);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'app-url.txt'), out.app_url + '\n');
    fs.writeFileSync(path.join(OUT, 'upload.json'), JSON.stringify({ apk: APK, sha256: before, bytes: fs.statSync(APK).size, app: out.app_url, uploadedAt: new Date().toISOString(), verification: 'local bytes unchanged during upload; remote digest unavailable' }, null, 2));
    return;
  }

  const full = mode === '--full';
  const { user, key } = creds();
  const APP_ID = process.env.APP_ID || (fs.existsSync(path.join(OUT, 'app-url.txt')) ? fs.readFileSync(path.join(OUT, 'app-url.txt'), 'utf8').trim() : '');
  if (!APP_ID) { console.error('APP_ID 가 필요합니다 (--upload 를 먼저 돌리세요).'); process.exit(2); }

  const { remote } = require(process.env.WDIO_PATH || 'webdriverio');
  fs.mkdirSync(OUT, { recursive: true });
  const report = { mode, startedAt: new Date().toISOString(), device: process.env.DEVICE || '', steps: [], skipped: [], notes: [] };

  const driver = await remote({
    protocol: 'https', hostname: HUB, port: 443, path: '/wd/hub',
    user, key, logLevel: 'silent', connectionRetryTimeout: 180000,
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:app': APP_ID,
      'appium:appPackage': PACKAGE,
      'appium:appActivity': ACTIVITY,
      'appium:autoGrantPermissions': true,
      'appium:newCommandTimeout': 180,
      ...(process.env.DEVICE ? { 'appium:deviceName': process.env.DEVICE } : {}),
      ...(process.env.OS_VERSION ? { 'appium:platformVersion': process.env.OS_VERSION } : {}),
      'bstack:options': { projectName: 'emoticon-studio', buildName: process.env.BUILD || 'B1 내부 확인', sessionName: full ? '확대 검수' : '짧은 검수', idleTimeout: 120 },
    },
  });

  // 무슨 일이 있어도 세션을 닫는다. 예산을 넘기면 강제로 끊는다.
  report.sessionId = driver.sessionId;
  fs.writeFileSync(path.join(OUT, 'session.json'), JSON.stringify({ sessionId: driver.sessionId, app: APP_ID, device: process.env.DEVICE, startedAt: report.startedAt }, null, 2));
  let closed = false;
  const close = async why => {
    if (closed) return;
    closed = true;
    report.closedBecause = why;
    try { await driver.deleteSession(); } catch { /* 이미 닫혔으면 그만이다 */ }
  };
  const watchdog = setTimeout(() => {
    report.notes.push('예산 ' + Math.round(BUDGET_MS / 1000) + '초를 넘겨 세션을 끊었다');
    void close('budget').then(() => { flush(); process.exit(1); });
  }, BUDGET_MS);
  const flush = () => fs.writeFileSync(path.join(OUT, 'report-' + (full ? 'full' : 'smoke') + '.json'), JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => void close(sig).then(() => { flush(); process.exit(1); }));

  const shot = async (id, note) => {
    const file = path.join(OUT, id + '.png');
    try { fs.writeFileSync(file, Buffer.from(await driver.takeScreenshot(), 'base64')); }
    catch (e) { report.notes.push(id + ' 캡처 실패: ' + e.message); return; }
    report.steps.push({ id, covers: COVERS[id] || '', note: note || '', shot: path.basename(file) });
    console.log('  ' + id + '  ' + (note || COVERS[id] || ''));
  };
  // 한 단계가 막혀도 멈추지 않는다. 그리고 **앞 단계 실패로 못 한 것**은 따로 적는다.
  let broken = null;
  const step = async (id, work) => {
    if (broken) { report.skipped.push({ id, covers: COVERS[id] || '', reason: '앞 단계(' + broken + ') 실패로 실행하지 못함' }); console.log('  ' + id + '  미실행 — ' + broken + ' 실패'); return; }
    try { await shot(id, await work()); }
    catch (e) { report.notes.push(id + ' 실패: ' + e.message); await shot(id, '실패 — ' + e.message); }
  };
  // 여기서 실패하면 뒤가 의미 없어지는 단계.
  const gate = async (id, work) => {
    if (broken) { report.skipped.push({ id, covers: COVERS[id] || '', reason: '앞 단계(' + broken + ') 실패로 실행하지 못함' }); return; }
    try { await shot(id, await work()); }
    catch (e) { broken = id; report.notes.push(id + ' 실패(이후 중단): ' + e.message); await shot(id, '실패 — ' + e.message); }
  };

  const byName = async (name, ms = 8000) => { const el = await driver.$('~' + name); await el.waitForExist({ timeout: ms }); return el; };
  const tapName = async (name, ms = 8000) => { await (await byName(name, ms)).click(); };
  const size = await driver.getWindowSize();
  const at = (fx, fy) => ({ x: Math.round(size.width * fx), y: Math.round(size.height * fy) });
  // 손가락 n 개로 같은 순간에 톡 친다. 되돌리기·다시 실행이 이 동작을 쓴다.
  const fingerTap = async count => {
    const spread = Math.round(size.width * 0.12), base = at(0.5, 0.42);
    await driver.performActions(Array.from({ length: count }, (_, i) => ({
      type: 'pointer', id: 'f' + i, parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: base.x + Math.round((i - (count - 1) / 2) * spread), y: base.y },
        { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 90 }, { type: 'pointerUp', button: 0 },
      ],
    })));
    try { await driver.releaseActions(); } catch { /* 이 기기는 정리 호출을 받지 않는다 */ }
  };
  const stroke = async (points, holdMs = 12) => {
    const actions = [{ type: 'pointerMove', duration: 0, ...points[0] }, { type: 'pointerDown', button: 0 }];
    for (const p of points.slice(1)) actions.push({ type: 'pointerMove', duration: holdMs, ...p });
    actions.push({ type: 'pointerUp', button: 0 });
    await driver.performActions([{ type: 'pointer', id: 'pen', parameters: { pointerType: 'touch' }, actions }]);
    try { await driver.releaseActions(); } catch { /* 이 기기는 정리 호출을 받지 않는다 */ }
  };
  const scribble = async (row) => {
    const points = [];
    for (let i = 0; i <= 12; i++) points.push(at(0.22 + i * 0.045, row + Math.sin(i / 2) * 0.02));
    await stroke(points);
  };

  try {
    await wait(3500);
    await gate('01-launch', async () => {
      // 화면에 잘려 보이는 것이 무엇인지 추측하지 않는다. 요소 트리를 그대로 받아 좌표로 확인한다.
      try { fs.writeFileSync(path.join(OUT, 'source-home.xml'), await driver.getPageSource()); }
      catch (e) { report.notes.push('화면 트리를 받지 못했다: ' + e.message); }
      return '창 ' + size.width + '×' + size.height;
    });
    await gate('02-new-set', async () => { await tapName(L.newSet, 12000); await wait(3500); return '새 세트로 들어감'; });
    await gate('03-draw', async () => { await scribble(0.32); await wait(200); await scribble(0.42); await wait(600); return '획 2개'; });
    if (!['--persist','--five','--rest','--menu','--contrast','--ui','--ui2','--fix','--wait','--bar','--b9','--r25','--r27','--r27rel','--r27color','--r28','--r28b'].includes(mode)) await step('04-undo', async () => { await fingerTap(2); await wait(800); return '두 손가락 탭 — 한 획이 사라져야 한다'; });
    if (!['--persist','--five','--rest','--menu','--contrast','--ui','--ui2','--fix','--wait','--bar','--b9','--r25','--r27','--r27rel','--r27color','--r28','--r28b'].includes(mode)) await step('05-redo', async () => { await fingerTap(3); await wait(800); return '세 손가락 탭 — 그 획이 돌아와야 한다'; });

    // 움직이기 탭만 깨끗한 상태로 다시 본다. 앞 단계에서 선택이 걸려 있으면 그것 때문인지
    // 탭 자체의 문제인지 가릴 수 없다. 그래서 그리기만 한 상태에서 바로 탭을 넘긴다.
    // 선택·변형만 따로 훑는다. 마키는 올가미가 아니라 **사각형 드래그**다(엔진 selectionBox()).
    // 앞선 시도가 시작점과 끝점을 같게 만들어 영역이 0이었고, 그래서 아무것도 들리지 않았다.
    // 변형은 손잡이를 끌지 않고 줄에 있는 버튼(크기·회전·좌우 반전)으로 낸다 — 자동 조작에 더 확실하다.
    // 7번만 겨냥한 최소 경로. 크기·회전·반전을 끼우지 않는다 — 그것들이 잉크를 옮겨 놓으면
    // 다음 단계의 고정 좌표가 빈 자리를 잡게 되고, 그러면 앱이 아니라 자동화가 실패한다.
    if (mode === '--persist') {
      await gate('P1-cut', async () => { await tapName(L.save); await wait(4500); return '그림이 있는 칸 · 저장까지 마친 상태'; });
      await gate('P2-tool', async () => { await tapName(L.toolSelect); await wait(1200); return '선택 도구'; });
      await gate('P3-lift', async () => { await stroke([at(0.18, 0.26), at(0.45, 0.31), at(0.80, 0.38)], 220); await wait(3000); return '첫 획을 들어올림'; });
      await gate('P4-move', async () => { await stroke([at(0.49, 0.32), at(0.40, 0.52)], 500); await wait(2000); return '아래 왼쪽으로 옮김 — 적용 전'; });
      await gate('P5-apply', async () => { await tapName(L.selectApply, 6000); await wait(2500); return '적용 — 점선·손잡이가 사라져야 한다'; });
      await gate('P6-save', async () => { await tapName(L.save, 8000); await wait(5000); return '옮긴 결과 저장'; });
      await gate('P7-restart', async () => {
        await driver.terminateApp(PACKAGE); await wait(1500);
        await driver.activateApp(PACKAGE); await wait(5000);
        return '껐다 켠 뒤 — 옮긴 결과가 남아 있어야 한다';
      });
      await step('P8-board', async () => { await tapName(L.projectCard, 10000); await wait(3500); return '보드 — 01번 썸네일에 옮긴 결과가 보여야 한다'; });
      await step('P9-reopen-01', async () => { await tapName('슬롯 1 작업 중', 6000).catch(async () => { await (await driver.$('~슬롯 1 완성')).click(); }); await wait(4500); return '01번을 다시 열어 위치 확인'; });
    }
    // 다섯 가지 수정을 한 세션에 훑는다. 무료 한도가 얼마 남지 않아 세션을 나눌 수 없다.
    // 팔레트·새 디자인은 이미 캡처로 확인했다. 남은 네 가지만 훑어 무료 시간을 아낀다.
    // ⋯ 메뉴와 검수 스위치 상태만 짧게 담는다.
    // 노란 글자가 실제 화면에 남아 있는지 본다. 글자가 많은 화면을 골라 담는다.
    // 이번 승인 범위를 한 세션에 훑는다: 하단 패널 전환 · 도구 UI · 문구 패널 · 질감 · 마스코트.
    // 놓친 셋만 다시 담는다: 펜 종류 · 색 즉시 반영 · 문구 패널.
    // 이번 보완 확인: 제출 준비 버튼 · 선택 이동 분기 기록 · 키보드 · ⋯ 재진입.
    // 자동저장 주기(40초)를 넘겨 기다린 뒤에도 선택이 살아 있는지 본다. 그것이 이번 수정의 요지다.
    // 하단 고정 도구바: 어떤 패널을 열어도 도구와 색이 같은 자리에 남는가.
    // B9 재검증 + 보고용 캡처 한 벌: 홈 · 페인터 기본 · 펜 패널 · 색상 패널 · 키보드 문구 패널.
    if (mode === '--b9') {
      await gate('S1-painter', async () => '페인터 기본 상태 — 하단 고정 도구바');
      await gate('S2-brush', async () => { await tapName('펜', 8000); await wait(1800); return '펜 종류 패널'; });
      await gate('S3-color', async () => { await tapName('펜 종류 닫기', 6000); await wait(900); await tapName('팔레트 열기', 8000); await wait(1800); return '색상 패널'; });
      await gate('S4-caption', async () => { await tapName('팔레트 닫기', 6000); await wait(900); await tapName('문구', 8000); await wait(1800); return '문구 패널 (키보드 전)'; });
      await gate('S5-keyboard', async () => {
        const box = await driver.$('~문구 내용'); await box.waitForExist({ timeout: 8000 });
        await box.click(); await wait(1800);
        await box.setValue('안녕하세요');
        await wait(1500);
        return '키보드 열림 — 입력칸과 문구 적용이 함께 보여야 한다';
      });
      await gate('S6-apply', async () => { await tapName('문구 적용', 8000); await wait(2500); return '키보드 상태에서 적용이 눌린다'; });
      await step('S7-restored', async () => {
        try { await driver.hideKeyboard(); } catch { /* 이미 닫혔으면 그만 */ }
        await wait(1500);
        return '키보드 닫은 뒤 배치 복원';
      });
      await step('S8-home', async () => {
        await tapName('저장', 8000); await wait(5000);
        await driver.back(); await wait(3000); await driver.back(); await wait(3000);
        return '홈 — 작품 중심 배치';
      });
    }
    // 25차: Codex 가 반영한 네 가지 변경을 실기기 화면에서 본다.
    //   기본 도구바의 펜·붓·연필 에셋과 선 샘플 / 펜 설정 패널의 중복 제거 / 색·굵기 한 줄 / 위로 옮긴 되돌리기·다시 실행.
    if (mode === '--r26') {
      await step('26-base', async () => '실제 화면 비교용 기본 상태');
      await step('26-brush', async () => { await tapName('선 종류 붓'); await scribble(.34); return '붓 실제 획'; });
      await step('26-pencil', async () => { await tapName('선 종류 연필'); await scribble(.40); return '연필 실제 획'; });
      await step('26-color', async () => { await tapName('팔레트 열기'); return '팔레트와 캔버스 비교'; });
      await step('26-color-picked', async () => { await tapName('색 #E94F4F'); return '색 선택 후 도구 유지 비교'; });
      await step('26-pen-panel', async () => { await tapName('펜 굵기'); return '설정 패널'; });
      await step('26-caption-keyboard', async () => {
        report.notes.push('close pen panel: accessibility click, no back command');
        await tapName('펜 설정 닫기'); await wait(800);
        if (await (await driver.$('~펜 설정 닫기')).isExisting()) {
          report.notes.push('pen panel remained: one back command before opening caption, keyboard not open');
          await driver.back(); await wait(800);
        }
        await tapName('문구');
        const input = await byName('문구 내용'); await input.click(); await input.setValue('round26');
        return '키보드·적용 접근';
      });
      await step('26-keyboard-closed', async () => { report.notes.push('keyboard dismiss: one accessibility click, zero back/hideKeyboard commands'); await tapName('키보드 닫기'); await wait(1000); await byName('문구 적용'); return '키보드만 닫고 문구 패널 유지'; });
      await step('26-caption-applied', async () => { await tapName('문구 위'); await tapName('문구 적용'); return '문구 위 위치 적용'; });
      await step('26-caption-selected', async () => { await tapName('문구 고르기'); return '이동 전 선택 위치'; });
      await step('26-caption-moved', async () => {
        const web=await driver.$('//android.webkit.WebView'); const pos=await web.getLocation(); const dim=await web.getSize();
        const n=Math.min(dim.width,dim.height);
        const from={x:Math.round(pos.x+dim.width/2),y:Math.round(pos.y+n*.09)};
        await stroke([from,{x:from.x-80,y:from.y+100}],500); return '문구 드래그: '+JSON.stringify(from);
      });
      await step('26-caption-reapplied', async () => { await tapName('문구'); await tapName('문구 적용'); return '이동 후 문구 재적용'; });
      await step('26-save', async () => { await tapName('저장'); await wait(4000); return '저장'; });
      await step('26-restart', async () => { await driver.terminateApp(PACKAGE); await driver.activateApp(PACKAGE); await wait(4000); return '재실행'; });
      let dockBefore;
      await step('26-board', async () => { await tapName(L.projectCard); dockBefore = await (await byName('움직임 일괄 적용')).getLocation(); return JSON.stringify({dockBefore}); });
      await step('26-board-bottom', async () => { await stroke([at(.5,.8),at(.5,.25)],500); const dockAfter=await (await byName('움직임 일괄 적용')).getLocation(); if(JSON.stringify(dockBefore)!==JSON.stringify(dockAfter)) throw new Error('dock moved: '+JSON.stringify({dockBefore,dockAfter})); return JSON.stringify({dockAfter}); });
      await step('26-caption-reopened', async () => {
        await stroke([at(.5,.3),at(.5,.8)],500);
        await tapName('슬롯 1 작업 중'); await wait(2000); return '재실행 후 문구 위치 비교';
      });
      await step('26-internal-settings', async () => {
        await tapName('그리기 닫기'); await wait(2000); await tapName('뒤로'); await tapName('설정');
        return '내부 빌드 설정과 PRO 스위치';
      });
      await step('26-internal-pro-on', async () => { await tapName('검수용 PRO 켜기'); return 'PRO 전환'; });
      await step('26-pro-color', async () => {
        await driver.back(); await tapName(L.projectCard); await tapName('슬롯 1 작업 중'); await wait(2000);
        await tapName('팔레트 열기'); await tapName('직접 선택'); return '고급 색상 실제 컨트롤 확인';
      });
      await step('26-pro-hex', async () => { await (await byName('HEX 색 값')).setValue('#3366AA'); return 'HEX 입력 반영'; });
    }

    // 27차 공용 도구. 캔버스(WebView)의 화면 좌표, 좌표 한 점 누르기, 요소 글자, 요소 존재.
    const canvasRect = async () => { const web = await driver.$('//android.webkit.WebView'); const p = await web.getLocation(); const d = await web.getSize(); return { x: p.x, y: p.y, w: d.width, h: d.height }; };
    const tapAt = async pt => stroke([pt, pt], 40);
    const textOf = async name => { try { return await (await byName(name, 4000)).getText(); } catch { return null; } };
    const exists = async name => { try { return await (await driver.$('~' + name)).isExisting(); } catch { return false; } };
    // 색 패널 안의 막대는 패널 스크롤 아래에 있을 수 있다. 보일 때까지 패널 안에서만 조금씩 올린다.
    const reveal = async name => {
      for (let i = 0; i < 6; i++) {
        if (await exists(name)) { const el = await driver.$('~' + name); const p = await el.getLocation(); if (p.y > 0 && p.y < size.height - 220) return el; }
        await stroke([at(.5, .9), at(.5, .8)], 260); await wait(500);
      }
      return byName(name, 3000);
    };
    const track = async (name, fx) => { const el = await reveal(name); const p = await el.getLocation(), d = await el.getSize(); await tapAt({ x: Math.round(p.x + d.width * fx), y: Math.round(p.y + d.height / 2) }); await wait(800); };

    // 27차 내부 검수 APK: 패널 전환 viewport · 무료 잠금 → 검수용 PRO → RGB·투명도·스포이드·내 팔레트(재실행 유지) · 32번째 칸.
    if (mode === '--r27') {
      report.viewport = [];
      let base;
      const measure = async what => { const r = await canvasRect(); report.viewport.push({ what, ...r }); if (base && JSON.stringify(r) !== JSON.stringify(base)) throw new Error('viewport changed at ' + what + ': ' + JSON.stringify({ base, r })); return what + ' ' + JSON.stringify(r); };
      await step('27-v0-base', async () => { base = await canvasRect(); report.viewport.push({ what: 'base', ...base }); return 'base ' + JSON.stringify(base); });
      await step('27-v1-palette', async () => { await tapName('팔레트 열기'); await wait(900); return measure('팔레트'); });
      await step('27-v2-custom', async () => { await tapName('직접 선택'); await wait(900); return measure('직접 선택'); });
      await step('27-v3-width', async () => { await driver.back(); await wait(700); await tapName('펜 굵기'); await wait(900); return measure('펜 굵기'); });
      await step('27-v4-caption', async () => { await tapName('펜 설정 닫기'); await wait(700); await tapName('문구'); await wait(900); return measure('문구(키보드 닫힘)'); });
      await step('27-v5-reference', async () => { await tapName('문구 닫기'); await wait(700); await tapName('참고'); await wait(900); return measure('참고'); });
      await step('27-v6-layers', async () => { await tapName('참고'); await wait(700); await tapName('레이어'); await wait(900); return measure('레이어'); });
      await step('27-v7-more', async () => { await tapName('레이어'); await wait(700); await tapName('더보기'); await wait(900); return measure('더보기'); });
      await step('27-v8-select', async () => {
        await tapName('작업 도구 닫기'); await wait(700);
        await tapName(L.toolSelect); await wait(700);
        await stroke([at(.18, .26), at(.5, .34), at(.82, .46)], 220); await wait(2000);
        await byName(L.selectCancel, 5000);
        return measure('선택 패널');
      });
      await step('27-v9-motion', async () => { await tapName(L.selectCancel); await wait(800); await tapName(L.toolPen); await wait(700); await tapName(L.tabMotion); await wait(1500); return measure('움직이기'); });
      await step('27-free-lock', async () => {
        await tapName(L.tabDraw); await wait(1200);
        await tapName('팔레트 열기'); await wait(900);
        const lock = await exists('스포이드 PRO'), open = await exists('스포이드');
        report.freeLock = { eyedropLocked: lock, eyedropOpen: open };
        if (!lock || open) throw new Error('무료 상태 스포이드 잠금 불일치: ' + JSON.stringify(report.freeLock));
        return '무료: 스포이드 PRO · 내 팔레트 저장 PRO';
      });
      await step('27-free-custom', async () => {
        await tapName('직접 선택'); await wait(900);
        const rgb = await exists('빨강'); report.freeLock.rgbOpen = rgb;
        if (rgb) throw new Error('무료 상태에 RGB 막대가 열려 있다');
        return '무료: 색상 줄·채도명도 면·HEX 유지, RGB·투명도 잠김';
      });
      await step('27-red-line', async () => {
        await driver.back(); await wait(700);
        await tapName('펜 굵기'); await wait(700); await tapName('굵기 24'); await wait(400); await tapName('펜 설정 닫기'); await wait(700);
        await tapName('팔레트 열기'); await wait(900); await tapName('팔레트'); await wait(600); await tapName('색 #E94F4F'); await wait(900);
        const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(.2 + i * .0375, .30));
        await stroke(pts, 20); await wait(800);
        return '굵기 24 빨강 직선 — 스포이드 대상';
      });
      await step('27-pro-on', async () => {
        await tapName(L.save); await wait(3500);
        await tapName('그리기 닫기'); await wait(3000); await tapName('뒤로'); await wait(1500); await tapName('설정'); await wait(1500);
        if (!(await exists('검수용 PRO 켜기'))) throw new Error('내부 빌드인데 검수용 스위치가 없다');
        await tapName('검수용 PRO 켜기'); await wait(1200);
        return '내부 검수 빌드 설정 · 검수용 PRO 켜짐';
      });
      await step('27-pro-custom', async () => {
        await driver.back(); await wait(1200); await tapName(L.projectCard); await wait(2500); await tapName('슬롯 1 작업 중'); await wait(4000);
        await tapName('팔레트 열기'); await wait(900);
        if (!(await exists('스포이드')) || await exists('스포이드 PRO')) throw new Error('PRO 전환 후에도 스포이드가 잠겨 있다');
        await tapName('직접 선택'); await wait(900);
        return 'PRO: 스포이드·내 팔레트 열림, 직접 선택';
      });
      await step('27-rgb-alpha', async () => {
        const r0 = await (await reveal('빨강 값')).getText();
        await track('빨강', .2); const r1 = await textOf('빨강 값');
        await track('투명도', .45); const a1 = await textOf('투명도 값');
        report.color = { red: [r0, r1], alpha: a1 };
        if (r0 === r1) throw new Error('빨강 막대가 값을 바꾸지 않았다: ' + JSON.stringify(report.color));
        if (!a1 || a1 === '100%') throw new Error('투명도 막대가 값을 바꾸지 않았다: ' + JSON.stringify(report.color));
        return 'RGB·투명도 막대 ' + JSON.stringify(report.color);
      });
      await step('27-alpha-stroke', async () => {
        await driver.back(); await wait(800);
        const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(.2 + i * .0375, .40));
        await stroke(pts, 20); await wait(900);
        return '바뀐 색·투명도로 그은 획(빨강 직선 아래)';
      });
      await step('27-eyedrop-armed', async () => { await tapName('팔레트 열기'); await wait(900); await tapName('스포이드'); await wait(1000); await byName('스포이드 취소', 4000); return '스포이드 대기 안내'; });
      await step('27-eyedrop-picked', async () => {
        await tapAt(at(.6, .30)); await wait(1800);
        const v = await textOf('지금 색 값'); report.eyedrop = v;
        if (!v || !v.startsWith('#E94F4F')) throw new Error('스포이드가 빨강 직선 색을 읽지 못했다: ' + v);
        return '스포이드로 읽은 색 ' + v;
      });
      await step('27-palette-saved', async () => {
        await tapName('내 팔레트에 저장'); await wait(1000); await tapName('팔레트'); await wait(900);
        if (!(await exists('내 팔레트 ' + report.eyedrop))) throw new Error('내 팔레트에 보이지 않는다: ' + report.eyedrop);
        return '내 팔레트 ' + report.eyedrop;
      });
      await step('27-palette-restart', async () => {
        await driver.back(); await wait(700); await tapName(L.save); await wait(4000);
        await driver.terminateApp(PACKAGE); await wait(1500); await driver.activateApp(PACKAGE); await wait(5000);
        await tapName(L.projectCard); await wait(2500); await tapName('슬롯 1 작업 중'); await wait(4000);
        await tapName('팔레트 열기'); await wait(900);
        if (!(await exists('내 팔레트 ' + report.eyedrop))) throw new Error('재실행 뒤 내 팔레트가 없다');
        return '재실행 후 내 팔레트 유지';
      });
      await step('27-palette-reused', async () => { await tapName('내 팔레트 ' + report.eyedrop); await wait(1000); return '내 팔레트 색 재사용 — 패널 닫히고 도구바 색 반영'; });
      await step('27-last-tile', async () => {
        await tapName('그리기 닫기'); await wait(3500);
        const target = '슬롯 32 미착수';
        try {
          const el = await driver.$('android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().description("' + target + '"))');
          await el.waitForExist({ timeout: 8000 });
        } catch { for (let i = 0; i < 8 && !(await exists(target)); i++) { await stroke([at(.5, .72), at(.5, .38)], 400); await wait(700); } }
        const el = await byName(target, 5000); const p = await el.getLocation(), d = await el.getSize();
        report.lastTile = { x: p.x, y: p.y, w: d.width, h: d.height, window: size };
        await el.click(); await wait(4000);
        const where = await textOf('현재 칸'); report.lastTile.opened = where;
        if (!where || !where.includes('32번')) throw new Error('32번 칸이 열리지 않았다: ' + where);
        return '32번째 칸 열림: ' + where;
      });
    }
    // 27차 출시 구성 APK(검수 스위치 없음): 개발자 진입 없음 · PRO 우회 없음 · 색상 PRO 잠금.
    if (mode === '--r27rel') {
      await step('27r-color-lock', async () => {
        await tapName('팔레트 열기'); await wait(900);
        const lock = await exists('스포이드 PRO'), open = await exists('스포이드');
        report.release = { eyedropLocked: lock, eyedropOpen: open };
        if (!lock || open) throw new Error('출시 구성 스포이드 잠금 불일치');
        return '출시 구성: 스포이드 PRO 잠금';
      });
      await step('27r-color-custom', async () => {
        await tapName('직접 선택'); await wait(900);
        report.release.rgbOpen = await exists('빨강');
        if (report.release.rgbOpen) throw new Error('출시 구성 무료에 RGB 막대가 열려 있다');
        return '출시 구성: RGB·투명도 잠김';
      });
      await step('27r-lock-to-sheet', async () => {
        await driver.back(); await wait(700); await tapName('팔레트 열기'); await wait(900); await tapName('스포이드 PRO'); await wait(2000);
        if (!(await exists('PRO 닫기'))) throw new Error('잠긴 스포이드가 PRO 안내로 가지 않았다');
        return '잠긴 스포이드 → PRO 안내';
      });
      await step('27r-settings', async () => {
        await tapName('PRO 닫기'); await wait(1200); await driver.back(); await wait(700);
        await tapName('그리기 닫기'); await wait(3000); await tapName('뒤로'); await wait(1500); await tapName('설정'); await wait(1500);
        report.release.reviewSwitch = await exists('검수용 PRO 켜기');
        if (report.release.reviewSwitch) throw new Error('출시 구성에 검수용 PRO 스위치가 보인다');
        return '출시 구성 설정: 검수용 스위치 없음';
      });
      await step('27r-purchase', async () => {
        await driver.back(); await wait(1000); await tapName('PRO 보기'); await wait(1500);
        await tapName('PRO 시작하기'); await wait(5000);
        return 'PRO 시작하기 — 결제 모듈 없음 안내, 권한 미부여';
      });
      await step('27r-restore', async () => { await tapName('구매 복원').catch(async () => { await stroke([at(.5, .8), at(.5, .3)], 400); await tapName('구매 복원'); }); await wait(4000); return '구매 복원 — 권한 미부여'; });
      await step('27r-still-free', async () => {
        await tapName('PRO 닫기'); await wait(1500);
        report.release.homeLabel = (await exists('PRO 보기')) ? 'PRO 보기' : (await exists('PRO')) ? 'PRO' : null;
        if (report.release.homeLabel !== 'PRO 보기') throw new Error('구매·복원 시도 뒤 PRO로 표시된다: ' + report.release.homeLabel);
        return '홈 표시 무료(PRO 보기) 유지 + 안내 문구';
      });
    }

    // 27차 색상 재검수(같은 내부 APK). r27 에서 막대가 패널 스크롤 아래에 있어 닿지 못했고(스와이프가 하단 도구바에 떨어짐),
    // 스포이드는 이미 같은 색이던 상태라 추출 증거가 약했다. 이번에는 패널 안에서 스크롤하고, 다른 색을 든 채 파랑을 읽는다.
    if (mode === '--r27color') {
      const panelScroll = async () => {
        const top = await (await byName('팔레트 닫기', 5000)).getLocation();
        await stroke([{ x: Math.round(size.width / 2), y: top.y + 620 }, { x: Math.round(size.width / 2), y: top.y + 160 }], 500); await wait(700);
      };
      const revealIn = async name => { for (let i = 0; i < 5 && !(await exists(name)); i++) await panelScroll(); return byName(name, 4000); };
      const slide = async (name, fx) => { const el = await revealIn(name); const p = await el.getLocation(), d = await el.getSize(); await tapAt({ x: Math.round(p.x + d.width * fx), y: Math.round(p.y + d.height / 2) }); await wait(900); };
      await step('27c-pro-on', async () => {
        await tapName(L.save); await wait(3500);
        await tapName('그리기 닫기'); await wait(3000); await tapName('뒤로'); await wait(1500); await tapName('설정'); await wait(1500);
        await tapName('검수용 PRO 켜기'); await wait(1200);
        return '검수용 PRO 켜짐';
      });
      await step('27c-blue-line', async () => {
        await driver.back(); await wait(1200); await tapName(L.projectCard); await wait(2500); await tapName('슬롯 1 작업 중'); await wait(4000);
        await tapName('펜 굵기'); await wait(700); await tapName('굵기 24'); await wait(400); await tapName('펜 설정 닫기'); await wait(700);
        await tapName('팔레트 열기'); await wait(900); await tapName('팔레트'); await wait(600); await tapName('색 #54A9E8'); await wait(900);
        const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(.2 + i * .0375, .30));
        await stroke(pts, 20); await wait(800);
        return '파랑(#54A9E8) 굵은 직선';
      });
      await step('27c-rgb', async () => {
        await tapName('팔레트 열기'); await wait(900); await tapName('팔레트'); await wait(500); await tapName('색 #FFD15C'); await wait(900);
        await tapName('팔레트 열기'); await wait(900); await tapName('직접 선택'); await wait(900);
        const r0 = await (await revealIn('빨강 값')).getText();
        await slide('빨강', .15); const r1 = await textOf('빨강 값');
        report.color = { red: [r0, r1] };
        if (!r1 || r0 === r1) throw new Error('빨강 막대가 값을 바꾸지 않았다: ' + JSON.stringify(report.color));
        return '빨강 막대 ' + r0 + ' → ' + r1;
      });
      await step('27c-alpha', async () => {
        const a0 = await (await revealIn('투명도 값')).getText();
        await slide('투명도', .4); const a1 = await textOf('투명도 값');
        report.color.alpha = [a0, a1];
        if (!a1 || a0 === a1 || a1 === '100%') throw new Error('투명도 막대가 값을 바꾸지 않았다: ' + JSON.stringify(report.color));
        return '투명도 막대 ' + a0 + ' → ' + a1;
      });
      await step('27c-hex', async () => {
        await driver.back(); await wait(800); await tapName('팔레트 열기'); await wait(1000);
        const v = await textOf('지금 색 값'); report.color.hex = v;
        if (!v || v.length !== 9) throw new Error('색 값에 투명도가 없다: ' + v);
        return '적용된 색 값 ' + v;
      });
      await step('27c-alpha-stroke', async () => {
        await driver.back(); await wait(800);
        const pts = []; for (let i = 0; i <= 12; i++) pts.push(at(.45, .22 + i * .014));
        await stroke(pts, 25); await wait(1000);
        return '반투명 색으로 파랑 직선을 가로지르는 세로 획 — 겹친 자리에서 파랑이 비쳐야 한다';
      });
      await step('27c-eyedrop', async () => {
        await tapName('팔레트 열기'); await wait(900);
        const before = await textOf('지금 색 값');
        await tapName('스포이드'); await wait(1000); await byName('스포이드 취소', 4000);
        await tapAt(at(.75, .30)); await wait(1800);
        const after = await textOf('지금 색 값');
        report.eyedrop = { before, after };
        if (!after || !after.startsWith('#54A9E8') || (before && before.startsWith('#54A9E8'))) throw new Error('스포이드가 다른 색을 든 상태에서 파랑을 읽지 못했다: ' + JSON.stringify(report.eyedrop));
        return '스포이드 ' + before + ' → ' + after;
      });
      await step('27c-saved', async () => { await driver.back(); await wait(600); await tapName(L.save); await wait(4000); return '저장 — 반투명 획이 남아 있어야 한다'; });
    }

    // 28차 PRO 브러시 기반(내부 APK). 무료 펜·되돌리기 → 무료 잠금 → 검수용 PRO → 프리셋 4종 나란히 → 진하기 → 선 보정 끔/강 →
    // 27차 미검증 RGB·투명도 재검수(스크롤 기준 좌표를 스크롤 전에 한 번만 잡는다) → 스포이드 → 저장·재실행 복원 → 참고 → 다음 칸.
    if (mode === '--r28') {
      const hline = async (row, ms = 18) => { const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(.18 + i * .04, row)); await stroke(pts, ms); await wait(900); };
      const zigzag = async row => { const pts = []; for (let i = 0; i <= 40; i++) pts.push(at(.18 + i * .016, row + (i % 2 ? .009 : -.009))); await stroke(pts, 10); await wait(1000); };
      const clearCanvas = async () => { await tapName('더보기'); await wait(900); await tapName('이 그림 전부 지우기'); await wait(900); await (await driver.$('android=new UiSelector().text("지우기")')).click(); await wait(900); };
      const sheet = async () => { await tapName('펜 굵기'); await wait(1000); };
      const closeSheet = async () => { await tapName('펜 설정 닫기'); await wait(800); };
      const onScreen = async name => { if (!(await exists(name))) return false; const p = await (await driver.$('~' + name)).getLocation(); return p.y > 0 && p.y < size.height - 60; };
      const presetNames = ['매끈한 잉크', '부드러운 펜', '결 연필', '마커'];
      report.brush = {};
      await step('28-undo', async () => { await fingerTap(2); await wait(900); return '무료 펜 두 손가락 되돌리기'; });
      await step('28-redo', async () => { await fingerTap(3); await wait(900); return '세 손가락 다시 실행'; });
      await step('28-free-sheet', async () => {
        await sheet();
        const lock = { marker: await exists('브러시 마커 PRO'), strong: await exists('보정 강 PRO'), opacity: await exists('브러시 진하기 PRO'), light: await exists('보정 약'), switch: await exists('선 보정') };
        report.brush.freeLock = lock;
        if (!lock.marker || !lock.strong || !lock.opacity || !lock.light || !lock.switch) throw new Error('무료 브러시 잠금/유지 불일치: ' + JSON.stringify(lock));
        return '무료: 프리셋·진하기·보정 중강 PRO 잠금, 선 보정·약 유지';
      });
      await step('28-pro-on', async () => {
        await closeSheet(); await tapName(L.save); await wait(3500);
        await tapName('그리기 닫기'); await wait(3000); await tapName('뒤로'); await wait(1500); await tapName('설정'); await wait(1500);
        await tapName('검수용 PRO 켜기'); await wait(1200);
        return '검수용 PRO 켜짐';
      });
      await step('28-pro-sheet', async () => {
        await driver.back(); await wait(1200); await tapName(L.projectCard); await wait(2500); await tapName('슬롯 1 작업 중'); await wait(4000);
        await clearCanvas();
        await sheet(); await tapName('굵기 24'); await wait(500);
        const visible = {}; for (const n of [...presetNames.map(t => '브러시 ' + t), '진하기', '보정 강']) visible[n] = await onScreen(n);
        report.brush.sheetVisible = visible;
        if (Object.values(visible).some(v => !v)) throw new Error('펜 설정에서 스크롤 없이 보이지 않는 조절이 있다: ' + JSON.stringify(visible));
        return 'PRO 펜 설정 — 프리셋·진하기·보정이 스크롤 없이 보인다';
      });
      await step('28-presets', async () => {
        const rows = [.23, .31, .39, .47];
        for (let i = 0; i < 4; i++) { if (i) await sheet(); await tapName('브러시 ' + presetNames[i]); await wait(600); await closeSheet(); await hline(rows[i]); }
        report.brush.current = await textOf('지금 브러시');
        return '같은 굵기 24·같은 색으로 위부터 매끈한 잉크 / 부드러운 펜 / 결 연필 / 마커';
      });
      await step('28-opacity', async () => {
        await sheet(); await tapName('브러시 매끈한 잉크'); await wait(500);
        const el = await byName('진하기'); const p = await el.getLocation(), d = await el.getSize();
        await tapAt({ x: Math.round(p.x + d.width * .35), y: Math.round(p.y + d.height / 2) }); await wait(900);
        const v = await textOf('진하기 값'); report.brush.opacity = v;
        if (!v || v === '100%') throw new Error('진하기 막대가 값을 바꾸지 않았다: ' + v);
        await closeSheet();
        const pts = []; for (let i = 0; i <= 14; i++) pts.push(at(.5, .19 + i * .024)); await stroke(pts, 22); await wait(1000);
        return '진하기 ' + v + ' 매끈한 잉크 세로 획 — 네 프리셋 선 위로 비쳐야 한다';
      });
      await step('28-stabilizer', async () => {
        await clearCanvas();
        await sheet(); await tapName('보정 약'); await wait(400); await tapName('선 보정'); await wait(500); await closeSheet();
        await zigzag(.28);
        await sheet(); await tapName('선 보정'); await wait(400); await tapName('보정 강'); await wait(500);
        report.brush.strongSelected = await (await driver.$('~보정 강')).getAttribute('selected');
        await closeSheet();
        await zigzag(.44);
        return '같은 흔들림 입력: 위 = 선 보정 끔, 아래 = 보정 강';
      });
      await step('28-rgb', async () => {
        await tapName('팔레트 열기'); await wait(900); await tapName('직접 선택'); await wait(900);
        const anchorY = (await (await byName('팔레트 닫기')).getLocation()).y;
        const swipe = async () => { await stroke([{ x: Math.round(size.width * .08), y: anchorY + 640 }, { x: Math.round(size.width * .08), y: anchorY + 200 }], 500); await wait(700); };
        for (let i = 0; i < 5 && !(await onScreen('투명도')); i++) await swipe();
        const r0 = await textOf('빨강 값'), a0 = await textOf('투명도 값');
        const slide = async (name, fx) => { const el = await byName(name); const p = await el.getLocation(), d = await el.getSize(); await tapAt({ x: Math.round(p.x + d.width * fx), y: Math.round(p.y + d.height / 2) }); await wait(900); };
        await slide('빨강', .8); const r1 = await textOf('빨강 값');
        await slide('투명도', .45); const a1 = await textOf('투명도 값');
        report.color = { red: [r0, r1], alpha: [a0, a1] };
        if (!r1 || r0 === r1) throw new Error('빨강 막대가 값을 바꾸지 않았다: ' + JSON.stringify(report.color));
        if (!a1 || a0 === a1 || a1 === '100%') throw new Error('투명도 막대가 값을 바꾸지 않았다: ' + JSON.stringify(report.color));
        return 'RGB·투명도 막대 ' + JSON.stringify(report.color);
      });
      await step('28-rgb-applied', async () => {
        await driver.back(); await wait(800); await tapName('팔레트 열기'); await wait(1000);
        const v = await textOf('지금 색 값'); report.color.hex = v;
        if (!v || v.length !== 9) throw new Error('색 값에 투명도가 없다: ' + v);
        await driver.back(); await wait(800);
        const pts = []; for (let i = 0; i <= 14; i++) pts.push(at(.3, .19 + i * .024)); await stroke(pts, 22); await wait(1000);
        return '적용된 색 ' + v + ' — 세로 획이 지그재그 위로 비쳐야 한다';
      });
      await step('28-eyedrop', async () => {
        await tapName('팔레트 열기'); await wait(900);
        const before = await textOf('지금 색 값');
        await tapName('스포이드'); await wait(1000); await byName('스포이드 취소', 4000);
        await tapAt(at(.72, .44)); await wait(1800);
        const after = await textOf('지금 색 값'); report.eyedrop = { before, after };
        if (!after || after === before || !after.startsWith('#242424')) throw new Error('스포이드가 지그재그 색을 읽지 못했다: ' + JSON.stringify(report.eyedrop));
        await driver.back(); await wait(700);
        return '스포이드 ' + before + ' → ' + after;
      });
      await step('28-restored', async () => {
        await tapName(L.save); await wait(4000);
        await driver.terminateApp(PACKAGE); await wait(1500); await driver.activateApp(PACKAGE); await wait(5000);
        await tapName(L.projectCard); await wait(2500); await tapName('슬롯 1 작업 중'); await wait(4000);
        const current = await textOf('지금 브러시');
        await sheet();
        const opacity = await textOf('진하기 값'), strong = await (await driver.$('~보정 강')).getAttribute('selected');
        report.brush.restored = { current, opacity, strong };
        if (current !== '매끈한 잉크' || opacity !== report.brush.opacity || String(strong) !== 'true') throw new Error('재실행 뒤 브러시 설정 복원 불일치: ' + JSON.stringify(report.brush.restored));
        return '재실행 후 복원 ' + JSON.stringify(report.brush.restored);
      });
      await step('28-reference', async () => { await closeSheet(); await tapName('참고'); await wait(1000); if (!(await exists('참고 추가'))) throw new Error('참고 줄이 열리지 않았다'); return '참고 줄 열림'; });
      await step('28-next-tile', async () => {
        await tapName('참고'); await wait(700); await tapName('더보기'); await wait(900); await tapName('다음 칸'); await wait(4000);
        const where = await textOf('현재 칸'); report.nextTile = where;
        if (!where || !where.includes('02번')) throw new Error('다음 칸으로 가지 않았다: ' + where);
        return '다음 칸: ' + where;
      });
    }

    // 28차 재검수(같은 APK). r28 은 ⋯ 메뉴의 '전부 지우기'가 메뉴 스크롤 아래라 캔버스를 비우지 못해 이후가 연쇄 실패했다.
    // 이번에는 비우는 대신 **다음 칸**(메뉴 맨 위)으로 빈 캔버스를 얻고, 단계마다 남은 알림을 먼저 닫는다.
    if (mode === '--r28b') {
      const dismiss = async () => { try { const ok = await driver.$('id=android:id/button1'); if (await ok.isExisting()) { await ok.click(); await wait(600); report.notes.push('남은 알림을 닫음'); } } catch { /* 없으면 그만 */ } };
      const hline = async (row, ms = 18) => { const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(.18 + i * .04, row)); await stroke(pts, ms); await wait(900); };
      const zigzag = async row => { const pts = []; for (let i = 0; i <= 40; i++) pts.push(at(.18 + i * .016, row + (i % 2 ? .009 : -.009))); await stroke(pts, 10); await wait(1000); };
      const sheet = async () => { await dismiss(); await tapName('펜 굵기'); await wait(1000); };
      const closeSheet = async () => { await tapName('펜 설정 닫기'); await wait(800); };
      const nextTile = async expect => { await dismiss(); await tapName('더보기'); await wait(900); await tapName('다음 칸'); await wait(4500); const where = await textOf('현재 칸'); if (!where || !where.includes(expect)) throw new Error('다음 칸 이동 실패: ' + where); return where; };
      const presetNames = ['매끈한 잉크', '부드러운 펜', '결 연필', '마커'];
      report.brush = {};
      await step('28b-pro-on', async () => {
        await tapName(L.save); await wait(3500);
        await tapName('그리기 닫기'); await wait(3000); await tapName('뒤로'); await wait(1500); await tapName('설정'); await wait(1500);
        await tapName('검수용 PRO 켜기'); await wait(1200);
        await driver.back(); await wait(1200); await tapName(L.projectCard); await wait(2500); await tapName('슬롯 1 작업 중'); await wait(4000);
        return '검수용 PRO 켜짐 · 01번 칸';
      });
      await step('28b-tile2', async () => { const where = await nextTile('02번'); report.tile2 = where; return '빈 캔버스를 위해 다음 칸 이동: ' + where; });
      await step('28b-sheet', async () => {
        await sheet(); await tapName('굵기 24'); await wait(500);
        const visible = {};
        for (const n of [...presetNames.map(t => '브러시 ' + t), '진하기', '보정 강']) { const el = await driver.$('~' + n); visible[n] = (await el.isExisting()) && (await el.getLocation()).y < size.height - 60; }
        report.brush.sheetVisible = visible;
        if (Object.values(visible).some(v => !v)) throw new Error('스크롤 없이 보이지 않는 조절: ' + JSON.stringify(visible));
        return 'PRO 펜 설정 — 프리셋·진하기·보정이 스크롤 없이 보인다';
      });
      await step('28b-presets', async () => {
        const rows = [.23, .31, .39, .47];
        for (let i = 0; i < 4; i++) {
          if (i) await sheet();
          await tapName('브러시 ' + presetNames[i]); await wait(500);
          if (i === 0) { const el = await byName('진하기'); const p = await el.getLocation(), d = await el.getSize(); await tapAt({ x: Math.round(p.x + d.width * .995), y: Math.round(p.y + d.height / 2) }); await wait(700); report.brush.opacityForPresets = await textOf('진하기 값'); }
          await closeSheet(); await hline(rows[i]);
        }
        report.brush.current = await textOf('지금 브러시');
        return '같은 굵기 24·같은 색·진하기 ' + report.brush.opacityForPresets + ' — 위부터 매끈한 잉크 / 부드러운 펜 / 결 연필 / 마커';
      });
      await step('28b-undo', async () => { await dismiss(); await fingerTap(2); await wait(1200); return '마커 획 되돌리기(두 손가락) — 네 번째 줄이 사라져야 한다'; });
      await step('28b-redo', async () => { await fingerTap(3); await wait(1200); return '다시 실행(세 손가락) — 마커 줄이 돌아와야 한다'; });
      await step('28b-tile3', async () => { await tapName(L.save); await wait(3500); const where = await nextTile('03번'); report.tile3 = where; return '다음 칸: ' + where; });
      await step('28b-stabilizer', async () => {
        await sheet(); await tapName('브러시 매끈한 잉크'); await wait(400); await tapName('선 보정'); await wait(500); await closeSheet();
        report.brush.offSwitch = await (await driver.$('~선 보정')).isExisting();
        await zigzag(.28);
        await sheet(); await tapName('선 보정'); await wait(400); await tapName('보정 강'); await wait(500);
        report.brush.strongSelected = await (await driver.$('~보정 강')).getAttribute('selected');
        await closeSheet();
        await zigzag(.44);
        return '같은 흔들림 입력: 위 = 선 보정 끔, 아래 = 보정 강';
      });
      await step('28b-eyedrop', async () => {
        await dismiss();
        await tapName('팔레트 열기'); await wait(900); await tapName('팔레트'); await wait(500); await tapName('색 #54A9E8'); await wait(900);
        await tapName('팔레트 열기'); await wait(900);
        const before = await textOf('지금 색 값');
        await tapName('스포이드'); await wait(1000); await byName('스포이드 취소', 4000);
        await tapAt(at(.5, .44)); await wait(1800);
        await dismiss();
        const after = await textOf('지금 색 값'); report.eyedrop = { before, after };
        if (!after || after === before || !after.startsWith('#242424')) throw new Error('스포이드가 지그재그 색을 읽지 못했다: ' + JSON.stringify(report.eyedrop));
        await driver.back(); await wait(700);
        return '스포이드 ' + before + ' → ' + after;
      });
      await step('28b-restored', async () => {
        await dismiss(); await tapName(L.save); await wait(4000);
        await driver.terminateApp(PACKAGE); await wait(1500); await driver.activateApp(PACKAGE); await wait(5000);
        await tapName(L.projectCard); await wait(2500);
        await tapName('슬롯 3 작업 중'); await wait(4000);
        const current = await textOf('지금 브러시');
        await sheet();
        const opacity = await textOf('진하기 값'), strong = await (await driver.$('~보정 강')).getAttribute('selected');
        report.brush.restored = { current, opacity, strong };
        if (current !== '매끈한 잉크' || opacity !== report.brush.opacityForPresets || String(strong) !== 'true') throw new Error('재실행 뒤 브러시 설정 복원 불일치: ' + JSON.stringify(report.brush.restored));
        return '재실행 후 복원 ' + JSON.stringify(report.brush.restored);
      });
      await step('28b-reference', async () => { await closeSheet(); await tapName('참고'); await wait(1000); if (!(await exists('참고 추가'))) throw new Error('참고 줄이 열리지 않았다'); return '참고 줄 열림'; });
    }
    if (mode === '--r25') {
      await gate('R1-painter', async () => '페인터 기본 — 펜 3종 에셋·선 샘플 · 색과 굵기 한 줄 · 머리의 되돌리기/다시 실행');
      await gate('R2-pen-panel', async () => { await tapName('펜 굵기', 8000); await wait(1800); return '펜 설정 패널 — 종류 선택이 겹쳐 있지 않아야 한다'; });
      await step('R3-home', async () => {
        await tapName('펜 설정 닫기', 6000).catch(() => {});
        await wait(600);
        await tapName('저장', 8000); await wait(5000);
        await driver.back(); await wait(3000); await driver.back(); await wait(3500);
        return '홈 — 작품이 있는 상태';
      });
    }
    if (mode === '--bar') {
      await gate('B1-base', async () => '기본 상태 — 도구바와 색');
      await gate('B2-color-open', async () => { await tapName('팔레트 열기', 8000); await wait(1800); return '색 패널이 올라오고 도구바는 남는다'; });
      await gate('B3-quick', async () => { await tapName('색 #E94F4F', 8000); await wait(1500); return '견본 → 닫히고 같은 도구로 복귀'; });
      await step('B4-draw', async () => { await scribble(0.55); await wait(900); return '펜 재선택 없이 바로 그린다'; });
      await step('B5-eraser', async () => { await tapName('지우개', 8000); await wait(1200); return '지우개로 전환'; });
      await step('B6-fill', async () => { await tapName('채우기', 8000); await wait(1200); return '채우기로 전환'; });
      await step('B7-brush-panel', async () => { await tapName('펜', 8000); await wait(900); await tapName('펜', 8000); await wait(1800); return '펜 종류 패널 — 도구바 유지'; });
      await step('B8-swap', async () => { await tapName('펜 종류 닫기', 6000).catch(() => {}); await tapName('펜 굵기', 8000); await wait(1800); return '다른 설정으로 교체'; });
      await step('B9-caption-keyboard', async () => {
        await tapName('펜 굵기 닫기', 6000).catch(() => {});
        await tapName('문구', 8000); await wait(1500);
        const box = await driver.$('~문구 내용'); await box.waitForExist({ timeout: 6000 }); await box.click(); await wait(1500);
        return '키보드 열린 문구 패널';
      });
      await step('B10-after-keyboard', async () => {
        try { await driver.hideKeyboard(); } catch { /* 이미 닫혔으면 그만 */ }
        await wait(1500);
        return '키보드 닫은 뒤 배치 복원';
      });
      await step('B11-selection', async () => {
        await tapName('문구 닫기', 6000).catch(() => {});
        await tapName('선택', 8000); await wait(1000);
        await stroke([at(0.18, 0.26), at(0.45, 0.31), at(0.80, 0.38)], 220);
        await wait(2500);
        return '선택 패널 — 취소·적용이 바닥에 고정';
      });
    }
    if (mode === '--wait') {
      await gate('X1-cut', async () => { await tapName(L.save); await wait(4500); return '그림이 있는 칸 · 저장까지 마친 상태'; });
      await gate('X2-tool', async () => { await tapName(L.toolSelect); await wait(1200); return '선택 도구'; });
      await gate('X3-lift', async () => { await stroke([at(0.18, 0.26), at(0.45, 0.31), at(0.80, 0.38)], 220); await wait(3000); return '선택 들어올림'; });
      await gate('X4-wait50s', async () => { await wait(50000); return '50초 대기 — 자동저장 주기를 넘겼다'; });
      await gate('X5-still', async () => { return '선택이 남아 있어야 한다 (점선·손잡이·취소/적용)'; });
      await gate('X6-move', async () => { await stroke([at(0.49, 0.32), at(0.40, 0.50)], 600); await wait(2000); return '기다린 뒤 이동'; });
      await gate('X7-apply', async () => { await tapName(L.selectApply, 8000); await wait(2500); return '적용'; });
      await gate('X8-save', async () => { await tapName(L.save, 8000); await wait(5500); return '저장'; });
      await gate('X9-restart', async () => {
        await driver.terminateApp(PACKAGE); await wait(1500);
        await driver.activateApp(PACKAGE); await wait(5500);
        return '껐다 켜기';
      });
      await step('X10-board', async () => { await tapName(L.projectCard, 10000); await wait(3500); return '보드'; });
      await step('X11-reopen', async () => {
        try { await tapName('슬롯 1 작업 중', 6000); } catch { await tapName('슬롯 1 완성', 6000); }
        await wait(4500);
        return '같은 칸(01번)을 다시 열어 위치 확인';
      });
    }
    if (mode === '--fix') {
      await gate('W1-select-lift', async () => {
        await tapName('선택', 8000); await wait(1000);
        await stroke([at(0.18, 0.26), at(0.45, 0.31), at(0.80, 0.38)], 220);
        await wait(3000);
        return '선택 들어올림';
      });
      await gate('W2-select-move', async () => {
        // 기록을 남기기 위한 단 한 번의 끌기. 분기 결과는 logcat 의 SELPROBE 에서 읽는다.
        await stroke([at(0.49, 0.32), at(0.40, 0.50)], 600);
        await wait(2000);
        return '선택 안을 끌었다 — 분기 기록 확인';
      });
      await step('W3-after', async () => { await wait(600); return '끈 뒤 상태'; });
      await step('W4-caption-keyboard', async () => {
        await tapName('선택 적용', 5000).catch(() => {});
        await wait(1200);
        await tapName('문구', 8000); await wait(1800);
        const box = await driver.$('~문구 내용'); await box.waitForExist({ timeout: 6000 }); await box.click(); await wait(1200);
        await box.setValue('안녕');
        await wait(1500);
        return '키보드가 열린 문구 패널 — 입력칸과 적용이 보여야 한다';
      });
      await step('W5-board', async () => {
        try { await driver.hideKeyboard(); } catch { /* 이미 닫혔으면 그만 */ }
        await wait(800);
        await tapName('문구 닫기', 5000).catch(() => {});
        await tapName('저장', 8000); await wait(5000);
        await driver.back(); await wait(3500);
        return '세트 화면 — 제출 준비가 상단에 크게';
      });
      await step('W6-more-again', async () => {
        await tapName('새 이모티콘 세트 이어서 만들기', 10000); await wait(4000);
        await tapName('더보기', 8000); await wait(1500);
        await tapName('작업 도구 닫기', 6000); await wait(1200);
        await tapName('더보기', 8000); await wait(1500);
        return '⋯ 메뉴 재진입 — 닫았다 다시 열린다';
      });
    }
    if (mode === '--ui2') {
      await gate('V1-brush', async () => { await tapName('펜', 8000); await wait(2000); return '펜 종류 — 도구 그림과 실제 선 샘플'; });
      await gate('V2-color', async () => { await tapName('펜 종류 닫기', 6000); await wait(900); await tapName('팔레트 열기', 8000); await wait(1800); return '색 패널로 교체'; });
      await gate('V3-quick', async () => { await tapName('색 #E94F4F', 8000); await wait(1800); return '견본 한 번 → 닫히고 그리기로 복귀'; });
      await step('V4-same-tool', async () => { await scribble(0.55); await wait(1200); return '도구가 펜 그대로라 바로 이어 그린다'; });
      await step('V5-eraser-color', async () => {
        await tapName('지우개', 6000); await wait(900);
        await tapName('팔레트 열기', 8000); await wait(1200);
        await tapName('색 #54A9E8', 8000); await wait(1500);
        return '지우개에서 색을 골라도 지우개가 그대로여야 한다';
      });
      await step('V6-caption', async () => { await tapName('펜', 6000); await wait(700); await tapName('펜 종류 닫기', 5000).catch(() => {}); await tapName('문구', 8000); await wait(2000); return '문구도 같은 하단 패널'; });
    }
    if (mode === '--ui') {
      await gate('U1-draw', async () => '그리기 — 종이 질감·도구 줄·색 칩');
      await gate('U2-brush', async () => { await tapName('펜', 8000); await wait(800); await tapName('펜', 6000); await wait(1800); return '펜 종류 — 도구 그림과 실제 선 샘플'; });
      await step('U3-width', async () => { await tapName('펜 굵기 닫기', 4000).catch(() => {}); await tapName('펜 굵기', 8000); await wait(1500); return '굵기 — 다른 설정으로 교체된다'; });
      await step('U4-color', async () => { await tapName('팔레트 열기', 8000); await wait(1500); return '색 — 또 교체된다'; });
      await step('U5-quick', async () => { await tapName('색 #E94F4F', 8000); await wait(1500); return '견본 한 번 → 닫히고 그리기로 복귀'; });
      await step('U6-draw-after', async () => { await scribble(0.52); await wait(900); return '도구가 펜 그대로라 바로 이어 그린다'; });
      await step('U7-caption', async () => { await tapName('문구', 8000); await wait(1800); return '문구도 같은 하단 패널'; });
      await step('U8-more', async () => { await tapName('문구 닫기', 5000).catch(() => {}); await tapName('더보기', 8000); await wait(1800); return '작업 도구 — 이것만 배경이 어둡다'; });
      await gate('U9-home', async () => {
        await tapName('작업 도구 닫기', 5000).catch(() => {});
        await tapName('저장', 8000); await wait(5000);
        await driver.back(); await wait(3000); await driver.back(); await wait(3000);
        return '홈 — 제목 옆 종이 캐릭터';
      });
      await step('U10-settings', async () => { await tapName('설정', 8000); await wait(2000); return '설정 — 질감 스위치와 지우개 캐릭터'; });
    }
    if (mode === '--contrast') {
      await gate('C1-draw', async () => '그리기 — 탭·저장·도구 이름·설명');
      await step('C2-menu', async () => { await tapName('더보기', 8000); await wait(2000); return '⋯ 메뉴 — 묶음 이름과 비활성 항목'; });
      await step('C3-motion', async () => { await tapName('더보기', 5000); await wait(800); await tapName('움직이기', 8000); await wait(3500); return '움직이기 — 카드·슬라이더·설명'; });
      await step('C4-preset', async () => { await tapName('통통', 8000); await wait(2500); return '선택 상태 — 노랑 배경 + 차콜 글자'; });
      await gate('C5-save', async () => { await tapName('그리기', 6000); await wait(1500); await tapName('저장', 8000); await wait(5500); return '저장됨 — 비활성 상태 글자'; });
      await gate('C6-home', async () => { await driver.back(); await wait(3000); await driver.back(); await wait(3000); return '홈'; });
      await step('C7-settings', async () => { await tapName('설정', 8000); await wait(2000); return '설정 — 안내문과 배너'; });
      await step('C8-board', async () => {
        await tapName('닫기', 6000); await wait(1200);
        await tapName('새 이모티콘 세트 이어서 만들기', 10000); await wait(4000);
        await driver.back(); await wait(3500);
        return '세트 — 제목·진행·칸 번호';
      });
      await step('C9-export', async () => { await tapName('제출 준비', 8000); await wait(3500); return '제출 준비 — 설명 글이 가장 많은 화면'; });
    }
    if (mode === '--menu') {
      await gate('M-more', async () => { await tapName('더보기', 8000); await wait(2000); return '⋯ 메뉴 — 묶음과 아이콘'; });
      await step('M-settings-on', async () => {
        await tapName('더보기', 5000); await wait(1000);
        await tapName('저장', 8000); await wait(5000);
        await driver.back(); await wait(3000);
        await driver.back(); await wait(3000);
        await tapName('설정', 8000); await wait(1800);
        await tapName('검수용 PRO 켜기', 6000); await wait(1500);
        return '검수용 PRO 를 켠 상태';
      });
    }
    if (mode === '--rest') {
      await gate('R1-caption-open', async () => { await tapName('문구'); await wait(2000); return '문구 넣기 창'; });
      await gate('R2-caption-typed', async () => {
        const box = await driver.$('~문구 내용'); await box.waitForExist({ timeout: 6000 }); await box.setValue('안녕하세요');
        await wait(600); await tapName('문구 적용', 6000); await wait(2500);
        return '문구를 넣었다';
      });
      await gate('R3-caption-pick', async () => { await tapName('문구 고르기', 8000); await wait(2000); return '문구 편집 중 — 파란 표시와 조작 줄'; });
      await step('R4-caption-move', async () => {
        await stroke([at(0.5, 0.60), at(0.34, 0.40)], 700); await wait(1500);
        await tapName('문구 크게', 6000); await wait(700);
        await tapName('문구 오른쪽 회전', 6000); await wait(1200);
        return '끌어 옮기고 키우고 돌렸다';
      });
      await gate('R5-motion-tab', async () => { await tapName('움직이기', 8000); await wait(3500); return '탭 전환 — 선택 표시가 남지 않아야 한다'; });
      await step('R6-back-to-draw', async () => { await tapName('그리기', 6000); await wait(2000); return '그리기로 복귀 — 잔상이 없어야 한다'; });
      await gate('R7-save', async () => { await tapName('저장', 8000); await wait(5500); return '저장'; });
      await gate('R8-restart', async () => {
        await driver.terminateApp(PACKAGE); await wait(1500);
        await driver.activateApp(PACKAGE); await wait(5500);
        return '재실행';
      });
      await step('R9-settings', async () => { await tapName('설정', 8000); await wait(2000); return '설정 — 내부 검수용 빌드 표시'; });
      await step('R10-review-on', async () => { await tapName('검수용 PRO 켜기', 6000); await wait(1500); return '검수용 PRO 켜짐'; });
      await gate('R11-board', async () => {
        await tapName('닫기', 6000); await wait(1200);
        await tapName('새 이모티콘 세트 이어서 만들기', 10000); await wait(4000);
        await driver.back(); await wait(3500);
        return '세트 화면 — 머리글에 제출 준비가 보여야 한다';
      });
      await step('R12-export', async () => { await tapName('제출 준비', 8000); await wait(3500); return '스크롤 없이 제출 준비로 들어갔다'; });
      await step('R13-menu', async () => {
        await driver.back(); await wait(2500);
        await tapName('새 이모티콘 세트 이어서 만들기', 10000); await wait(4000);
        await tapName('더보기', 8000); await wait(2000);
        return '⋯ 메뉴 — 아이콘과 묶음';
      });
    }
    if (mode === '--five') {
      await gate('F1-draw-new', async () => '새 디자인의 그리기 화면 · 색 동그라미가 늘어서 있지 않아야 한다');
      await gate('F2-palette', async () => { await tapName('팔레트 열기'); await wait(1500); return '팔레트 — 작은 사각 격자와 최근 줄'; });
      await step('F3-custom', async () => { await tapName('직접 선택'); await wait(1500); return '직접 선택 — 색상 줄·채도명도 면·HEX'; });
      await step('F4-picked', async () => { await tapName('팔레트', 5000); await wait(800); await tapName('색 #54A9E8', 6000); await wait(1200); return '고른 색이 테두리와 체크로 표시된다'; });
      await gate('F5-closed', async () => { await tapName('팔레트 닫기'); await wait(1200); return '닫으면 간결한 줄로 돌아온다'; });
      await gate('F6-caption', async () => {
        await tapName('문구'); await wait(1500);
        await (await byName('문구', 6000)).click().catch(() => {});
        return '문구 넣기 창';
      });
      await step('F7-caption-typed', async () => {
        const box = await driver.$('~문구'); await box.setValue('안녕하세요');
        await wait(600); await tapName('문구 적용', 6000); await wait(2000);
        return '문구를 넣었다';
      });
      await step('F8-caption-pick', async () => { await tapName('문구 고르기', 6000); await wait(1500); return '문구 편집 중 — 파란 표시와 조작 줄'; });
      await step('F9-caption-move', async () => {
        await stroke([at(0.5, 0.62), at(0.36, 0.42)], 600); await wait(1200);
        await tapName('문구 크게', 5000); await wait(600);
        await tapName('문구 오른쪽 회전', 5000); await wait(900);
        return '끌어 옮기고 키우고 돌렸다';
      });
      await gate('F10-motion', async () => { await tapName('움직이기'); await wait(3000); return '탭 전환 — 선택 표시가 남지 않아야 한다'; });
      await step('F11-motion-applied', async () => { await tapName('통통', 8000); await wait(3000); return '새 디자인의 움직이기 화면'; });
      await gate('F12-save', async () => { await tapName('그리기', 5000); await wait(1500); await tapName('저장', 8000); await wait(5000); return '저장'; });
      await gate('F13-restart', async () => {
        await driver.terminateApp(PACKAGE); await wait(1500);
        await driver.activateApp(PACKAGE); await wait(5000);
        return '재실행 — 문구 자리가 유지돼야 한다';
      });
      await step('F14-settings', async () => { await tapName('설정', 6000); await wait(1800); return '설정 — 내부 검수용 빌드 표시와 스위치'; });
      await step('F15-review-on', async () => { await tapName('검수용 PRO 켜기', 6000); await wait(1500); return '검수용 PRO 켜짐'; });
      await step('F16-board', async () => { await tapName('닫기', 5000); await wait(1000); await tapName('새 이모티콘 세트 이어서 만들기', 8000); await wait(3000); await driver.back(); await wait(3000); return '세트 화면 — 머리글에 제출 준비'; });
      await step('F17-export', async () => { await tapName('제출 준비', 8000); await wait(3000); return '스크롤 없이 제출 준비로 들어갔다'; });
      await step('F18-menu', async () => {
        await driver.back(); await wait(2500);
        await tapName('새 이모티콘 세트 이어서 만들기', 8000); await wait(3500);
        await tapName('더보기', 6000); await wait(1500);
        return '⋯ 메뉴 — 아이콘과 묶음';
      });
    }
    if (mode === '--select') {
      await gate('S1-cut', async () => { await tapName(L.save); await wait(4500); return '그림이 있는 칸 · 저장까지 마친 상태'; });
      await gate('S2-tool', async () => { await tapName(L.toolSelect); await wait(1200); return '선택 도구 진입'; });
      await gate('S3-lift', async () => {
        // 첫 획을 감싸는 사각형 하나. 한 번의 곧은 드래그다.
        await stroke([at(0.18, 0.26), at(0.45, 0.31), at(0.80, 0.38)], 220);
        await wait(2500);
        return '마키로 영역을 잡고 손을 떼 들어올림 — 점선과 손잡이가 보여야 한다';
      });
      await step('S4-move', async () => { await stroke([at(0.49, 0.32), at(0.42, 0.46)], 500); await wait(1500); return '선택 영역을 캔버스에서 끌어 이동'; });
      await step('S5-scale', async () => { for (let i = 0; i < 3; i++) { await tapName(L.selScale, 5000); await wait(500); } await wait(800); return '크기 3회(회당 1.1배)'; });
      await step('S6-rotate', async () => { for (let i = 0; i < 2; i++) { await tapName(L.selRotate, 5000); await wait(500); } await wait(800); return '회전 2회(회당 15도)'; });
      await step('S7-flip', async () => { await tapName(L.selFlip, 5000); await wait(1200); return '좌우 반전'; });
      await step('S8-cancel', async () => { await tapName(L.selectCancel, 5000); await wait(1800); return '취소 — 원본이 그대로 돌아와야 한다'; });
      await gate('S9-reselect', async () => {
        await stroke([at(0.18, 0.26), at(0.45, 0.31), at(0.80, 0.38)], 220);
        await wait(3000);
        return '다시 선택해 들어올림';
      });
      await gate('S9b-move', async () => { await stroke([at(0.49, 0.32), at(0.40, 0.52)], 500); await wait(2000); return '아래 왼쪽으로 옮김 — 적용 전 위치'; });
      await gate('S10-apply', async () => { await tapName(L.selectApply, 5000); await wait(2000); return '적용 — 점선과 손잡이가 사라져야 한다'; });
      await gate('S11-save', async () => { await tapName(L.save, 8000); await wait(5000); return '적용 결과 저장'; });
      await gate('S12-restart', async () => {
        await driver.terminateApp(PACKAGE); await wait(1500);
        await driver.activateApp(PACKAGE); await wait(5000);
        return '껐다 켠 뒤 — 옮긴 결과가 남아 있어야 한다';
      });
      await step('S13-export', async () => {
        await tapName(L.projectCard, 10000); await wait(3000);
        for (let i = 0; i < 6; i++) { await stroke([at(0.5, 0.82), at(0.5, 0.22)], 240); await wait(400); }
        await tapName(L.exportEntry, 8000); await wait(3500);
        for (let i = 0; i < 3; i++) { await stroke([at(0.5, 0.82), at(0.5, 0.30)], 240); await wait(400); }
        return '저장 파일 미리보기 — 점선·손잡이가 섞였는지 본다';
      });
    }
    if (mode === '--motion') {
      await step('M1-motion-clean', async () => { await tapName(L.tabMotion); await wait(3500); return '그리기만 한 상태에서 움직이기 탭'; });
      await step('M2-preset', async () => { await tapName(L.presetBounce); await wait(3500); return '통통 적용'; });
    }
    if (full) {
      await step('08-layers', async () => { await tapName(L.layerRail); await wait(1200); await tapName(L.addLayer); await wait(1200); await scribble(0.5); await wait(600); return '그림 추가 뒤 새 층에 획 1개'; });
      await step('09-select', async () => {
        await tapName(L.layerRail); await wait(1000);   // 레이어 줄을 닫아야 도구 줄이 나온다
        await tapName(L.toolSelect); await wait(800);
        await stroke([at(0.22, 0.26), at(0.40, 0.26), at(0.62, 0.26), at(0.72, 0.33), at(0.72, 0.40), at(0.50, 0.40), at(0.22, 0.40), at(0.22, 0.33), at(0.22, 0.26)], 180);
        await wait(2500);
        return '선택 올가미 — 손잡이가 보여야 한다';
      });
      await step('10-select-applied', async () => {
        await stroke([at(0.43, 0.37), at(0.55, 0.30)], 400);  // 들어올린 것을 옮긴다
        await wait(600);
        await tapName(L.selectApply, 5000); await wait(1200);
        return '옮긴 뒤 적용';
      });
      await step('11-motion', async () => { try { await tapName(L.toolPen, 4000); } catch { /* 선택 줄이 떠 있으면 도구 줄이 없다 */ } await tapName(L.tabMotion); await wait(2500); return '움직이기 탭'; });
      await step('12-motion-applied', async () => { await tapName(L.presetBounce); await wait(3500); return '통통 적용 — 미리보기가 움직여야 한다'; });
      await step('12b-back-to-draw', async () => { await tapName(L.tabDraw); await wait(2000); return '그리기 탭으로 복귀'; });
    }

    if (!['--r26', '--r27', '--r27rel', '--r27color', '--r28', '--r28b', '--motion', '--select', '--persist', '--five', '--rest', '--menu', '--contrast', '--ui', '--ui2', '--fix', '--wait', '--bar', '--b9'].includes(mode)) {
      await gate('06-save', async () => { const t = Date.now(); await tapName(L.save); await wait(4000); return '저장 누름 · ' + (Date.now() - t) + 'ms 뒤 캡처'; });
      await gate('07-restart', async () => {
        await driver.terminateApp(PACKAGE); await wait(1500);
        await driver.activateApp(PACKAGE); await wait(5000);
        return '껐다 켠 뒤 — 작품이 남아 있어야 한다 · 설정 아이콘이 카드에 가리지 않아야 한다';
      });
    }

    // 저장된 세트를 실제로 내보낸다. 재실행 뒤이므로 홈에서 세트로 들어가 제출 화면까지 간다.
    if (full) {
      await gate('13-export', async () => {
        await tapName(L.projectCard, 10000); await wait(3000);   // 홈 → 보드
        for (let i = 0; i < 6; i++) { await stroke([at(0.5, 0.82), at(0.5, 0.22)], 240); await wait(500); }
        await tapName(L.exportEntry, 8000); await wait(3500);
        return '제출 화면';
      });
      await step('14-share', async () => { for (let i = 0; i < 8; i++) { await stroke([at(0.5, 0.82), at(0.5, 0.22)], 240); await wait(400); } await tapName(L.exportSet, 8000); await wait(14000); return '작업 파일 만들기 — 공유 시트가 떠야 한다'; });
    }

    try {
      const logs = await driver.getLogs('logcat');
      const text = logs.map(l => l.message || '');
      report.crashes = text.filter(m => /FATAL|AndroidRuntime|ReactNativeJS.*(Error|Warn)/.test(m)).slice(0, 40);
      // 'Text strings must be rendered within a <Text> component' 는 화면에 붉은 상자로도 뜨지만
      // 릴리스 번들에서는 그냥 죽는다. 기록에서 직접 찾아 있고 없음을 적는다.
      const textErrors = text.filter(m => /Text strings must be rendered/.test(m));
      report.textStringError = { found: textErrors.length > 0, lines: textErrors.slice(0, 10) };
      fs.writeFileSync(path.join(OUT, 'logcat-' + (full ? 'full' : 'smoke') + '.txt'), text.join('\n'));
    } catch (e) { report.notes.push('logcat 을 기기에서 받지 못했다(BrowserStack 은 REST 로 따로 받는다): ' + e.message); }
  } finally {
    clearTimeout(watchdog);
    await close('done');
    flush();
  }
  console.log('');
  console.log('캡처와 보고서: ' + OUT);
  console.log('이 스크립트는 합격을 매기지 않는다. 캡처를 사람이 보고 판단한다.');
})().catch(e => { console.error(String(e && e.message ? e.message : e)); process.exit(1); });
