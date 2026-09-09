// Export bundle: real ZIP structure, slot order, reference exclusion, CRC checked against zlib.
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { loader } = require('./load-ts.cjs');

const files = new Map();
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data) { files.set(this.uri, data); }
  textSync() { return files.get(this.uri); }
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
const { createProject } = load('src/project.ts');
const { localFile } = load('src/services/storage.ts');
const { buildZip, crc32, setEntries, exportSet, safeName } = load('src/services/export.ts');

// CRC32 must agree with a known-good implementation, or every archiver will reject the bundle.
for (const sample of ['', 'a', 'hello world', '이모티콘', 'x'.repeat(1000)]) {
  const bytes = new Uint8Array(Buffer.from(sample, 'utf8'));
  assert.equal(crc32(bytes), zlib.crc32(Buffer.from(sample, 'utf8')), 'crc32 matches zlib for ' + JSON.stringify(sample.slice(0, 12)));
}

// A minimal reader, so the test proves the bytes parse rather than trusting the writer.
function readZip(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const end = buffer.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054B50, 'end of central directory signature');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014B50, 'central directory signature');
    const nameLength = view.getUint16(at + 28, true), sum = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true), offset = view.getUint32(at + 42, true);
    const name = Buffer.from(buffer.slice(at + 46, at + 46 + nameLength)).toString('utf8');
    assert.equal(view.getUint32(offset, true), 0x04034B50, 'local header signature for ' + name);
    const localName = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
    const start = offset + 30 + localName + extra;
    const data = buffer.slice(start, start + size);
    assert.equal(crc32(data), sum, 'stored crc matches payload for ' + name);
    entries.push({ name, data });
    at += 46 + nameLength;
  }
  return entries;
}

const png = name => new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from(name)]));
const image = path => ({ path, width: 360, height: 360 });

const project = createProject('내 첫 세트 ♥', '콩이');
project.canon.image = image('image-canon.png');
project.slots = project.slots.map(s => ({ ...s, referenceImages: [image('image-ref.png')] }));
for (const number of [3, 1, 7]) {
  project.slots[number - 1].finalImage = image(`image-final-${number}.png`);
  files.set(localFile(`image-final-${number}.png`).uri, png('final' + number));
}
files.set(localFile('image-canon.png').uri, png('canon'));
files.set(localFile('image-ref.png').uri, png('reference'));
// Painter working layers are separate files and must not reach the bundle either.
project.slots[0].work = { version: 1, activeLayerId: 'draw-1', layers: [{ id: 'draw-1', name: 'draw-1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: image('image-layer.png') }], references: [] };
files.set(localFile('image-layer.png').uri, png('layer'));

const entries = setEntries(project);
assert.deepEqual(entries.map(e => e.name), ['01.png', '03.png', '07.png'], 'slots come out in set order, gaps skipped');

const archive = readZip(buildZip(entries));
assert.deepEqual(archive.map(e => e.name), ['01.png', '03.png', '07.png']);
assert.deepEqual([...archive[0].data], [...png('final1')], 'payload survives the round trip');
for (const entry of archive) {
  assert.equal(Buffer.from(entry.data.slice(0, 8)).toString('hex'), '89504e470d0a1a0a', 'every entry is a PNG');
  const text = Buffer.from(entry.data).toString('utf8');
  for (const forbidden of ['canon', 'reference', 'layer']) assert.ok(!text.includes(forbidden), 'the bundle carries no ' + forbidden);
}

const result = exportSet(project);
assert.equal(result.count, 3);
assert.equal(result.missing, 32 - 3, 'the caller learns how many slots are still empty');
assert.equal(result.path, `set-emoticon-set-${project.id.slice(-6)}-3.zip`, 'a Korean title falls back to a name that still identifies the set');
const twin = createProject('다른 한글 이름', '두부');
twin.slots[0].finalImage = image('image-final-1.png');
assert.notEqual(exportSet(twin).path, result.path, 'two Korean-named sets do not collide');
assert.ok(files.has(localFile(result.path).uri), 'the bundle is written');
assert.ok(!/[^a-zA-Z0-9._-]/.test(result.path), 'no unsafe characters survive in the name');
assert.equal(safeName('   '), 'emoticon-set', 'an unusable name falls back');

const empty = createProject('빈 세트', '콩이');
assert.throws(() => exportSet(empty), /저장된 그림이 없습니다/, 'exporting nothing is refused, not silently empty');

console.log('PASS: zip structure parses, crc32 agrees with zlib, slot ordering, reference/canon/working layers excluded, safe file naming, empty set refused. File system mocked.');
