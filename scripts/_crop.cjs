// 승인 시안 원본에서 한 컷을 잘라낸다. **다시 그리지 않는다** — 원본 픽셀만 오려 쓴다.
// 보드는 1024×1536 에 3열 × 2행으로 폰 목업이 놓여 있다.
const fs = require('node:fs'), zlib = require('node:zlib'), path = require('node:path');
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
function read(f) { const b = fs.readFileSync(f); let off = 8, w = 0, h = 0, type = 0; const idat = [];
  while (off < b.length) { const len = b.readUInt32BE(off), tag = b.slice(off + 4, off + 8).toString('latin1'), d = b.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); type = d[9]; } if (tag === 'IDAT') idat.push(d); if (tag === 'IEND') break; off += 12 + len; }
  const ch = type === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) { const f2 = raw[p++];
    for (let x = 0; x < stride; x++) { const cur = raw[p + x], a = x >= ch ? out[y * stride + x - ch] : 0, bb = y > 0 ? out[(y - 1) * stride + x] : 0, c = (x >= ch && y > 0) ? out[(y - 1) * stride + x - ch] : 0;
      let v; if (f2 === 0) v = cur; else if (f2 === 1) v = cur + a; else if (f2 === 2) v = cur + bb; else if (f2 === 3) v = cur + ((a + bb) >> 1);
      else { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c); v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      out[y * stride + x] = v & 255; } p += stride; }
  return { w, h, ch, d: out }; }
function write(f, w, h, rgba) { const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const chunk = (t, x) => { const o = Buffer.alloc(12 + x.length); o.writeUInt32BE(x.length, 0); o.write(t, 4, 'latin1'); x.copy(o, 8); o.writeUInt32BE(CRC(Buffer.concat([Buffer.from(t, 'latin1'), x])), 8 + x.length); return o; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])); }
// 인자: 원본 결과 x y w h
const [src, dst, X, Y, W, H] = [process.argv[2], process.argv[3], ...process.argv.slice(4).map(Number)];
const img = read(src);
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const sx = Math.min(img.w - 1, X + x), sy = Math.min(img.h - 1, Y + y);
  const si = (sy * img.w + sx) * img.ch, di = (y * W + x) * 4;
  out[di] = img.d[si]; out[di + 1] = img.d[si + 1]; out[di + 2] = img.d[si + 2];
  out[di + 3] = img.ch === 4 ? img.d[si + 3] : 255;
}
write(dst, W, H, out);
console.log('  ' + dst + '  ' + W + '×' + H + '  ← ' + path.basename(src) + ' (' + X + ',' + Y + ')');
