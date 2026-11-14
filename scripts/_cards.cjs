// 브러시 카드의 획 견본을 **엔진이 방금 그린 것**으로 갈아 끼운다.
// _brush30.cjs 가 문서 ID(F06.png)로 저장하므로, 구성표를 보고 엔진 ID(stroke-colorpencil.png)로 옮긴다.
// 실제 결과가 좋아진 뒤에만 돌린다 — 견본이 실제 획보다 예뻐 보이면 안 된다.
// 쓰는 법: node scripts/_cards.cjs <획폴더>
const fs = require('node:fs'), path = require('node:path');
const { LIST } = require('./_brush30.cjs');

const SRC = process.argv[2];
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);   // 비우면 전체
if (!SRC) { console.error('획 폴더를 달라'); process.exit(1); }
const OUT = path.resolve(__dirname, '..', 'assets', 'art');

let moved = 0, missing = [];
for (const [id, name, tier, how] of LIST) {
  const key = how.preset || (how.base === 'pen' ? 'pen' : how.base);
  if (!key) continue;
  if (ONLY.length && !ONLY.includes(id)) continue;
  const from = path.join(SRC, id + '.png');
  if (!fs.existsSync(from)) { missing.push(id + ' ' + name); continue; }
  const to = path.join(OUT, 'stroke-' + key + '.png');
  if (!fs.existsSync(to)) { missing.push(id + ' ' + name + '(카드 자리 없음 ' + path.basename(to) + ')'); continue; }
  fs.copyFileSync(from, to);
  moved++;
}
console.log('  견본 ' + moved + '개 갈아 끼웠다 → assets/art');
if (missing.length) console.log('  건너뜀: ' + missing.join(' · '));
