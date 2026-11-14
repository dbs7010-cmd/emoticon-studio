// End to end over the real services, not the UI: plan a set, draw it, save it, review it,
// export it, reopen the archive and check every PNG. Scope is integration, not screens.
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');

const files = new Map();
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data, options) { files.set(this.uri, options?.encoding === 'base64' ? new Uint8Array(Buffer.from(data, 'base64')) : data); }
  textSync() { return files.get(this.uri); }
  async bytes() { return this.bytesSync(); }
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } }, 'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } } });
const { createProject, doneCount, duplicateCaptions, isDone, nextUnfinished, previousDrawn, reorderSlots, storeImagePaths } = load('src/project.ts');
const { loadStore, saveStore, localFile, exportUri } = load('src/services/storage.ts');
const { saveDrawing } = load('src/services/images.ts');
const { inspectImage } = load('src/services/qa.ts');
const { exportSet, readZipNames } = load('src/services/export.ts');
const SPEC = load('src/constants/kakao-spec.ts').KAKAO_STATIC_SPEC;

// A real PNG the painter could have produced: correct signature and canvas size in the header.
const painterOutput = tag => {
  const bytes = Buffer.alloc(72);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(SPEC.width, 16); bytes.writeUInt32BE(SPEC.height, 20);
  bytes.write(tag, 40);
  return 'data:image/png;base64,' + bytes.toString('base64');
};
const metrics = { coverage: .28, centerX: .5, centerY: .5, width: .5, height: .5, color: [.2, .2, .2], transparent: true };

// 1. New project, canon, references.
let project = createProject('완주 테스트', '콩이');
project.canon = { ...project.canon, image: { path: 'image-canon.png', width: 360, height: 360, metrics }, locked: '둥근 눈' };
files.set(localFile('image-canon.png').uri, new Uint8Array(Buffer.from('canon')));
const reference = { path: 'image-ref.png', width: 360, height: 360 };
files.set(localFile('image-ref.png').uri, new Uint8Array(Buffer.from('reference')));
project.slots = project.slots.map(s => ({ ...s, referenceImages: [reference] }));

// 2. An older store may already carry planning text and a chosen reference. Nothing is required.
const plan = [['잘자', '졸림'], ['안녕!', '반가움'], ['고마워', '고마움'], ['헐', '놀람'], ['', '']];
plan.forEach(([dialogue, emotion], i) => {
  project.slots[i] = { ...project.slots[i], dialogue, emotion, noDialogue: !dialogue, status: 'PLANNED', referenceKey: reference.path };
});
assert.equal(doneCount(project), 0, 'planning text alone finishes nothing');
assert.equal(nextUnfinished(project, 0), 1, 'and work starts at the first cut');

// 3. Draw, declare finished, and move on, the way 완성 · 다음 does.
const drawn = [1, 2, 3, 4, 5];
let cursor = 0;
for (const number of drawn) {
  assert.equal(nextUnfinished(project, cursor), number, '완성 · 다음 lands on the next unfinished cut');
  const caption = number === 3 ? { text: '고마워요', place: 'bottom', color: '#242424' } : undefined;
  const finalImage = { ...saveDrawing(painterOutput('slot' + number), metrics) };
  const qa = inspectImage(finalImage);
  assert.equal(qa.status, 'PASS', `slot ${number} passes the submission checks`);
  project.slots[number - 1] = { ...project.slots[number - 1], finalImage, qa, status: qa.status, done: true,
    work: { version: 1, activeLayerId: 'draw-1', layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: finalImage }], references: [], caption } };
  project.lastSlot = number;
  cursor = number;
}
assert.equal(doneCount(project), drawn.length, 'only declared cuts are counted');
assert.equal(previousDrawn(project, 6).number, 5, 'a copy would come from the cut just finished');
assert.deepEqual(duplicateCaptions(project.slots), [], 'no two cuts carry the same words');

// 완성 · 다음 hands over an empty canvas: a cut someone already drew on is not the next stop,
// and once the empty ones run out it comes back to the work that is still open.
const halfway = { ...project, slots: project.slots.map(s => s.number === 6 ? { ...s, finalImage: { path: 'image-wip.png', width: 360, height: 360 }, done: false } : s) };
assert.equal(nextUnfinished(halfway, 5), 7, 'the cut that already has a drawing is skipped');
const onlyWip = { ...project, slots: project.slots.map(s => s.number > 5 && s.number !== 6 ? { ...s, finalImage: { path: 'image-x.png', width: 360, height: 360 }, done: true } : s.number === 6 ? { ...s, finalImage: { path: 'image-wip.png', width: 360, height: 360 }, done: false } : s) };
assert.equal(nextUnfinished(onlyWip, 5), 6, 'but with nothing empty left, unfinished work is where it goes');
const finished = { ...project, slots: project.slots.map(s => ({ ...s, done: true, finalImage: s.finalImage ?? { path: 'image-x.png', width: 360, height: 360 } })) };
assert.equal(nextUnfinished(finished, 5), null, 'and a finished set sends the user to the board instead');
assert.equal(nextUnfinished({ ...finished, slots: finished.slots.map(s => s.number === 2 ? { ...s, done: false, finalImage: undefined } : s) }, 30), 2, 'it wraps around to an earlier open cut');
saveStore({ version: 1, revision: 1, projects: [project] });

