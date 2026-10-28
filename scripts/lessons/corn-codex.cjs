// 강좌 녹화용: 지금 Codex 콘(assets/mascot/corn-base.png)을 손가락 획으로 그린다(2026-10-28).
// 획은 trace-corn.cjs 가 원본 윤곽선을 따라 뽑은 corn-trace.json. 예전 콘 선 그림(corn-strokes.cjs, 10-16)은 쓰지 않는다.
// 좌표: 그림 기준 0~1 → 1080×2400 폰 에뮬레이터 캔버스(왼쪽 위 26,694 · 한 변 1028)의 가운데 90%.
const r = require('./rec.cjs');
const { strokes } = require('./corn-trace.json');
const CANVAS = { x: 26, y: 694, side: 1028 }, FIT = .9;
const at = (nx, ny) => [CANVAS.x + CANVAS.side * ((1 - FIT) / 2 + FIT * nx), CANVAS.y + CANVAS.side * ((1 - FIT) / 2 + FIT * ny)];
// 획 사이에 잠깐 쉰다 — adb 입력을 몰아 보내면 작은 획(눈)이 가끔 빠졌다.
function draw(pause = 350) { for (const s of strokes) { r.stroke(s.map(([x, y]) => at(x, y))); r.sleep(pause); } }
// 원본 그림에서 잰 자리(그림 기준 0~1): 채우기·볼터치·알갱이·하트
const SPOT = {
  body: [.5, .35], leafL: [.33, .72], leafR: [.67, .72], sproutL: [.43, .14], sproutR: [.675, .21],
  handL: [.2, .7], handR: [.8, .7], footL: [.39, .91], footR: [.6, .91],
  cheekL: [.36, .56], cheekR: [.64, .56], grains: [[.44, .3], [.52, .28], [.6, .31], [.48, .37], [.56, .38]], heart: [.86, .38],
};
module.exports = { draw, at, SPOT, strokes };
