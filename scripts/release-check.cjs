#!/usr/bin/env node
// 출시 빌드 검사 — 네 갈래를 따로 판정한다. 비밀 값은 읽지도 출력하지도 않는다(설정됐는지 이름만 본다).
//   CONFIG   : 앱 설정(app.config.js 결과) — 내부 검수 꺼짐 · 영수증 서버 주소 · applicationId · versionCode/Name
//   SIGNING  : 서명 구조(android/app/build.gradle) · 서명 입력(이름만) · 저장소에 키/비밀번호 없음 · (AAB 가 있으면) 서명 인증서
//   ARTIFACT : AAB 내용 — applicationId · BILLING 권한 · release JS 번들 · expo-iap 네이티브 · app.config 값
//   ASSETS   : scripts/asset-check.cjs 결과(브랜드 에셋). 에셋 미도착은 BLOCKED 로 따로 표시한다.
// 종료 코드: 0 전부 PASS · 1 CONFIG/SIGNING/ARTIFACT 에 FAIL · 2 그 셋은 통과했고 ASSETS 만 BLOCKED
//
// 사용: node scripts/release-check.cjs [--aab <path>] [--identity <out.json>]
//   출시 검사는 EMOTICON_INTERNAL_REVIEW 없이, EMOTICON_RECEIPT_ENDPOINT 를 넣은 셸에서 돌린다.
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { httpsUrl, email } = require('../release/config-values.cjs');

const root = path.resolve(__dirname, '..');
const EXPECTED_APPLICATION_ID = 'com.emoticonstudio.app';
const SIGNING_KEYS = ['EMOTICON_UPLOAD_STORE_FILE', 'EMOTICON_UPLOAD_STORE_PASSWORD', 'EMOTICON_UPLOAD_KEY_ALIAS', 'EMOTICON_UPLOAD_KEY_PASSWORD'];
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

// ── ZIP(AAB) 읽기 ────────────────────────────────────────────────────────────────────────────
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('ZIP 끝 레코드가 없어요(AAB 가 아님)');
  const count = buf.readUInt16LE(eocd + 10), cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP 중앙 디렉터리가 손상됐어요');
    const method = buf.readUInt16LE(p + 10), comp = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    entries.set(buf.toString('utf8', p + 46, p + 46 + nameLen), { method, comp, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = name => {
    const e = entries.get(name);
    if (!e) return null;
    const nl = buf.readUInt16LE(e.local + 26), el = buf.readUInt16LE(e.local + 28), start = e.local + 30 + nl + el;
    const data = buf.subarray(start, start + e.comp);
    return e.method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
  };
  return { names: [...entries.keys()], read };
}

// ── 서명 블록(PKCS#7)에서 인증서 꺼내기 — keytool 의 SHA256 과 같은 값(인증서 DER 의 SHA-256) ───────────
function tlv(buf, off) {
  let len = buf[off + 1], head = 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = len * 256 + buf[off + 2 + i]; head = 2 + n; }
  return { tag: buf[off], start: off, contentStart: off + head, end: off + head + len };
}
function children(buf, node) {
  const out = [];
  for (let p = node.contentStart; p < node.end;) { const c = tlv(buf, p); out.push(c); p = c.end; }
  return out;
}
function certificatesFromPkcs7(der) {
  const top = tlv(der, 0);
  const [, explicit] = children(der, top);
  if (!explicit || explicit.tag !== 0xa0) return [];
  const signedData = children(der, explicit)[0];
  if (!signedData) return [];
  const certs = children(der, signedData).find(c => c.tag === 0xa0);
  return certs ? children(der, certs).filter(c => c.tag === 0x30).map(c => der.subarray(c.start, c.end)) : [];
}

const row = (group, id, status, message, extra = {}) => ({ group, id, status, message, ...extra });

