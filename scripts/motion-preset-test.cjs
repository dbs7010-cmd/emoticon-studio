// 움직임 종류: 화면에 내놓는 것과 저장이 받는 것이 같은가.
//
// 45.34 에서 전체 움직임을 셋에서 여섯으로 늘렸는데, 저장 검증(project.ts)에는 옛 셋만 글자로
// 박혀 있었다. 그래서 둥실·까딱·부르르를 고르면 칸을 닫을 때 "저장하지 못했어요 /
// 움직임 종류가 손상되었습니다" 가 떴다 — 사용자가 신고한 그 오류다.
// 종류를 또 늘릴 때 같은 자리가 다시 갈라지지 않도록, 여기서 **화면 목록을 읽어** 그 모두가
// 실제 저장 경로(saveStore → 파일 → loadStore)를 왕복하는지 본다. 목록을 손으로 적지 않는다.
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');

const files = new Map();
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data) { files.set(this.uri, data); }
  textSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  'react-native': { Platform: { OS: 'android' }, View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', StyleSheet: { create: s => s } },
  '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
});
const { createProject } = load('src/project.ts');
const { saveStore, loadStore } = load('src/services/storage.ts');
const { MOTION_PRESETS } = load('src/types.ts');
const { PRESETS } = load('src/painter/motion-panel.tsx');

// ① 화면이 고르게 하는 모든 효과는 저장이 아는 종류여야 한다.
const shown = PRESETS.map(p => p.id);
assert.equal(shown.length, 20, '전체 움직임은 스무 가지다(45.39): ' + shown.length);
for (const id of shown) {
  assert.ok(MOTION_PRESETS.includes(id), `화면에 있는 '${id}' 가 저장 목록에 없다 — 고르면 저장이 막힌다`);
}
// 반대쪽도 본다: 저장만 아는 유령 종류를 남겨 두지 않는다.
for (const id of MOTION_PRESETS) {
  assert.ok(shown.includes(id), `저장 목록의 '${id}' 를 고를 방법이 화면에 없다`);
}

// ② 각 종류가 실제 저장 파일을 왕복한다. 검증은 saveStore 안에서 돈다 — 거부되면 여기서 던진다.
let rev = 0;
for (const id of shown) {
  // 저장은 두 벌을 번갈아 쓰고 개정 번호로 최신을 고른다. 검사에서도 실제처럼 번호를 올린다.
  const store = { version: 1, revision: ++rev, projects: [createProject('검사', '검사')] };
  store.projects[0].slots[0].motion = { version: 1, preset: id, speed: .5, strength: .5, captionMoves: false };
  let failed = null;
  try { saveStore(store); } catch (e) { failed = e.message; }
  assert.equal(failed, null, `'${id}' 를 고르면 저장이 거부된다: ${failed}`);
  const back = loadStore().store.projects[0].slots[0].motion;
  assert.equal(back.preset, id, `'${id}' 가 다시 열 때 그대로 돌아온다`);
  assert.equal(back.speed, .5); assert.equal(back.strength, .5);
}

// ③ 정말 모르는 종류는 여전히 거부한다 — 검증을 통째로 열어 둔 것이 아니다.
const bad = { version: 1, revision: rev + 1, projects: [createProject('검사', '검사')] };
bad.projects[0].slots[0].motion = { version: 1, preset: 'nonsense', speed: .5, strength: .5 };
assert.throws(() => saveStore(bad), /움직임 종류/, '모르는 종류는 그대로 거부한다');

// ④ 거부된 저장은 파일을 건드리지 않는다 — 이전 정상 저장본이 남는다.
const kept = loadStore().store.projects[0].slots[0].motion.preset;
assert.equal(kept, shown[shown.length - 1], '거부된 저장 뒤에도 직전 정상 저장본이 그대로 있다');


