// 「임티 라인」 실제 SVG 렌더 시트 — icons.tsx 의 경로 데이터를 그대로 브라우저 SVG 로 그린다(14/18/22 × 기기 배율 1·3).
// 잘림·가독성 확인용. 브라우저 SVG 렌더이지 안드로이드 react-native-svg 렌더가 아니다(그건 APK 에서 본다).
// 쓰는 법: node scripts/_icon-sheet.cjs <나갈 html 경로>
const fs = require('fs');
const { loader } = require('./load-ts.cjs');
const I = loader({})('src/design/icons.tsx');
const out = process.argv[2] || 'verification/_latest/icon-sheet.html';
const el = e => e[0] === 'p' ? `<path d="${e[1]}"/>` : e[0] === 'c' ? `<circle cx="${e[1]}" cy="${e[2]}" r="${e[3]}"/>` : `<rect x="${e[1]}" y="${e[2]}" width="${e[3]}" height="${e[4]}" rx="${e[5]}"/>`;
const svg = (name, size, color = I.ICON_INK) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${I.ICON_STROKE}" stroke-linecap="round" stroke-linejoin="round">${I.ICON_PATHS[name].map(el).join('')}</svg>`;
const names = Object.keys(I.ICON_PATHS);
const rows = names.map(n => `<tr><td class="n">${n}</td>${[14, 18, 22].map(s => `<td><span class="box" style="width:${s}px;height:${s}px">${svg(n, s)}</span></td>`).join('')}<td><span class="sel">${svg(n, 22)}</span></td><td>${svg(n, 22, I.ICON_FAINT)}</td></tr>`).join('');
fs.mkdirSync(require('path').dirname(out), { recursive: true });
fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:12px system-ui;background:#fff;color:#1F1D1A}table{border-collapse:collapse}td{padding:4px 10px;border-bottom:1px solid #ECE9E3;vertical-align:middle}.n{width:80px;color:#77716A}.box{display:inline-block;outline:1px dashed #F2C4C4}.sel{display:inline-flex;padding:6px;border-radius:10px;background:#FFCC2E}th{text-align:left;color:#77716A;font-weight:600;padding:4px 10px}</style>
<table><tr><th>이름</th><th>14</th><th>18</th><th>22</th><th>선택(노란 면)</th><th>비활성</th></tr>${rows}</table>`);
console.log(out);
