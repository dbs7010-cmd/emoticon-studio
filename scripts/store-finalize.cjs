// 스토어 그림을 업로드 형식으로 굳힌다: 알파 채널 없는 24-bit RGB PNG(Play 그래픽 이미지 요구), 크기·용량 확인.
// 사용: node scripts/store-finalize.cjs <찍은 png> <나갈 png> <폭> <높이> <최대 바이트>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { read } = require('./_png.cjs');
const [src, dest, w, h, max] = process.argv.slice(2);
const img = read(src);
if (img.w !== +w || img.h !== +h) throw new Error(`${src}: ${img.w}×${img.h} — ${w}×${h} 이어야 한다`);
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
const chunk = (t, x) => { const o = Buffer.alloc(12 + x.length); o.writeUInt32BE(x.length, 0); o.write(t, 4, 'latin1'); x.copy(o, 8); o.writeUInt32BE(CRC(Buffer.concat([Buffer.from(t, 'latin1'), x])), 8 + x.length); return o; };
const stride = img.w * 3, raw = Buffer.alloc(img.h * (stride + 1));
for (let y = 0; y < img.h; y++) {
  raw[y * (stride + 1)] = 0;
  for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4, a = img.d[i + 3] / 255;   // 투명이 남아 있으면 흰 바탕에 합성
    for (let c = 0; c < 3; c++) raw[y * (stride + 1) + 1 + x * 3 + c] = Math.round(img.d[i + c] * a + 255 * (1 - a));
  }
}
const ih = Buffer.alloc(13); ih.writeUInt32BE(img.w, 0); ih.writeUInt32BE(img.h, 4); ih[8] = 8; ih[9] = 2;
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
const size = fs.statSync(dest).size;
if (size > +max) throw new Error(`${dest}: ${size} bytes — 최대 ${max}`);
console.log(`${dest}  ${img.w}×${img.h}  RGB(알파 없음)  ${(size / 1024).toFixed(0)}KB`);
