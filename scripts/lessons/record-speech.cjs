// 강좌 '대사 넣기 · 글씨 배치' 녹화(2026-10-29, v24 화면 · 원본 색 Codex 콘).
// 준비: record-export.cjs 까지 찍은 세트(02번 칸에 색칠한 콘 · 완성, 다음 빈 칸 03). 어느 화면에서 시작해도 홈으로 나온다.
const path = require('path');
const r = require('./rec.cjs'), u = require('./ui.cjs');
const out = n => path.join(__dirname, '..', '..', 'assets', 'lessons', 'speech', `step${n}.mp4`);
const say = t => console.log('  ' + t);
for (let i = 0; i < 5 && !u.has('표현 가이드'); i++) {
  if (u.has('그리기 닫기')) u.tap('그리기 닫기', 2500);
  else if (u.has('뒤로')) u.tap('뒤로', 2000);
  else r.adb(['shell', 'input', 'keyevent', '4']), r.sleep(2000);
}
r.touches(true);

// 세 단계 모두 같은 칸(가이드가 고른 빈 칸)에서 찍는다. 02번은 애니메이션 장 표시가 캔버스 위쪽 글씨를 가렸다.
// 그리기 화면은 이전 칸에서 따라온 움직임 때문에 화면 읽기가 한 번에 6초씩 걸린다 — 녹화 중엔 자리로 누르고,
// 자리가 바뀌는 문구 창(가이드 대사가 추천 대사 맨 앞에 끼면 칩이 밀린다)은 녹화 전에 한 번 열어 재 둔다.
const at = label => { const n = u.find(label); if (!n) throw new Error('화면에 없음: ' + label); return [n.x, n.y]; };
const T = { closeGuide: [1013, 395], closeHint: [975, 543], continue: [360, 545], caption: [1005, 270], pickDone: [795, 1884] };

// 1. 가이드에서 대사 고르기 — 신나 › 양팔 들고 › 우와 → 예시 위에 대사 → 참고 보기 › 이전 칸 그림으로 시작: 색칠한 콘 위에 '우와'
u.dismiss();
r.start('sp1'); r.sleep(600);
u.tap('표현 가이드', 2500);
u.tap('신나', 2500, { exact: false });
u.tap('양팔 들고 고르기', 1500);
u.tap('우와 대사 고르기', 2500);
u.tap('참고 보기', 3500);
// 표현 예시 창과 그 뒤에 남는 힌트 줄을 닫아야 '이전 칸 그림으로 시작' 안내가 보인다(창이 열려 있으면 아래 자리가 모두 밀린다).
r.tap(...T.closeGuide, 1500);
r.tap(...T.closeHint, 1500);
r.tap(...T.continue, 9000);              // 가져와도 고른 대사는 남는다(10-29 고침)
r.stop(); r.pull('sp1');
say('1 ' + r.cut('sp1', { from: 0.4, squeeze: true, out: out(1), crop: [0, 1440] }) + 'B');

// 녹화 전 재기: 문구 창(키보드) → 추천 대사·적용·키보드 닫기, 키보드 닫은 창 → 배치·닫기
r.tap(...T.caption, 2500);
const M = { kk: at('대사 ㅋㅋㅋㅋ'), apply: at('문구 적용'), kbClose: at('키보드 닫기') };
r.tap(...M.kbClose, 2500);
Object.assign(M, { split: at('문구 배치 양옆'), bubble: at('문구 배치 말풍선'), close: at('문구 닫기') });
r.tap(...M.close, 2500);
console.log('  잰 자리', JSON.stringify(M));

// 2. 추천 대사로 바로 넣기 — 문구 › ㅋㅋㅋㅋ › 적용 → 캐릭터 위에 작게
u.dismiss();
r.start('sp2'); r.sleep(600);
r.tap(...T.caption, 2500);
r.tap(...M.kk, 1500);
r.tap(...M.apply, 4000);                 // 움직임이 도는 칸은 적용이 캔버스에 늦게 올라온다
r.tap(...T.pickDone, 2500);
r.stop(); r.pull('sp2');
say('2 ' + r.cut('sp2', { from: 0.4, out: out(2), crop: [150, 1440] }) + 'B');

// 3. 글씨 배치 바꾸기 — 양옆(ㅋㅋ … ㅋㅋ), 그다음 말풍선. 배치는 누르는 즉시 캔버스에 반영된다.
u.dismiss();
r.start('sp3'); r.sleep(600);
for (const lay of [M.split, M.bubble]) {
  r.tap(...T.caption, 2500);
  r.tap(...M.kbClose, 2500);
  r.tap(...lay, 1800);
  r.tap(...M.close, 3000);
}
r.stop(); r.pull('sp3');
say('3 ' + r.cut('sp3', { from: 0.4, out: out(3), crop: [150, 1440] }) + 'B');
r.touches(false);
