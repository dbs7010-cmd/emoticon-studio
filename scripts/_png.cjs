// 작은 PNG 도구: 읽기 / 쓰기 / 잘라 확대 / 이름표 붙여 이어 붙이기.
// 글자는 5×7 점 글꼴로 직접 찍는다(한글은 글꼴이 없으므로 이름표에 쓰지 않는다).
const fs = require('node:fs'), zlib = require('node:zlib');

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();

function read(f) {
  const b = fs.readFileSync(f); let off = 8, w = 0, h = 0, type = 0; const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), tag = b.slice(off + 4, off + 8).toString('latin1'), d = b.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); type = d[9]; }
    if (tag === 'IDAT') idat.push(d); if (tag === 'IEND') break; off += 12 + len;
  }
  const ch = type === 6 ? 4 : type === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) {
    const f2 = raw[p++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[p + x], a = x >= ch ? px[y * stride + x - ch] : 0, bb = y > 0 ? px[(y - 1) * stride + x] : 0, c = (x >= ch && y > 0) ? px[(y - 1) * stride + x - ch] : 0;
      let v; if (f2 === 0) v = cur; else if (f2 === 1) v = cur + a; else if (f2 === 2) v = cur + bb; else if (f2 === 3) v = cur + ((a + bb) >> 1);
      else { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c); v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      px[y * stride + x] = v & 255;
    } p += stride;
  }
  // 무엇이 들어오든 RGBA 로 맞춘다.
  if (ch === 4) return { w, h, d: px };
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { const r = ch === 1 ? px[i] : px[i * 3], g = ch === 1 ? px[i] : px[i * 3 + 1], bl = ch === 1 ? px[i] : px[i * 3 + 2]; out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = bl; out[i * 4 + 3] = 255; }
  return { w, h, d: out };
}

function write(f, img) {
  const { w, h, d } = img, stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; d.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const chunk = (t, x) => { const o = Buffer.alloc(12 + x.length); o.writeUInt32BE(x.length, 0); o.write(t, 4, 'latin1'); x.copy(o, 8); o.writeUInt32BE(CRC(Buffer.concat([Buffer.from(t, 'latin1'), x])), 8 + x.length); return o; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

const blank = (w, h, rgb = [255, 255, 255]) => { const d = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255; } return { w, h, d }; };

// 흰 바탕 위에 알파 합성
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) {
    const dy = oy + y; if (dy < 0 || dy >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const dx = ox + x; if (dx < 0 || dx >= dst.w) continue;
      const si = (y * src.w + x) * 4, di = (dy * dst.w + dx) * 4, a = src.d[si + 3] / 255;
      for (let c = 0; c < 3; c++) dst.d[di + c] = Math.round(src.d[si + c] * a + dst.d[di + c] * (1 - a));
    }
  }
}

// 최근접 확대 — 도장 자국을 흐리지 않고 그대로 키운다.
function crop(img, x0, y0, w, h, zoom = 1) {
  const out = blank(w * zoom, h * zoom);
  for (let y = 0; y < h * zoom; y++) for (let x = 0; x < w * zoom; x++) {
    const sx = x0 + Math.floor(x / zoom), sy = y0 + Math.floor(y / zoom);
    const di = (y * out.w + x) * 4;
    if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
    const si = (sy * img.w + sx) * 4, a = img.d[si + 3] / 255;
    for (let c = 0; c < 3; c++) out.d[di + c] = Math.round(img.d[si + c] * a + 255 * (1 - a));
  }
  return out;
}

// 5×7 점 글꼴 — 영문 대문자·숫자·몇 개 기호. 한글은 담지 않는다.
const FONT = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 11110 10001 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 11110 10000 10000 10000 11111', F: '11111 10000 11110 10000 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 11111 10001 10001 10001 10001',
  I: '11111 00100 00100 00100 00100 00100 11111', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 11011 10001', X: '10001 01010 00100 00100 00100 01010 10001',
  Y: '10001 01010 00100 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10011 10101 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00110 01000 10000 11111', 3: '11111 00010 00100 00010 00001 10001 01110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 01100 01100', ':': '00000 01100 01100 00000 01100 01100 00000',
  '/': '00001 00010 00010 00100 01000 01000 10000', '%': '11001 11010 00010 00100 01000 01011 10011',
  '+': '00000 00100 00100 11111 00100 00100 00000', '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000', '=': '00000 00000 11111 00000 11111 00000 00000',
  '#': '01010 01010 11111 01010 11111 01010 01010', '*': '00000 10101 01110 11111 01110 10101 00000',
  '>': '01000 00100 00010 00001 00010 00100 01000', ',': '00000 00000 00000 00000 01100 01100 10000',
};
function text(img, s, x, y, scale = 2, rgb = [30, 32, 38]) {
  let cx = x;
  for (const chRaw of String(s).toUpperCase()) {
    const rows = (FONT[chRaw] || FONT[' ']).split(' ');
    for (let ry = 0; ry < 7; ry++) for (let rx = 0; rx < 5; rx++) {
      if (rows[ry][rx] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const px = cx + rx * scale + dx, py = y + ry * scale + dy;
        if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
        const di = (py * img.w + px) * 4; img.d[di] = rgb[0]; img.d[di + 1] = rgb[1]; img.d[di + 2] = rgb[2]; img.d[di + 3] = 255;
      }
    }
    cx += 6 * scale;
  }
  return cx;
}
const textWidth = (s, scale = 2) => String(s).length * 6 * scale;

function rect(img, x, y, w, h, rgb) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (xx < 0 || yy < 0 || xx >= img.w || yy >= img.h) continue;
    const di = (yy * img.w + xx) * 4; img.d[di] = rgb[0]; img.d[di + 1] = rgb[1]; img.d[di + 2] = rgb[2]; img.d[di + 3] = 255;
  }
}

module.exports = { read, write, blank, blit, crop, text, textWidth, rect };
