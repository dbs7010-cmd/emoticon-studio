// 같은 엔진으로 두 번 그린 결과를 견준다. 획 씨앗이 Date.now() 라 **매 획이 원래 다르다** —
// 그 차이를 먼저 재 두어야 '버전 때문에 바뀐 것'과 '원래 매번 다른 것'을 가를 수 있다.
// 쓰는 법: node scripts/_noise.cjs <A폴더> <B폴더> [꼬리표]
const fs = require('node:fs'), path = require('node:path');
const P = require('./_png.cjs');
const { LIST } = require('./_brush30.cjs');

const A = process.argv[2], B = process.argv[3], TAG = process.argv[4] || '__new';
function diff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return null;
  let changed = 0, sum = 0;
  for (let i = 0; i < a.w * a.h; i++) {
    const k = i * 4, aa = a.d[k + 3] / 255, ba = b.d[k + 3] / 255;
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs((a.d[k + c] * aa + 255 * (1 - aa)) - (b.d[k + c] * ba + 255 * (1 - ba))));
    if (d > 2) changed++; sum += d;
  }
  return { changed: changed / (a.w * a.h), mean: sum / (a.w * a.h) };
}
const out = [];
console.log('ID   브러시             같은 엔진 두 번 (바뀐 픽셀 / 평균차)');
for (const [id, name] of LIST) {
  const fa = path.join(A, id + TAG + '.png'), fb = path.join(B, id + TAG + '.png');
  if (!fs.existsSync(fa) || !fs.existsSync(fb)) { console.log(id.padEnd(5) + (name + '                  ').slice(0, 18) + ' 자료 없음'); continue; }
  const d = diff(P.read(fa), P.read(fb));
  out.push({ id, name, ...d });
  console.log(id.padEnd(5) + (name + '                  ').slice(0, 18) + ' ' + (d.changed * 100).toFixed(2).padStart(6) + '%  ' + d.mean.toFixed(2).padStart(6));
}
const noisy = out.filter(r => r.changed > 0.001);
console.log('');
console.log('같은 엔진인데도 매번 달라지는 브러시: ' + noisy.length + '/' + out.length + ' — ' + noisy.map(r => r.id + '(' + (r.changed * 100).toFixed(1) + '%)').join(' '));
fs.writeFileSync(path.join(A, 'noise.json'), JSON.stringify(out, null, 2));
