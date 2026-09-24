// 받아 온 획들을 한 장으로 모은다. 그림은 옮겨 놓을 뿐 새로 그리지 않는다.
// 쓰는 법: node scripts/_brush-sheet.cjs <폴더> <나갈파일> [칸너비] [칸높이] [열]
const fs = require('node:fs'), zlib = require('node:zlib'), path = require('node:path');
const { LIST } = require('./_brush30.cjs');
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
  return { w, h, d: out };
}
function write(f, w, h, rgba) { const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const chunk = (t, x) => { const o = Buffer.alloc(12 + x.length); o.writeUInt32BE(x.length, 0); o.write(t, 4, 'latin1'); x.copy(o, 8); o.writeUInt32BE(CRC(Buffer.concat([Buffer.from(t, 'latin1'), x])), 8 + x.length); return o; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
const DIR = process.argv[2], OUTF = process.argv[3];
const CW = Number(process.argv[4] || 240), CH = Number(process.argv[5] || 150), COLS = Number(process.argv[6] || 5);
const ids = LIST.map(r => r[0]).filter(id => fs.existsSync(path.join(DIR, id + '.png')));
const rows = Math.ceil(ids.length / COLS);
const W = CW * COLS, H = CH * rows;
const buf = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { buf[i * 4] = 255; buf[i * 4 + 1] = 255; buf[i * 4 + 2] = 255; buf[i * 4 + 3] = 255; }
ids.forEach((id, k) => {
  const img = read(path.join(DIR, id + '.png'));
  const col = k % COLS, row = Math.floor(k / COLS), ox = col * CW, oy = row * CH;
  const scale = Math.min(CW / img.w, CH / img.h), dw = Math.round(img.w * scale), dh = Math.round(img.h * scale);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = Math.min(img.w - 1, Math.floor(x / scale)), sy = Math.min(img.h - 1, Math.floor(y / scale));
    const si = (sy * img.w + sx) * 4, di = ((oy + y) * W + ox + x) * 4, a = img.d[si + 3] / 255;
    for (let c = 0; c < 3; c++) buf[di + c] = Math.round(img.d[si + c] * a + buf[di + c] * (1 - a));
  }
  // 칸 경계
  for (let x = 0; x < CW; x++) { const di = (oy * W + ox + x) * 4; buf[di] = buf[di + 1] = buf[di + 2] = 220; }
  for (let y = 0; y < CH; y++) { const di = ((oy + y) * W + ox) * 4; buf[di] = buf[di + 1] = buf[di + 2] = 220; }
});
write(OUTF, W, H, buf);
console.log('  ' + OUTF + ' ' + W + '×' + H + ' · ' + ids.length + '칸 · 차례 ' + ids.join(' '));
