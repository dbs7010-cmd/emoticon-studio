// 색 고르는 판의 바탕 그림 세 장을 만든다.
//
// 왜 그림인가: 예전에는 SV 사각을 세로 16칸·가로 20칸의 작은 네모로 이어 붙이고, 색상 막대를 30칸으로
// 나눠 붙였다. 칸마다 색이 한 번에 뛰므로 **계단식 색 타일**로 보였다 — 사용자가 지적한 그 문제다.
// 그라디언트 라이브러리를 새로 넣으면 네이티브 빌드가 달라지므로, 대신 아주 작은 PNG 를 만들어
// 늘려 쓴다. 늘릴 때 기기가 픽셀 사이를 메워 주므로 단이 생기지 않는다.
//
//   field-sat.png  가로: 흰색이 서서히 사라진다 → 왼쪽이 흐리고 오른쪽이 선명하다(채도)
//   field-val.png  세로: 검정이 서서히 짙어진다 → 위가 밝고 아래가 어둡다(명도)
//   hue-bar-v.png  세로: 빨강에서 한 바퀴 도는 색 띠(색상)
//
// 앞의 두 장은 색과 무관하다. 바탕에 지금 색상(hue)의 선명한 색을 깔고 두 장을 겹치면 어떤 색에서도
// 같은 판이 나온다 — 색이 바뀔 때마다 그림을 다시 만들지 않는다.
const path = require('node:path');
const { write } = require('./_png.cjs');

const OUT = path.join(__dirname, '..', 'assets', 'art');

// 가로로만 변하는 그림은 세로 한 줄이면 충분하지만, 기기가 늘릴 때 가장자리를 물고 늘어지는 일이
// 없도록 여덟 줄을 준다. 파일은 여전히 1KB 아래다.
const THICK = 8;

function horizontal(w, at) {
  const d = Buffer.alloc(w * THICK * 4);
  for (let x = 0; x < w; x++) {
    const [r, g, b, a] = at(w === 1 ? 0 : x / (w - 1));
    for (let y = 0; y < THICK; y++) { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; }
  }
  return { w, h: THICK, d };
}
function vertical(h, at) {
  const d = Buffer.alloc(THICK * h * 4);
  for (let y = 0; y < h; y++) {
    const [r, g, b, a] = at(h === 1 ? 0 : y / (h - 1));
    for (let x = 0; x < THICK; x++) { const i = (y * THICK + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; }
  }
  return { w: THICK, h, d };
}

// 채도: 왼쪽 끝은 흰색으로 완전히 덮이고 오른쪽 끝은 아무것도 덮지 않는다.
write(path.join(OUT, 'field-sat.png'), horizontal(256, t => [255, 255, 255, Math.round(255 * (1 - t))]));
// 명도: 위쪽은 덮지 않고, 아래로 갈수록 검정이 짙어진다. 맨 아래도 완전한 검정은 아니다 —
// 완전히 검으면 고른 자리의 색이 보이지 않는다(엔진도 명도 하한 .04 를 둔다).
write(path.join(OUT, 'field-val.png'), vertical(256, t => [0, 0, 0, Math.round(255 * Math.min(1, t * .98))]));

// 색상 띠: 한 바퀴. 360 칸이면 한 칸이 1도라 늘려도 이음매가 보이지 않는다.
function hue(t) {
  const h = t * 6, i = Math.floor(h) % 6, f = h - Math.floor(h);
  const q = Math.round(255 * (1 - f)), tt = Math.round(255 * f);
  const table = [[255, tt, 0], [q, 255, 0], [0, 255, tt], [0, q, 255], [tt, 0, 255], [255, 0, q]];
  return [...table[i], 255];
}
// 시안의 색상 막대는 색 사각판 **오른쪽에 세로로** 선다. 가로판은 쓰지 않으므로 만들지 않는다 —
// 쓰이지 않는 그림을 묶음에 넣지 않는다.
write(path.join(OUT, 'hue-bar-v.png'), vertical(360, hue));

console.log('만듦: field-sat.png · field-val.png · hue-bar-v.png');
