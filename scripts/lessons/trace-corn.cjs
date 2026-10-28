// Codex 콘(assets/mascot/corn-base.png)의 윤곽선을 따라 그릴 획 목록으로 바꾼다(2026-10-28).
// 강좌 녹화에서 손가락으로 '지금 콘'을 그리기 위해서다 — 새 그림을 만드는 게 아니라 Codex 원본 선을 따라간다.
// 방법: 진한 선 픽셀 → 격자로 줄이기 → 가늘게(Zhang-Suen) → 끝점·갈림길에서 길 따라가기 → 점 줄이기(RDP).
// 결과: scripts/lessons/corn-trace.json  { strokes: [[[x,y]...]...] }  좌표는 그림 기준 0~1.
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const SRC = path.join(__dirname, '..', '..', 'assets', 'mascot', process.argv[2] || 'corn-base.png');
const OUT = path.join(__dirname, process.argv[3] || 'corn-trace.json');
const G = 200;                                     // 격자 한 변

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H, data } = png;
const dark = (x, y) => { const k = (y * W + x) * 4; return data[k + 3] > 200 && data[k] * .3 + data[k + 1] * .59 + data[k + 2] * .11 < 95; };
// 격자로 줄이기: 칸 안 진한 픽셀이 30% 넘으면 선
const grid = new Uint8Array(G * G), cell = W / G;
for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
  let n = 0, t = 0;
  for (let y = Math.floor(gy * cell); y < Math.floor((gy + 1) * cell); y++) for (let x = Math.floor(gx * cell); x < Math.floor((gx + 1) * cell); x++) { t++; if (dark(x, y)) n++; }
  grid[gy * G + gx] = n / t > .3 ? 1 : 0;
}
// Zhang-Suen 가늘게
const at = (x, y) => (x < 0 || y < 0 || x >= G || y >= G) ? 0 : grid[y * G + x];
for (let changed = true; changed;) {
  changed = false;
  for (const step of [0, 1]) {
    const kill = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      if (!at(x, y)) continue;
      const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
      const b = p.reduce((a, v) => a + v, 0); if (b < 2 || b > 6) continue;
      let a = 0; for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) a++; if (a !== 1) continue;
      if (step === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
      kill.push(y * G + x);
    }
    if (kill.length) { changed = true; for (const k of kill) grid[k] = 0; }
  }
}
// 길 따라가기
const nb = (x, y) => { const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(x + dx, y + dy)) o.push([x + dx, y + dy]); return o; };
const seen = new Uint8Array(G * G), paths = [];
const walk = (x, y) => {
  const pts = [[x, y]]; seen[y * G + x] = 1;
  for (;;) {
    const next = nb(x, y).filter(([a, b]) => !seen[b * G + a]);
    if (!next.length) break;
    // 곧게 이어지는 쪽(가로·세로 이웃)을 먼저
    next.sort((p, q) => (Math.abs(p[0] - x) + Math.abs(p[1] - y)) - (Math.abs(q[0] - x) + Math.abs(q[1] - y)));
    [x, y] = next[0]; seen[y * G + x] = 1; pts.push([x, y]);
  }
  return pts;
};
for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (at(x, y) && !seen[y * G + x] && nb(x, y).length === 1) paths.push(walk(x, y));
for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (at(x, y) && !seen[y * G + x]) { const p = walk(x, y); const [a, b] = [p[0], p.at(-1)]; if (p.length > 2 && Math.hypot(a[0] - b[0], a[1] - b[1]) <= 2) p.push(p[0]); paths.push(p); }
// 점 줄이기(RDP)
const rdp = (pts, eps) => {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts.at(-1)]; let best = 0, at2 = 0;
  for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i], d = (a[0] === b[0] && a[1] === b[1]) ? Math.hypot(x - a[0], y - a[1]) : Math.abs((b[1] - a[1]) * x - (b[0] - a[0]) * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); if (d > best) { best = d; at2 = i; } }
  return best > eps ? [...rdp(pts.slice(0, at2 + 1), eps).slice(0, -1), ...rdp(pts.slice(at2), eps)] : [a, b];
};
// 속이 찬 작은 점(눈)은 가늘게 하면 몇 칸만 남는다 — 그 자리에 작은 동그라미 획으로 바꾼다.
const dot = p => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, r = 2.2; return Array.from({ length: 13 }, (_, i) => [cx + r * Math.cos(i / 12 * Math.PI * 2), cy + r * Math.sin(i / 12 * Math.PI * 2)]); };
const small = p => Math.max(...p.map(q => q[0])) - Math.min(...p.map(q => q[0])) <= 6 && Math.max(...p.map(q => q[1])) - Math.min(...p.map(q => q[1])) <= 6;
// 눈: 원본에서 속이 찬 진한 덩어리(가로세로 20~90px, 둥근 것)를 찾아 작은 동그라미 두 번 돌리기 획으로.
const eyes = (() => { const lab = new Int32Array(W * H).fill(-1), found = []; let id = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { if (!dark(x, y) || lab[y * W + x] >= 0) continue;
    const st = [[x, y]]; lab[y * W + x] = id; let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
    while (st.length) { const [a, b] = st.pop(); n++; x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b);
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const c = a + dx, d = b + dy; if (c < 0 || d < 0 || c >= W || d >= H || lab[d * W + c] >= 0 || !dark(c, d)) continue; lab[d * W + c] = id; st.push([c, d]); } }
    const w = x1 - x0, h = y1 - y0; if (w >= 20 && h >= 20 && w <= 90 && h <= 90 && n * 4 > w * h * .5) found.push({ n, cx: (x0 + x1) / 2 / W, cy: (y0 + y1) / 2 / H, r: Math.min(w, h) / 2 / W }); id++; }
  // 가장 큰 둘이 두 눈(입 안쪽의 작은 진한 자리는 뺀다)
  return found.sort((a, b) => b.n - a.n).slice(0, 2).map(e => Array.from({ length: 25 }, (_, i) => { const a = i / 12 * Math.PI * 2, r = e.r * (i < 13 ? .8 : .4); return [+(e.cx + r * Math.cos(a)).toFixed(4), +(e.cy + r * Math.sin(a)).toFixed(4)]; })); })();
const strokes = paths.filter(p => p.length >= 4 && !small(p)).map(p => rdp(p, .7)).map(p => p.map(([x, y]) => [+((x + .5) / G).toFixed(4), +((y + .5) / G).toFixed(4)]));
// 틈 막기: 갈림길에서 끊긴 획 끝을 4칸 안의 다른 선에 이어 붙인다 — 틈이 있으면 채우기가 몸 밖으로 번진다.
const near = .022;
for (const st of strokes) for (const end of [0, 1]) {
  const p = end ? st.at(-1) : st[0]; let best = null, bd = near;
  for (const o of strokes) for (let i = 0; i < o.length; i++) { if (o === st && (end ? i > o.length - 4 : i < 3)) continue; const d = Math.hypot(o[i][0] - p[0], o[i][1] - p[1]); if (d > 1e-4 && d < bd) { bd = d; best = o[i]; } }
  if (best) { if (end) st.push([...best]); else st.unshift([...best]); }
}
// 큰 획(몸·잎 윤곽)부터 — 손으로 그리는 순서처럼
strokes.sort((p, q) => q.length - p.length);
strokes.push(...eyes);   // 눈은 얼굴을 그린 뒤 마지막에
fs.writeFileSync(OUT, JSON.stringify({ source: path.basename(SRC), grid: G, strokes }, null, 0));
console.log('strokes', strokes.length, 'points', strokes.reduce((a, s) => a + s.length, 0), '→', OUT);
