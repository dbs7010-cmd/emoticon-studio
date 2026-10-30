// 강좌 그림·영상의 언어판 목록을 만든다(2026-10-30). assets/lessons/<폴더>/<ja|zh-Hant>/<파일> 이 있으면
// src/constants/lesson-media.ts 에 require 로 적는다 — 앱은 기기 언어판이 있으면 그것을, 없으면 한국어판을 보인다.
//   node scripts/lessons/media-index.cjs   (언어판을 더하거나 지운 뒤 한 번)
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '../../assets/lessons'), OUT = path.join(__dirname, '../../src/constants/lesson-media.ts');
const LANGS = ['ja', 'zh-Hant'], table = Object.fromEntries(LANGS.map(l => [l, []]));
for (const dir of fs.readdirSync(ROOT).sort()) for (const lang of LANGS) {
  const sub = path.join(ROOT, dir, lang);
  if (!fs.existsSync(sub)) continue;
  for (const file of fs.readdirSync(sub).sort()) {
    if (!/\.(png|mp4)$/.test(file)) continue;
    // 한국어판이 없는 파일은 어디에도 안 쓰이므로 넣지 않는다.
    if (!fs.existsSync(path.join(ROOT, dir, file))) { console.warn('한국어판 없음, 건너뜀: ' + dir + '/' + lang + '/' + file); continue; }
    table[lang].push(`    '${dir}/${file}': require('../../assets/lessons/${dir}/${lang}/${file}'),`);
  }
}
const body = LANGS.map(l => `  '${l}': {\n${table[l].join('\n')}${table[l].length ? '\n' : ''}  },`).join('\n');
fs.writeFileSync(OUT, `// 만든 곳: scripts/lessons/media-index.cjs — 손으로 고치지 않는다.
// 강좌 그림·영상의 언어판. 키는 assets/lessons 아래 한국어판 경로.
export const LESSON_MEDIA: Record<'ja' | 'zh-Hant', Record<string, number>> = {
${body}
};
`);
console.log('lesson-media: ' + LANGS.map(l => l + ' ' + table[l].length).join(', '));
