// 캐릭터 시트(12 표현 + 보조 캐릭터)와 표현마다의 투명 PNG 용 HTML 을 만든다.
// 사용: node scripts/promo/sheet.cjs <나갈 폴더>
const fs = require('fs');
const path = require('path');
const C = require('./character.cjs');
const out = path.resolve(process.argv[2] || 'verification/promo');
fs.mkdirSync(path.join(out, 'png-src'), { recursive: true });
const cell = (svgText, label) => `<figure><div class="art">${svgText}</div><figcaption>${label}</figcaption></figure>`;
const sheet = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#FBF8EC;font:15px 'Malgun Gothic',sans-serif;color:#2A2320;padding:28px}
h1{font-size:22px;margin:0 0 4px}p{margin:0 0 18px;color:#6B655E;font-size:13px}.g{display:grid;grid-template-columns:repeat(6,190px);gap:14px}
figure{margin:0;background:#fff;border-radius:18px;border:1px solid #ECE9E3;padding:6px 6px 8px;text-align:center}.art svg{width:178px;height:178px}figcaption{font-weight:700;font-size:14px}
h2{font-size:17px;margin:26px 0 10px}</style>
<h1>몽이 — 표현 12종</h1><p>홍보용 오리지널 캐릭터 · 자세·눈·입·소품이 모두 다름(같은 그림 + 문구 바꿈 없음)</p>
<div class="g">${C.ORDER.map(k => cell(C.svg(C.drawPose(k)), C.POSES[k].label)).join('')}</div>
<h2>보조 캐릭터 2종(한 세트에 섞지 않음 — 다른 캐릭터도 만들 수 있다는 예시)</h2>
<div class="g">${['piyak', 'dubu'].flatMap(s => ['hello', 'excited', 'good'].map(k => cell(C.svg(C.drawPose(k, s)), C.SPECIES[s].name + ' · ' + C.POSES[k].label))).join('')}</div>`;
fs.writeFileSync(path.join(out, 'character-sheet.html'), sheet);
// 표현마다 투명 PNG(360×360)로 찍을 페이지
const page = s => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;width:360px;height:360px;overflow:hidden}svg{display:block}</style></head><body>${s}</body></html>`;
const files = [];
for (const k of C.ORDER) { fs.writeFileSync(path.join(out, 'png-src', `mongi-${k}.html`), page(C.svg(C.drawPose(k)))); files.push(`mongi-${k}`); }
for (const s of ['piyak', 'dubu']) for (const k of ['hello', 'excited', 'good']) { fs.writeFileSync(path.join(out, 'png-src', `${s}-${k}.html`), page(C.svg(C.drawPose(k, s)))); files.push(`${s}-${k}`); }
// 부분 움직임 예시: '안녕'을 몸(흔드는 팔 뺀 것) · 오른팔 두 레이어로
fs.writeFileSync(path.join(out, 'png-src', 'mongi-hello-layer-body.html'), page(C.svg(C.drawPose('hello', 'mongi', 'body')))); files.push('mongi-hello-layer-body');
fs.writeFileSync(path.join(out, 'png-src', 'mongi-hello-layer-arm.html'), page(C.svg(C.drawPose('hello', 'mongi', 'armR')))); files.push('mongi-hello-layer-arm');
fs.writeFileSync(path.join(out, 'png-src', 'list.json'), JSON.stringify(files));
console.log(out, files.length);
