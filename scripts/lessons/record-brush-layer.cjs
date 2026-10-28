// 강좌 '브러시 · 레이어 · 색' 다시 녹화(2026-10-28, v24 화면 · 3배 엔진). step4(선택해서 옮기기)는 사진 그대로.
// 준비: record-first-set.cjs 직후(02번 칸에 콘 선 그림이 열린 그리기 화면).
const path = require('path');
const r = require('./rec.cjs'), u = require('./ui.cjs'), corn = require('./corn-codex.cjs');
const out = n => path.join(__dirname, '..', '..', 'assets', 'lessons', 'brush-layer', `step${n}.mp4`);
const say = t => console.log('  ' + t);
const S = corn.SPOT, pt = (x, y) => corn.at(x, y), at = ([x, y]) => corn.at(x, y);
const color = hex => { u.tap('색, ' + u.nodes().find(n => n.desc.startsWith('색, #')).desc.slice(3), 1200); if (!u.has('색 ' + hex)) u.tap('팔레트', 1000); u.tap('색 ' + hex, 900); if (u.has('팔레트 닫기')) u.tap('팔레트 닫기', 900); };
r.touches(true);

// 1. 선 종류 — 연필로 알갱이, 마커로 볼터치, 같은 칸 한 번 더 → 세부 설정
r.start('bl1'); r.sleep(600);
u.tap('연필', 900);
for (const [x, y] of S.grains) r.stroke([pt(x - .015, y), pt(x, y + .015), pt(x + .015, y)]);
color('#FF6E7A');
u.tap('마커', 900);
for (const [x, y] of [S.cheekL, S.cheekR]) r.stroke([pt(x - .03, y), pt(x, y + .004), pt(x + .03, y)]);
r.sleep(600);
u.tap('마커', 2200);                            // 같은 칸을 한 번 더 → 진하기·선 보정
for (const close of ['브러시 닫기', '닫기']) if (u.has(close)) { u.tap(close, 900); break; }
r.stop(); r.pull('bl1');
say('1 ' + r.cut('bl1', { from: 0.4, speed: 1.6, out: out(1), crop: [420, 1440] }) + 'B');

// 2. 색 고르기 — 노랑으로 몸, 초록으로 잎을 채우기
r.start('bl2'); r.sleep(600);
color('#FFD15C');
u.tap('채우기', 900);
for (const k of ['body', 'handL', 'handR', 'footL', 'footR']) r.tap(...at(S[k]), 1300);
color('#65C47A');
u.tap('채우기', 600);
for (const k of ['sproutL']) r.tap(...at(S[k]), 1300);
r.sleep(800);
r.stop(); r.pull('bl2');
say('2 ' + r.cut('bl2', { from: 0.4, speed: 1.6, out: out(2), crop: [420, 1440] }) + 'B');

// 3. 레이어 나누기 — 레이어 2에 하트
r.start('bl3'); r.sleep(600);
u.tap('레이어', 1300);
u.tap('레이어 추가', 1300);
u.tap('레이어 닫기', 900);
color('#E94F4F');
u.tap('그리기 도구 펜', 700);
const heart = []; for (let i = 0; i <= 28; i++) { const t = i / 28 * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); heart.push(pt(S.heart[0] + x * .0042, S.heart[1] + y * .0042)); }
r.stroke(heart);
r.sleep(600);
u.tap('레이어', 1500);
r.sleep(1200);
u.tap('레이어 닫기', 900);
r.stop(); r.pull('bl3');
say('3 ' + r.cut('bl3', { from: 0.4, speed: 1.6, out: out(3), crop: [150, 1440] }) + 'B');
r.touches(false);
