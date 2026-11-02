// 문구 손글씨 폰트(2026-11-03): 구글 폰트(OFL) 원본을 자주 쓰는 글자만 남겨 assets/fonts 에 넣는다.
// 한국어 KS X 1001 한글 2,350자 · 일본어 가나 + JIS 1수준 한자 · 번체 Big5 상용자 5,401자 + 공통(영문·숫자·기호·전각).
// WOFF2 로 저장한다(캔버스 WebView 가 FontFace 로 읽는다) — TTF 37MB → WOFF2 약 11MB. 문구 패널 견본은 캔버스 실시간 미리보기가 대신한다.
// 실행: node scripts/fonts/build-fonts.cjs <원본 TTF 폴더>  (원본은 저장소에 넣지 않는다 — 출처는 assets/fonts/SOURCES.md)
const fs = require('node:fs');
const path = require('node:path');
const subsetFont = require('subset-font');
const { FONT_FILES } = require('./font-list.cjs');

const src = process.argv[2];
if (!src) { console.error('원본 폰트 폴더를 주세요'); process.exit(1); }
const out = path.join(__dirname, '..', '..', 'assets', 'fonts');
fs.mkdirSync(path.join(out, 'licenses'), { recursive: true });

// 인코딩 표에서 두 바이트 글자를 뽑는다(Node 의 TextDecoder 가 euc-kr · shift_jis · big5 를 안다).
function decode(enc, [h0, h1, l0, l1]) {
  const d = new TextDecoder(enc), set = new Set();
  for (let h = h0; h <= h1; h++) for (let l = l0; l <= l1; l++) { const c = d.decode(new Uint8Array([h, l])); if (c.length === 1 && c !== '�') set.add(c); }
  return [...set].join('');
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join('');
const common = range(0x20, 0x7e) + range(0xa0, 0xff) + range(0x2010, 0x2027) + range(0x2030, 0x203e) + range(0x2190, 0x2193) + range(0x2605, 0x2606) + range(0x2661, 0x2665)
  + range(0x266a, 0x266b) + range(0x3000, 0x303f) + range(0xff01, 0xff5e) + '…·~♡♥☆★♪';
const sets = {
  ko: common + decode('euc-kr', [0xb0, 0xc8, 0xa1, 0xfe]).replace(/[^가-힣]/g, '') + range(0x3131, 0x318e),
  ja: common + range(0x3041, 0x309f) + range(0x30a0, 0x30ff) + decode('shift_jis', [0x88, 0x98, 0x40, 0xfc]).replace(/[^\p{Script=Han}]/gu, ''),
  'zh-Hant': common + decode('big5', [0xa4, 0xc6, 0x40, 0xfe]).replace(/[^\p{Script=Han}]/gu, '') + '，。、；：？！「」『』（）《》〈〉',
};

(async () => {
  let total = 0;
  for (const f of FONT_FILES) {
    const input = fs.readFileSync(path.join(src, f.source));
    const buf = await subsetFont(input, sets[f.lang], { targetFormat: 'woff2' });
    fs.writeFileSync(path.join(out, f.key + '.woff2'), buf);
    fs.copyFileSync(path.join(src, f.source.replace(/\.ttf$/, '.OFL.txt')), path.join(out, 'licenses', f.key + '-OFL.txt'));
    total += buf.length;
    console.log(f.key.padEnd(16), (input.length / 1048576).toFixed(1) + 'MB →', (buf.length / 1048576).toFixed(2) + 'MB');
  }
  console.log('합계', (total / 1048576).toFixed(1) + 'MB');
})().catch(e => { console.error(e); process.exit(1); });
