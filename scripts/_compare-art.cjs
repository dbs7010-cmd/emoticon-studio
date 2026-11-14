// 파스텔 카드 위에 원본과 표시용을 나란히 올려 한 장으로 만든다(검토용).
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const SRC = path.resolve(__dirname, '..', 'assets', 'expression-guides');
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
function readPng(file) {
  const b = fs.readFileSync(file); let off = 8, w = 0, h = 0, depth = 0, type = 0; const idat = [];
  while (off < b.length) { const len = b.readUInt32BE(off), tag = b.slice(off + 4, off + 8).toString('latin1'), data = b.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; }
    if (tag === 'IDAT') idat.push(data); if (tag === 'IEND') break; off += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p++];
    for (let x = 0; x < stride; x++) { const cur = raw[p + x], a = x >= bpp ? out[y * stride + x - bpp] : 0, bb = y > 0 ? out[(y - 1) * stride + x] : 0, c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
      let v; if (f === 0) v = cur; else if (f === 1) v = cur + a; else if (f === 2) v = cur + bb; else if (f === 3) v = cur + ((a + bb) >> 1);
      else { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c); v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      out[y * stride + x] = v & 255; } p += stride; }
  return { w, h, rgba: out };
}
function writePng(file, w, h, rgba) {
  const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const chunk = (tag, data) => { const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); o.write(tag, 4, 'latin1'); data.copy(o, 8); o.writeUInt32BE(CRC(Buffer.concat([Buffer.from(tag, 'latin1'), data])), 8 + data.length); return o; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
const TILE = 200, PAD = 12;
const cards = [[217, 204, 250], [199, 232, 252], [252, 214, 209]];
const names = process.argv.slice(3);
const out = process.argv[2];
const W = TILE * 2 + PAD * 3, H = (TILE + PAD) * names.length + PAD;
const buf = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { buf[i * 4] = 32; buf[i * 4 + 1] = 34; buf[i * 4 + 2] = 40; buf[i * 4 + 3] = 255; }
const place = (img, ox, oy, bg) => {
  const s = Math.min((TILE - 40) / img.w, (TILE - 40) / img.h);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const px = ((oy + y) * W + ox + x) * 4;
    buf[px] = bg[0]; buf[px + 1] = bg[1]; buf[px + 2] = bg[2]; buf[px + 3] = 255;
  }
  const dw = Math.round(img.w * s), dh = Math.round(img.h * s), dx = ox + ((TILE - dw) >> 1), dy = oy + ((TILE - dh) >> 1);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = Math.min(img.w - 1, Math.floor(x / s)), sy = Math.min(img.h - 1, Math.floor(y / s));
    const si = (sy * img.w + sx) * 4, a = img.rgba[si + 3] / 255, di = ((dy + y) * W + dx + x) * 4;
    for (let c = 0; c < 3; c++) buf[di + c] = Math.round(img.rgba[si + c] * a + buf[di + c] * (1 - a));
  }
};
names.forEach((name, i) => {
  const oy = PAD + i * (TILE + PAD), bg = cards[i % cards.length];
  place(readPng(path.join(SRC, name)), PAD, oy, bg);
  const disp = path.join(SRC, 'display', name);
  if (fs.existsSync(disp)) place(readPng(disp), PAD * 2 + TILE, oy, bg);
});
writePng(out, W, H, buf);
console.log('  ' + out);
