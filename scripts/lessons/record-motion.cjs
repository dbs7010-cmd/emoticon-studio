// 강좌 '움직이기 · 손그림 떨림' 다시 녹화(2026-10-28, v24 화면). 움직이기 화면은 미리보기가 계속 움직여
// 화면 읽기(uiautomator)가 멈춘 순간을 못 잡는다 — 1080×2400 폰 에뮬레이터의 자리로 누른다(m1~m6 캡처로 잰 값).
// 준비: record-brush-layer.cjs 직후(02번 칸, 색칠한 지금 Codex 콘 + 레이어 2 하트, 그리기 화면). step4(부분)는 PRO 라 record-motion-part.cjs.
const path = require('path');
const r = require('./rec.cjs');
const out = n => path.join(__dirname, '..', '..', 'assets', 'lessons', 'motion', `step${n}.mp4`);
const say = t => console.log('  ' + t);
const P = { motionTab: [314, 268], pop: [156, 1850], bounce: [156, 2040], strength: [330, 394], speed: [864, 394], boilMid: [670, 2144] };
r.touches(true);

// 1. 효과 고르기 — 뿅, 그리고 아래로 내려 통통
r.start('mo1'); r.sleep(600);
r.tap(...P.motionTab, 2500);
r.tap(...P.pop, 3500);
// 천천히 끌어야(튕기지 않게) 내려가는 거리가 매번 같다 — s1·s2 캡처로 잰 자리와 맞는다.
r.swipe(540, 2200, 540, 1800, 1500, 900);
r.tap(...P.bounce, 3500);
r.stop(); r.pull('mo1');
say('1 ' + r.cut('mo1', { from: 0.4, out: out(1), crop: [600, 1440] }) + 'B');

// 2. 세기 · 속도 — 캔버스 위 막대
r.start('mo2'); r.sleep(800);
r.swipe(...P.strength, 470, 394, 700, 2500);
r.swipe(...P.speed, 1000, 394, 700, 3000);
r.stop(); r.pull('mo2');
say('2 ' + r.cut('mo2', { from: 0.4, out: out(2), crop: [330, 1440] }) + 'B');

// 3. 손그림 떨림 — 아래로 내려 보통
r.start('mo3'); r.sleep(600);
r.swipe(540, 2200, 540, 1400, 2500, 900); r.swipe(540, 2200, 540, 1400, 2500, 1000);
r.tap(...P.boilMid, 4000);
r.stop(); r.pull('mo3');
say('3 ' + r.cut('mo3', { from: 0.4, out: out(3), crop: [900, 1440] }) + 'B');
r.touches(false);
