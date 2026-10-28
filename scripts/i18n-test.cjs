// 다국어(2026-10-28): 기기 언어 고르기 · 모든 키 번역 여부 · 자리 채우기 · 없는 키는 한국어로.
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const load = loader();
const i = load('src/i18n/index.ts'), { ko } = load('src/i18n/ko.ts'), { ja } = load('src/i18n/ja.ts'), { zhHant } = load('src/i18n/zh-Hant.ts');
const L = (languageCode, regionCode = null, languageScriptCode = null) => ({ languageCode, regionCode, languageScriptCode });
assert.equal(i.pickLang([L('ko', 'KR')]), 'ko');
assert.equal(i.pickLang([L('ja', 'JP')]), 'ja');
assert.equal(i.pickLang([L('zh', 'TW')]), 'zh-Hant');
assert.equal(i.pickLang([L('zh', 'HK')]), 'zh-Hant');
assert.equal(i.pickLang([L('zh', null, 'Hant')]), 'zh-Hant');
assert.equal(i.pickLang([L('zh', 'CN', 'Hans')]), 'ko', '간체는 아직 없음 → 한국어');
assert.equal(i.pickLang([L('en', 'US'), L('ja', 'JP')]), 'ja', '두 번째 선호 언어');
assert.equal(i.pickLang([L('en', 'US')]), 'ko');
assert.equal(i.lang(), 'ko', '검사 기기는 한국어');
const keys = Object.keys(ko);
assert.deepEqual(keys.filter(k => !(k in ja)), [], '일본어에 빠진 키');
assert.deepEqual(keys.filter(k => !(k in zhHant)), [], '번체에 빠진 키');
for (const [name, table] of [['ja', ja], ['zh-Hant', zhHant]]) for (const k of keys) {
  const holes = s => (s.match(/\{\w+\}/g) || []).sort().join();
  assert.equal(holes(table[k]), holes(ko[k]), `${name} ${k} 자리 표시 같음`);
  assert.ok(!/[가-힣]/.test(table[k]), `${name} ${k} 에 한국어 남음`);
}
assert.equal(i.t('home.recentAll', { n: 7 }), '최근 작업순 · 전체 7');
// 대사(2026-10-28): 표현 가이드 20감정 모두 세 언어로 대사 셋. 비거나 겹치면 안 된다.
const sayIds = keys.filter(k => k.startsWith('say.') && k.split('.')[1].includes('-')).map(k => k.slice(4));
assert.equal(sayIds.length, 20, '감정 20개의 대사');
for (const L of ['ko', 'ja', 'zh-Hant']) { i.setLang(L); for (const id of sayIds) { const lines = i.sayLines(id); assert.equal(lines.length, 3, L + ' ' + id + ' 대사 셋'); assert.equal(new Set(lines).size, 3, L + ' ' + id + ' 겹침 없음'); } assert.equal(i.popularLines().length, 10); }
i.setLang('ko'); assert.deepEqual(i.sayLines('greeting-hello'), ['하이~', '넵!', '안뇽']); assert.deepEqual(i.popularLines().slice(0, 4), ['응응', '넵!', 'ㅋㅋㅋㅋ', '딱!']); assert.deepEqual(i.sayLines('없는-감정'), []);
i.setLang('ja'); assert.equal(i.t('tab.home'), 'ホーム'); assert.equal(i.overseas(), true);
i.setLang('zh-Hant'); assert.equal(i.t('line.needMoving', { n: 3 }), 'LINE 動態貼圖至少需要 8 張（目前有 3 張）。');
i.setLang('ko'); assert.equal(i.overseas(), false);
console.log(`PASS: i18n — 기기 언어 고르기(ko/ja/zh-Hant, 간체·영어는 한국어), 키 ${keys.length}개 모두 일본어·번체, 자리 표시 일치, 한국어 잔존 없음, 대사 20감정×3 세 언어`);
