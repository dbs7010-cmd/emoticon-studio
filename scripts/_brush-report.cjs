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
const DIR = 'verification/round45_26';
const rows = [];
console.log('  브러시  단계      굵기(3곳)      최대 알파  잉크 픽셀');
for (const kind of ['pen', 'brush', 'pencil']) {
  const stages = {};
  for (const [stage, label] of [['during', '입력 중'], ['committed', '확정 후'], ['reopened', '재열기 후']]) {
    const f = path.join(DIR, 'stroke-' + kind + '-' + stage + '.png');
    if (!fs.existsSync(f)) { console.log('  없음: ' + f); continue; }
    const m = measure(f); stages[stage] = m;
    console.log('  ' + kind.padEnd(7) + label.padEnd(10) + m.widths.join(' / ').padEnd(15) + String(m.maxA).padEnd(10) + m.ink);
  }
  rows.push({ kind, stages });
}
console.log('');
// 단계 사이가 같은지: 확정 후와 재열기 후는 같아야 한다(저장이 외형을 바꾸면 안 된다).
let bad = 0;
for (const r of rows) {
  const c = r.stages.committed, o = r.stages.reopened;
  if (!c || !o) continue;
  const same = JSON.stringify(c.widths) === JSON.stringify(o.widths) && Math.abs(c.maxA - o.maxA) <= 2 && Math.abs(c.ink - o.ink) / c.ink < .02;
  if (!same) bad++;
  console.log('  ' + r.kind.padEnd(7) + (same ? '확정 후 == 재열기 후 (저장이 외형을 바꾸지 않는다)' : '⚠ 확정 후와 재열기 후가 다르다'));
}
// 세 브러시가 서로 다른지.
const [pen, brush, pencil] = rows.map(r => r.stages.committed);
console.log('');
console.log('  펜 대비 붓  — 굵기 ' + (brush.widths[0] / pen.widths[0]).toFixed(2) + '배 · 잉크 ' + (brush.ink / pen.ink).toFixed(2) + '배');
console.log('  펜 대비 연필 — 굵기 ' + (pencil.widths[0] / pen.widths[0]).toFixed(2) + '배 · 최대 알파 ' + pencil.maxA + ' (펜 ' + pen.maxA + ')');
if (brush.widths[0] === pen.widths[0] && brush.ink === pen.ink) { console.log('  ⚠ 붓이 펜과 같다'); bad++; }
if (pencil.maxA >= pen.maxA) { console.log('  ⚠ 연필이 펜보다 옅지 않다'); bad++; }
fs.writeFileSync(path.join(DIR, 'brush-pipeline.json'), JSON.stringify(rows, null, 2));
console.log(bad ? '\n  손봐야 할 것 ' + bad + '개' : '\n  세 브러시가 서로 다르고, 저장·재열기가 외형을 바꾸지 않는다');
process.exit(bad ? 2 : 0);
