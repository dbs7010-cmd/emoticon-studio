// 강좌 녹화를 일본어·번체 기기에서 돌릴 때(2026-10-30): 대본은 한국어 이름으로 버튼을 부르고, 여기서 그 언어 이름으로 바꾼다.
//   LESSON_LANG=ja node scripts/lessons/record-first-set.cjs — 없으면 한국어 그대로.
// 한국어 문구를 번역 표(src/i18n/*.ts)에서 거꾸로 찾는다. {v0} 같은 자리가 있는 문구는 채워진 값까지 맞춰 보고, 그 값도 문구면 같이 바꾼다.
// 같은 한국어가 여러 방식으로 만들어질 수 있어(예: '우와 대사 고르기' = '우와' + '대사 고르기', 또는 '{v0} 고르기') 후보를 모두 돌려주고, 화면에 있는 것을 고른다(ui.cjs).
const fs = require('node:fs'), path = require('node:path');
const LANG = process.env.LESSON_LANG || 'ko';
const FILE = { ko: 'ko.ts', ja: 'ja.ts', 'zh-Hant': 'zh-Hant.ts' };
function table(lang) {
  const src = fs.readFileSync(path.join(__dirname, '../../src/i18n', FILE[lang]), 'utf8'), out = {};
  for (const m of src.matchAll(/(['"])([\w.\-]+)\1\s*:\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g)) out[m[2]] = (m[3] ?? m[4]).replace(/\\n/g, '\n').replace(/\\(['"\\])/g, '$1');
  return out;
}
const ko = table('ko'), to = LANG === 'ko' ? ko : table(LANG);
const exact = new Map(), patterns = [];
for (const [k, v] of Object.entries(ko)) {
  if (/\{\w+\}/.test(v)) {
    const names = [], re = v.split(/(\{\w+\})/).map(p => { const n = p.match(/^\{(\w+)\}$/); if (n) { names.push(n[1]); return '(.+?)'; } return p.replace(/[.*+?^$()|[\]\\]/g, '\\$&'); }).join('');
    patterns.push({ k, names, re: new RegExp('^' + re + '$') });
  } else {
    if (!exact.has(v)) exact.set(v, []);
    exact.get(v).push(k);
  }
}
// 추천 대사 한 마디(say.<감정> 의 '|' 목록 안 한 칸)는 같은 자리의 번역으로.
function sayWords(word) {
  const out = [];
  for (const [k, v] of Object.entries(ko)) if (k.startsWith('say.') && to[k]) {
    const i = v.split('|').map(s => s.trim()).indexOf(word);
    if (i >= 0) out.push(to[k].split('|').map(s => s.trim())[i]);
  }
  return out;
}
const cache = new Map();
function all(label) {
  if (LANG === 'ko' || !/[가-힣]/.test(label)) return [label];
  if (cache.has(label)) return cache.get(label);
  cache.set(label, []);   // 되부름 막기
  const out = new Set();
  for (const k of exact.get(label) || []) if (to[k]) out.add(to[k]);
  for (const s of sayWords(label)) out.add(s);
  for (const p of patterns) {
    const m = label.match(p.re); if (!m || !to[p.k]) continue;
    const vals = p.names.map((_, i) => all(m[i + 1]));
    if (vals.some(v => !v.length)) continue;
    // 자리 값마다 후보가 여럿이면 첫 후보만 쓴다(조합이 늘지 않게).
    out.add(to[p.k].replace(/\{(\w+)\}/g, (s, n) => { const i = p.names.indexOf(n); return i < 0 ? s : vals[i][0]; }));
  }
  // 앱이 두 문구를 띄어 붙인 이름('색 #FFD15C' · '우와 대사 고르기')은 앞뒤로 나눠 각각 바꾼다.
  const words = label.split(' ');
  for (let i = 1; i < words.length; i++) {
    const a = all(words.slice(0, i).join(' ')), b = all(words.slice(i).join(' '));
    if (a.length && b.length) out.add(a[0] + ' ' + b[0]);
  }
  const list = [...out];
  cache.set(label, list);
  return list;
}
function L(label) {
  const list = all(label);
  if (!list.length) throw new Error(`번역 표에 없는 녹화 이름(${LANG}): ${label}`);
  return list[0];
}
module.exports = { L, all, LANG };