// ⑤ 45.39: 엔진 글자(MOTION_MATH_JS)와 견본 식(presetDelta)이 같은 값을 낸다 — 두 벌이 갈라지면 견본이 거짓말을 한다.
const math = load('src/motion-math.ts');
const engine = new Function(math.MOTION_MATH_JS + '\nreturn presetDelta;')();
const keys = ['px', 'py', 'dx', 'dy', 'sx', 'sy', 'rot'];
for (const id of MOTION_PRESETS) for (const a of [0, .25, .5, .75, 1]) for (const dir of [undefined, 'left', 'right', 'up', 'down']) for (let i = 0; i <= 40; i++) {
  const u = i / 40, x = engine(id, u, a, dir, 360, 360), y = math.presetDelta(id, u, a, dir, 360, 360);
  for (const k of keys) assert.ok(Math.abs(x[k] - y[k]) < 1e-9, `${id} u=${u} a=${a} ${dir}: 엔진 ${k}=${x[k]} 견본 ${y[k]}`);
}
// ⑥ 앞의 여섯은 45.38 과 **같은 값**이다(저장된 칸이 달라 보이면 안 된다). 45.38 의 식을 그대로 옮겨 비교한다.
const W = 360, H = 360;
const legacy = (p, phase, a) => {
  const d = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
  if (p === 'float') d.dy = Math.sin(phase) * (H * .035) * a;
  if (p === 'bounce') { const up = Math.abs(Math.sin(phase)); d.dy = -up * (H * .07) * a; const sq = (1 - up) * (1 - up) * .12 * a; d.sy = 1 - sq; d.sx = 1 + sq * .8; }
  if (p === 'pulse') { const s = 1 + Math.sin(phase) * .07 * a; d.sx = s; d.sy = s; }
  if (p === 'tilt') d.rot = Math.sin(phase) * 7 * a;
  if (p === 'shake') d.dx = Math.sin(phase * 2) * (W * .035) * a;
  if (p === 'jitter') { d.dx = Math.sin(phase * 7) * (W * .012) * a; d.dy = Math.cos(phase * 9) * (H * .010) * a; d.rot = Math.sin(phase * 8) * 1.5 * a; }
  return d;
};
for (const id of ['float', 'bounce', 'pulse', 'tilt', 'shake', 'jitter']) for (const a of [.1, .5, 1]) for (let i = 0; i < 36; i++) {
  const u = i / 36, x = math.presetDelta(id, u, a, undefined, W, H), y = legacy(id, u * Math.PI * 2, a);
  for (const k of ['dx', 'dy', 'sx', 'sy', 'rot']) assert.ok(Math.abs(x[k] - y[k]) < 1e-9, `${id}: 45.38 과 값이 다르다(${k})`);
  assert.equal(x.px, W / 2); assert.equal(x.py, H / 2);
}
// ⑦ 스무 가지 모두 한 바퀴 끝(u→1)이 처음(u=0)과 이어진다 — 반복할 때 튀지 않는다. 회전은 360° 차이도 같은 자세다.
// 들어오는 효과는 처음과 끝이 모두 '보이지 않는' 자세일 수 있다(아주 작거나 캔버스 밖) — 그때는 값이 달라도 튀어 보이지 않는다.
const hidden = d => Math.min(d.sx, d.sy) < .01 || Math.abs(d.dx) >= W || Math.abs(d.dy) >= H;
for (const id of MOTION_PRESETS) for (const a of [0, .5, 1]) for (const dir of ['left', 'right', 'up', 'down']) {
  const x = math.presetDelta(id, 0, a, dir, W, H), y = math.presetDelta(id, 1 - 1e-7, a, dir, W, H);
  if (hidden(x) && hidden(y)) continue;
  for (const k of ['dx', 'dy']) assert.ok(Math.abs(x[k] - y[k]) < .5, `${id} 이음매가 튄다(${k}: ${x[k]} → ${y[k]})`);
  for (const k of ['sx', 'sy']) assert.ok(Math.abs(x[k] - y[k]) < .02, `${id} 이음매가 튄다(${k}: ${x[k]} → ${y[k]})`);
  const turn = ((x.rot - y.rot) % 360 + 360) % 360; assert.ok(turn < .5 || turn > 359.5, `${id} 이음매가 튄다(rot ${x.rot} → ${y.rot})`);
}
// ⑧ 무료는 정확히 여섯(뿅·통통·둥실·까딱·흔들기·두근), 나머지는 PRO. 부르르는 45.39 부터 PRO.
assert.deepEqual([...math.FREE_MOTION_PRESETS].sort(), ['bounce', 'float', 'pop', 'pulse', 'shake', 'tilt']);
assert.equal(MOTION_PRESETS.filter(id => math.isProPreset(id)).length, 14, 'PRO 효과는 열넷');
assert.ok(math.isProPreset('jitter'), '부르르는 PRO');
const { usesPro } = load('src/project.ts');
assert.ok(usesPro({ version: 1, preset: 'slide', speed: .5, strength: .5 }), 'PRO 효과만 든 움직임도 PRO 다');
assert.ok(!usesPro({ version: 1, preset: 'pop', speed: .5, strength: .5 }), '무료 효과는 PRO 가 아니다');
// ⑨ 방향은 네 가지만 저장된다.
const dirStore = { version: 1, revision: rev + 10, projects: [createProject('검사', '검사')] };
dirStore.projects[0].slots[0].motion = { version: 1, preset: 'slide', direction: 'up', speed: .5, strength: .5 };
saveStore(dirStore);
assert.equal(loadStore().store.projects[0].slots[0].motion.direction, 'up', '쓱의 방향이 저장을 왕복한다');
dirStore.revision += 1; dirStore.projects[0].slots[0].motion.direction = 'sideways';
assert.throws(() => saveStore(dirStore), /움직임 방향/, '모르는 방향은 거부한다');
console.log(`PASS: 전체 움직임 ${shown.length}종(${shown.join('·')}) 모두 선택 → 저장 → 재열기. 모르는 종류는 여전히 거부하고, 거부된 저장은 이전 저장본을 건드리지 않는다. 엔진·견본 식 일치, 옛 여섯 값 불변, 스무 가지 이음매, 무료 6·PRO 14, 방향 저장.`);
