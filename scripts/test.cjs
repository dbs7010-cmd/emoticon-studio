const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const files = new Map();
let failWrite = false;
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data) { if (failWrite) { files.set(this.uri, '{'); throw new Error('disk full'); } files.set(this.uri, data); }
  textSync() { return files.get(this.uri); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
}
const load = loader({ 'expo-file-system': { File, Directory, Paths: { document: 'document' } } });
const { createProject, duplicates, parseStore } = load('src/project.ts');
const { loadStore, saveStore, localFile } = load('src/services/storage.ts');
const { inspectImage, compareMetrics } = load('src/services/qa.ts');
const p = createProject('테스트', '콩이');
assert.equal(p.slots.length, 32); assert.deepEqual(p.slots.map(s => s.number), Array.from({ length: 32 }, (_, i) => i + 1));
p.slots[0].dialogue = '고마워!!'; p.slots[1].dialogue = '고 마 워';
assert.deepEqual(duplicates(p.slots), [[1, 2]]);
const initial = { version: 1, revision: 1, projects: [p] };
saveStore(initial); assert.deepEqual(loadStore().store, initial);
saveStore({ ...initial, revision: 2 });
failWrite = true; assert.throws(() => saveStore({ ...initial, revision: 3 })); failWrite = false;
assert.equal(loadStore().store.revision, 2); assert.equal(loadStore().recovered, true);
files.set(localFile('store-b.json').uri, '{'); assert.throws(loadStore);
assert.throws(() => parseStore('{"version":2}')); assert.throws(() => localFile('../secret'));
assert.equal(inspectImage().status, 'FAIL');
const png = Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.writeUInt32BE(360,16); png.writeUInt32BE(360,20);
files.set(localFile('test.png').uri, png);
const metrics = { coverage: 0.2, centerX: 0.5, centerY: 0.5, width: 0.5, height: 0.5, color: [0.2,0.2,0.2], transparent: true };
const im = { path: 'test.png', width: 360, height: 360, metrics };
const qa = inspectImage(im, im);
assert.equal(qa.status, 'WARNING'); // unverified policy must never silently pass
assert.equal(qa.checks.find(c => c.label === '작업 크기').status, 'PASS');
assert.equal(inspectImage({ ...im, metrics: { ...metrics, coverage: 0 } }, im).status, 'FAIL');
png.writeUInt32BE(400,16); assert.equal(inspectImage(im, im).status, 'FAIL');
assert.equal(compareMetrics(metrics, { ...metrics, centerX: 0.9 })[0].status, 'WARNING');
assert.equal(compareMetrics({ ...metrics, coverage: 1 }, metrics)[0].status, 'WARNING');
console.log('PASS: 32 slots, duplicate dialogue, JSON round-trip, failed-write recovery, corrupt-store protection, path validation, PNG dimensions, empty-image failure, unverified-policy warning, consistency thresholds. FileSystem is mocked; native persistence requires device verification.');
