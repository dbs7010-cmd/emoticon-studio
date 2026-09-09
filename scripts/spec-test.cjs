// Submission checks grade the real exported PNG, and only defects the user can act on.
// Anything we could not verify is a note, never a verdict.
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');

const files = new Map();
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data) { files.set(this.uri, data); }
  bytesSync() { return files.get(this.uri); }
  textSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
const { inspectImage } = load('src/services/qa.ts');
const { localFile } = load('src/services/storage.ts');
const { setEntries } = load('src/services/export.ts');
const { createProject } = load('src/project.ts');
const SPEC = load('src/constants/kakao-spec.ts').KAKAO_STATIC_SPEC;

let seq = 0;
// Stands in for what the painter actually writes: a PNG whose header carries the canvas size.
const finalAsset = ({ width = SPEC.width, height = SPEC.height, transparent = true, coverage = .3, signature = true, exists = true } = {}) => {
  const path = `image-final-${++seq}.png`;
  const bytes = Buffer.alloc(64);
  Buffer.from(signature ? [137, 80, 78, 71, 13, 10, 26, 10] : [0, 0, 0, 0, 0, 0, 0, 0]).copy(bytes);
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  bytes.writeUInt32BE(seq, 40); // every asset carries distinct payload bytes
  if (exists) files.set(localFile(path).uri, new Uint8Array(bytes));
  return { path, width, height, metrics: { coverage, centerX: .5, centerY: .5, width: .5, height: .5, color: [.2, .2, .2], transparent } };
};
const canon = finalAsset();
const grade = options => inspectImage(finalAsset(options), canon);
const failing = qa => [...qa.checks, ...qa.consistency].filter(c => c.status !== 'PASS');

// A drawing with nothing wrong with it must pass. This is the whole point.
const good = grade();
assert.equal(good.status, 'PASS', 'a flawless final PNG passes');
assert.deepEqual(failing(good), [], 'and raises no check at all');
assert.ok(good.notes.length > 0, 'what we could not verify is still reported, as a note');
assert.ok(good.notes.some(n => n.includes('공식')), 'the unconfirmed official spec is one of those notes');

// Real defects still fail. The fix must not have softened anything.
const wrongSize = grade({ width: 512, height: 512 });
assert.equal(wrongSize.status, 'FAIL', 'a canvas that is not the working size fails');
assert.ok(failing(wrongSize).some(c => c.detail.includes('512') && c.detail.includes(String(SPEC.width))), 'and says both the actual and the expected size');
assert.equal(grade({ transparent: false }).status, 'FAIL', 'an opaque background fails');
assert.equal(grade({ coverage: 0 }).status, 'FAIL', 'an empty drawing fails');
assert.equal(grade({ signature: false }).status, 'FAIL', 'a file that is not a PNG fails');
assert.equal(grade({ exists: false }).status, 'FAIL', 'a missing file fails');
assert.equal(inspectImage(undefined, canon).status, 'FAIL', 'a slot with no drawing fails');

// Uncertainty on our side must never be charged to the user.
assert.equal(SPEC.policyStatus, 'UNVERIFIED', 'the official spec is still unconfirmed');
assert.equal(SPEC.maxBytes, null, 'and so is the size limit');
assert.equal(inspectImage(finalAsset(), undefined).status, 'PASS', 'having no canon to compare against is not a defect');
assert.ok(inspectImage(finalAsset(), undefined).notes.some(n => n.includes('원캐릭터')), 'it is reported as a note instead');
for (const qa of [good, wrongSize, inspectImage(finalAsset(), undefined)]) {
  for (const check of [...qa.checks, ...qa.consistency]) {
    assert.ok(!/^[A-Z][A-Z_]+$/.test(check.label), 'labels read as Korean, not as codes: ' + check.label);
    assert.ok(/[가-힣]/.test(check.detail), 'every message is in Korean: ' + check.detail);
    assert.ok(!check.detail.includes('UNVERIFIED'), 'internal status words never reach the user: ' + check.detail);
  }
}

// Preview, QA and export must all judge and ship the very same file.
const project = createProject('한 세트', '콩이');
const shipped = finalAsset();
project.slots[0].finalImage = shipped;
project.slots[0].work = { version: 1, activeLayerId: 'draw-1', layers: [{ id: 'draw-1', name: 'draw-1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: finalAsset() }], references: [] };
const bundled = setEntries(project);
assert.equal(bundled.length, 1);
assert.deepEqual([...bundled[0].data], [...files.get(localFile(shipped.path).uri)], 'export ships the same bytes QA inspected, not the working layer');
assert.equal(inspectImage(project.slots[0].finalImage, canon).status, 'PASS', 'and that same file is what QA grades');

console.log('PASS: a flawless final passes, real defects still fail, unverifiable policy stays a note, messages are Korean, and QA and export judge the same asset. File system mocked.');
