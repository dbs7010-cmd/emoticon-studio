// 표현 가이드 그림의 속이 비어 있는지(투명) 본다. 카드 배경이 몸 안으로 비치는지 판정하는 근거.
// PNG 를 직접 풀어 알파만 센다 — 새로 그리지 않고 읽기만 한다.
const fs = require('node:fs'), zlib = require('node:zlib'), path = require('node:path');
function readPng(file) {
  const b = fs.readFileSync(file);
  let off = 8, w = 0, h = 0, depth = 0, type = 0, idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), tag = b.slice(off + 4, off + 8).toString('latin1');
    const data = b.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; }
    if (tag === 'IDAT') idat.push(data);
    if (tag === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || type !== 6) return { w, h, depth, type, rgba: null };
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[p + x], a = x >= bpp ? out[y * stride + x - bpp] : 0, bb = y > 0 ? out[(y - 1) * stride + x] : 0,
            c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
      let v;
      if (filter === 0) v = cur; else if (filter === 1) v = cur + a; else if (filter === 2) v = cur + bb;
      else if (filter === 3) v = cur + ((a + bb) >> 1);
      else { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c); v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      out[y * stride + x] = v & 255;
    }
    p += stride;
  }
  return { w, h, depth, type, rgba: out };
}
const files = process.argv.slice(2);
for (const f of files) {
  const { w, h, depth, type, rgba } = readPng(f);
  if (!rgba) { console.log(path.basename(f).padEnd(34), w + 'x' + h, 'depth', depth, 'type', type, '— 8bit RGBA 가 아니라 건너뜀'); continue; }
  // 가운데 세로줄을 훑어, 불투명한 선 사이의 '속' 이 투명한지 본다.
  const at = (x, y) => rgba[(y * w + x) * 4 + 3];
  let opaque = 0, inside = 0, insideClear = 0;
  for (let y = 0; y < h; y++) {
    let first = -1, last = -1;
    for (let x = 0; x < w; x++) if (at(x, y) > 200) { if (first < 0) first = x; last = x; }
    if (first < 0 || last - first < 4) continue;
    for (let x = first + 1; x < last; x++) { inside++; if (at(x, y) < 40) insideClear++; }
  }
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 200) opaque++;
  const pct = inside ? Math.round(insideClear / inside * 100) : 0;
  console.log(path.basename(f).padEnd(34), (w + '×' + h).padEnd(10),
    '불투명 ' + String(Math.round(opaque / (w * h) * 100)).padStart(3) + '%',
    '· 선 사이 속이 투명한 비율 ' + String(pct).padStart(3) + '%');
}
