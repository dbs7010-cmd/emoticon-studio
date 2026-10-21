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
// v2 구성 30종 + 호환 5종(45.31). 사람이 읽는 이름으로 적는다.
const KINDS = [["F01","기본 펜",false],["F02","자연 잉크",false],["F03","테이퍼 펜",false],["F04","붓펜",false],["F05","연필",false],["F06","색연필",false],["F07","불투명 채색붓",false],["F08","마커",false],["F09","에어브러시",false],["F10","납작 펜",false],["P01","거친 잉크",true],["P02","드라이 잉크",true],["P03","붓결 잉크",true],["P04","볼펜",true],["P05","크레용",true],["P06","분필",true],["P07","소프트 파스텔",true],["P08","목탄",true],["P09","연필 옆면",true],["P10","입자 음영",true],["P11","점묘",true],["P12","스프레이",true],["P13","드라이 평붓",true],["P14","워시",true],["P15","가장자리 수채",true],["P16","오일 파스텔",true],["P17","테두리 펜",true],["P18","점선 펜",true],["P19","평행선 펜",true],["P20","발광 펜",true],["L01","예전 마커",false],["L02","예전 붓펜",false],["L03","부드러운 펜",false],["L04","예전 붓",false],["L05","예전 연필",false]];
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
console.log('  서로 다른 결과 ' + seen.size + ' / ' + rows.length + '  (지문이 다르다는 것일 뿐, 품질 판정이 아니다)');
fs.writeFileSync(path.join(DIR, 'brush-pipeline.json'), JSON.stringify(rows, null, 2));
console.log(bad ? '\n  손봐야 할 것 ' + bad + '개' : '\n  서른다섯 가지가 서로 다르고, 저장·재열기가 외형을 바꾸지 않는다');
process.exit(bad ? 2 : 0);
