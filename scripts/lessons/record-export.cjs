// 강좌 '내보내기 · 카카오 제안 파일' 다시 녹화(2026-10-29, v24 화면 · 원본 색 Codex 콘).
// 준비: record-animation.cjs 직후(02번 칸 애니메이션 탭, 재생 중). 보드로 나와 시작한다.
const path = require('path');
const r = require('./rec.cjs'), u = require('./ui.cjs');
const out = n => r.langOut(path.join(__dirname, '..', '..', 'assets', 'lessons', 'export', `step${n}.mp4`));
const say = t => console.log('  ' + t);
// node record-export.cjs 2 → 2단계부터(녹화가 비었을 때 이어 찍기, 화면은 내보내기에 있어야 한다)
const from = +(process.argv[2] || 1);
if (from === 1 && !u.has('내보내기')) {   // 이미 보드에 있으면 그대로 시작
r.tap(977, 1584, 1200);                 // 재생 멈춤(애니메이션 재생 단추)
u.tap('그리기 닫기', 3000);
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);   // 검수용 빌드 알림은 영상에 넣지 않는다
}
r.touches(true);

// 1. 내보내기 열기 — 칸 격자 · 손볼 곳 · 파일 묶음 만들기
if (from <= 1) {
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);   // 검수용 빌드 알림
u.dismiss();
r.start('ex1'); r.sleep(600);
u.tap('내보내기', 3000);
r.swipe(540, 2000, 540, 1300, 1500, 2500);
r.stop(); r.pull('ex1');
say('1 ' + r.cut('ex1', { from: 0.4, out: out(1), crop: [0, 1440] }) + 'B');
}

// 2. 제출 준비 보기 — 몇 개 더 필요한지
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);   // 검수용 빌드 알림
u.dismiss();
r.start('ex2'); r.sleep(600);
r.swipe(540, 2000, 540, 1100, 1500, 1500);
u.tap('제출 준비 보기', 1500);
r.swipe(540, 2000, 540, 1300, 1500, 3000);
r.stop(); r.pull('ex2');
say('2 ' + r.cut('ex2', { from: 0.4, out: out(2), crop: [600, 1440] }) + 'B');

// 3. 아이콘 만들기 — 부가 이미지 › 아이콘 이미지 › 02번 · 크기 1.3배 › 이 모양으로 만들기
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);   // 검수용 빌드 알림
u.dismiss();
r.start('ex3'); r.sleep(600);
u.tap('부가 이미지 만들기', 2500);
if (u.has('알림 닫기')) u.tap('알림 닫기', 900);
u.tap('2번으로 만들기', 2500);
r.swipe(474, 1673, 570, 1673, 900, 1500);   // 크기 막대 손잡이(1.00배)를 오른쪽으로
u.tap('이 모양으로 만들기', 3000);
r.stop(); r.pull('ex3');
say('3 ' + r.cut('ex3', { from: 0.4, out: out(3), crop: [0, 1440] }) + 'B');
r.touches(false);
