// 강좌 '브러시 · 레이어 · 색' 다시 녹화(2026-10-29, v24 화면 · 3배 엔진 · 원본 Codex 콘 색). step4(선택해서 옮기기)는 사진 그대로.
// 준비: record-first-set.cjs 직후(02번 칸에 갈색 콘 선 그림이 열린 그리기 화면).
// 원본처럼 칠한다: 주황 알갱이 점 · 살구 볼 · 노랑 몸·손·발 · 초록 새싹 둘과 아래 잎 둘(2026-10-29 '칠하다 말았어' 지적).
const path = require('path');
const r = require('./rec.cjs'), u = require('./ui.cjs'), corn = require('./corn-codex.cjs');
const out = n => path.join(__dirname, '..', '..', 'assets', 'lessons', 'brush-layer', `step${n}.mp4`);
const say = t => console.log('  ' + t);
const S = corn.SPOT, C = corn.COLOR, at = ([x, y]) => corn.at(x, y);
r.touches(true);

// 1. 선 종류 — 기본 펜으로 알갱이(주황 점)와 볼터치(살구 점), 같은 칸 한 번 더 → 세부 설정. 마커는 겹친 자리가 얼룩져 원본처럼 꽉 찬 볼이 안 나왔다.
r.start('bl1'); r.sleep(600);
corn.color(C.grain);   // 첫 세트에서 이미 기본 펜 — 다시 누르면 세부 설정 창이 열린다
for (const g of S.grains) r.stroke(corn.dot(g, .02));
corn.color(C.cheek);
for (const c of [S.cheekL, S.cheekR]) r.stroke(corn.dot(c, .026));
r.sleep(600);
u.tap('기본 펜', 2200);                         // 같은 칸을 한 번 더 → 진하기·선 보정
for (const close of ['브러시 닫기', '닫기']) if (u.has(close)) { u.tap(close, 900); break; }
r.stop(); r.pull('bl1');
say('1 ' + r.cut('bl1', { from: 0.4, speed: 1.4, out: out(1), crop: [420, 1440] }) + 'B');

// 2. 색 고르기 — 노랑으로 몸·손·발, 초록으로 새싹 둘과 아래 잎 둘을 채우기
r.start('bl2'); r.sleep(600);
corn.color(C.body);
u.tap('채우기', 900);
for (const k of ['body', 'handL', 'handR', 'footL', 'footR']) r.tap(...at(S[k]), 1100);
corn.color(C.leaf);   // 채우기는 이미 골라져 있다 — 다시 누르면 세부 설정 창이 열려 다음 탭이 배경을 칠했다
for (const k of ['sproutL', 'sproutR', 'leafL', 'leafR']) r.tap(...at(S[k]), 1100);
r.sleep(800);
r.stop(); r.pull('bl2');
say('2 ' + r.cut('bl2', { from: 0.4, speed: 1.6, out: out(2), crop: [420, 1440] }) + 'B');

// 3. 레이어 나누기 — 레이어 2에 하트
r.start('bl3'); r.sleep(600);
u.tap('레이어', 1300);
u.tap('레이어 추가', 1300);
u.tap('레이어 닫기', 900);
corn.color(C.heart);
u.tap('그리기 도구 펜', 700);
const heart = []; for (let i = 0; i <= 28; i++) { const t = i / 28 * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); heart.push(corn.at(S.heart[0] + x * .0042, S.heart[1] + y * .0042)); }
r.stroke(heart);
u.tap('채우기', 700);
r.tap(...at(S.heart), 1200);
r.sleep(400);
u.tap('레이어', 1500);
r.sleep(1200);
u.tap('레이어 닫기', 900);
r.stop(); r.pull('bl3');
say('3 ' + r.cut('bl3', { from: 0.4, speed: 1.6, out: out(3), crop: [150, 1440] }) + 'B');
r.touches(false);
