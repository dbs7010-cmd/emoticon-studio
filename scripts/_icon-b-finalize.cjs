// _icon-b-export.cjs 로 찍은 PNG 를 출시 에셋 자리(assets/asset-contract.json)에 놓는다.
// 알파 채널이 금지된 것(app-icon · adaptive-background)은 RGB PNG 로 다시 쓰고, 투명이 필요한 것은 RGBA 그대로 둔다.
// 사용: node scripts/_icon-b-finalize.cjs <찍은 폴더>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { read } = require('./_png.cjs');
const src = process.argv[2] || 'verification/round45_44/icon-b';
const root = path.resolve(__dirname, '..');
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
const chunk = (t, x) => { const o = Buffer.alloc(12 + x.length); o.writeUInt32BE(x.length, 0); o.write(t, 4, 'latin1'); x.copy(o, 8); o.writeUInt32BE(CRC(Buffer.concat([Buffer.from(t, 'latin1'), x])), 8 + x.length); return o; };
function writePng(file, img, rgb) {
  const ch = rgb ? 3 : 4, stride = img.w * ch, raw = Buffer.alloc(img.h * (stride + 1));
  for (let y = 0; y < img.h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < img.w; x++) for (let c = 0; c < ch; c++) raw[y * (stride + 1) + 1 + x * ch + c] = img.d[(y * img.w + x) * 4 + c];
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(img.w, 0); ih.writeUInt32BE(img.h, 4); ih[8] = 8; ih[9] = rgb ? 2 : 6;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
const plan = [
  ['app-icon', 'assets/brand/app-icon.png', true],
  ['adaptive-foreground', 'assets/brand/adaptive-foreground.png', false],
  ['adaptive-background', 'assets/brand/adaptive-background.png', true],
  ['adaptive-monochrome', 'assets/brand/adaptive-monochrome.png', false],
  ['splash-icon', 'assets/brand/splash-icon.png', false],
  ['play-icon-512', 'assets/store/play-icon-512.png', true],
];
for (const [name, dest, rgb] of plan) {
  const img = read(path.join(src, name + '.png'));
  if (rgb) for (let i = 3; i < img.d.length; i += 4) if (img.d[i] !== 255) throw new Error(name + ': 불투명해야 하는데 투명 픽셀이 있다');
  if (!rgb && ![...Array(img.w * img.h).keys()].some(i => img.d[i * 4 + 3] === 0)) throw new Error(name + ': 투명 픽셀이 있어야 한다');
  writePng(path.join(root, dest), img, rgb);
  console.log(`${dest}  ${img.w}×${img.h}  ${rgb ? 'RGB(알파 없음)' : 'RGBA(투명)'}  ${fs.statSync(path.join(root, dest)).size} bytes`);
}
// 적응형 배경색·스플래시 바탕(앱 바탕과 같은 흰색)·스플래시 그림 폭
fs.writeFileSync(path.join(root, 'assets/brand/brand.json'), JSON.stringify({ adaptiveBackgroundColor: '#FFCC2E', splashBackgroundColor: '#FFFFFF', splashImageWidth: 200 }, null, 2) + '\n');
console.log('assets/brand/brand.json');
