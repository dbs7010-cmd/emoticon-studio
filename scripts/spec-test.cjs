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
  async bytes() { return this.bytesSync(); }
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
const grade = options => inspectImage(finalAsset(options));
const failing = qa => [...qa.checks, ...qa.consistency].filter(c => c.status !== 'PASS');

// A drawing with nothing wrong with it must pass. This is the whole point.
const good = grade();
assert.equal(good.status, 'PASS', 'a flawless final PNG passes');
assert.deepEqual(failing(good), [], 'and raises no check at all');
assert.ok(good.notes.length > 0, 'what we could not verify is still reported, as a note');
assert.ok(good.notes.some(n => n.includes('눈으로 확인')), 'what a person still has to judge is said out loud');

// Real defects still fail. The fix must not have softened anything.
const wrongSize = grade({ width: 512, height: 512 });
assert.equal(wrongSize.status, 'FAIL', 'a canvas that is not the working size fails');
assert.ok(failing(wrongSize).some(c => c.detail.includes('512') && c.detail.includes(String(SPEC.width))), 'and says both the actual and the expected size');
assert.equal(grade({ transparent: false }).status, 'FAIL', 'an opaque background fails');
assert.equal(grade({ coverage: 0 }).status, 'FAIL', 'an empty drawing fails');
assert.equal(grade({ signature: false }).status, 'FAIL', 'a file that is not a PNG fails');
assert.equal(grade({ exists: false }).status, 'FAIL', 'a missing file fails');
assert.equal(inspectImage(undefined).status, 'FAIL', 'a slot with no drawing fails');

// The guide was read, so the ceilings are real and enforced.
assert.equal(SPEC.policyStatus, 'VERIFIED', 'the official spec has been read');
assert.equal(SPEC.maxBytes, 150 * 1024, '멈춰있는 이모티콘은 150KB 이하');
assert.equal(SPEC.count, 32);
const ANIMATED = load('src/constants/kakao-spec.ts').KAKAO_ANIMATED_SPEC;
assert.equal(ANIMATED.maxBytes, 650 * 1024, '움직이는 이모티콘은 650KB 이하');
assert.equal(ANIMATED.count, 24);
assert.equal(ANIMATED.maxFrames, 24);
assert.equal(ANIMATED.format, 'WebP', '제출 형식은 WebP이고 우리가 쓰는 GIF가 아니다');
// A file over the ceiling has to fail, and the same file passes under the moving ceiling.
{
  const big = finalAsset();
  files.set(localFile(big.path).uri, new Uint8Array(Buffer.concat([Buffer.from(files.get(localFile(big.path).uri)), Buffer.alloc(200 * 1024)])));
  const asStill = inspectImage(big), asMoving = inspectImage(big, ANIMATED);
  assert.equal(asStill.status, 'FAIL', '150KB를 넘으면 멈춰있는 규격에서 떨어진다');
  assert.ok(asStill.checks.some(c => c.label === '파일 크기' && c.status === 'FAIL'), '이유가 파일 크기라고 말한다');
  assert.equal(asMoving.status, 'PASS', '같은 파일이 움직이는 규격 650KB 안에서는 통과한다');
}
// Character consistency is a person's judgement. The app says so and scores nothing.
assert.deepEqual(good.consistency, [], 'nothing about the artwork itself is graded');
assert.ok(good.notes.some(n => n.includes('눈으로 확인')), 'it is handed to the user as a look-at-it note');
for (const qa of [good, wrongSize]) {
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
assert.equal(inspectImage(project.slots[0].finalImage).status, 'PASS', 'and that same file is what QA grades');

// Two cuts that exported the very same bytes are pointed out, and nothing is changed for the user.
const { identicalFinals } = load('src/services/qa.ts');
project.slots[1].finalImage = shipped;
assert.deepEqual(identicalFinals(project), [[1, 2]], 'identical exports are reported as a pair');
project.slots[1].motion = { version: 1, preset: 'bounce', speed: .5, strength: .5 };
assert.deepEqual(identicalFinals(project), [], 'same still picture but a different motion is not a duplicate');
delete project.slots[1].motion;
project.slots[1].finalImage = finalAsset();
assert.deepEqual(identicalFinals(project), [], 'different drawings are not');

console.log('PASS: a flawless final passes, real defects still fail, 공식 가이드에서 읽은 용량·개수·형식이 실제로 강제되고, artwork judgement is never scored, identical exports are reported, messages are Korean, and QA and export judge the same asset. File system mocked.');
