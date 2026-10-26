// 에뮬레이터 캔버스에 대표 캐릭터 콘을 손가락 획으로 그린다(강좌 녹화용, 2026-10-16).
// 좌표는 예전(10-16) 콘 선 그림(0~96 단위, 2026-10-27 생성 스크립트 삭제)을 화면 픽셀로 옮긴 것이다. 1080×2400 기준 캔버스: x 24~1056, y 694~1728.
const r = require('./rec.cjs');
const N = 14;
const quad = (p0, p1, p2, n = N) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t; return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]; });
const circle = (cx, cy, rad, n = 16, turns = 1) => Array.from({ length: n * turns + 1 }, (_, i) => { const a = i / n * Math.PI * 2 - Math.PI / 2; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; });
const roundRect = (x, y, w, h, rad) => {
  const pts = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = (a0 + i / 8 * 90) * Math.PI / 180; pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); } };
  arc(x + w - rad, y + rad, -90); arc(x + w - rad, y + h - rad, 0); arc(x + rad, y + h - rad, 90); arc(x + rad, y + rad, 180); pts.push(pts[0]); return pts;
};
// 획 목록(콘 단위). 이름은 강좌 단계에서 일부만 그릴 때 쓴다.
const PARTS = {
  body: [roundRect(30, 14, 36, 68, 18)],
  sprout: [[...quad([48, 15], [40, 1], [29, 3]), ...quad([29, 3], [35, 13], [48, 16])], [...quad([48, 15], [57, -1], [68, 1]), ...quad([68, 1], [61, 13], [48, 16])]],
  armL: [quad([30, 52], [23, 56], [21, 63], 8), circle(20, 66, 4.2, 12)],
  armR: [quad([66, 52], [73, 56], [75, 63], 8), circle(76, 66, 4.2, 12)],
  armWave: [quad([65, 52], [73, 46], [76, 37], 8), circle(77, 33, 4.2, 12)],
  skirt: [[...quad([48, 90], [33, 90], [27, 73]), ...quad([27, 73], [40, 75], [47, 84]), [48, 90]], [...quad([48, 90], [63, 90], [69, 73]), ...quad([69, 73], [56, 75], [49, 84]), [48, 90]]],
  eyes: [circle(41, 45, 1.6, 10, 2), circle(55, 45, 1.6, 10, 2)],
  wink: [circle(41, 45, 1.6, 10, 2), quad([51, 45], [55, 41], [59, 45], 6)],
  mouth: [[...quad([43, 53], [45.5, 56], [48, 53], 5), ...quad([48, 53], [50.5, 56], [53, 53], 5)]],
};
// 콘 단위 → 화면 픽셀. s = 콘 1단위의 픽셀(기본 8.6 ≈ 캔버스 75%)
const place = ({ cx = 540, cy = 1211, s = 8.6 } = {}) => ([x, y]) => [cx + (x - 48) * s, cy + (y - 46) * s];
function draw(parts, opts = {}) { const at = place(opts); for (const name of parts) for (const stroke of PARTS[name]) r.stroke(stroke.map(at)); }
module.exports = { draw, place, PARTS };