// 4. Reopen from disk, exactly as a restart would.
const reopened = loadStore().store;
assert.equal(reopened.projects.length, 1);
project = reopened.projects[0];
assert.equal(project.lastSlot, 5, 'the set remembers where work stopped');
assert.equal(project.slots.filter(s => s.finalImage).length, drawn.length, 'every saved drawing came back');
assert.equal(project.slots[0].referenceImages.length, 1, 'and so did the references');
assert.equal(project.slots[4].noDialogue, true, 'and the no-dialogue plan');
assert.equal(doneCount(project), drawn.length, 'and every completion survived the restart');
assert.deepEqual(project.slots[2].work.caption, { text: '고마워요', place: 'bottom', color: '#242424' }, 'together with the words drawn into the picture');
assert.equal(isDone(project.slots[5]), false, 'an untouched cut is still open');

// 4b. 그림(레이어) 이름과 움직임이 가리키는 대상이 열기 → 편집 → 저장 → 재실행을 건너온다.
// The name is what the screen calls a layer; the id is what a movement points at. A rename must
// travel with the drawing and must not become the thing the movement is matched by.
{
  const before = project.slots[0].work.layers.map(l => l.id);
  const target = before[0];
  const named = {
    ...project,
    slots: project.slots.map(s => s.number === 1 ? {
      ...s,
      work: { ...s.work, layers: s.work.layers.map(l => l.id === target ? { ...l, name: '손' } : l) },
      motion: { version: 1, preset: 'bounce', speed: .5, strength: .5, parts: [{ id: 'p1', layerId: target, effect: 'rotate', pivotX: .5, pivotY: .5, amount: 20, angle: 0, speed: .5, delay: 0 }] },
    } : s),
  };
  saveStore({ version: 1, revision: 9, projects: [named] });
  const back = loadStore().store.projects[0].slots[0];
  assert.deepEqual(back.work.layers.map(l => l.id), before, 'every layer id came back unchanged');
  assert.equal(back.work.layers.find(l => l.id === target).name, '손', 'and the name the user typed came back with it');
  assert.equal(back.motion.parts[0].layerId, target, 'the part movement still points at the layer id, not at its name');
  assert.ok(back.work.layers.some(l => l.id === back.motion.parts[0].layerId), 'so the layer it names is really in this cut');
  // An older store never carried a user-chosen name, only the default one. It still opens.
  const legacy = JSON.parse(JSON.stringify(named));
  legacy.slots[0].work.layers = legacy.slots[0].work.layers.map((l, i) => ({ ...l, name: '그림 ' + (i + 1) }));
  saveStore({ version: 1, revision: 10, projects: [legacy] });
  const old = loadStore().store.projects[0].slots[0];
  assert.equal(old.work.layers[0].name, '그림 1', 'a store from before renaming opens untouched');
  assert.equal(old.motion.parts[0].layerId, target, 'and its movement still points at the same layer');
  saveStore({ version: 1, revision: 11, projects: [project] });
}

// 5. Review the whole set the way the preview screen does.
for (const slot of project.slots.filter(s => s.finalImage)) {
  assert.equal(inspectImage(slot.finalImage).status, 'PASS', `slot ${slot.number} still passes after a reopen`);
}

