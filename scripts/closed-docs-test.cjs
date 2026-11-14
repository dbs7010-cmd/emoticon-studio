const assert = require('node:assert/strict');
const fs = require('node:fs');
for (const name of ['PRIVACY_POLICY_KO', 'PLAY_DATA_SAFETY', 'PLAY_STORE_LISTING_KO', 'PLAY_CONSOLE_CHECKLIST', 'RELEASE_SIGNING']) {
  const text = fs.readFileSync(`docs/${name}.md`, 'utf8');
  assert.match(text, /갱신일: 2026-09-27.*기준 커밋:/);
  assert.match(text, /pro_lifetime/);
  const obsolete = text.split(/\r?\n/).filter(line => /구독|월간|연간|pro_monthly|pro_yearly|4,900|39,000/.test(line));
  assert.deepEqual(obsolete, ['예전 구독 `pro_monthly` / `pro_yearly`는 팔지 않지만 복원에서 알아봅니다.'], name);
}
const data = fs.readFileSync('docs/PLAY_DATA_SAFETY.md', 'utf8');
for (const topic of ['백업 ZIP 만들기', '백업에서 되살리기', '휴지통 30일', '제목 글꼴 파일']) assert.match(data, new RegExp('\\| '+topic+' \\|'));
assert.match(data, /tools:node="remove"/);
const viewport = fs.readFileSync('scripts/viewport-matrix-test.cjs', 'utf8');
assert.ok(!/writeFileSync\(['"]verification\/round/.test(viewport));
assert.match(viewport, /verification\/_latest/);
console.log('PASS: C5/C6 docs — one-time PRO only, current data flows, owner placeholders, historical results not overwritten');
