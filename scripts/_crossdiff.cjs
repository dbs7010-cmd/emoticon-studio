// 버전 사이 결과를 **픽셀로** 센다. 두 가지를 따로 잰다.
//   보존 — 예전 엔진이 저장한 그림을 지금 엔진에서 연 것(__reopen)이 원본(__old)과 같은가
//   변화 — 같은 경로를 지금 엔진으로 새로 그은 것(__new)이 예전(__old)과 얼마나 다른가
// 쓰는 법: node scripts/_crossdiff.cjs <폴더> [이름]
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const P = require('./_png.cjs');
const { LIST } = require('./_brush30.cjs');

const DIR = process.argv[2] || 'verification/round45_33/crossver';
const TITLE = process.argv[3] || '45.31 → 지금';

function diff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return null;
  let changed = 0, sum = 0, max = 0;
  for (let i = 0; i < a.w * a.h; i++) {
    const k = i * 4;
    // 흰 바탕 위 색으로 맞춰 비교한다 — 알파만 다르고 보이는 건 같은 경우를 오해하지 않게.
    const aa = a.d[k + 3] / 255, ba = b.d[k + 3] / 255;
    let d = 0;
    for (let c = 0; c < 3; c++) {
      const av = a.d[k + c] * aa + 255 * (1 - aa), bv = b.d[k + c] * ba + 255 * (1 - ba);
      d = Math.max(d, Math.abs(av - bv));
    }
    if (d > 2) changed++;
    sum += d; if (d > max) max = d;
  }
  return { changed: changed / (a.w * a.h), mean: sum / (a.w * a.h), max };
}
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);

const rows = [];
for (const [id, name, tier] of LIST) {
  const f = s => path.join(DIR, id + '__' + s + '.png');
  if (!fs.existsSync(f('old')) || !fs.existsSync(f('new')) || !fs.existsSync(f('reopen'))) { rows.push({ id, name, tier, missing: true }); continue; }
  const old = P.read(f('old')), reopen = P.read(f('reopen')), fresh = P.read(f('new'));
  rows.push({ id, name, tier,
    sameBytes: sha(f('old')) === sha(f('reopen')),
    keep: diff(old, reopen),
    change: diff(old, fresh) });
}

console.log('# ' + TITLE + ' — ' + DIR);
console.log('');
console.log('ID   브러시             보존(열었을 때)      새 획 변화(바뀐 픽셀 / 평균차 / 최대차)');
for (const r of rows) {
  if (r.missing) { console.log(r.id.padEnd(5) + (r.name + '            ').slice(0, 18) + ' 자료 없음'); continue; }
  const keep = r.sameBytes ? '같음(바이트까지)' : (r.keep && r.keep.changed === 0 ? '같음(픽셀)' : '다름 ' + (r.keep ? (r.keep.changed * 100).toFixed(2) + '%' : '크기 다름'));
  const ch = r.change ? (r.change.changed * 100).toFixed(2).padStart(6) + '%  ' + r.change.mean.toFixed(2).padStart(6) + '  ' + String(r.change.max).padStart(4) : '크기 다름';
  console.log(r.id.padEnd(5) + (r.name + '                  ').slice(0, 18) + ' ' + keep.padEnd(20) + ' ' + ch);
}
const bad = rows.filter(r => !r.missing && !r.sameBytes);
console.log('');
console.log('보존: ' + (rows.length - bad.length - rows.filter(r => r.missing).length) + '/' + rows.filter(r => !r.missing).length + ' 이 바이트까지 같다' + (bad.length ? ' · 다른 것: ' + bad.map(r => r.id).join(' ') : ''));
const moved = rows.filter(r => !r.missing && r.change && r.change.changed > 0.001);
console.log('새 획이 달라진 브러시: ' + moved.length + '/' + rows.filter(r => !r.missing).length +
  (moved.length ? ' — ' + moved.map(r => r.id + '(' + (r.change.changed * 100).toFixed(1) + '%)').join(' ') : ''));
fs.writeFileSync(path.join(DIR, 'diff.json'), JSON.stringify(rows, null, 2));
