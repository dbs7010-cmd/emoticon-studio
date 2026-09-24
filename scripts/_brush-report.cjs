// 세 단계 그림을 재서 표로 만든다. 굵기·최대 알파·잉크 픽셀이 단계마다 같은지 본다.
const fs = require('node:fs'), zlib = require('node:zlib'), path = require('node:path');
function rgba(file) {
  const b = fs.readFileSync(file); let off = 8, w = 0, h = 0; const idat = [];
  while (off < b.length) { const len = b.readUInt32BE(off), tag = b.slice(off + 4, off + 8).toString('latin1'), d = b.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); } if (tag === 'IDAT') idat.push(d); if (tag === 'IEND') break; off += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p++];
    for (let x = 0; x < stride; x++) { const cur = raw[p + x], a = x >= bpp ? out[y * stride + x - bpp] : 0, bb = y > 0 ? out[(y - 1) * stride + x] : 0, c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
      let v; if (f === 0) v = cur; else if (f === 1) v = cur + a; else if (f === 2) v = cur + bb; else if (f === 3) v = cur + ((a + bb) >> 1);
      else { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c); v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      out[y * stride + x] = v & 255; } p += stride; }
  return { w, h, d: out };
}
function measure(file) {
  const { w, h, d } = rgba(file);
  let ink = 0, maxA = 0, widths = [];
  for (let i = 3; i < d.length; i += 4) { if (d[i] > 8) ink++; if (d[i] > maxA) maxA = d[i]; }
  for (const f of [.3, .5, .7]) { const x = Math.round(w * f); let n = 0; for (let y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 20) n++; widths.push(n); }
  return { widths, maxA, ink };
}
const DIR = process.argv[2] || 'verification/round45_26';
// 승인 구성 12종. 이름은 사람이 읽는 이름으로 적는다 — key 만으로는 어느 브러시인지 알기 어렵다.
const KINDS = [
  ['pen', '기본 펜', false], ['soft', '부드러운 펜', false], ['pencil', '연필', false], ['marker', '마커', false],
  ['ink', '테이퍼 잉크', true], ['brushpen', '붓펜', true], ['crayon', '크레용', true], ['chalk', '분필', true],
  ['rough', '드라이 잉크', true], ['airbrush', '에어브러시', true], ['dotted', '점선 펜', true], ['outline', '테두리 펜', true],
];
const rows = [];
const pad = (t, n) => { let w = 0; for (const ch of String(t)) w += ch.charCodeAt(0) > 0x2000 ? 2 : 1; return String(t) + ' '.repeat(Math.max(1, n - w)); };
console.log('  브러시        단계        굵기(3곳)        최대 알파  잉크 픽셀');
for (const [kind, title, pro] of KINDS) {
  const stages = {};
  for (const [stage, label] of [['during', '입력 중'], ['committed', '확정 후'], ['reopened', '재열기 후']]) {
    const f = path.join(DIR, 'stroke-' + kind + '-' + stage + '.png');
    if (!fs.existsSync(f)) { console.log('  없음: ' + f); continue; }
    const m = measure(f); stages[stage] = m;
    console.log('  ' + pad(title, 14) + pad(label, 12) + pad(m.widths.join(' / '), 17) + pad(m.maxA, 11) + m.ink);
  }
  rows.push({ kind, title, pro, stages });
}
console.log('');
let bad = 0;
// ① 저장·재열기가 외형을 바꾸지 않는다.
for (const r of rows) {
  const c = r.stages.committed, o = r.stages.reopened;
  if (!c || !o) { bad++; console.log('  ' + pad(r.title, 14) + '⚠ 단계가 모자라다'); continue; }
  const same = JSON.stringify(c.widths) === JSON.stringify(o.widths) && Math.abs(c.maxA - o.maxA) <= 2 && Math.abs(c.ink - o.ink) / Math.max(1, c.ink) < .02;
  if (!same) bad++;
  console.log('  ' + pad(r.title, 14) + (same ? '확정 후 == 재열기 후 (저장·재열기가 외형을 바꾸지 않는다)' : '⚠ 확정 후와 재열기 후가 다르다: ' + JSON.stringify([c.widths, o.widths, c.maxA, o.maxA, c.ink, o.ink])));
}
// ② 열두 가지가 서로 다르다 — 굵기·알파·잉크를 묶은 지문이 겹치면 이름만 다른 것이다.
console.log('');
const seen = new Map();
for (const r of rows) {
  const c = r.stages.committed; if (!c) continue;
  const key = c.widths.join(',') + '|' + c.maxA + '|' + Math.round(c.ink / 50);
  if (seen.has(key)) { bad++; console.log('  ⚠ ' + r.title + ' 가 ' + seen.get(key) + ' 와 같은 결과를 낸다'); }
  seen.set(key, r.title);
}
console.log('  서로 다른 결과 ' + seen.size + ' / ' + rows.length);
fs.writeFileSync(path.join(DIR, 'brush-pipeline.json'), JSON.stringify(rows, null, 2));
console.log(bad ? '\n  손봐야 할 것 ' + bad + '개' : '\n  열두 가지가 서로 다르고, 저장·재열기가 외형을 바꾸지 않는다');
process.exit(bad ? 2 : 0);
