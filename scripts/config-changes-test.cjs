// MainActivity configChanges(2026-10-28): 화면 밀도·폴드 접기/펴기·회전에 다시 만들어지지 않는다.
// 플러그인 단위 검사 + 지금 android/ 매니페스트(prebuild 결과) 확인.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { addDensity } = require('../plugins/withDensityConfigChange.js');

const m = { manifest: { application: [{ activity: [{ $: { 'android:name': '.MainActivity', 'android:configChanges': 'keyboard|orientation|screenSize' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }], category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }] }] }] }] } };
const once = addDensity(m), twice = addDensity(once);
assert.equal(twice.manifest.application[0].activity[0].$['android:configChanges'], 'keyboard|orientation|screenSize|density', 'density 를 한 번만 더한다');
const file = 'android/app/src/main/AndroidManifest.xml';
if (fs.existsSync(file)) {
  const changes = (fs.readFileSync(file, 'utf8').match(/configChanges="([^"]*)"/) || [])[1].split('|');
  for (const k of ['density', 'screenSize', 'smallestScreenSize', 'screenLayout', 'orientation']) assert.ok(changes.includes(k), 'configChanges 에 ' + k);
}
console.log('PASS: config changes — density 추가(중복 없음), 매니페스트에 density·screenSize·smallestScreenSize·screenLayout·orientation');

// 서버 설정 읽기(2026-11-04): EAS 에 따옴표 없이 저장된 값도 읽고, 망가진 값은 버린다(iOS build 7·8 이 '준비 중'이던 원인).
{
  const load = value => { if (value === undefined) delete process.env.EMOTICON_FIREBASE_CONFIG; else process.env.EMOTICON_FIREBASE_CONFIG = value; delete require.cache[require.resolve('../app.config.js')]; return require('../app.config.js')().extra.cloud; };
  const loose = load('{apiKey:AAA,authDomain:x.web.app,projectId:p,storageBucket:p.app,messagingSenderId:1,appId:1:2:web:3,region:us-central1}');
  assert.ok(loose && loose.appId === '1:2:web:3' && loose.projectId === 'p', '따옴표 없는 값도 읽는다(콜론 든 appId 그대로)');
  assert.ok(load(JSON.stringify({ apiKey: 'A', projectId: 'p', storageBucket: 'b', appId: '1:2:web:3' })), '정상 JSON 도 읽는다');
  assert.equal(load('garbage'), undefined, '망가진 값은 버린다');
  assert.equal(load('{apiKey:A,projectId:p}'), undefined, '필수 값이 빠지면 버린다');
  load(undefined);
  console.log('PASS: cloud settings — JSON·따옴표 없는 값 읽기, 망가진 값·빠진 값 버림');
}
