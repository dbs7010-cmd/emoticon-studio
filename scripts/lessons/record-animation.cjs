// 강좌 '애니메이션 · 장마다 그리기' 다시 녹화(2026-10-29, v24 화면 · 원본 색 Codex 콘).
// 준비: record-motion.cjs 직후(02번 칸, 움직이기 탭, 통통 + 레이어 2 하트 부분 움직임). 애니메이션 탭은 미리보기가 멈춰 있어 이름으로 누른다.
const path = require('path');
const r = require('./rec.cjs'), u = require('./ui.cjs'), corn = require('./corn-codex.cjs');
const out = n => path.join(__dirname, '..', '..', 'assets', 'lessons', 'animation', `step${n}.mp4`);
const say = t => console.log('  ' + t);
const C = corn.COLOR, EYE = [.6, .5];   // 오른쪽 눈(corn-trace 눈 획의 가운데)
r.tap(50, 1557, 1200);                  // 부분만 움직이기에 있으면 처음으로
r.touches(true);

// 1. 애니메이션 시작 — 지금 그림이 1장, 복사가 2장
u.dismiss();
r.start('an1'); r.sleep(600);
u.tap('애니메이션', 2200);
u.tap('애니메이션 시작', 3000);
r.stop(); r.pull('an1');
say('1 ' + r.cut('an1', { from: 0.4, squeeze: true, out: out(1), crop: [150, 1440] }) + 'B');

// 2. 바뀌는 곳만 고치기 — 2장 그리기 → 레이어 1 → 오른쪽 눈 지우고 노랑으로 메운 뒤 윙크(⌒)
u.dismiss();
r.start('an2'); r.sleep(600);
u.tap('2장 그리기', 2500);
u.tap('레이어', 1300); u.tap('레이어 1 선택', 900); u.tap('레이어 닫기', 900);
u.tap('지우개', 900);
const [ex, ey] = EYE, zig = [];
for (let i = 0; i <= 8; i++) zig.push(corn.at(ex - .035 + i * .009, ey + (i % 2 ? .028 : -.028)));
r.stroke(zig); r.sleep(800);
corn.color(C.body);
u.tap('채우기', 900);
corn.fill(EYE, C.body, 1500);           // 지운 구멍을 노랑으로(칠해졌는지 확인)
const wink = []; for (let i = 0; i <= 12; i++) { const t = Math.PI + i / 12 * Math.PI; wink.push(corn.at(ex + .032 * Math.cos(t), ey + .012 + .026 * Math.sin(t))); }
// 윙크가 노랑으로 그어져 안 보인 적이 있다(10-29) — 갈색 선이 들어갔는지 보고 아니면 펜·색을 다시 골라 긋는다.
for (let i = 0; i < 3; i++) {
  u.tap('그리기 도구 펜', 900);
  corn.color(C.line);
  r.stroke(wink); r.sleep(1200);
  if (corn.inkNear(EYE, .04) > 300) break;
  if (i === 2) throw new Error('윙크가 안 그려짐');
  u.tap('되돌리기', 900);
}
r.stop(); r.pull('an2');
say('2 ' + r.cut('an2', { from: 0.4, speed: 1.2, squeeze: true, out: out(2), crop: [150, 1440] }) + 'B');

// 3. 장마다 시간 — 윙크(2장)는 0.1초, 눈 뜬 1장은 0.8초
u.dismiss();
r.start('an3'); r.sleep(600);
u.tap('애니메이션', 2200);
u.tap('2장 0.1초', 1500);
u.tap('1장 · 0.3초', 1500);
u.tap('1장 0.8초', 1800);
r.stop(); r.pull('an3');
say('3 ' + r.cut('an3', { from: 0.4, squeeze: true, out: out(3), crop: [150, 1440] }) + 'B');

// 4. 재생으로 확인 — 통통·하트 움직임과 함께 돈다
u.dismiss();
r.start('an4'); r.sleep(600);
u.tap('애니메이션 재생', 5500);
r.stop(); r.pull('an4');
r.tap(859, 131, 3000);   // 저장 = 이 칸 완성(대사 강좌가 '이전 칸 그림으로 시작'으로 이 색칠한 콘을 가져간다). 재생 중이라 자리로 누른다.
say('4 ' + r.cut('an4', { from: 0.4, out: out(4), crop: [150, 1440] }) + 'B');
r.touches(false);
