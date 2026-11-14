// A(승인 시안 원본 오림) · B(현재 구현 렌더) · C(수정 목표 시안)를 같은 높이로 나란히 붙인다.
// 세 장의 성격이 다르므로 머리에 무엇인지 적는다. 새로 그리는 것은 없다 — 이미 있는 PNG 를 옮겨 놓을 뿐이다.
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

// 아주 작은 글자판(5×7). 머리의 A/B/C 표시를 그리는 데만 쓴다.
const FONT = { A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'] };
const R = 'verification/round45_27';
const STATES = [['draw-base', '기본 그리기'], ['draw-brush', '펜/브러시 선택'], ['draw-color', '색 선택'], ['draw-reference', '참고를 보면서 그리기']];
const BAND = 26, H = 760, GAP = 10, PAD = 10;
for (const [id, title] of STATES) {
  const imgs = ['A', 'B', 'C'].map(k => {
    const f = path.join(R, k, id + '.png');
    return fs.existsSync(f) ? { k, img: read(f) } : { k, img: null };
  });
  const widths = imgs.map(({ img }) => img ? Math.round(img.w * H / img.h) : 260);
  const W = widths.reduce((a, b) => a + b, 0) + GAP * 2 + PAD * 2;
  const total = H + BAND + PAD * 2;
  const buf = Buffer.alloc(W * total * 4);
  for (let i = 0; i < W * total; i++) { buf[i * 4] = 26; buf[i * 4 + 1] = 28; buf[i * 4 + 2] = 33; buf[i * 4 + 3] = 255; }
  let ox = PAD;
  imgs.forEach(({ k, img }, i) => {
    const w = widths[i];
    // 머리 띠 + 글자
    const tint = k === 'A' ? [90, 120, 200] : k === 'B' ? [120, 120, 130] : [180, 60, 40];
    for (let y = 0; y < BAND; y++) for (let x = 0; x < w; x++) { const p = ((PAD + y) * W + ox + x) * 4; buf[p] = tint[0]; buf[p + 1] = tint[1]; buf[p + 2] = tint[2]; buf[p + 3] = 255; }
    const glyph = FONT[k], S = 3, gx = ox + 8, gy = PAD + 4;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (glyph[r][c] === '1')
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const p = ((gy + r * S + dy) * W + gx + c * S + dx) * 4; buf[p] = 255; buf[p + 1] = 255; buf[p + 2] = 255; }
    if (!img) { ox += w + GAP; return; }
    const oy = PAD + BAND;
    for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) {
      const sx = Math.min(img.w - 1, Math.floor(x * img.w / w)), sy = Math.min(img.h - 1, Math.floor(y * img.h / H));
      const si = (sy * img.w + sx) * img.ch, di = ((oy + y) * W + ox + x) * 4;
      const a = img.ch === 4 ? img.d[si + 3] / 255 : 1;
      for (let c = 0; c < 3; c++) buf[di + c] = Math.round(img.d[si + c] * a + buf[di + c] * (1 - a));
      buf[di + 3] = 255;
    }
    ox += w + GAP;
  });
  write(path.join(R, 'abc-' + id + '.png'), W, total, buf);
  console.log('  abc-' + id + '.png  ' + W + '×' + total + '   ' + title);
}
