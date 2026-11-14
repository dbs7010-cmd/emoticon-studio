// Android 자동 백업 규칙(2026-10-06): 내보낸 사본 폴더만 빼고, 작품 원본은 그대로 백업된다.
const assert = require('node:assert/strict');
const { applyBackupRules, FULL_BACKUP, EXTRACTION, EXPORTS } = require('../plugins/withBackupRules');
const manifest = { manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' } }] } };
const app = applyBackupRules(manifest).manifest.application[0].$;
assert.equal(app['android:allowBackup'], 'true', '자동 백업은 켜 둔다(처리방침 §4 와 같음)');
assert.equal(app['android:fullBackupContent'], '@xml/emoti_backup_rules');
assert.equal(app['android:dataExtractionRules'], '@xml/emoti_data_extraction_rules');
assert.equal(EXPORTS, 'emoticon-studio/exports/', 'storage.ts 의 exports 폴더와 같은 경로');
for (const xml of [FULL_BACKUP, EXTRACTION]) {
  assert.ok(xml.includes(`<exclude domain="file" path="${EXPORTS}" />`), '사본 폴더를 뺀다');
  assert.ok(!/<include/.test(xml), 'include 를 쓰지 않는다 — 쓰면 적힌 것만 백업돼 원본이 빠진다');
  assert.equal((xml.match(/<exclude/g) || []).length, 1, '빼는 것은 사본 폴더 하나뿐');
}
assert.ok(/<cloud-backup>/.test(EXTRACTION) && !/<device-transfer>/.test(EXTRACTION), '클라우드 백업만 다룬다(기기 간 옮기기는 그대로)');
const storage = require('fs').readFileSync('src/services/storage.ts', 'utf8');
assert.ok(/new Directory\(root\(\), 'exports'\)/.test(storage), '앱이 사본을 쓰는 폴더 이름이 규칙과 같다');
assert.ok(/plugins\.push\('\.\/plugins\/withBackupRules'\)/.test(require('fs').readFileSync('app.config.js', 'utf8')), '설정에 등록됨');
console.log('PASS: backup rules — auto backup stays on, only emoticon-studio/exports/ (sent copies) is excluded from cloud backup, no include rules, path matches storage');