// ── CONFIG ──────────────────────────────────────────────────────────────────────────────────
function checkConfig(config, { released = [], gradleText = null } = {}) {
  const out = [];
  const internal = config?.extra?.internalReview === true;
  out.push(row('CONFIG', 'internal_review_off', internal ? 'FAIL' : 'PASS', internal ? '내부 검수 빌드 설정이 켜져 있어요(EMOTICON_INTERNAL_REVIEW=1 없이 빌드)' : '내부 검수 스위치 꺼짐'));
  out.push(...checkPurchases(config, 'CONFIG', ''));
  out.push(...checkContact(config, 'CONFIG', ''));
  const endpoint = config?.extra?.receiptEndpoint;
  const endpointOk = typeof endpoint === 'string' && /^https:\/\//.test(endpoint);
  const closedMissing = config?.extra?.purchases === 'closed' && endpoint === undefined;
  out.push(row('CONFIG', 'receipt_endpoint', endpointOk ? 'PASS' : closedMissing ? 'WARN' : 'FAIL', endpointOk ? '영수증 확인 서버 주소 있음(https)' : closedMissing ? '명시적 구매 비활성 테스트: 영수증 서버 미설정 허용' : '영수증 확인 서버 주소가 없어요 — 서버 배포 후 EMOTICON_RECEIPT_ENDPOINT 로 빌드', { external: !endpointOk }));
  const pkg = config?.android?.package;
  out.push(row('CONFIG', 'application_id', pkg === EXPECTED_APPLICATION_ID ? 'PASS' : 'FAIL', `android.package = ${pkg ?? '(없음)'}${pkg === EXPECTED_APPLICATION_ID ? '' : ` — ${EXPECTED_APPLICATION_ID} 이어야 해요`}`));
  const code = config?.android?.versionCode, maxReleased = Math.max(0, ...released.map(r => r.versionCode));
  const codeOk = Number.isInteger(code) && code >= 1 && code > maxReleased;
  out.push(row('CONFIG', 'version_code', codeOk ? 'PASS' : 'FAIL', `android.versionCode = ${code ?? '(없음)'} · 올린 적 있는 최대 ${maxReleased}${codeOk ? '' : ' — 정수이고 이전 업로드보다 커야 해요(app.json 에서 올린다)'}`));
  const name = config?.version;
  out.push(row('CONFIG', 'version_name', /^\d+\.\d+\.\d+$/.test(name ?? '') ? 'PASS' : 'FAIL', `version = ${name ?? '(없음)'}`));
  if (gradleText) {
    const g = gradleText.match(/versionCode (\d+)/), n = gradleText.match(/versionName "([^"]+)"/);
    const synced = g && Number(g[1]) === code && n && n[1] === name;
    out.push(row('CONFIG', 'native_version_sync', synced ? 'PASS' : 'FAIL', synced ? 'android/ 의 버전이 설정과 같아요' : `android/ 버전(${g?.[1]} / ${n?.[1]})이 설정(${code} / ${name})과 달라요 — npx expo prebuild --platform android 필요`));
  }
  return out;
}

