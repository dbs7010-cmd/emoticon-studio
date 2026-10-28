// 강좌 녹화용: 지금 Codex 콘(assets/mascot/corn-base.png)을 손가락 획으로 그린다(2026-10-28).
// 획은 trace-corn.cjs 가 원본 윤곽선을 따라 뽑은 corn-trace.json. 예전 콘 선 그림(corn-strokes.cjs, 10-16)은 쓰지 않는다.
// 좌표: 그림 기준 0~1 → 1080×2400 폰 에뮬레이터 캔버스(왼쪽 위 26,694 · 한 변 1028)의 가운데 90%.
// 색(2026-10-29): 원본처럼 갈색 선 · 노랑 몸·손·발 · 초록 새싹 둘과 아래 껍질 잎 둘 · 주황 알갱이 점 · 살구 볼. 칠하다 마는 곳이 없게 한다.
const r = require('./rec.cjs'), u = require('./ui.cjs');
const { strokes } = require('./corn-trace.json');
const CANVAS = { x: 26, y: 694, side: 1028 }, FIT = .9;
const at = (nx, ny) => [CANVAS.x + CANVAS.side * ((1 - FIT) / 2 + FIT * nx), CANVAS.y + CANVAS.side * ((1 - FIT) / 2 + FIT * ny)];
// 획 사이에 잠깐 쉰다 — adb 입력을 몰아 보내면 작은 획(눈)이 가끔 빠졌다.
// 선 보정이 획 끝을 조금 짧게 끊어 이음새에 틈이 났다(10-29, 채우기가 몸 밖으로 샘) — 양 끝을 0.7% 더 긋고, 끝에서 잠깐 머문다.
const reach = s => { if (s.length < 2) return s; const ext = (a, b) => { const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1; return [a[0] + dx / l * .007, a[1] + dy / l * .007]; };
  const closed = Math.hypot(s[0][0] - s.at(-1)[0], s[0][1] - s.at(-1)[1]) < .005; const o = closed ? [...s, s[1]] : [ext(s[0], s[1]), ...s, ext(s.at(-1), s.at(-2))]; return [...o, ...Array(2).fill(o.at(-1))]; };
function draw(pause = 350) { for (const s of strokes) { r.stroke(reach(s).map(([x, y]) => at(x, y))); r.sleep(pause); } }
// 원본 그림에서 잰 자리(그림 기준 0~1): 채우기·볼터치·알갱이·하트. 채우기 자리는 corn-trace 선에서 가장 먼 칸 안쪽(10-29) — 선에 붙으면 굵은 선 위를 눌러 안 칠해졌다.
const SPOT = {
  body: [.5, .35], leafL: [.348, .768], leafR: [.65, .767], sproutL: [.443, .15], sproutR: [.633, .212],
  handL: [.198, .72], handR: [.798, .728], footL: [.39, .905], footR: [.6, .907],
  cheekL: [.33, .55], cheekR: [.66, .55], grains: [[.47, .31], [.53, .27], [.6, .335]], heart: [.86, .38],
};
const COLOR = { line: '#765044', body: '#FFD15C', leaf: '#65C47A', grain: '#FFAA4D', cheek: '#FF8C69', heart: '#E94F4F' };
// 팔레트에서 색 고르기(색 칸 → 없으면 팔레트 펼치기)
function color(hex) {
  u.tap('색, ' + u.nodes().find(n => n.desc.startsWith('색, #')).desc.slice(3), 1200);
  if (!u.has('색 ' + hex)) u.tap('팔레트', 1000);
  u.tap('색 ' + hex, 900);
  if (u.has('팔레트 닫기')) u.tap('팔레트 닫기', 900);
}
// 알갱이·볼: 작은 동그라미를 두 바퀴(마커로 칠한 점처럼)
const dot = ([x, y], rad = .018) => Array.from({ length: 25 }, (_, i) => { const a = i / 12 * Math.PI * 2, k = i < 13 ? 1 : .5; return at(x + rad * k * Math.cos(a), y + rad * k * Math.sin(a)); });
module.exports = { draw, at, dot, color, SPOT, COLOR, strokes };
// 다 그린 뒤 확인: 캔버스 안 갈색 선 픽셀 수. 첫 획들이 엔진 준비 전에 들어가 빠진 일이 있었다(10-29, 몸 아래 선이 없어 칠이 샘).
// 획 길이 × 굵기로 어림하면 약 10만 — 크게 모자라면 녹화를 멈춘다.
function ink() {
  const { PNG } = require('pngjs');
  const png = PNG.sync.read(r.adb(['exec-out', 'screencap', '-p']));
  let n = 0;
  for (let y = CANVAS.y; y < CANVAS.y + CANVAS.side; y++) for (let x = CANVAS.x; x < CANVAS.x + CANVAS.side; x++) {
    const k = (y * png.width + x) * 4; if (Math.abs(png.data[k] - 0x76) + Math.abs(png.data[k + 1] - 0x50) + Math.abs(png.data[k + 2] - 0x44) < 60) n++;
  }
  return n;
}
module.exports.ink = ink;
// 채우기: 누른 뒤 그 자리 색을 보고, 안 칠해졌으면 한 번 더 누른다(에뮬레이터에서 탭이 가끔 씹혀 잎 하나가 하얗게 남았다, 10-29).
function fill([nx, ny], hex, wait = 1100) {
  const { PNG } = require('pngjs');
  const [x, y] = at(nx, ny), want = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < 3; i++) {
    r.tap(x, y, wait);
    const png = PNG.sync.read(r.adb(['exec-out', 'screencap', '-p'])), k = ((y | 0) * png.width + (x | 0)) * 4;
    if (Math.abs(png.data[k] - want[0]) + Math.abs(png.data[k + 1] - want[1]) + Math.abs(png.data[k + 2] - want[2]) < 40) return true;
  }
  throw new Error('채우기가 안 됨: ' + hex + ' @ ' + nx + ',' + ny);
}
module.exports.fill = fill;
// 한 자리 둘레(그림 기준 반지름 rad)의 갈색 선 픽셀 수 — 윙크처럼 작은 획이 실제로 들어갔는지 본다.
function inkNear([nx, ny], rad = .05) {
  const { PNG } = require('pngjs');
  const png = PNG.sync.read(r.adb(['exec-out', 'screencap', '-p']));
  const [x0, y0] = at(nx - rad, ny - rad), [x1, y1] = at(nx + rad, ny + rad);
  let n = 0;
  for (let y = y0 | 0; y < y1; y++) for (let x = x0 | 0; x < x1; x++) {
    const k = (y * png.width + x) * 4; if (Math.abs(png.data[k] - 0x76) + Math.abs(png.data[k + 1] - 0x50) + Math.abs(png.data[k + 2] - 0x44) < 60) n++;
  }
  return n;
}
module.exports.inkNear = inkNear;
