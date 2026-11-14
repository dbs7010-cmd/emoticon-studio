// 자동으로 채운 63장을 훑어, **원래 비어 있어야 할 곳까지 희게 찼는지** 찾는다.
// 팔과 몸 사이, 다리 사이, 소품 바깥처럼 '선으로 둘러싸였지만 몸이 아닌' 구멍이 문제다.
// 사람이 다 볼 수 없으니, 채운 자리를 **따로 떨어진 덩어리**로 나눠 크기·모양을 잰다.
//   - 덩어리가 여럿이면 그중 작은 것들이 '원래 빈 곳'일 가능성이 높다.
//   - 덩어리가 길고 좁으면(다리 사이·겨드랑이) 더 의심스럽다.
const fs = require('node:fs'), zlib = require('node:zlib'), path = require('node:path');
const SRC = path.resolve(__dirname, '..', 'assets', 'expression-guides');
const DISP = path.join(SRC, 'display');
function read(file) {
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
const rows = [];
for (const name of fs.readdirSync(DISP).filter(f => f.endsWith('.png')).sort()) {
  const src = read(path.join(SRC, name)), out = read(path.join(DISP, name));
  if (src.w !== out.w || src.h !== out.h) { rows.push({ name, note: '크기가 다르다' }); continue; }
  const { w, h } = src;
  // 새로 흰색이 깔린 자리: 원본은 비어 있었는데 결과는 차 있는 곳.
  const filled = new Uint8Array(w * h);
  let total = 0;
  for (let i = 0; i < w * h; i++) if (src.d[i * 4 + 3] <= 24 && out.d[i * 4 + 3] > 200) { filled[i] = 1; total++; }
  // 덩어리로 나눈다.
  const seen = new Uint8Array(w * h), blobs = [];
  for (let i = 0; i < w * h; i++) {
    if (!filled[i] || seen[i]) continue;
    const stack = [i]; seen[i] = 1;
    let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j - x) / w; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const k of [j + 1, j - 1, j + w, j - w]) {
        if (k < 0 || k >= w * h || seen[k] || !filled[k]) continue;
        if (k === j + 1 && (j + 1) % w === 0) continue;
        if (k === j - 1 && j % w === 0) continue;
        seen[k] = 1; stack.push(k);
      }
    }
    blobs.push({ n, w: x1 - x0 + 1, h: y1 - y0 + 1, x: x0, y: y0 });
  }
  blobs.sort((a, b) => b.n - a.n);
  const main = blobs[0]?.n ?? 0;
  // 몸통(가장 큰 덩어리) 말고 눈에 띄는 덩어리들.
  const extras = blobs.slice(1).filter(b => b.n >= total * 0.02 && b.n >= 12);
  // 길쭉한 덩어리(다리 사이·겨드랑이처럼 좁고 긴 틈)
  const slivers = extras.filter(b => Math.max(b.w, b.h) / Math.max(1, Math.min(b.w, b.h)) >= 2.5);
  rows.push({ name, total, blobs: blobs.length, main, extras: extras.length, slivers: slivers.length,
    extraArea: extras.reduce((s, b) => s + b.n, 0), suspect: extras.length > 0 });
}
rows.sort((a, b) => (b.extraArea ?? 0) - (a.extraArea ?? 0));
const suspects = rows.filter(r => r.suspect);
console.log('  자동 채움 ' + rows.length + '장 · 몸통 말고 따로 찬 덩어리가 있는 것 ' + suspects.length + '장');
console.log('');
console.log('  파일                              찬 픽셀  덩어리  몸통밖 덩어리  길쭉한 것  몸통밖 넓이');
for (const r of suspects) console.log('  ' + r.name.replace('.png', '').padEnd(34) + String(r.total).padStart(6) + String(r.blobs).padStart(7) + String(r.extras).padStart(13) + String(r.slivers).padStart(10) + String(r.extraArea).padStart(12));
fs.writeFileSync('verification/round45_26/fill-audit.json', JSON.stringify(rows, null, 2));
console.log('');
console.log('  전체 수치는 verification/round45_26/fill-audit.json');