// 5b. 순서를 바꿔도 작품과 파일 연결이 그대로 따라간다.
{
  const before = project.slots.map(s => s.finalImage && s.finalImage.path);
  const movedProject = reorderSlots(project, 1, 4);
  const order = movedProject.slots.map(s => s.finalImage && s.finalImage.path);
  assert.deepEqual(order.slice(0, 4), [before[1], before[2], before[3], before[0]], 'the cut travels to its new place and the others close up');
  assert.deepEqual(movedProject.slots.map(s => s.number), project.slots.map(s => s.number), 'the places keep their numbers 1..n');
  assert.deepEqual([...storeImagePaths({ version: 1, revision: 1, projects: [movedProject] })].sort(), [...storeImagePaths({ version: 1, revision: 1, projects: [project] })].sort(), 'not one file is dropped or invented by reordering');
  assert.equal(movedProject.slots[1].work && movedProject.slots[1].work.caption && movedProject.slots[1].work.caption.text, '고마워요', 'the words travel with the cut');
  assert.equal(movedProject.slots[3].done, true, 'and the finished mark travels too');
  assert.deepEqual(reorderSlots(movedProject, 4, 1).slots.map(s => s.finalImage && s.finalImage.path), before, 'moving it back restores the original order exactly');
  assert.deepEqual(reorderSlots(project, 2, 2).slots, project.slots, 'moving a cut onto itself changes nothing');

  // Reordering must not quietly break the things a cut *points at*. The set-level reference drawing
  // and the movement targets are held by id, not by cut number, so moving a cut must leave both
  // pointing at exactly what they pointed at before.
  const target = project.slots[0].work.layers[0].id;
  const motion = { version: 1, preset: 'bounce', speed: .5, strength: .5, parts: [{ id: 'p1', layerId: target, effect: 'rotate', pivotX: .5, pivotY: .5, amount: 20, angle: 0, speed: .5, delay: 0 }], alternate: { poseB: [target], interval: .4 } };
  const withMotion = { ...project, lastSlot: 1, slots: project.slots.map(s => s.number === 1 ? { ...s, motion, motionImage: { path: 'moving-1.gif', width: 360, height: 360, bytes: 2048 } } : s) };
  const after = reorderSlots(withMotion, 1, 4);
  assert.deepEqual(after.canon, withMotion.canon, 'the set reference drawing is untouched by reordering');
  assert.deepEqual(after.slots[3].motion, motion, 'the movement settings travel with the cut, unchanged');
  assert.equal(after.slots[3].motion.parts[0].layerId, target, 'the part being moved still names the same drawing inside that cut');
  assert.deepEqual(after.slots[3].motion.alternate.poseB, [target], 'the second pose still names the same drawing');
  assert.equal(after.slots[3].motionImage.path, 'moving-1.gif', 'and the moving file stays attached to its own cut');
  assert.ok(after.slots[3].work.layers.some(l => l.id === target), 'the layer the movement names is still inside the cut it travelled with');
  assert.equal(after.lastSlot, 4, 'the cut you were last on is followed to its new place');
  assert.equal(reorderSlots(withMotion, 2, 5).lastSlot, 1, 'and a cut that did not move keeps its place');
  assert.equal(after.slots.filter(s => s.motion).length, 1, 'no other cut picks up a movement it never had');
}

// 6. Export, then reopen the archive and check every entry.
const result = exportSet(project);
assert.equal(result.count, drawn.length);
assert.equal(result.missing, SPEC.count - drawn.length, 'the caller learns the set is not finished yet');
const archive = files.get(exportUri(result.path));
assert.deepEqual(readZipNames(archive), ['01.png', '02.png', '03.png', '04.png', '05.png'], 'entries are named and ordered by slot');

const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
const end = archive.length - 22;
let at = view.getUint32(end + 16, true);
const shipped = new Map();
for (let i = 0; i < view.getUint16(end + 10, true); i++) {
  const nameLength = view.getUint16(at + 28, true), size = view.getUint32(at + 24, true), offset = view.getUint32(at + 42, true);
  const name = Buffer.from(archive.slice(at + 46, at + 46 + nameLength)).toString('utf8');
  const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
  shipped.set(name, archive.slice(start, start + size));
  at += 46 + nameLength;
}
for (const slot of project.slots.filter(s => s.finalImage)) {
  const entry = shipped.get(`${String(slot.number).padStart(2, '0')}.png`);
  const source = files.get(localFile(slot.finalImage.path).uri);
  assert.deepEqual([...entry], [...source], `slot ${slot.number} ships exactly the bytes that were inspected`);
  const header = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
  assert.equal(Buffer.from(entry.slice(0, 8)).toString('hex'), '89504e470d0a1a0a', 'it is a real PNG');
  assert.equal(header.getUint32(16), SPEC.width); assert.equal(header.getUint32(20), SPEC.height);
}
// Nothing that is not a final drawing may be in the bundle.
const forbidden = [project.canon.image.path, reference.path];
for (const path of forbidden) {
  const bytes = files.get(localFile(path).uri);
  for (const entry of shipped.values()) assert.notDeepEqual([...entry], [...bytes], 'no reference or canon file is shipped');
}
assert.equal(storeImagePaths({ version: 1, revision: 1, projects: [project] }).has(result.path), false, 'the archive is not itself a project asset');

console.log('PASS: plan, draw, save, restart, review, export and reopen the archive; every entry is the inspected final PNG at the working canvas size, with references and canon excluded. Services integration, not a screen-level end to end.');
