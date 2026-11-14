// asset-check.cjs 의 판정 규칙 검사. 가짜 PNG/JPEG 를 임시 폴더에 만들어 넣고, 실제 저장소의 템플릿 이미지로 해시 판정을 확인한다.
// 여기서 만드는 이미지는 검사용 픽셀 덩어리일 뿐 앱 에셋이 아니다(임시 폴더에만 쓰고 지운다).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { inspectFile, checkAll, readJpeg } = require('./asset-check.cjs');

const root = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'assets/asset-contract.json'), 'utf8'));

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
// alpha: RGBA 로 쓸지 / hole: 투명하게 만들 픽셀 [x, y] / 두 번째 줄부터 Up 필터로 써서 필터 해석까지 확인한다.
function png(width, height, { alpha = false, hole = null, shade = 180 } = {}) {
  const ch = alpha ? 4 : 3, stride = width * ch;
  const rows = [];
  let prev = null;
  for (let y = 0; y < height; y++) {
    const cur = Buffer.alloc(stride, shade);
    if (alpha) for (let x = 0; x < width; x++) cur[x * 4 + 3] = hole && hole[0] === x && hole[1] === y ? 0 : 255;
    if (prev) { const up = Buffer.alloc(stride); for (let i = 0; i < stride; i++) up[i] = (cur[i] - prev[i]) & 255; rows.push(Buffer.from([2]), up); }
    else rows.push(Buffer.from([0]), cur);
    prev = cur;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
function jpegHeader(width, height) {
  // SOI + SOF0 만 있는 최소 헤더(크기 판독만 확인)
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-check-'));
const put = (rel, buf) => { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); return f; };
const byId = (results, id) => results.find(r => r.id === id);
try {
  // ── 판독기: 실제 템플릿 파일과 합성 이미지 ─────────────────────────────────────────────────
  const icon = inspectFile(path.join(root, 'assets/icon.png'));
  assert.deepEqual([icon.format, icon.width, icon.height, icon.alphaChannel], ['png', 1024, 1024, false], '템플릿 아이콘: RGB 1024');
  assert.equal(icon.sha256, contract.templateFingerprints['assets/icon.png'], '템플릿 해시가 계약과 같다');
  assert.equal(inspectFile(path.join(root, 'assets/android-icon-foreground.png')).transparentPixels, true, '템플릿 앞면은 투명 픽셀이 있다');
  assert.equal(inspectFile(put('opaque.png', png(40, 30, { alpha: true }))).transparentPixels, false, 'RGBA 라도 모두 불투명이면 투명 픽셀 없음');
  assert.equal(inspectFile(put('hole.png', png(40, 30, { alpha: true, hole: [17, 20] }))).transparentPixels, true, 'Up 필터 줄의 한 픽셀 투명도까지 읽는다');
  assert.deepEqual(readJpeg(jpegHeader(1024, 500)), { width: 1024, height: 500 }, 'JPEG 크기 판독');

  // ── 아무것도 없을 때: P0 FAIL, P2 WARN ────────────────────────────────────────────────────
  let results = checkAll({ root: tmp, contract });
  for (const id of ['app_icon', 'adaptive_foreground', 'adaptive_background', 'adaptive_monochrome', 'splash_icon', 'play_icon', 'feature_graphic', 'phone_screenshots'])
    assert.equal(byId(results, id).status, 'FAIL', id + ' 없음 → FAIL');
  assert.equal(byId(results, 'brush_preset_previews').status, 'WARN', 'P2 브러시 견본 없음 → WARN');

  // ── 모두 규격대로 넣으면 PASS ─────────────────────────────────────────────────────────────
  put('assets/brand/app-icon.png', png(1024, 1024));
  put('assets/brand/adaptive-foreground.png', png(1024, 1024, { alpha: true, hole: [0, 0] }));
  put('assets/brand/adaptive-background.png', png(1024, 1024, { shade: 240 }));
  put('assets/brand/adaptive-monochrome.png', png(1024, 1024, { alpha: true, hole: [5, 5], shade: 0 }));
  put('assets/brand/splash-icon.png', png(1024, 1024, { alpha: true, hole: [1, 1] }));
  put('assets/store/play-icon-512.png', png(512, 512, { alpha: true }));
  put('assets/store/feature-graphic.jpg', jpegHeader(1024, 500));
  put('assets/store/screenshots/phone-01.png', png(1080, 1920));
  put('assets/store/screenshots/phone-02.jpg', jpegHeader(1080, 1920));
  for (const name of ['ink', 'soft', 'grain', 'marker']) put(`assets/brush/preset-${name}.png`, png(300, 84, { alpha: true, hole: [0, 0] }));
  const goodConfig = {
    icon: './assets/brand/app-icon.png',
    android: { adaptiveIcon: { foregroundImage: './assets/brand/adaptive-foreground.png', backgroundImage: './assets/brand/adaptive-background.png', monochromeImage: './assets/brand/adaptive-monochrome.png' } },
    plugins: ['expo-sharing', ['expo-splash-screen', { image: './assets/brand/splash-icon.png', imageWidth: 200 }]],
  };
  results = checkAll({ root: tmp, contract, config: goodConfig, splashModuleInstalled: true });
  assert.deepEqual(results.filter(r => r.status !== 'PASS').map(r => r.id + ': ' + r.messages.join(' / ')), [], '규격대로 넣으면 전부 PASS');

  // ── 규칙 위반은 각자 FAIL ─────────────────────────────────────────────────────────────────
  put('assets/brand/app-icon.png', fs.readFileSync(path.join(root, 'assets/icon.png')));
  assert.match(byId(checkAll({ root: tmp, contract }), 'app_icon').messages.join(), /템플릿/, '브랜드 자리에 템플릿을 복사해 넣으면 FAIL');
  put('assets/brand/app-icon.png', png(1024, 1024, { alpha: true }));
  assert.match(byId(checkAll({ root: tmp, contract }), 'app_icon').messages.join(), /알파 채널이 없어야/, 'iOS 아이콘에 알파 채널이 있으면 FAIL');
  put('assets/brand/app-icon.png', png(512, 512));
  assert.match(byId(checkAll({ root: tmp, contract }), 'app_icon').messages.join(), /1024×1024/, '크기가 틀리면 FAIL');
  put('assets/brand/app-icon.png', png(1024, 1024));
  put('assets/brand/splash-icon.png', png(1024, 1024, { alpha: true }));
  assert.match(byId(checkAll({ root: tmp, contract }), 'splash_icon').messages.join(), /투명해야/, '스플래시 배경이 투명하지 않으면 FAIL');
  put('assets/brand/splash-icon.png', png(1024, 1024, { alpha: true, hole: [1, 1] }));
  put('assets/store/feature-graphic.jpg', jpegHeader(1024, 512));
  assert.equal(byId(checkAll({ root: tmp, contract }), 'feature_graphic').status, 'FAIL', '피처 그래픽 크기 틀림 → FAIL');
  put('assets/store/feature-graphic.jpg', jpegHeader(1024, 500));
  put('assets/store/screenshots/phone-02.jpg', jpegHeader(1080, 2400));
  assert.match(byId(checkAll({ root: tmp, contract }), 'phone_screenshots').messages.join(), /2배/, '긴 변이 짧은 변의 2배를 넘으면 FAIL');
  fs.rmSync(path.join(tmp, 'assets/store/screenshots/phone-02.jpg'));
  assert.match(byId(checkAll({ root: tmp, contract }), 'phone_screenshots').messages.join(), /2장 이상/, '스크린샷 1장 → FAIL');
  put('assets/store/screenshots/phone-02.png', png(720, 1280, { alpha: true }));
  const shots = byId(checkAll({ root: tmp, contract }), 'phone_screenshots');
  assert.equal(shots.status, 'FAIL'); assert.match(shots.messages.join(), /알파 채널/, '스크린샷에 알파 채널 → FAIL'); assert.match(shots.messages.join(), /권장 1080/, '1080 미만은 경고 문구');

  // ── 설정: 템플릿을 가리키거나 스플래시가 없으면 FAIL ─────────────────────────────────────────
  fs.mkdirSync(path.join(tmp, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(root, 'assets/icon.png'), path.join(tmp, 'assets/icon.png'));
  const cfg = byId(checkAll({ root: tmp, contract, config: { ...goodConfig, icon: './assets/icon.png' }, splashModuleInstalled: false }), 'app_config');
  assert.equal(cfg.status, 'FAIL');
  assert.match(cfg.messages.join(), /expo\.icon → \.\/assets\/icon\.png 는 Expo 템플릿/, '설정이 템플릿 아이콘을 가리키면 FAIL');
  assert.match(cfg.messages.join(), /expo-splash-screen 이 설치되지/, '스플래시 모듈 미설치 → FAIL');
  assert.match(byId(checkAll({ root: tmp, contract, config: { ...goodConfig, plugins: [] }, splashModuleInstalled: true }), 'app_config').messages.join(), /연결되지 않았어요/, '스플래시 미연결 → FAIL');

  // ── 네이티브: 템플릿으로 만든 리소스가 남으면 FAIL ──────────────────────────────────────────
  const nativeDir = path.join(tmp, 'android/app/src/main/res');
  // 템플릿 스플래시 견본: 이 저장소의 android/ 는 실제 에셋으로 바뀌었으므로(2026-10-03) 보관해 둔 템플릿 파일을 쓴다.
  const realNative = path.join(root, 'scripts/fixtures/template-splashscreen_logo.png');
  if (fs.existsSync(realNative)) {
    put('android/app/src/main/res/drawable-mdpi/splashscreen_logo.png', fs.readFileSync(realNative));
    assert.equal(byId(checkAll({ root: tmp, contract, nativeDir }), 'native_resources').status, 'FAIL', 'prebuild 전 템플릿 스플래시 리소스 → FAIL');
    put('android/app/src/main/res/drawable-mdpi/splashscreen_logo.png', png(288, 288, { alpha: true, hole: [0, 0] }));
    assert.equal(byId(checkAll({ root: tmp, contract, nativeDir }), 'native_resources').status, 'PASS', '새로 만든 리소스면 PASS');
  }

  // ── 실제 앱 설정: 브랜드 파일이 없으면 템플릿으로 떨어지고, 검사는 그걸 FAIL 로 잡는다 ─────────────
  const appConfig = require(path.join(root, 'app.config.js'))();
  const brandPresent = fs.existsSync(path.join(root, 'assets/brand/app-icon.png'));
  assert.equal(appConfig.icon, brandPresent ? './assets/brand/app-icon.png' : './assets/icon.png', '앱 아이콘은 브랜드 파일이 있으면 그것, 없으면 템플릿');
  const real = byId(checkAll({ root, contract, config: appConfig, splashModuleInstalled: false }), 'app_config');
  if (!brandPresent) assert.match(real.messages.join(), /Expo 템플릿/, '지금 저장소 설정은 템플릿을 가리키므로 출시 검사가 FAIL 한다');
  assert.equal(appConfig.extra.internalReview, false, '에셋 연결이 기존 빌드 구성 값을 건드리지 않는다');

  console.log('PASS: asset check — PNG 크기·알파 채널·투명 픽셀(필터 해석 포함)·JPEG 크기 판독, 계약 P0 없음 FAIL·P2 WARN, 규격대로면 전부 PASS, 템플릿 복사·알파·크기·스플래시 불투명·피처 그래픽 크기·스크린샷 비율/장수/알파 FAIL, 설정의 템플릿 참조·스플래시 모듈 미설치·미연결 FAIL, android 템플릿 리소스 잔존 FAIL, 실제 app.config 는 브랜드 파일 없으면 템플릿으로 떨어지고 검사가 잡는다.');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