// ── SIGNING ─────────────────────────────────────────────────────────────────────────────────
function checkGradle(text) {
  if (!text) return [row('SIGNING', 'release_signing_structure', 'FAIL', 'android/app/build.gradle 이 없어요 — npx expo prebuild --platform android')];
  const types = text.indexOf('buildTypes {');
  const relStart = types >= 0 ? text.indexOf('release {', types) : -1;
  const relBlock = relStart >= 0 ? text.slice(relStart, text.indexOf('\n        }', relStart)) : '';
  const problems = [];
  if (!text.includes('// @emoticon-release-signing')) problems.push('출시 서명 플러그인이 적용되지 않았어요(plugins/withReleaseSigning.js → prebuild, 또는 npm run release:apply-signing)');
  if (/^\s*signingConfig\s*=?\s*signingConfigs\.debug\s*$/m.test(relBlock)) problems.push('release 빌드가 디버그 키로 서명돼요');
  if (!relBlock.includes('emoticonUploadConfigured ? signingConfigs.release')) problems.push('release 빌드가 업로드 키 설정을 쓰지 않아요');
  if (!text.includes('Release app bundles are never signed with the debug key')) problems.push('AAB 디버그 서명 차단 가드가 없어요');
  return [row('SIGNING', 'release_signing_structure', problems.length ? 'FAIL' : 'PASS', problems.length ? problems.join(' · ') : 'release → 업로드 키, AAB 디버그 서명 차단')];
}
function propertyKeys(file) {
  if (!fs.existsSync(file)) return new Set();
  return new Set(fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => (l.match(/^\s*([\w.]+)\s*=/) || [])[1]).filter(Boolean));
}
function checkSigningInputs({ env = process.env, userProperties, projectProperties }) {
  const userKeys = propertyKeys(userProperties), projectKeys = propertyKeys(projectProperties);
  const missing = SIGNING_KEYS.filter(k => !env[k] && !userKeys.has(k));
  const out = [row('SIGNING', 'signing_inputs', missing.length ? 'FAIL' : 'PASS', missing.length ? `업로드 키 설정이 없어요: ${missing.join(', ')} (값은 ~/.gradle/gradle.properties 또는 환경변수)` : '업로드 키 설정 4개가 있어요(값은 읽지 않음)', { external: missing.length === SIGNING_KEYS.length })];
  const leaked = SIGNING_KEYS.filter(k => projectKeys.has(k));
  out.push(row('SIGNING', 'no_project_properties_secret', leaked.length ? 'FAIL' : 'PASS', leaked.length ? `android/gradle.properties 에 서명 값이 있어요: ${leaked.join(', ')} — 사용자 gradle.properties 로 옮기세요` : '프로젝트 gradle.properties 에 서명 값 없음'));
  return out;
}
function checkRepoSecrets(files, readText) {
  const keys = files.filter(f => /\.(jks|keystore|p12|pfx)$/i.test(f) && !/(^|\/)debug\.keystore$/.test(f));
  const pw = /EMOTICON_UPLOAD_(STORE|KEY)_PASSWORD\s*[=:]\s*(?!<)[^\s"'`<]+/;
  const textFiles = files.filter(f => /\.(properties|json|js|cjs|mjs|ts|tsx|md|gradle|env|txt|ya?ml)$/i.test(f) || /(^|\/)\.env/.test(f));
  const withPassword = textFiles.filter(f => { const t = readText(f); return t !== null && pw.test(t); });
  const bad = [...keys.map(f => `키 파일: ${f}`), ...withPassword.map(f => `비밀번호 값: ${f}`)];
  return [row('SIGNING', 'no_secrets_in_repo', bad.length ? 'FAIL' : 'PASS', bad.length ? bad.join(' · ') : '저장소(추적·미추적)에 키 파일·비밀번호 값 없음')];
}
function checkCertificate(fingerprints, policy, expected) {
  if (!fingerprints.length) return [row('SIGNING', 'signing_certificate', 'FAIL', 'AAB 에 서명이 없어요')];
  if (fingerprints.length > 1) return [row('SIGNING', 'signing_certificate', 'FAIL', `서명 인증서가 ${fingerprints.length}개예요`)];
  const fp = fingerprints[0];
  if (fp === policy.debug) return [row('SIGNING', 'signing_certificate', 'FAIL', `디버그 키로 서명됐어요 (${fp})`, { kind: 'debug' })];
  if ((policy.dryRun || []).some(d => d.sha256 === fp)) return [row('SIGNING', 'signing_certificate', 'FAIL', `검증용 임시 키로 서명됐어요 — Play 에 올리면 안 돼요 (${fp})`, { kind: 'dry-run' })];
  if (expected && expected.toLowerCase() !== fp) return [row('SIGNING', 'signing_certificate', 'FAIL', `등록한 업로드 키와 달라요 (${fp})`, { kind: 'unexpected' })];
  return [row('SIGNING', 'signing_certificate', expected ? 'PASS' : 'FAIL', expected ? `등록한 업로드 키로 서명됨 (${fp})` : `디버그·임시 키는 아니지만 EMOTICON_UPLOAD_CERT_SHA256 로 등록한 업로드 키와 대조하지 않았어요 (${fp})`, { kind: expected ? 'upload' : 'unverified' })];
}

// ── ARTIFACT ────────────────────────────────────────────────────────────────────────────────
function inspectBundle(aabPath) {
  const buf = fs.readFileSync(aabPath);
  const zip = readZip(buf);
  const manifest = zip.read('base/manifest/AndroidManifest.xml');
  const appConfigRaw = zip.read('base/assets/app.config');
  let appConfig = null; try { appConfig = appConfigRaw ? JSON.parse(appConfigRaw.toString('utf8')) : null; } catch { appConfig = null; }
  const jsBundle = zip.read('base/assets/index.android.bundle');
  const dexNames = zip.names.filter(n => /^base\/dex\/.*\.dex$/.test(n));
  const iap = dexNames.some(n => zip.read(n).includes('expo/modules/iap'));
  const certs = zip.names.filter(n => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(n)).flatMap(n => certificatesFromPkcs7(zip.read(n)));
  return { sha256: sha256(buf), bytes: buf.length, isBundle: zip.names.includes('BundleConfig.pb') && !!manifest, manifest, appConfig, jsBundleBytes: jsBundle ? jsBundle.length : 0, iap, certificates: [...new Set(certs.map(c => sha256(c)))] };
}
function checkContact(config, group, prefix) {
  return [
    row(group, prefix + 'privacy_url', httpsUrl(config?.extra?.privacyPolicyUrl) ? 'PASS' : 'FAIL', '개인정보처리방침 https URL 필요', { owner: true }),
    row(group, prefix + 'support_email', email(config?.extra?.supportEmail) ? 'PASS' : 'FAIL', '유효한 문의 이메일 필요', { owner: true }),
  ];
}
function checkPurchases(config, group, prefix) {
  const mode = config?.extra?.purchases;
  const valid = !!config && (mode === undefined || mode === 'closed');
  // 비공개 테스트 PRO 체험: 구매가 닫힌 빌드에서만 허용. 구매가 열린(정상 출시) 구성에서 켜져 있으면 실패 —
  // 실수로 PRO 를 공짜로 여는 출시본을 막는다. 값은 true/false/없음만 받는다.
  const trial = config?.extra?.proTrial;
  const trialOk = trial === undefined || trial === false || (trial === true && mode === 'closed');
  return [row(group, prefix + 'purchases', valid ? 'PASS' : 'FAIL',
    mode === 'closed' ? '명시적 구매 비활성 비공개 테스트' : mode === undefined ? '정상 출시 구성: 결제 검증 필수' : '지원하지 않는 구매 구성'),
  row(group, prefix + 'pro_trial', !!config && trialOk ? 'PASS' : 'FAIL',
    trial === true ? (mode === 'closed' ? '비공개 테스트 PRO 체험 켜짐(구매 닫힘 빌드 전용)' : 'PRO 체험이 구매가 열린 구성에서 켜져 있어요 — 출시 금지') : trial === undefined || trial === false ? 'PRO 체험 꺼짐' : '지원하지 않는 PRO 체험 값')];
}
function checkArtifact(info, expectedConfig) {
  const out = [];
  const r = (id, ok, msg, extra) => out.push(row('ARTIFACT', id, ok ? 'PASS' : 'FAIL', msg, extra));
  r('app_bundle', info.isBundle, info.isBundle ? 'Android App Bundle(BundleConfig.pb · base 모듈)' : 'AAB 구조가 아니에요');
  r('application_id_in_bundle', !!info.manifest && info.manifest.includes(EXPECTED_APPLICATION_ID), `매니페스트 패키지 ${EXPECTED_APPLICATION_ID}`);
  r('billing_permission', !!info.manifest && info.manifest.includes('com.android.vending.BILLING'), 'com.android.vending.BILLING 권한');
  r('no_overlay_permission', !!info.manifest && !info.manifest.includes('android.permission.SYSTEM_ALERT_WINDOW'), '출시 매니페스트에 SYSTEM_ALERT_WINDOW 없음');
  r('release_js_bundle', info.jsBundleBytes > 0, `index.android.bundle ${info.jsBundleBytes} bytes`);
  r('expo_iap_native', info.iap, 'expo-iap 네이티브 모듈(dex 에 expo/modules/iap)');
  r('bundle_internal_review_off', info.appConfig && info.appConfig.extra?.internalReview !== true, `묶인 app.config internalReview = ${info.appConfig?.extra?.internalReview}`);
  out.push(...checkPurchases(info.appConfig, 'ARTIFACT', 'bundle_'));
  out.push(...checkContact(info.appConfig, 'ARTIFACT', 'bundle_'));
  if (expectedConfig) r('bundle_pro_trial_match', !!info.appConfig && (info.appConfig.extra?.proTrial === true) === (expectedConfig.extra?.proTrial === true), '빌드 설정과 AAB 의 PRO 체험 설정 일치');
  if (expectedConfig) r('bundle_purchases_match', !!info.appConfig && info.appConfig.extra?.purchases === expectedConfig.extra?.purchases, '빌드 설정과 AAB 구매 구성 일치');
  const ep = info.appConfig?.extra?.receiptEndpoint;
  const closedMissing = info.appConfig?.extra?.purchases === 'closed' && ep === undefined;
  const epOk = typeof ep === 'string' && /^https:\/\//.test(ep);
  out.push(row('ARTIFACT', 'bundle_receipt_endpoint', epOk ? 'PASS' : closedMissing ? 'WARN' : 'FAIL', epOk ? '묶인 app.config 에 영수증 서버 주소 있음' : closedMissing ? '묶인 app.config: 구매 비활성 테스트의 서버 미설정' : '묶인 app.config 에 유효한 영수증 서버 주소가 없어요', { external: !epOk }));
  return out;
}

function summarize(results) {
  const groups = {};
  for (const g of ['CONFIG', 'SIGNING', 'ARTIFACT', 'ASSETS']) {
    const rows = results.filter(r => r.group === g);
    groups[g] = !rows.length ? 'NOT RUN' : rows.some(r => r.status === 'FAIL') ? 'FAIL' : rows.some(r => r.status === 'BLOCKED') ? 'BLOCKED' : 'PASS';
  }
  const hardFail = ['CONFIG', 'SIGNING', 'ARTIFACT'].some(g => groups[g] === 'FAIL');
  return { groups, exitCode: hardFail ? 1 : groups.ASSETS === 'BLOCKED' ? 2 : 0 };
}

module.exports = { readZip, certificatesFromPkcs7, checkConfig, checkGradle, checkSigningInputs, checkRepoSecrets, checkCertificate, inspectBundle, checkArtifact, summarize, EXPECTED_APPLICATION_ID, SIGNING_KEYS };

if (require.main === module) {
  const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const config = require(path.join(root, 'app.config.js'))();
  const history = JSON.parse(fs.readFileSync(path.join(root, 'release/version-history.json'), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'release/nonrelease-certificates.json'), 'utf8'));
  const gradleFile = path.join(root, 'android/app/build.gradle');
  const gradleText = fs.existsSync(gradleFile) ? fs.readFileSync(gradleFile, 'utf8') : null;
  const results = [...checkConfig(config, { released: history.released, gradleText }), ...checkGradle(gradleText)];
  const userHome = process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle');
  results.push(...checkSigningInputs({ userProperties: path.join(userHome, 'gradle.properties'), projectProperties: path.join(root, 'android/gradle.properties') }));
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
  const files = git('ls-files', '-co', '--exclude-standard').split('\n').filter(Boolean);
  results.push(...checkRepoSecrets(files, f => { try { const s = fs.statSync(path.join(root, f)); return s.size < 1024 * 1024 ? fs.readFileSync(path.join(root, f), 'utf8') : null; } catch { return null; } }));
  const aab = arg('--aab');
  let bundle = null;
  if (aab) {
    bundle = inspectBundle(path.resolve(aab));
    results.push(...checkCertificate(bundle.certificates, policy, process.env.EMOTICON_UPLOAD_CERT_SHA256), ...checkArtifact(bundle, config));
  }
  // ASSETS — 브랜드 에셋 미도착은 서명과 구분해 BLOCKED
  const assetCheck = require('./asset-check.cjs');
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'assets/asset-contract.json'), 'utf8'));
  let splash = false; try { require.resolve('expo-splash-screen/package.json', { paths: [root] }); splash = true; } catch { /* 없음 */ }
  const assetResults = assetCheck.checkAll({ root, contract, config, splashModuleInstalled: splash, nativeDir: path.join(root, contract.nativeTemplateFingerprints.directory) });
  const assetFails = assetResults.filter(r => r.status === 'FAIL').map(r => r.id);
  results.push(row('ASSETS', 'brand_assets', assetFails.length ? 'BLOCKED' : 'PASS', assetFails.length ? `npm run assets:check FAIL: ${assetFails.join(', ')}` : '브랜드·스토어 에셋 통과'));

  const { groups, exitCode } = summarize(results);
  for (const g of Object.keys(groups)) {
    console.log(`${g.padEnd(8)} ${groups[g]}`);
    for (const r of results.filter(x => x.group === g)) console.log(`   ${r.status.padEnd(7)} ${r.id}${r.owner && r.status === 'FAIL' ? ' [OWNER]' : r.external ? ' [EXTERNAL]' : ''} — ${r.message}`);
  }
  const identityOut = arg('--identity');
  if (identityOut) {
    let sourceId = null; try { sourceId = (execFileSync('node', [path.join(root, 'scripts/source-id.cjs')], { cwd: root, encoding: 'utf8' }).match(/SOURCE_ID (\w+)/) || [])[1]; } catch { /* 계산 실패 */ }
    const identity = {
      headCommit: git('rev-parse', 'HEAD').trim(), uncommittedFiles: git('status', '--porcelain').split('\n').filter(Boolean).length, sourceId,
      applicationId: config.android?.package, versionName: config.version, versionCode: config.android?.versionCode, buildType: 'release',
      aab: bundle ? { path: path.relative(root, path.resolve(aab)), sha256: bundle.sha256, bytes: bundle.bytes, builtAt: fs.statSync(path.resolve(aab)).mtime.toISOString() } : null,
      signingCertificateSha256: bundle?.certificates ?? [], signingCertificateKind: results.find(r => r.id === 'signing_certificate')?.kind ?? null,
      internalReview: bundle?.appConfig?.extra?.internalReview ?? config.extra?.internalReview ?? null,
      purchases: (bundle ? bundle.appConfig?.extra?.purchases : config.extra?.purchases) ?? 'release',
      receiptEndpointPresent: !!(bundle?.appConfig?.extra?.receiptEndpoint ?? config.extra?.receiptEndpoint),
      groups, checkedAt: new Date().toISOString(),
    };
    fs.writeFileSync(identityOut, JSON.stringify(identity, null, 2));
    console.log('\n빌드 식별 기록: ' + identityOut);
  }
  console.log(`\n출시 검사 종료 코드 ${exitCode} (0 통과 · 1 설정/서명/산출물 실패 · 2 에셋만 BLOCKED)`);
  process.exit(exitCode);
}
