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
