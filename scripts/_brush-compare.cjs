// 이름이 붙은 수정 전/후 비교 장. 브러시 이름·무료/PRO·굵기·불투명도와 무엇을 고쳤는지를 함께 적는다.
// 그림은 엔진이 그린 PNG 를 옮겨 놓을 뿐이다. _shots.cjs 가 이 HTML 을 PNG 로 굳힌다.
const fs = require('node:fs'), path = require('node:path');
const { LIST } = require('./_brush30.cjs');

const OUT = process.argv[2] || 'verification/round45_32/compare';
// [문서ID, 무엇이 문제였나, 무엇을 고쳤나]
const FIXED = [
  ['F02', '기본 펜과 구별되지 않았다 — 손그림 느낌이 전혀 없었다', '획 합성 방식을 띠(ribbon)로 바꾸고, 길이에 따라 굵기가 천천히 오르내리게 했다. 중심선은 그대로다'],
  ['F03', '끝이 가늘어지지 않았다. 시작만 가늘고 끝은 뭉툭했다', '띠로 바꿔 **양 끝**이 가늘어진다. 바닥값을 둬 바늘 끝이 되지 않는다'],
  ['F04', '굵기만 굵고 변화가 약했다. 끝이 둥글게 뭉쳤다', '띠 + 속도 반응 + 완만한 굵기 물결. 테이퍼 펜보다 굵고 변화가 크다'],
  ['F06', '연필의 색만 바꾼 것처럼 보였다', '종이 이를 굵게(결 2→4) 하고 단단하게(.6→.8) — 연필과 결 크기가 분명히 갈린다'],
  ['F08', '작은 원과 급회전에서 **톱니(톱날)** 가 났고 획 끝이 뭉쳤다', '① 도는 반지름을 재서 급회전에서 납작한 dab 을 둥글게 눕힌다 ② 손을 대자마자 방향도 모른 채 찍던 첫 자국을 없앴다'],
  ['P03', '털이 벌어져 **빗살 줄무늬**가 났다', '털을 굵혀(0.2→0.42) 서로 닿게 하고 벌림을 줄였다(0.9→0.62)'],
  ['P05', '**무작위 구멍만 뚫린 선**이었다(결을 파내는 방식)', '파내기를 버리고 종이 이에 왁스가 뭉쳐 앉는 dab 방식으로 다시 만들었다'],
  ['P07', '너무 뭉개져 형태가 읽히지 않았다', '가장자리를 덜 풀고(.35→.74) 더 촘촘히 — 크레용보다 곱고 부드럽되 형태는 남는다'],
  ['P08', '흔들림이 너무 커서 형태가 흩어졌다', '흔들림을 1.1→0.42 로 줄이고 결은 키웠다'],
  ['P09', '너무 옅어 음영이 보이지 않았다', '진하기 .2→.3, 가장자리 .5→.78, 결 간격을 넓혀 결이 살아난다'],
  ['P13', '털이 벌어지고 너무 자주 끊겨 지저분했다', '털을 굵히고 끊김을 .35→.18 로 — 결은 남기고 면이 읽힌다'],
];
const NAME = Object.fromEntries(LIST.map(r => [r[0], r]));

const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const copy = (from, to) => { if (fs.existsSync(from)) { fs.copyFileSync(from, path.join(OUT, 'img', to)); return true; } return false; };

const rows = FIXED.map(([id, problem, fix]) => {
  const [, name, tier] = NAME[id];
  // 뒤늦게 고친 넷(P03·P08·P09·P13)의 '수정 전'은 그 수정 **직전**에 찍은 scenes-all 이다.
  const LATE = ['P03','P08','P09','P13'];
  const okB = LATE.includes(id)
    ? copy('verification/round45_32/scenes-all/' + id + '.png', id + '-before.png')
    : copy('verification/round45_32/scenes-before/' + id + '.png', id + '-before.png');
  const after = ['scenes-final', 'scenes-fix4', 'scenes-after', 'scenes-all'].map(d => 'verification/round45_32/' + d + '/' + id + '.png').find(f => fs.existsSync(f));
  const okA = after ? copy(after, id + '-after.png') : false;
  return { id, name, tier, problem, fix, okB, okA };
});

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>브러시 수정 전후</title>
<style>
 body{margin:0;background:#14161A;font:14px/1.6 -apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif}
 .phone{width:1180px;background:#fff;padding:22px 24px;box-sizing:border-box}
 h1{margin:0 0 2px;font-size:20px;color:#17191D}
 .sub{margin:0 0 16px;font-size:12px;color:#6B7280}
 .row{display:flex;gap:16px;align-items:flex-start;padding:14px 0;border-top:1px solid #E7E9EE}
 .row:first-of-type{border-top:0}
 .meta{width:330px;flex:0 0 auto}
 .nm{font-size:16px;font-weight:800;color:#17191D}
 .tag{font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;margin-left:6px;vertical-align:2px}
 .free{background:#F2F3F5;color:#6B7280}.pro{background:#FFE9A8;color:#5C4A00}
 .cond{font-size:11px;color:#9AA1AC;margin:2px 0 6px}
 .p{font-size:12px;color:#B23A2F;margin:0 0 4px}
 .f{font-size:12px;color:#1F6F43;margin:0}
 .pics{display:flex;gap:10px;flex:1}
 .pic{flex:1;text-align:center}
 .pic img{width:100%;max-width:330px;border:1px solid #E7E9EE;border-radius:8px;background:#fff}
 .cap{font-size:11px;font-weight:700;color:#6B7280;margin-top:3px}
 .none{font-size:11px;color:#9AA1AC;padding:40px 0}
</style></head><body><div class="phone">
<h1>브러시 수정 전 / 후 — 실제 엔진 출력</h1>
<p class="sub">모두 같은 조건: 같은 입력 경로 · 색 #17191D · 굵기 10(넓은 칠 32, 질감 26) · 불투명도 100% · 선 보정 약.
다섯 장면은 왼쪽 위부터 <b>A 얼굴 외곽선과 눈·입</b> · <b>B 손글씨 안녕!</b> · <b>C 볼터치와 넓은 채색·겹침</b> ·
<b>D 질감 색면과 해칭</b> · <b>E 효과선</b>. 한글은 글꼴이 아니라 같은 손글씨 획 경로를 엔진이 그은 것이다.</p>
${rows.map(r => `<div class="row">
  <div class="meta">
    <div class="nm">${esc(r.name)} <span class="tag ${r.tier === 'pro' ? 'pro' : 'free'}">${r.tier === 'pro' ? 'PRO' : '무료'}</span></div>
    <div class="cond">${r.id} · 굵기 10 · 불투명도 100%</div>
    <p class="p">문제 · ${esc(r.problem)}</p>
    <p class="f">수정 · ${esc(r.fix)}</p>
  </div>
  <div class="pics">
    <div class="pic">${r.okB ? `<img src="img/${r.id}-before.png" alt="">` : '<div class="none">전 그림 없음</div>'}<div class="cap">수정 전</div></div>
    <div class="pic">${r.okA ? `<img src="img/${r.id}-after.png" alt="">` : '<div class="none">후 그림 없음</div>'}<div class="cap">수정 후</div></div>
  </div>
</div>`).join('\n')}
</div></body></html>`;
fs.writeFileSync(path.join(OUT, 'compare.html'), html);
fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify([{ id: 'brush-compare', file: 'compare.html', title: '브러시 수정 전후' }], null, 2));
console.log('  ' + rows.length + '행 · ' + path.join(OUT, 'compare.html'));
