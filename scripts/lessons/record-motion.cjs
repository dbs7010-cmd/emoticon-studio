// 강좌 '움직이기 · 손그림 떨림' 다시 녹화(2026-10-29, v24 화면 · 지금 Codex 콘). 효과가 고르면 미리보기가 계속 움직여
// 화면 읽기(uiautomator)가 멈춘 순간을 못 잡는다 — 움직임 '없음'일 때 덤프로 잰 1080×2400 폰 에뮬레이터 자리로 누른다.
// 준비: record-brush-layer.cjs 직후(02번 칸, 색칠한 콘 + 레이어 2 하트, 그리기 화면, 움직임 없음 · 세기·속도 보통), 검수용 PRO 켬(step4).
const path = require('path');
const r = require('./rec.cjs');
const out = n => path.join(__dirname, '..', '..', 'assets', 'lessons', 'motion', `step${n}.mp4`);
const say = t => console.log('  ' + t);
// 묶음 칩 줄(y 1581 · 새 세트 첫 화면 캡처로 잼 — 효과 칸 미리보기가 움직여 덤프가 안 된다)과 효과 칸(첫 칸 155,1836) · 위 막대(세기 174~523, 속도 700~1049 — 막대를 누른 자리로 바로 간다)
const P = {
  drawTab: [121, 268], motionTab: [314, 268],
  chipPart: [345, 1581], chipCombo: [540, 1581], chipEnter: [831, 1581], chipAction: [981, 1581],
  first: [155, 1836], boilMid: [667, 2077],
  strength: x => [x, 396], speed: x => [x, 396],
  layer2: [541, 2320], bounce: [868, 2088],
};
const u = require('./ui.cjs');
// 녹화 전: 앱 데이터를 비운 뒤라 검수용 PRO 를 다시 켠다(부분 칩 → PRO 안내 → '결제 없이 검수용 PRO 켜기').
r.tap(...P.motionTab, 2000);
r.tap(...P.chipPart, 2500);
if (u.has('PRO 닫기')) { for (let i = 0; i < 5 && !u.has('결제 없이 검수용 PRO 켜기'); i++) r.swipe(540, 2000, 540, 900, 600, 1200); u.tap('결제 없이 검수용 PRO 켜기', 2500); r.tap(...P.chipPart, 2500); }
r.tap(50, 1557, 1500);   // 부분만 움직이기 → 처음으로
r.touches(true);
r.tap(...P.drawTab, 1500);

// 1. 효과 고르기 — 등장 묶음에서 뿅, 동작 묶음에서 통통
u.dismiss();
r.start('mo1'); r.sleep(600);
r.tap(...P.motionTab, 2000);
r.tap(...P.chipEnter, 1200);
r.tap(...P.first, 3500);           // 뿅
r.tap(...P.chipAction, 1200);
r.tap(...P.first, 3500);           // 통통
r.shot(path.join(r.RAW || 'C:/build-temp/lesson-raw', 'mo1-end.png')); r.stop(); r.pull('mo1');
say('1 ' + r.cut('mo1', { from: 0.4, out: out(1), crop: [150, 1440] }) + 'B');

// 2. 세기 · 속도 — 아주 세게면 빨간 띠(칸 밖), 다시 보통으로. 속도는 조금 빠르게
u.dismiss();
r.start('mo2'); r.sleep(800);
// 효과가 도는 동안엔 막대를 눌러도 안 바뀐다 — 손잡이(보통 = 가운데)를 잡고 끈다.
r.swipe(360, 396, 515, 396, 900, 3000);
r.swipe(515, 396, 360, 396, 900, 2500);
r.swipe(861, 396, 935, 396, 700, 3000);
r.shot(path.join(r.RAW || 'C:/build-temp/lesson-raw', 'mo2-end.png')); r.stop(); r.pull('mo2');
say('2 ' + r.cut('mo2', { from: 0.4, out: out(2), crop: [150, 1440] }) + 'B');

// 3. 손그림 떨림 — 조합 묶음 아래 줄에서 보통
u.dismiss();
r.start('mo3'); r.sleep(600);
r.tap(...P.chipCombo, 1500);
r.tap(...P.boilMid, 4000);
r.shot(path.join(r.RAW || 'C:/build-temp/lesson-raw', 'mo3-end.png')); r.stop(); r.pull('mo3');
say('3 ' + r.cut('mo3', { from: 0.4, out: out(3), crop: [150, 1440] }) + 'B');

// 4. 부분만(PRO) — 부분 칩 → 레이어 2(하트) → 통통 튀기
u.dismiss();
r.start('mo4'); r.sleep(600);
r.tap(...P.chipPart, 2000);
r.tap(...P.layer2, 3000);
r.tap(...P.bounce, 4500);
r.shot(path.join(r.RAW || 'C:/build-temp/lesson-raw', 'mo4-end.png')); r.stop(); r.pull('mo4');
say('4 ' + r.cut('mo4', { from: 0.4, out: out(4), crop: [150, 1440] }) + 'B');
r.touches(false);
