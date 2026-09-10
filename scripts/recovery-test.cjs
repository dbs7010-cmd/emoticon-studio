// Data safety: a failed snapshot write must not lose the edit or destroy the last good state,
// and a broken or unverifiable export must never be reported as a finished submission file.
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');

const files = new Map();
let failWrites = false;
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data) { if (failWrites) throw new Error('디스크가 가득 찼습니다.'); files.set(this.uri, data); }
  textSync() { return files.get(this.uri); }
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
const { createProject, duplicates, parseStore, droppedImagePaths } = load('src/project.ts');
const { loadStore, saveStore, localFile, deleteLocalImages } = load('src/services/storage.ts');
const { exportSet, brokenSlots, readZipNames, buildZip } = load('src/services/export.ts');

const image = path => ({ path, width: 360, height: 360 });
const png = tag => { const b = Buffer.alloc(48); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b); b.writeUInt32BE(360, 16); b.writeUInt32BE(360, 20); b.write(tag, 32); return new Uint8Array(b); };

// ---------- a failed write keeps the last good snapshot ----------
const project = createProject('안전 세트', '콩이');
project.slots[0].finalImage = image('image-a.png');
files.set(localFile('image-a.png').uri, png('a'));
saveStore({ version: 1, revision: 1, projects: [project] });
const good = loadStore().store;
assert.equal(good.projects[0].slots[0].finalImage.path, 'image-a.png');

const edited = JSON.parse(JSON.stringify(good));
edited.projects[0].slots[0].finalImage = image('image-b.png');
edited.revision = 2;
files.set(localFile('image-b.png').uri, png('b'));
failWrites = true;
assert.throws(() => saveStore(edited), /가득/, 'a write failure surfaces rather than passing silently');
failWrites = false;
const afterFailure = loadStore().store;
assert.deepEqual(afterFailure, good, 'the last good snapshot survives a failed write untouched');
assert.ok(files.has(localFile('image-a.png').uri), 'and still points at a file that is present');
// The new asset was written before the snapshot; it must not have been cleaned up on failure,
// because the retry needs it.
assert.ok(files.has(localFile('image-b.png').uri), 'the asset the retry will reference is kept');

// A retry writes the edit the user still sees.
saveStore(edited);
assert.equal(loadStore().store.projects[0].slots[0].finalImage.path, 'image-b.png', 'the retry persists the edit');
deleteLocalImages(droppedImagePaths(good, edited));
assert.equal(files.has(localFile('image-a.png').uri), false, 'only then is the replaced file released');

// ---------- corrupted and future snapshots ----------
files.set(localFile('store-a.json').uri, '{ not json');
assert.deepEqual(loadStore().store, edited, 'one damaged copy falls back to the good one');
assert.equal(loadStore().recovered, true, 'and says so');
files.set(localFile('store-b.json').uri, JSON.stringify({ version: 2, revision: 9, projects: [] }));
assert.throws(() => loadStore(), /읽지 못했습니다/, 'an unreadable pair refuses rather than starting empty');
assert.throws(() => parseStore(JSON.stringify({ version: 2, revision: 1, projects: [] })), /지원하지 않/, 'a future schema is refused, never silently accepted');

// ---------- no-dialogue slots are not repeats ----------
const planning = createProject('기획', '콩이');
planning.slots[0] = { ...planning.slots[0], dialogue: '안녕', noDialogue: true };
planning.slots[1] = { ...planning.slots[1], dialogue: '안녕', noDialogue: true };
assert.deepEqual(duplicates(planning.slots), [], 'two no-dialogue slots keeping old text are not duplicates');
planning.slots[2] = { ...planning.slots[2], dialogue: '  ' };
planning.slots[3] = { ...planning.slots[3], dialogue: '' };
assert.deepEqual(duplicates(planning.slots), [], 'blank dialogue is not a duplicate either');
planning.slots[4] = { ...planning.slots[4], dialogue: '잘자!' };
planning.slots[5] = { ...planning.slots[5], dialogue: '잘 자' };
assert.deepEqual(duplicates(planning.slots), [[5, 6]], 'but the same words really are');

// ---------- export refuses what it cannot ship ----------
const shipping = createProject('내보내기', '콩이');
for (const n of [1, 2]) { shipping.slots[n - 1].finalImage = image(`image-s${n}.png`); files.set(localFile(`image-s${n}.png`).uri, png('s' + n)); }
const ok = exportSet(shipping);
assert.equal(ok.count, 2);
const names = readZipNames(files.get(localFile(ok.path).uri));
assert.deepEqual(names, ['01.png', '02.png'], 'the written archive reopens with the expected entries');
assert.equal(new Set(names).size, names.length, 'and carries no duplicate entry');

shipping.slots[2].finalImage = image('image-gone.png'); // recorded, but the file is not on disk
assert.deepEqual(brokenSlots(shipping), [3], 'a slot whose file vanished is found');
assert.throws(() => exportSet(shipping), /03번 그림 파일을 찾을 수 없어요/, 'and export stops with a Korean message instead of a raw crash');
files.set(localFile('image-gone.png').uri, png('g'));
assert.equal(exportSet(shipping).count, 3, 'once the file is back the set exports');

// A truncated archive must not read back as a success.
const truncated = buildZip([{ name: '01.png', data: png('x') }]).slice(0, 40);
assert.throws(() => readZipNames(truncated), /제출 파일/, 'a half-written archive is rejected, in Korean');
assert.throws(() => readZipNames(new Uint8Array(4)), /제출 파일/, 'so is an empty one');

console.log('PASS: failed writes keep the last good snapshot and the retryable edit, damaged and future schemas refuse safely, no-dialogue slots are not duplicates, export refuses missing files and unverifiable archives. File system mocked with injected write failure.');
