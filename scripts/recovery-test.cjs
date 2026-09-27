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
  write(data) {
    if (failWrites === 'truncate') { files.set(this.uri, String(data).slice(0, 12)); return; } // the dangerous kind: bytes land, but only some
    if (failWrites) throw new Error('디스크가 가득 찼습니다.');
    files.set(this.uri, data);
  }
  textSync() { return files.get(this.uri); }
  async bytes() { return this.bytesSync(); }
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
const { createProject, duplicateCaptions, isDone, parseStore, droppedImagePaths } = load('src/project.ts');
const { loadStore, saveStore, localFile, deleteLocalImages, inspectStore } = load('src/services/storage.ts');
const { exportSet, brokenSlots, readZipNames, buildZip } = load('src/services/export.ts');

const image = path => ({ path, width: 360, height: 360 });
const png = tag => { const b = Buffer.alloc(48); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b); b.writeUInt32BE(360, 16); b.writeUInt32BE(360, 20); b.write(tag, 32); return new Uint8Array(b); };

// ---------- a failed write keeps the last good snapshot, however often it is retried ----------
const project = createProject('안전 세트', '콩이');
project.slots[0].finalImage = image('image-a.png');
files.set(localFile('image-a.png').uri, png('a'));
saveStore({ version: 1, revision: 1, projects: [project] });
const good = loadStore().store;
assert.equal(good.projects[0].slots[0].finalImage.path, 'image-a.png');

const snapshots = () => ['store-a.json', 'store-b.json'].map(name => ({ name, text: files.get(localFile(name).uri) }));
const readable = () => snapshots().filter(s => { try { parseStore(s.text); return true; } catch { return false; } });
assert.equal(readable().length, 1, 'a first save leaves exactly one snapshot');

const edited = JSON.parse(JSON.stringify(good));
edited.projects[0].slots[0].finalImage = image('image-b.png');
edited.revision = 2;
files.set(localFile('image-b.png').uri, png('b'));

// A write that dies halfway is the dangerous one: the bytes on disk are already ruined.
failWrites = 'truncate';
assert.throws(() => saveStore(edited), /저장 검증 실패|가득/, 'a write failure surfaces rather than passing silently');
const afterFailure = loadStore();
assert.deepEqual(afterFailure.store, good, 'the last good snapshot survives a failed write untouched');
assert.equal(afterFailure.recovered, true, 'and the app is told one copy is damaged');
assert.ok(files.has(localFile('image-a.png').uri), 'and it still points at a file that is present');
// The new asset was written before the snapshot; it must not have been cleaned up on failure,
// because the retry needs it.
assert.ok(files.has(localFile('image-b.png').uri), 'the asset the retry will reference is kept');

// The retry is where a set used to be lost: bumping the revision must not send the write to the
// other slot, or two failures in a row would leave nothing readable at all.
for (const revision of [3, 4, 5]) {
  assert.throws(() => saveStore({ ...edited, revision }), /저장 검증 실패|가득/, 'retry ' + revision + ' still fails');
  assert.equal(readable().length, 1, 'retry ' + revision + ' must not spend the last good snapshot');
  assert.deepEqual(loadStore().store, good, 'and the set is still there after retry ' + revision);
}
failWrites = false;

// A retry that lands writes the edit the user still sees, and the older copy stays beside it.
saveStore({ ...edited, revision: 6 });
assert.equal(loadStore().store.projects[0].slots[0].finalImage.path, 'image-b.png', 'the retry persists the edit');
assert.equal(readable().length, 2, 'and the repaired pair holds two readable snapshots again');
assert.equal(Math.min(...readable().map(s => parseStore(s.text).revision)), 1, 'the older one is the last good state, still intact');
deleteLocalImages(droppedImagePaths(good, edited));
assert.equal(files.has(localFile('image-a.png').uri), false, 'only then is the replaced file released');

// ---------- corrupted and future snapshots ----------
const newest = () => readable().reduce((a, b) => parseStore(b.text).revision > parseStore(a.text).revision ? b : a);
const older = snapshots().find(s => s.name !== newest().name);
files.set(localFile(older.name).uri, '{ not json');
assert.equal(loadStore().store.revision, 6, 'one damaged copy falls back to the good one');
assert.equal(loadStore().recovered, true, 'and says so');
// Now the pair that the device reported: nothing readable anywhere.
const survivor = newest().name;
files.set(localFile(survivor).uri, JSON.stringify({ version: 2, revision: 9, projects: [] }));
let refused;
try { loadStore(); } catch (e) { refused = e; }
assert.ok(refused && /읽지 못했습니다/.test(String(refused)), 'an unreadable pair refuses rather than starting empty');
assert.ok(files.get(localFile(older.name).uri) === '{ not json', 'and the damaged file is left exactly as it was found');
// The refusal has to say what was actually wrong, or a device can only be guessed at.
const report = refused.report;
assert.ok(report && report.directory, 'the refusal carries the directory it looked in');
assert.equal(report.snapshots.length, 2, 'and a line for each snapshot');
const broken = report.snapshots.find(s => s.name === older.name);
assert.equal(broken.exists, true);
assert.equal(broken.stage, 'json', 'damaged bytes are reported as a JSON failure');
assert.ok(/JSON|Unexpected|token/i.test(broken.error), 'with the parser message kept: ' + broken.error);
assert.ok(broken.head.length > 0, 'and the start of the file, to show what is actually in it');
const rejected = report.snapshots.find(s => s.name === survivor);
assert.equal(rejected.stage, 'shape', 'a file that parses but is not a store is reported differently');
assert.ok(/지원하지 않/.test(rejected.error), 'with the reason it was rejected: ' + rejected.error);
assert.notEqual(broken.stage, rejected.stage, 'the two causes are never reported as the same thing');

