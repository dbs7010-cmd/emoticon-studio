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
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } }, 'expo-image-picker': {}, 'expo-image-manipulator': {} });
const { createProject, planningIssues, duplicates, storeImagePaths } = load('src/project.ts');
const { loadStore, saveStore, localFile } = load('src/services/storage.ts');
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

// 2. Plan several slots, including one with no dialogue.
const plan = [['잘자', '졸림'], ['안녕!', '반가움'], ['고마워', '고마움'], ['헐', '놀람'], ['', '']];
plan.forEach(([dialogue, emotion], i) => {
  project.slots[i] = { ...project.slots[i], dialogue, emotion, noDialogue: !dialogue, status: 'PLANNED', referenceKey: reference.path };
});
assert.deepEqual(duplicates(project.slots), [], 'the plan has no repeated line');
assert.ok(planningIssues(project).some(i => /^\d+칸이 남았어요$/.test(i)), 'and it says how many slots are still open');

// 3. Draw and save each planned slot, the way save-next does.
const drawn = [1, 2, 3, 4, 5];
for (const number of drawn) {
  const finalImage = { ...saveDrawing(painterOutput('slot' + number), metrics) };
  const qa = inspectImage(finalImage, project.canon.image);
  assert.equal(qa.status, 'PASS', `slot ${number} passes the submission checks`);
  project.slots[number - 1] = { ...project.slots[number - 1], finalImage, qa, status: qa.status, lastSaved: undefined };
  project.lastSlot = number;
}
saveStore({ version: 1, revision: 1, projects: [project] });

// 4. Reopen from disk, exactly as a restart would.
const reopened = loadStore().store;
assert.equal(reopened.projects.length, 1);
project = reopened.projects[0];
assert.equal(project.lastSlot, 5, 'the set remembers where work stopped');
assert.equal(project.slots.filter(s => s.finalImage).length, drawn.length, 'every saved drawing came back');
assert.equal(project.slots[0].referenceImages.length, 1, 'and so did the references');
assert.equal(project.slots[4].noDialogue, true, 'and the no-dialogue plan');

// 5. Review the whole set the way the preview screen does.
for (const slot of project.slots.filter(s => s.finalImage)) {
  assert.equal(inspectImage(slot.finalImage, project.canon.image).status, 'PASS', `slot ${slot.number} still passes after a reopen`);
}

// 6. Export, then reopen the archive and check every entry.
const result = exportSet(project);
assert.equal(result.count, drawn.length);
assert.equal(result.missing, SPEC.count - drawn.length, 'the caller learns the set is not finished yet');
const archive = files.get(localFile(result.path).uri);
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
