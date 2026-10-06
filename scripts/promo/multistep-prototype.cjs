// V2 다중 동작 검증용 프로토타입(EXPERIMENTAL · 앱에 들어가지 않음, 2026-10-05).
// 단계(등장 → 흔들기 → 손 흔들기 …)를 시간 순서로 잇는 타임라인을 앱의 실제 식(motion-math.ts presetDelta)으로 계산해,
//  1) 효과마다 시작(u=0)·끝(u→1) 자세가 정지 자세(변환 없음)와 같은지 — 같아야 다음 단계로 '튀지 않고' 넘어간다
//  2) 예시 타임라인(쓱 등장 0.8s → 흔들기 0.6s ×2 → 정지)의 단계 경계에서 위치·크기·회전이 끊기는지
// 를 본다. 결과는 설계 문서(docs/closed-test/12_V2_다중동작_공모전_설계.md)의 근거다.
const { loader } = require('../load-ts.cjs');
const { presetDelta } = loader()('src/motion-math.ts');
const { MOTION_PRESETS } = loader()('src/types.ts');
const W = 360, H = 360, A = .5;
const off = d => Math.max(Math.abs(d.dx), Math.abs(d.dy), Math.abs(d.sx - 1) * W / 2, Math.abs(d.sy - 1) * H / 2, Math.abs(d.rot) * Math.PI / 180 * W / 2);
const rows = MOTION_PRESETS.map(p => {
  const s = presetDelta(p, 0, A, undefined, W, H), e = presetDelta(p, .9999, A, undefined, W, H);
  return { preset: p, start: +off(s).toFixed(1), end: +off(e).toFixed(1) };
});
console.log('효과별 시작·끝이 정지 자세에서 떨어진 정도(px, 0 이면 이어 붙이기 좋음)');
for (const r of rows) console.log(`  ${r.preset.padEnd(8)} 시작 ${String(r.start).padStart(6)}  끝 ${String(r.end).padStart(6)}  ${r.start < 1 && r.end < 1 ? '이음 좋음' : '전환 필요'}`);
// 예시 타임라인
const steps = [{ preset: 'slide', dur: .8, repeat: 1 }, { preset: 'shake', dur: .6, repeat: 2 }, { preset: null, dur: .4, repeat: 1 }];
const total = steps.reduce((t, s) => t + s.dur * s.repeat, 0);
const at = t => { let acc = 0; for (const s of steps) { const len = s.dur * s.repeat; if (t < acc + len) { const u = ((t - acc) % s.dur) / s.dur; return s.preset ? presetDelta(s.preset, u, A, 'left', W, H) : { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 }; } acc += len; } return { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 }; };
let acc = 0, worst = 0;
for (const s of steps) { const b = acc + s.dur * s.repeat; const jump = off({ dx: at(b - 1e-4).dx - at(b).dx, dy: at(b - 1e-4).dy - at(b).dy, sx: 1 + at(b - 1e-4).sx - at(b).sx, sy: 1 + at(b - 1e-4).sy - at(b).sy, rot: at(b - 1e-4).rot - at(b).rot }); worst = Math.max(worst, jump); console.log(`경계 ${b.toFixed(2)}s 튐 ${jump.toFixed(2)}px`); acc = b; }
console.log(`타임라인 ${total.toFixed(1)}s · 최대 튐 ${worst.toFixed(2)}px`);
