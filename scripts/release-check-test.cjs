// release-check.cjs · plugins/withReleaseSigning.js 규칙 검사. 실제 키·비밀번호·서명 없이 합성 입력으로만 돈다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const rc = require('./release-check.cjs');
const { applyReleaseSigning } = require('../plugins/withReleaseSigning.js');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(__dirname, 'fixtures/app-build.gradle.template'), 'utf8');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
try {
  // ── 서명 플러그인 변환 ─────────────────────────────────────────────────────────────────────
  assert.match(rc.checkGradle(template)[0].message, /디버그 키로 서명/, 'prebuild 템플릿 그대로면 release 가 디버그 키 → FAIL');
  const signed = applyReleaseSigning(template);
  assert.equal(rc.checkGradle(signed)[0].status, 'PASS', '플러그인 적용 후 서명 구조 PASS');
  assert.equal(applyReleaseSigning(signed), signed, '두 번 적용해도 같다(prebuild 반복 안전)');
  // 39차: 가드가 라이브러리 모듈의 bundleLibRuntimeToJarRelease 를 AAB 로 착각해 내부 검수 APK 까지 막았다.
  assert.ok(!signed.includes("it.startsWith('bundle') && it.endsWith('Release')"), 'AAB 판정은 라이브러리 bundleLib*Release 작업을 세지 않는다');
  assert.ok(signed.includes('graph.allTasks.findAll { it.project == project }') && signed.includes("it == 'bundleRelease'"), 'AAB 판정은 앱 모듈의 bundleRelease 작업만 본다');
  assert.ok(/if \(bundling \|\| !emoticonAllowDebugRelease\)/.test(signed), 'AAB 는 여전히 디버그 서명 허용값으로도 막힌다');
  const types = signed.indexOf('buildTypes {'), relStart = signed.indexOf('release {', types);
  assert.ok(!/^\s*signingConfig signingConfigs\.debug\s*$/m.test(signed.slice(relStart, signed.indexOf('\n        }', relStart))), 'release 에 무조건 디버그 서명 줄이 남지 않는다');
  assert.ok(signed.includes("findProperty(name) ?: System.getenv(name)"), '값은 gradle.properties 또는 환경변수에서만 읽는다');
  assert.ok(!/storePassword\s+'(?!android')/.test(signed), '저장소 파일에 업로드 키 비밀번호 문자열이 없다');
  assert.throws(() => applyReleaseSigning(template.replace('signingConfig signingConfigs.debug\n            def enableShrink', 'signingConfig signingConfigs.other\n            def enableShrink')), /template changed/, '템플릿 모양이 바뀌면 조용히 넘어가지 않고 멈춘다');
  assert.equal(rc.checkGradle(null)[0].status, 'FAIL', 'android/ 가 없으면 FAIL');
  const assignStyle = signed.replace(/signingConfig emoticonUploadConfigured \?[^\n]*/, 'signingConfig = signingConfigs.debug');
  assert.match(rc.checkGradle(assignStyle)[0].message, /디버그 키로 서명/, '새 템플릿의 `signingConfig = signingConfigs.debug` 표기도 잡는다');
  assert.throws(() => applyReleaseSigning(template.replace(/(release \{\n[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig = signingConfigs.debug')), /template changed/, 'release 줄 표기가 바뀌면 플러그인이 멈춘다(조용히 디버그 서명을 남기지 않음)');

  // ── CONFIG ────────────────────────────────────────────────────────────────────────────────
  const good = { version: '1.0.0', android: { package: 'com.emoticonstudio.app', versionCode: 3 }, extra: { internalReview: false, receiptEndpoint: 'https://verify.example/receipt', privacyPolicyUrl: 'https://privacy.example/policy', supportEmail: 'support@example.com' } };
  const status = (cfg, opts) => Object.fromEntries(rc.checkConfig(cfg, opts).map(r => [r.id, r.status]));
  assert.deepEqual(Object.values(status(good, { released: [{ versionCode: 2 }] })).filter(s => s !== 'PASS'), [], '좋은 설정은 전부 PASS');
  assert.equal(status({ ...good, extra: { ...good.extra, internalReview: true } }).internal_review_off, 'FAIL', '내부 검수 켜짐 → FAIL');
  assert.equal(status({ ...good, extra: { internalReview: false } }).receipt_endpoint, 'FAIL', '영수증 서버 주소 없음 → FAIL');
  assert.equal(status({ ...good, extra: { internalReview: false, receiptEndpoint: 'http://plain' } }).receipt_endpoint, 'FAIL', 'https 아님 → FAIL');
  assert.equal(status({ ...good, android: { ...good.android, package: 'com.example.app' } }).application_id, 'FAIL', 'applicationId 다름 → FAIL');
  assert.equal(status(good, { released: [{ versionCode: 3 }] }).version_code, 'FAIL', '이미 올린 versionCode 재사용 → FAIL');
  assert.equal(status({ ...good, android: { ...good.android, versionCode: 1.5 } }).version_code, 'FAIL', '정수 아님 → FAIL');
  assert.equal(status({ ...good, android: { package: 'com.emoticonstudio.app' } }).version_code, 'FAIL', 'versionCode 없음 → FAIL');
  assert.equal(status(good, { gradleText: 'versionCode 3\n versionName "1.0.0"' }).native_version_sync, 'PASS');
  assert.equal(status(good, { gradleText: 'versionCode 1\n versionName "1.0.0"' }).native_version_sync, 'FAIL', 'android/ 가 옛 versionCode 면 FAIL');

  // ── 서명 입력·저장소 비밀 ─────────────────────────────────────────────────────────────────
  const userProps = path.join(tmp, 'user.properties'), projectProps = path.join(tmp, 'project.properties');
  fs.writeFileSync(projectProps, 'android.useAndroidX=true\n');
  assert.equal(rc.checkSigningInputs({ env: {}, userProperties: userProps, projectProperties: projectProps })[0].status, 'FAIL', '업로드 키 설정 없음 → FAIL');
  fs.writeFileSync(userProps, rc.SIGNING_KEYS.map(k => `${k}=x`).join('\n'));
  const inputs = rc.checkSigningInputs({ env: {}, userProperties: userProps, projectProperties: projectProps });
  assert.deepEqual(inputs.map(r => r.status), ['PASS', 'PASS'], '사용자 gradle.properties 에 4개 → PASS');
  assert.ok(!inputs.map(r => r.message).join().includes('=x'), '값은 출력하지 않는다');
  // 비밀번호 대입 문자열은 조립해서 만든다 — 이 테스트 파일 자체가 저장소 비밀 검사에 걸리지 않도록
  const passwordLine = value => 'EMOTICON_UPLOAD_STORE_' + 'PASSWORD=' + value;
  fs.writeFileSync(projectProps, passwordLine('x') + '\n');
  assert.equal(rc.checkSigningInputs({ env: {}, userProperties: userProps, projectProperties: projectProps })[1].status, 'FAIL', '프로젝트 gradle.properties 에 서명 값 → FAIL');
  const texts = { 'release/upload-signing.example.properties': 'EMOTICON_UPLOAD_STORE_PASSWORD=<set-locally>', 'docs/x.md': 'set EMOTICON_UPLOAD_KEY_PASSWORD=<your-password>' };
  assert.equal(rc.checkRepoSecrets(['android/app/debug.keystore', ...Object.keys(texts)], f => texts[f] ?? '')[0].status, 'PASS', '자리표시자와 디버그 키는 통과');
  assert.equal(rc.checkRepoSecrets(['release/upload.jks'], () => '')[0].status, 'FAIL', '키 파일이 저장소에 있으면 FAIL');
  assert.equal(rc.checkRepoSecrets(['secrets.properties'], () => passwordLine('hunter2'))[0].status, 'FAIL', '실제 비밀번호 값이 있으면 FAIL');
  assert.equal(rc.checkRepoSecrets(['scripts/release-check-test.cjs'], f => fs.readFileSync(path.join(root, f), 'utf8'))[0].status, 'PASS', '이 테스트 파일은 비밀 검사에 걸리지 않는다');

  // ── 인증서 판정 ─────────────────────────────────────────────────────────────────────────
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'release/nonrelease-certificates.json'), 'utf8'));
  assert.equal(policy.debug, 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c', '디버그 인증서 지문(apksigner 로 확인한 값)');
  assert.equal(rc.checkCertificate([policy.debug], policy)[0].status, 'FAIL', '디버그 키 서명 → FAIL');
  assert.equal(rc.checkCertificate(['ab'.repeat(32)], { debug: policy.debug, dryRun: [{ sha256: 'ab'.repeat(32) }] })[0].kind, 'dry-run', '검증용 임시 키 → FAIL(dry-run)');
  assert.equal(rc.checkCertificate(['cd'.repeat(32)], policy, 'cd'.repeat(32))[0].status, 'PASS', '등록한 업로드 키와 같으면 PASS');
  assert.equal(rc.checkCertificate(['cd'.repeat(32)], policy)[0].status, 'FAIL', '대조할 업로드 키 지문이 없으면 PASS 로 두지 않는다');
  assert.equal(rc.checkCertificate([], policy)[0].status, 'FAIL', '서명 없음 → FAIL');

  // ── AAB 판독: 합성 ZIP + PKCS#7 ────────────────────────────────────────────────────────────
  const der = (tag, ...parts) => { const body = Buffer.concat(parts); const len = body.length < 128 ? Buffer.from([body.length]) : body.length < 256 ? Buffer.from([0x81, body.length]) : Buffer.from([0x82, body.length >> 8, body.length & 255]); return Buffer.concat([Buffer.from([tag]), len, body]); };
  const cert = der(0x30, der(0x30, der(0x02, Buffer.from([1])), Buffer.from('fake-certificate-body'.repeat(8))));
  const pkcs7 = der(0x30, der(0x06, Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02])), der(0xa0, der(0x30, der(0x02, Buffer.from([1])), der(0x31), der(0x30, der(0x06, Buffer.from([1]))), der(0xa0, cert))));
  assert.deepEqual(rc.certificatesFromPkcs7(pkcs7).map(sha), [sha(cert)], 'PKCS#7 에서 인증서 DER 을 꺼내 SHA-256');
  const zip = entries => {
    const locals = [], centrals = []; let offset = 0;
    for (const [name, data, deflate] of entries) {
      const body = deflate ? zlib.deflateRawSync(data) : data, n = Buffer.from(name), crc = zlib.crc32(data) >>> 0;
      const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(deflate ? 8 : 0, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26);
      const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(deflate ? 8 : 0, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
      locals.push(lh, n, body); centrals.push(ch, n); offset += 30 + n.length + body.length;
    }
    const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, end]);
  };
  const bundleEntries = (appConfig, extra = []) => [
    ['BundleConfig.pb', Buffer.from('cfg')],
    ['base/manifest/AndroidManifest.xml', Buffer.from(' package com.emoticonstudio.app   com.android.vending.BILLING')],
    ['base/assets/app.config', Buffer.from(JSON.stringify(appConfig)), true],
    ['base/assets/index.android.bundle', Buffer.from('var __BUNDLE_START_TIME__'), true],
    ['base/dex/classes.dex', Buffer.from('dex\nexpo/modules/iap/ExpoIapModule'), true],
    ['META-INF/UPLOAD.RSA', pkcs7],
    ...extra,
  ];
  const aab = path.join(tmp, 'good.aab');
  fs.writeFileSync(aab, zip(bundleEntries({ extra: { internalReview: false, receiptEndpoint: 'https://verify.example/receipt', privacyPolicyUrl: 'https://privacy.example/policy', supportEmail: 'support@example.com' } })));
  const info = rc.inspectBundle(aab);
  assert.deepEqual(info.certificates, [sha(cert)], 'AAB 서명 인증서 지문');
  assert.deepEqual(rc.checkArtifact(info).filter(r => r.status !== 'PASS').map(r => r.id), [], '완전한 AAB 는 산출물 검사 PASS');
  fs.writeFileSync(aab, zip(bundleEntries({ extra: { internalReview: true } }).filter(([n]) => !n.startsWith('base/dex'))));
  const bad = Object.fromEntries(rc.checkArtifact(rc.inspectBundle(aab)).map(r => [r.id, r.status]));
  assert.deepEqual([bad.bundle_internal_review_off, bad.bundle_receipt_endpoint, bad.expo_iap_native], ['FAIL', 'FAIL', 'FAIL'], '내부 검수 켜짐·서버 주소 없음·expo-iap 없음 → 각각 FAIL');

  // ── 요약: 서명과 에셋을 구분 ──────────────────────────────────────────────────────────────
  const onlyAssets = rc.summarize([{ group: 'CONFIG', status: 'PASS' }, { group: 'SIGNING', status: 'PASS' }, { group: 'ARTIFACT', status: 'PASS' }, { group: 'ASSETS', status: 'BLOCKED' }]);
  assert.deepEqual([onlyAssets.groups.SIGNING, onlyAssets.groups.ASSETS, onlyAssets.exitCode], ['PASS', 'BLOCKED', 2], 'SIGNING PASS / ASSET BLOCKED 는 종료 코드 2');
  assert.equal(rc.summarize([{ group: 'SIGNING', status: 'FAIL' }, { group: 'ASSETS', status: 'PASS' }]).exitCode, 1, '서명 FAIL 은 종료 코드 1');

  // ── 실제 저장소 설정 ────────────────────────────────────────────────────────────────────
  const config = require(path.join(root, 'app.config.js'))();
  assert.equal(config.android.package, rc.EXPECTED_APPLICATION_ID);
  assert.ok(Number.isInteger(config.android.versionCode), 'versionCode 가 app.json 에 명시돼 있다');
  assert.ok((config.plugins || []).includes('./plugins/withReleaseSigning'), '서명 플러그인이 설정에 연결돼 있다');

  console.log('PASS: release check — 서명 플러그인(템플릿 디버그 서명 제거·업로드 키만·AAB 디버그 서명 차단 가드·반복 적용 안전·템플릿 변경 시 중단), 설정(내부 검수·영수증 서버 https·applicationId·versionCode 증가/정수·네이티브 버전 동기), 서명 입력(이름만·값 미출력·프로젝트 properties 비밀 FAIL), 저장소 키 파일·비밀번호 값 탐지, 인증서(디버그·임시 키·미등록 FAIL, 등록 키 PASS), AAB 판독(ZIP·PKCS#7·BILLING·JS 번들·expo-iap·app.config), 요약 SIGNING PASS / ASSETS BLOCKED 구분.');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
