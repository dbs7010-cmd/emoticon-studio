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
assert.ok(shown.length >= 6, '전체 움직임은 여섯 가지 이상이다: ' + shown.length);
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

console.log(`PASS: 전체 움직임 ${shown.length}종(${shown.join('·')}) 모두 선택 → 저장 → 재열기. 모르는 종류는 여전히 거부하고, 거부된 저장은 이전 저장본을 건드리지 않는다.`);
