// V2 다중 동작(2026-10-07, PRO): 단계 타임라인 계산 검사.
//  1) 엔진 글자(MOTION_MATH_JS 의 stepDelta)와 RN 식(stepDelta)이 같은 값
//  2) 단계 경계·한 바퀴 이음매에서 튀지 않는다(1/240초 간격 변화량) — 예전 프로토타입은 쓱→흔들기 경계에서 367px 튀었다
//  3) 저장 검증: 옳은 단계는 받고, 빼꼼·사라지기·단계 4개·범위 밖 길이는 거절 / 단계 없는 옛 움직임은 그대로
//  4) 단계가 있으면 PRO 움직임이고 움직이는 칸이다
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const math = loader()('src/motion-math.ts');
const { MOTION_PRESETS } = loader()('src/types.ts');
const { parseStore, usesPro, isAnimated, createProject } = loader()('src/project.ts');
const { stepDelta, stepTotal, STEP_EXCLUDED, STEP_LIMITS, MOTION_MATH_JS } = math;
const js = new Function(MOTION_MATH_JS + '; return { stepDelta, stepTotal };')();
const W = 360, H = 360;
const usable = MOTION_PRESETS.filter(p => !STEP_EXCLUDED.includes(p));
const step = (preset, duration = .8, repeat = 1, extra = {}) => ({ id: preset + duration + repeat, preset, duration, repeat, ...extra });

// 1) 두 벌이 같다
const lines = [[step('slide', .8), step('shake', .6, 2), step('pulse', .5)], [step('pop', .6), step('bounce', .5, 2)], [step('drop', 1), step('tilt', .7, 1, { strength: 1, direction: 'right' })]];
for (const steps of lines) {
  const total = stepTotal(steps);
  assert.ok(Math.abs(total - js.stepTotal(steps)) < 1e-12);
  for (let i = 0; i <= 200; i++) {
    const t = total * i / 200 + (i % 3) * 1e-3;
    const a = stepDelta(steps, t, .5, 'left', W, H), b = js.stepDelta(steps, t, .5, 'left', W, H);
    for (const k of ['px', 'py', 'dx', 'dy', 'sx', 'sy', 'rot']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `엔진·RN 식이 같다 ${k} t=${t}`);
  }
}

// 2) 튀지 않는다: 쓸 수 있는 효과 두 개씩 이은 모든 조합(세기 0.5·1)에서 단계 경계와 한 바퀴 이음매 바로 앞·뒤 자세가 같다.
//    회전은 360° 를 돌아 0° 로 이어지므로 각도 차이는 -180~180 으로 접어 잰다.
const wrap = r => ((r % 360) + 540) % 360 - 180;
const gap = (a, b) => Math.max(Math.abs(a.dx - b.dx), Math.abs(a.dy - b.dy), Math.abs(a.sx - b.sx) * W / 2, Math.abs(a.sy - b.sy) * H / 2, Math.abs(wrap(a.rot - b.rot)) * Math.PI / 180 * W / 2);
let worst = { jump: 0 }, checked = 0;
for (const a of usable) for (const b of usable) for (const st of [.5, 1]) for (const rep of [1, 2]) {
  const steps = [step(a, .8, rep, { strength: st }), step(b, .6, 1, { strength: st })];
  const total = stepTotal(steps), eps = 1e-6;
  for (const edge of [.8 * rep, total]) {
    const before = stepDelta(steps, edge - eps, st, 'left', W, H), after = stepDelta(steps, edge + eps, st, 'left', W, H), j = gap(before, after);
    checked++;
    if (j > worst.jump) worst = { jump: j, a, b, st, rep, edge };
  }
}
console.log(`경계 ${checked}곳(효과 ${usable.length}×${usable.length}×세기 2×반복 2×경계 2) — 앞·뒤 자세 최대 차이 ${worst.jump.toFixed(4)}px${worst.a ? ` (${worst.a}→${worst.b})` : ''}`);
assert.ok(worst.jump < .5, '단계 경계·이음매에서 자세가 끊기지 않는다(0.5px 미만): ' + JSON.stringify(worst));

// 3) 저장 검증
const base = () => { const p = createProject('단계 시험', '몽'); return p; };
const withMotion = motion => { const p = base(); p.slots[0].motion = motion; return JSON.stringify({ version: 1, revision: 1, projects: [p] }); };
const ok = { version: 1, speed: .5, strength: .5, steps: [step('slide', .8), step('shake', .6, 2)] };
assert.doesNotThrow(() => parseStore(withMotion(ok)), '옳은 단계는 저장된다');
assert.throws(() => parseStore(withMotion({ ...ok, steps: [step('peek')] })), /단계 효과/, '빼꼼은 단계로 쓸 수 없다');
assert.throws(() => parseStore(withMotion({ ...ok, steps: [step('vanish')] })), /단계 효과/, '사라지기도');
assert.throws(() => parseStore(withMotion({ ...ok, steps: [step('shake'), step('pulse'), step('tilt'), step('float')] })), /단계 데이터/, `단계는 ${STEP_LIMITS.maxSteps}개까지`);
assert.throws(() => parseStore(withMotion({ ...ok, steps: [step('shake', 5)] })), /길이/, '단계 길이 범위');
assert.throws(() => parseStore(withMotion({ ...ok, steps: [step('shake', .8, 9)] })), /길이/, '반복 범위');
const legacy = { version: 1, preset: 'bounce', speed: .5, strength: .5 };
assert.deepEqual(parseStore(withMotion(legacy)).projects[0].slots[0].motion, legacy, '단계 없는 옛 움직임은 그대로 읽힌다');

// 4) PRO · 움직이는 칸
assert.equal(usesPro(ok), true, '단계가 있으면 PRO 움직임');
assert.equal(usesPro(legacy), false, '무료 효과 하나는 그대로 무료');
const p = base(); p.slots[0].motion = { version: 1, speed: .5, strength: .5, steps: [step('shake')] };
assert.equal(isAnimated(p.slots[0]), true, '단계만 있어도 움직이는 칸');

console.log('PASS: motion steps (V2) — engine and RN formulas identical, no jumps at step boundaries or loop seam (all usable pairs), store accepts valid steps and rejects peek/vanish/too many/out of range, legacy motion unchanged, steps are PRO and animate the cut');
