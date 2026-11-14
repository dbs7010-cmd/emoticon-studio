// 확정 아이콘 B(스티커와 연필, 디자인 캔버스 Icon-B 시안)를 출시 에셋 크기로 옮겨 그리는 HTML 을 만든다.
// 모양·색·배치는 시안 그대로(256 격자) — 새로 디자인하지 않는다. 바뀌는 것은 용도별 배경·축척뿐이다.
// · full       : 노란 바탕 + 스티커 + 연필(시안 그대로, 마스크는 OS 가 씌움) → app-icon 1024 · play-icon 512
// · foreground : 투명 바탕, 적응형 안전 원(지름 66%) 안에 들어오게 0.64 배 → adaptive-foreground 1024
// · monochrome : 투명 바탕, 선과 눈·입만 한 색(검정) — 흰 면·그림자 없음 → adaptive-monochrome 1024
// · splash     : 투명 바탕, foreground 와 같은 축척 → splash-icon 1024
// 사용: node scripts/_icon-b-export.cjs <나갈 폴더>  → 폴더에 variant 별 html. 찍기는 Edge 헤드리스.
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || 'verification/round45_44/icon-b';
fs.mkdirSync(out, { recursive: true });
const INK = '#2A2320', YELLOW = '#F5E642';   // 2026-10-03 브랜드 레몬(예전 #FFCC2E). 모양·비율은 그대로
// 연필(시안 그대로: 100 격자 → 92px, 오른쪽 20 · 아래 16, 40도)
const pencil = mono => `<g transform="translate(144 148) rotate(40 46 46) scale(.92)">
  <rect x="40" y="8" width="20" height="62" rx="3" fill="${mono ? 'none' : '#FFF3D6'}" stroke="${INK}" stroke-width="4.5"/>
  <rect x="40" y="8" width="20" height="12" rx="3" fill="${mono ? 'none' : '#FF8FA3'}" stroke="${INK}" stroke-width="4.5"/>
  <path d="M40 70l10 22 10-22z" fill="${mono ? 'none' : '#F6EBD3'}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M47 86l3 6 3-6z" fill="${INK}"/></g>`;
// 스티커(시안: 150 상자 + 테두리 6 + 그림자 8,8 · -8도 · 가운데)
const sticker = mono => `<g transform="rotate(-8 128 128)">
  ${mono ? '' : `<rect x="58" y="58" width="156" height="156" rx="37" fill="${INK}" stroke="${INK}" stroke-width="6"/>`}
  <rect x="50" y="50" width="156" height="156" rx="37" fill="${mono ? 'none' : '#fff'}" stroke="${INK}" stroke-width="6"/>
  <g transform="translate(78 78)"><circle cx="34" cy="40" r="7" fill="${INK}"/><circle cx="66" cy="40" r="7" fill="${INK}"/>
  <path d="M26 60q24 26 48 0" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/></g></g>`;
const svg = ({ bg, scale = 1, mono = false, size = 1024 }) => {
  const art = `<g transform="translate(128 128) scale(${scale}) translate(-128 -128)">${sticker(mono)}${pencil(mono)}</g>`;
  const body = mono ? art.replace(new RegExp(INK, 'g'), '#000000') : art;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">${bg ? `<rect width="256" height="256" fill="${bg}"/>` : ''}${body}</svg>`;
};
const page = (s, size) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;width:${size}px;height:${size}px;overflow:hidden}svg{display:block}</style></head><body>${s}</body></html>`;
const variants = {
  'app-icon': page(svg({ bg: YELLOW }), 1024),
  'play-icon-512': page(svg({ bg: YELLOW, size: 512 }), 512),
  'adaptive-foreground': page(svg({ scale: .64 }), 1024),
  'adaptive-background': page(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${YELLOW}"/></svg>`, 1024),
  'adaptive-monochrome': page(svg({ scale: .64, mono: true }), 1024),
  'splash-icon': page(svg({ scale: .64 }), 1024),
};
for (const [name, html] of Object.entries(variants)) fs.writeFileSync(path.join(out, name + '.html'), html);
// 확인용: 원형·둥근 사각 마스크와 안전 원을 겹친 미리보기
fs.writeFileSync(path.join(out, 'preview.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#ddd;font:13px system-ui;display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}figure{margin:0;text-align:center}.m{width:220px;height:220px;overflow:hidden;position:relative}.m svg{width:220px;height:220px}.safe{position:absolute;left:37px;top:37px;width:146px;height:146px;border:2px dashed red;border-radius:50%;box-sizing:border-box}</style>
<figure><div class="m" style="border-radius:48px">${svg({ bg: YELLOW })}</div>app-icon(둥근 사각)</figure>
<figure><div class="m" style="border-radius:50%;background:${YELLOW}">${svg({ scale: .64 })}<div class="safe"></div></div>적응형(원형 마스크 · 빨강=안전 원)</figure>
<figure><div class="m" style="border-radius:40px;background:${YELLOW}">${svg({ scale: .64 })}</div>적응형(둥근 사각)</figure>
<figure><div class="m" style="border-radius:50%;background:#3a3a3a;filter:invert(1)">${svg({ scale: .64, mono: true })}</div>테마 아이콘(단색)</figure>
<figure><div class="m" style="background:#fff;border:1px solid #ccc">${svg({ scale: .64 })}</div>스플래시(흰 바탕)</figure>
<figure><div style="width:48px;height:48px;border-radius:12px;overflow:hidden">${svg({ bg: YELLOW, size: 48 })}</div>48px</figure>`);
console.log(out);
