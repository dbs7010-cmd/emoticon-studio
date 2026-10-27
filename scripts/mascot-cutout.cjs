// 대표 캐릭터를 HQ/Codex 원본 그림(docs/design/mascot-v2-src/)에서 그대로 오려 낸다(2026-10-27, 대표: "코덱스가 만든 캐릭터를 써라 — 다시 그린 건 미세하게 다르다").
// 다시 그리지 않는다: 크림색 종이 바탕만 지우고(가장자리에서 이어진 밝은 바탕을 채움 지우기) 캐릭터 픽셀은 그대로 둔다.
// 겹쳐 그려진 세 친구 큰 그림(kon-friends-v2 위쪽)은 서로 가려 있어 오리지 않는다 — 떨어져 있는 그림만 쓴다.
// 결과: assets/mascot/<이름>.png (원본 시트에서 떨어져 있는 7장만) (1024 정사각, 투명, 캐릭터는 가운데 · 바닥 정렬). 같은 파일을 쓰는 앱 자리·강좌·PRO GIF 가 같이 바뀐다.
// 실행: node scripts/mascot-cutout.cjs
const fs = require('node:fs');
const path = require('node:path');
const { read, write } = require('./_png.cjs');
const SRC = path.join(__dirname, '..', 'docs', 'design', 'mascot-v2-src');
const OUT = path.join(__dirname, '..', 'assets', 'mascot');

// [원본, 오릴 상자 x0 y0 x1 y1, 캐릭터 안쪽 한 점(이 점과 이어진 덩어리만 남김)]
const CUTS = {
  'corn-wave': ['kon-v2-character-sheet', [60, 215, 720, 1070], [450, 700]],
  'corn-shy': ['kon-v2-character-sheet', [850, 65, 1160, 470], [1010, 300]],
  'corn-cheer': ['kon-v2-character-sheet', [795, 485, 1210, 900], [1000, 720]],
  'corn-sleep': ['kon-v2-character-sheet', [790, 900, 1210, 1190], [990, 1040]],
  'corn-cheer-small': ['kon-friends-v2', [450, 845, 790, 1180], [620, 1050]],
  'goguma-shy': ['kon-friends-v2', [50, 855, 400, 1185], [230, 1050]],
  'kong-sleep': ['kon-friends-v2', [815, 925, 1210, 1190], [1000, 1080]],
};
// 2026-10-27: 나머지 16장(corn-base·bow·sad·angry·no·heart·sorry·nod·wave-body·wave-arm, goguma-base·wave·cheer, kong-base·wave·cheer)은
// Codex 가 단독 그림으로 따로 그려 줬다(docs/design/mascot-v2-src/solo/ → assets/mascot/ 그대로 복사). 여기서는 만들지 않는다.
const ALIAS = {};
const isPaper = (r, g, b) => r > 228 && g > 214 && b > 180 && r - b < 70;   // 크림 종이 + 발밑 옅은 그림자

function cut(img, [x0, y0, x1, y1], [sx, sy]) {
  const w = x1 - x0, h = y1 - y0, px = (x, y) => ((y0 + y) * img.w + x0 + x) * 4;
  const bg = new Uint8Array(w * h), q = [];
  const push = (x, y) => { const i = y * w + x; if (bg[i]) return; const p = px(x, y); if (!isPaper(img.d[p], img.d[p + 1], img.d[p + 2])) return; bg[i] = 1; q.push(i); };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (q.length) { const i = q.pop(), x = i % w, y = (i / w) | 0; if (x) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
  // 씨앗 점과 이어진 덩어리만(상자에 걸친 이웃 그림 조각 제거). 반짝 선처럼 떨어진 작은 조각은 몸 가까이(40px)면 남긴다.
  const keep = new Uint8Array(w * h), st = [(sy - y0) * w + (sx - x0)]; keep[st[0]] = 1;
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (!keep[j] && !bg[j]) { keep[j] = 1; st.push(j); } } }
  let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (keep[y * w + x]) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  const near = 40, mark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (keep[i] || (!bg[i] && x > bx0 - near && x < bx1 + near && y > by0 - near && y < by1 + near)) mark[i] = 1; }
  // 바탕과 맞닿은 테두리 픽셀은 밝기만큼 반투명(종이색 테두리 번짐 줄이기)
  const out = { w, h, d: Buffer.alloc(w * h * 4) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = px(x, y), o = i * 4; if (!mark[i]) continue;
    const r = img.d[p], g = img.d[p + 1], b = img.d[p + 2];
    let a = 255;
    const edge = (x && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (edge) { const lum = (r + g + b) / 3; a = Math.max(0, Math.min(255, Math.round((250 - lum) / 110 * 255))); }
    out.d[o] = r; out.d[o + 1] = g; out.d[o + 2] = b; out.d[o + 3] = a;
  }
  return out;
}
// 정사각 캔버스(1024)에 가운데 · 바닥 여백 6% 로 놓는다(축소는 상자 평균)
function place(c, size = 1024, pad = .06) {
  let bx0 = c.w, by0 = c.h, bx1 = 0, by1 = 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.d[(y * c.w + x) * 4 + 3]) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  const cw = bx1 - bx0 + 1, ch = by1 - by0 + 1, s = Math.min(size * (1 - 2 * pad) / cw, size * (1 - 2 * pad) / ch);
  const out = { w: size, h: size, d: Buffer.alloc(size * size * 4) };
  const ox = (size - cw * s) / 2, oy = size * (1 - pad) - ch * s;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx0 = (x - ox) / s + bx0, fy0 = (y - oy) / s + by0, fx1 = (x + 1 - ox) / s + bx0, fy1 = (y + 1 - oy) / s + by0;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(fy0); yy < Math.max(Math.floor(fy0) + 1, Math.ceil(fy1)); yy++) for (let xx = Math.floor(fx0); xx < Math.max(Math.floor(fx0) + 1, Math.ceil(fx1)); xx++) {
      n++; if (xx < 0 || yy < 0 || xx >= c.w || yy >= c.h) continue; const p = (yy * c.w + xx) * 4, al = c.d[p + 3]; r += c.d[p] * al; g += c.d[p + 1] * al; b += c.d[p + 2] * al; a += al; }
    if (!a) continue; const o = (y * size + x) * 4;
    out.d[o] = Math.round(r / a); out.d[o + 1] = Math.round(g / a); out.d[o + 2] = Math.round(b / a); out.d[o + 3] = Math.round(a / n);
  }
  return out;
}

const made = {};
for (const [name, [file, box, seed]] of Object.entries(CUTS)) {
  const img = made[file] ||= read(path.join(SRC, file + '.png'));
  const png = place(cut(img, box, seed));
  write(path.join(OUT, name + '.png'), png);
  console.log(name, png.w + '×' + png.h);
}
for (const [name, from] of Object.entries(ALIAS)) { fs.copyFileSync(path.join(OUT, from + '.png'), path.join(OUT, name + '.png')); console.log(name, '←', from); }