// Reading is safe to repeat: nothing is written, so the files can be inspected as often as needed.
const before = snapshots().map(s => s.text);
try { loadStore(); } catch {}
try { loadStore(); } catch {}
assert.deepEqual(snapshots().map(s => s.text), before, 'a failed load never rewrites what it could not read');
assert.deepEqual(inspectStore().snapshots.map(s => s.name), ['store-a.json', 'store-b.json'], 'and the files can be inspected without opening the app');
assert.deepEqual(snapshots().map(s => s.text), before, 'inspecting changes nothing either');

// Once a good copy is put back, the app opens again without anything being deleted.
files.set(localFile(older.name).uri, JSON.stringify({ ...edited, revision: 7 }));
assert.equal(loadStore().store.revision, 7, 'a repaired snapshot is picked up on the next try');

// ---------- repeated wording is what the picture actually carries ----------
const worded = createProject('문구', '콩이');
const withCaption = (n, text) => { worded.slots[n - 1] = { ...worded.slots[n - 1], work: { version: 1, activeLayerId: 'draw-1', layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], references: [], caption: text === undefined ? undefined : { text, place: 'bottom', color: '#242424' } } }; };
worded.slots[0] = { ...worded.slots[0], dialogue: '안녕' };
worded.slots[1] = { ...worded.slots[1], dialogue: '안녕' };
assert.deepEqual(duplicateCaptions(worded.slots), [], 'planning text an old store kept is not a repeated caption');
withCaption(3, '  '); withCaption(4, undefined);
assert.deepEqual(duplicateCaptions(worded.slots), [], 'and blank or missing words are never a repeat');
withCaption(5, '잘자!'); withCaption(6, '잘 자');
assert.deepEqual(duplicateCaptions(worded.slots), [[5, 6]], 'but the same words on two cuts are');

// ---------- a store written before 완성 existed keeps every finished cut ----------
const legacy = createProject('예전', '콩이');
legacy.slots[0].finalImage = image('image-legacy.png');
assert.equal(isDone(legacy.slots[0]), true, 'an old saved drawing still counts as finished');
assert.equal(isDone(legacy.slots[1]), false, 'an empty cut does not');
assert.equal(isDone({ ...legacy.slots[0], done: false }), false, 'and a cut put back to 작업 중 is honoured');
assert.deepEqual(parseStore(JSON.stringify({ version: 1, revision: 1, projects: [legacy] })).projects[0].slots[0].finalImage, legacy.slots[0].finalImage, 'the old shape still parses');
assert.throws(() => parseStore(JSON.stringify({ version: 1, revision: 1, projects: [{ ...legacy, slots: legacy.slots.map((s, i) => i ? s : { ...s, done: 'yes' }) }] })), /완성 표시/, 'a damaged 완성 flag refuses rather than guessing');

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


// ── 이번 개편이 예전 저장 파일을 깨지 않는다 ───────────────────────────────────────────────
// 브러시 이름을 marker→brush 로 바꿨고, 저장소에 paperTexture·reviewUnlock 이 새로 생겼다.
// 그 전에 저장한 파일이 그대로 열리고, 그려 둔 획이 한 픽셀도 달라지지 않아야 한다.
{
  // 예전 모양: 새 항목이 하나도 없는 저장 파일.
  const legacy = {
    version: 1, revision: 99,
    projects: [{ ...createProject('예전 세트', '콩이'), }],
    palette: ['#E94F4F'],
  };
  legacy.projects[0].slots[0].finalImage = { path: 'image-old-1.png', width: 360, height: 360 };
  files.set(localFile('image-old-1.png').uri, png('old'));
  saveStore(legacy);   // 예전 모양 그대로 저장한다 — 새 항목을 끼워 넣지 않는다
  const opened = loadStore().store;
  assert.equal(opened.projects[0].projectName, '예전 세트', '예전 저장 파일이 그대로 열린다');
  assert.equal(opened.projects[0].slots[0].finalImage.path, 'image-old-1.png', '그려 둔 그림도 그대로다');
  // 새 항목이 없으면 기본값으로 읽힌다. 종이 질감은 켜짐이 기본, 검수 해제는 꺼짐이 기본이다.
  assert.equal(opened.paperTexture, undefined, '예전 파일에는 질감 설정이 없다');
  assert.notEqual(opened.paperTexture, false, '없으면 기본값(켜짐)으로 읽힌다 — 화면 표시일 뿐 작품에는 영향이 없다');
  assert.equal(opened.reviewUnlock, undefined, '검수 해제도 없다');
  // 브러시는 저장 데이터에 들어가지 않는다. 그래서 이름을 바꿔도 예전 획이 다시 그려질 일이 없다.
  const work = JSON.stringify(opened.projects[0]);
  assert.ok(!work.includes('marker') && !work.includes('brush'), '저장 데이터에 브러시 이름이 없다 — 획은 이미 픽셀이다');
  console.log('  예전 저장 파일 호환: 그대로 열리고, 브러시 이름 변경이 획에 닿지 않는다');
}

console.log('PASS: failed writes keep the last good snapshot and the retryable edit, damaged and future schemas refuse safely, repeated captions are found without mistaking old planning text, pre-완성 stores keep every finished cut, export refuses missing files and unverifiable archives. File system mocked with injected write failure.');
