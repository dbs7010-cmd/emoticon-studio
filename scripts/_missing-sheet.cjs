// 표시용을 만들지 못한 18장을 파스텔 카드 위에 올려 한 장으로 묶는다.
// 이 그림들은 **원본뿐**이므로, 카드 색이 몸 안으로 비치는 모습이 그대로 보인다 — 그것이 문제 부위다.
const fs = require('node:fs'), zlib = require('node:zlib'), path = require('node:path');
const SRC = path.resolve(__dirname, '..', 'assets', 'expression-guides');
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
function read(f) { const b = fs.readFileSync(f); let off = 8, w = 0, h = 0; const idat = [];
  while (off < b.length) { const len = b.readUInt32BE(off), tag = b.slice(off + 4, off + 8).toString('latin1'), d = b.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); } if (tag === 'IDAT') idat.push(d); if (tag === 'IEND') break; off += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) { const f2 = raw[p++];
    for (let x = 0; x < stride; x++) { const cur = raw[p + x], a = x >= bpp ? out[y * stride + x - bpp] : 0, bb = y > 0 ? out[(y - 1) * stride + x] : 0, c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
      let v; if (f2 === 0) v = cur; else if (f2 === 1) v = cur + a; else if (f2 === 2) v = cur + bb; else if (f2 === 3) v = cur + ((a + bb) >> 1);
      else { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c); v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      out[y * stride + x] = v & 255; } p += stride; }
  return { w, h, d: out }; }
function write(f, w, h, d) { const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; d.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const ch = (t, x) => { const o = Buffer.alloc(12 + x.length); o.writeUInt32BE(x.length, 0); o.write(t, 4, 'latin1'); x.copy(o, 8); o.writeUInt32BE(CRC(Buffer.concat([Buffer.from(t, 'latin1'), x])), 8 + x.length); return o; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw, { level: 9 })), ch('IEND', Buffer.alloc(0))])); }
const names = require(path.join(SRC, 'display', 'INDEX.json')).skipped.map(s => s.name);
const T = 130, PAD = 8, COLS = 6;
const rows = Math.ceil(names.length / COLS);
const W = COLS * (T + PAD) + PAD, H = rows * (T + PAD) + PAD;
const buf = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { buf[i * 4] = 26; buf[i * 4 + 1] = 28; buf[i * 4 + 2] = 33; buf[i * 4 + 3] = 255; }
const tints = [[217, 204, 250], [199, 232, 252], [252, 214, 209]];
names.forEach((name, i) => {
  const img = read(path.join(SRC, name));
  const r = Math.floor(i / COLS), c = i % COLS, bg = tints[i % tints.length];
  const ox = PAD + c * (T + PAD), oy = PAD + r * (T + PAD);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const p = ((oy + y) * W + ox + x) * 4; buf[p] = bg[0]; buf[p + 1] = bg[1]; buf[p + 2] = bg[2]; buf[p + 3] = 255; }
  const s = Math.min((T - 14) / img.w, (T - 14) / img.h), dw = Math.round(img.w * s), dh = Math.round(img.h * s);
  const dx = ox + ((T - dw) >> 1), dy = oy + ((T - dh) >> 1);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = Math.min(img.w - 1, Math.floor(x / s)), sy = Math.min(img.h - 1, Math.floor(y / s));
    const si = (sy * img.w + sx) * 4, a = img.d[si + 3] / 255, di = ((dy + y) * W + dx + x) * 4;
    for (let ch2 = 0; ch2 < 3; ch2++) buf[di + ch2] = Math.round(img.d[si + ch2] * a + buf[di + ch2] * (1 - a));
  }
});
write('verification/round45_27/fill-missing.png', W, H, buf);
console.log('  fill-missing.png — 표시용을 만들지 못한 ' + names.length + '장(원본 그대로). 몸 안으로 카드 색이 비치는 것이 문제 부위다.');
