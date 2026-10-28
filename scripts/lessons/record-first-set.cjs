// 강좌 '첫 세트 · 첫 칸 그리기' 다시 녹화(2026-10-28, v24 화면 · 3배 엔진).
// 준비: 폰 에뮬레이터(1080×2400)에 검수 빌드, 앱 데이터 비움 → 시작하기까지 지난 홈(세트 0개). 화면 애니메이션 0(버튼 이름 읽기용).
// 실행: node scripts/lessons/record-first-set.cjs  → assets/lessons/first-set/step1~4.mp4
const path = require('path');
const r = require('./rec.cjs'), u = require('./ui.cjs'), corn = require('./corn-codex.cjs');
const out = n => path.join(__dirname, '..', '..', 'assets', 'lessons', 'first-set', `step${n}.mp4`);
const say = t => console.log('  ' + t);
u.fresh();
r.touches(true);

// 1. 세트 만들기
r.start('fs1'); r.sleep(800);
u.tap('새 세트 만들기', 1500);
u.tap('만들기', 2500);
u.waitFor('저장'); r.sleep(1200);
r.stop(); r.pull('fs1');
say('1 ' + r.cut('fs1', { from: 0.5, out: out(1), crop: [840, 1440] }) + 'B');

// 2. 그리기 — 갈색 · 굵기 8로 지금 Codex 콘을 큰 윤곽부터(예전 콘 선 그림은 쓰지 않는다)
r.start('fs2'); r.sleep(600);
corn.color(corn.COLOR.line);
r.tap(230, 396, 900);   // 굵기 막대(153~521, 1~48) 8 자리
corn.draw();
r.sleep(1000);
r.stop(); r.pull('fs2');
say('2 ' + r.cut('fs2', { from: 0.4, speed: 1.3, out: out(2), crop: [420, 1440] }) + 'B');

// 3. 저장하고 보드로
r.start('fs3'); r.sleep(600);
u.tap('저장', 2200);
r.adb(['shell', 'input', 'keyevent', '4']); r.sleep(2500);
r.stop(); r.pull('fs3');
say('3 ' + r.cut('fs3', { from: 0.4, out: out(3), crop: [0, 1440] }) + 'B');

// 4. 다음 칸은 이어서 — 02번 → 이전 칸 그림으로 시작
r.start('fs4'); r.sleep(600);
u.tap('02', 3000, { exact: false });
u.tap('이전 칸 그림으로 시작', 2500, { exact: false });
r.sleep(4500);   // 복사는 엔진이 그림을 다시 읽어 와서 몇 초 걸린다
r.stop(); r.pull('fs4');
say('4 ' + r.cut('fs4', { from: 0.4, out: out(4), crop: [150, 1440] }) + 'B');
r.touches(false);
