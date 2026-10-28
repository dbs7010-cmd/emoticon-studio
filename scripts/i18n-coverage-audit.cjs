// Runtime text audit, deliberately reports untranslated content instead of hiding it.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const results = [];
let baseline;
for (const languageCode of ['ko', 'ja', 'zh']) {
  const load = loader({ 'expo-localization': { getLocales: () => [{ languageCode, regionCode: languageCode === 'zh' ? 'TW' : null }] } });
  const { LESSONS, LESSON_GROUPS } = load('src/constants/lessons.ts');
  const { GUIDEBOOK } = load('src/constants/guidebook.ts');
  const ids = LESSONS.map(x => [x.id, x.group, x.minutes, x.steps.length, x.tryIt?.action]);
  if (!baseline) baseline = ids; else assert.deepEqual(ids, baseline, 'localization preserves lesson identity/actions');
  const remaining = [];
  function visit(value, path) {
    if (typeof value === 'string' && /[가-힣]/.test(value)) remaining.push({ path, text: value });
    else if (Array.isArray(value)) value.forEach((x, i) => visit(x, path + '[' + i + ']'));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) if (!key.startsWith('__')) visit(item, path + '.' + key);
  }
  if (languageCode !== 'ko') {
    assert.ok(LESSON_GROUPS.every(x => !/[가-힣]/.test(x.title)), 'translated group headings');
    assert.ok(LESSONS.every(x => !/[가-힣]/.test(x.title + x.summary)), 'translated lesson titles and descriptions');
    visit({ LESSONS, GUIDEBOOK }, 'content');
  }
  results.push({ locale: languageCode === 'zh' ? 'zh-Hant' : languageCode, remaining });
}
fs.writeFileSync('verification/visual-direction-v24/i18n-coverage.json', JSON.stringify({ scope: 'Runtime lesson/guide copy only; painter and raster text remain outside this audit', results }, null, 2));
console.log('PASS: locale headings and unchanged lesson identity; remaining untranslated strings:', results.map(x => x.locale + '=' + x.remaining.length).join(', '));
