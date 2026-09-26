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
const { buildZip, crc32, setEntries, exportSet, safeName, exportFormatSummary } = load('src/services/export.ts');

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

// ── 제출 형식이 묶음에 들어간다 ─────────────────────────────────────────────────────────────
// 카카오는 움직이는 이모티콘을 WebP 로 받는다. 움직이는 컷은 WebP 가 있으면 그것이, 없으면 작업용
// GIF 가, 멈춘 컷은 PNG 가 들어가야 한다. 이름과 확장자가 실제 내용과 맞아야 한다.
{
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8X')]);
  files.set(localFile('image-submit-2.webp').uri, [...webp]);
  files.set(localFile('image-move-2.gif').uri, [...Buffer.from('GIF89a')]);
  files.set(localFile('image-move-4.gif').uri, [...Buffer.from('GIF89a')]);
  const mixed = createProject('섞인 세트', '콩이');
  mixed.slots[0].finalImage = image('image-final-1.png');
  mixed.slots[1].finalImage = image('image-final-2.png');
  mixed.slots[1].motionImage = image('image-move-2.gif');
  mixed.slots[1].submitImage = image('image-submit-2.webp');
  mixed.slots[3].finalImage = image('image-final-4.png');
  mixed.slots[3].motionImage = image('image-move-4.gif');   // WebP 를 못 만든 컷
  const names = setEntries(mixed).map(e => e.name);
  assert.deepEqual(names, ['01.png', '02.webp', '04.gif'], '움직이는 컷은 WebP, 못 만든 컷은 GIF, 멈춘 컷은 PNG: ' + names.join(' '));
  const bundle = readZip(buildZip(setEntries(mixed)));
  const submitted = bundle.find(e => e.name === '02.webp');
  assert.equal(Buffer.from(submitted.data.slice(0, 4)).toString('ascii'), 'RIFF', '02.webp 의 내용이 실제로 WebP 다');
  assert.equal(Buffer.from(submitted.data.slice(8, 12)).toString('ascii'), 'WEBP', '그리고 WEBP 형식이다');
  const fallback = bundle.find(e => e.name === '04.gif');
  assert.equal(Buffer.from(fallback.data.slice(0, 6)).toString('ascii'), 'GIF89a', '04.gif 는 작업용 GIF 그대로다');
  // 45.38: 화면의 '파일 형식' 안내는 ZIP 에 실제로 들어가는 파일과 같은 수를 말한다(예전 안내는 'WebP · 나머지 PNG').
  assert.equal(exportFormatSummary(mixed), 'PNG 1개 · WebP 1개 · GIF 1개', '형식 안내가 묶음 내용과 같다: ' + exportFormatSummary(mixed));
  assert.equal(exportFormatSummary(createProject('빈 세트', '콩이')), '아직 만든 파일이 없어요', '만든 파일이 없으면 그렇게 말한다');
}

// ── GIF 가 조용히 섞이지 않는다 ─────────────────────────────────────────────────────────────
// 카카오가 받는 움직이는 형식은 WebP 뿐이다. WebP 를 만들지 못한 컷이 묶음에 들어갈 때, 그 사실이
// 파일 이름(.gif)에 드러나야 하고 부르는 쪽이 몇 칸인지 셀 수 있어야 한다. 조용히 섞이면 안 된다.
{
  const half = createProject('반만 된 세트', '콩이');
  half.slots[0].finalImage = image('image-final-1.png');
  half.slots[0].motionImage = image('image-move-2.gif');
  half.slots[0].submitImage = image('image-submit-2.webp');
  half.slots[1].finalImage = image('image-final-2.png');
  half.slots[1].motionImage = image('image-move-4.gif');     // WebP 실패
  const names = setEntries(half).map(e => e.name);
  const gifs = names.filter(n => n.endsWith('.gif'));
  assert.deepEqual(gifs, ['02.gif'], 'WebP 를 못 만든 컷은 .gif 로 드러난다 — 이름이 내용을 숨기지 않는다');
  assert.ok(!names.some(n => n.endsWith('.webp') && n === '02.webp'), '실패한 컷이 webp 이름을 달고 나가지 않는다');
  // 부르는 쪽이 셀 수 있어야 화면이 "N칸은 WebP 가 아니에요"라고 말할 수 있다.
  const animated = half.slots.filter(s => s.motionImage).length;
  const submitReady = half.slots.filter(s => s.submitImage).length;
  assert.equal(animated - submitReady, 1, '움직이는 칸 중 제출 형식이 없는 칸을 셀 수 있다');
}

// ── 공식 도구로 넘기는 묶음 ─────────────────────────────────────────────────────────────────
// WebPAnimator 는 360×360 PNG 를 순서대로 받는다(확인 2026-09-12: accept="image/png,image/webp").
// 프레임은 **저장해 둔 파일이 아니라 내보내는 순간 지금 그림·움직임에서 만든 것**을 받는다.
// 그래야 (1) 저장할 때마다 24장을 쓰지 않고 (2) 고치거나 순서를 바꾼 뒤 옛 프레임이 섞이지 않는다.
{
  const { animatorNote, decodeDataUrl } = load('src/services/export.ts');
  const { reorderSlots } = load('src/project.ts');
  for (const n of ['image-icon.png', 'image-share.png']) files.set(localFile(n).uri, [...png(n)]);
  // 프레임은 파일을 거치지 않는다. 만든 바이트가 그대로 묶음에 들어간다.
  const frames = (tag, count) => Array.from({ length: count }, (_, i) => png(tag + '-' + (i + 1)));

  const handoff = createProject('넘기는 세트', '콩이');
  handoff.slots[0].finalImage = image('image-final-1.png');
  handoff.slots[0].motionImage = image('image-move-2.gif');
  handoff.extras = { icon: image('image-icon.png'), share: image('image-share.png'), coverSlot: 1 };
  const baked = [{ number: 1, frames: frames('a', 3), delayMs: 80 }];
  const names = setEntries(handoff, baked).map(e => e.name);
  assert.ok(names.includes('icon.png'), '아이콘이 묶음에 들어간다');
  assert.ok(names.includes('share.png'), '공유 이미지도 들어간다');
  assert.deepEqual(names.filter(n => n.startsWith('webp-animator/01/')),
    ['webp-animator/01/01.png', 'webp-animator/01/02.png', 'webp-animator/01/03.png'],
    '컷 폴더 안에 프레임이 번호 순서대로 들어간다');
  assert.ok(names.includes('webp-animator/읽어주세요.txt'), '무엇을 해야 하는지 적은 쪽지가 함께 있다');
  // 넘긴 바이트가 그대로 실린다 — 중간에 다른 파일로 바뀌지 않는다.
  const first = setEntries(handoff, baked).find(e => e.name === 'webp-animator/01/01.png');
  assert.deepEqual([...first.data], [...baked[0].frames[0]], '묶음에 실린 프레임이 지금 만든 그 바이트다');

  const note = animatorNote(baked);
  assert.ok(note.includes('01번 · 3장 · 한 장당 80ms'), '컷마다 몇 장을 몇 초 간격으로 넣는지 적혀 있다: ' + note.split('\n').pop());
  assert.ok(note.includes('webp-animator'), '어느 폴더를 여는지 적혀 있다');
  assert.ok(!/자동|대신 변환|알아서/.test(note.replace('이 앱은 변환을 대신하지 않습니다.', '')), '앱이 대신 변환해 준다고 말하지 않는다');
  assert.ok(note.includes('변환을 대신하지 않습니다'), '오히려 대신하지 않는다고 분명히 적는다');

  // 1. 정지형으로 바꾼 뒤 — 움직임이 없으면 넘길 프레임도 없다. 폴더도 쪽지도 만들지 않는다.
  const still = setEntries(handoff, []).map(e => e.name);
  assert.ok(!still.some(n => n.startsWith('webp-animator/')), '정지형이 되면 옛 프레임이 남지 않는다: ' + still.join(' '));
  assert.equal(animatorNote([]), '', '쪽지도 만들지 않는다');

  // 2. 순서를 바꾼 뒤 — 폴더 번호는 지금 번호를 따른다. 1번 것이 3번 폴더에 그대로 남지 않는다.
  const moved = reorderSlots(handoff, 1, 3);
  assert.equal(moved.slots[2].motionImage?.path, 'image-move-2.gif', '움직이는 컷이 3번으로 갔다');
  const afterMove = setEntries(moved, [{ number: 3, frames: frames('a', 3), delayMs: 80 }]).map(e => e.name);
  assert.deepEqual(afterMove.filter(n => n.startsWith('webp-animator/')).slice(0, 3),
    ['webp-animator/03/01.png', 'webp-animator/03/02.png', 'webp-animator/03/03.png'],
    '바뀐 번호로 들어간다: ' + afterMove.filter(n => n.startsWith('webp-animator/')).join(' '));
  assert.ok(!afterMove.some(n => n.startsWith('webp-animator/01/')), '옛 번호 폴더가 함께 남지 않는다');

  // 3. 다시 저장해 움직임이 길어진 뒤 — 장수와 쪽지가 새 것으로만 채워진다. 섞이지 않는다.
  const again = setEntries(handoff, [{ number: 1, frames: frames('b', 5), delayMs: 60 }]);
  const kept = again.filter(e => e.name.startsWith('webp-animator/01/'));
  assert.equal(kept.length, 5, '새로 만든 5장만 들어간다: ' + kept.length);
  assert.deepEqual([...kept[0].data], [...png('b-1')], '3장짜리 옛 프레임이 첫 장에 남아 있지 않다');
  assert.ok(animatorNote([{ number: 1, frames: frames('b', 5), delayMs: 60 }]).includes('01번 · 5장 · 한 장당 60ms'),
    '쪽지의 숫자도 새 움직임을 가리킨다');

  // 4. 슬롯에 남겨 둔 옛 프레임이라는 것이 아예 없다 — 넘기지 않은 것은 묶음에 들어갈 길이 없다.
  handoff.slots[0].motionFrames = [image('image-icon.png')];  // 옛 모델 흉내
  const ignored = setEntries(handoff, []).map(e => e.name);
  assert.ok(!ignored.some(n => n.startsWith('webp-animator/')), '슬롯에 뭘 붙여 놔도 묶음에 들어가지 않는다');
  delete handoff.slots[0].motionFrames;

  // 프레임은 파일이 아니라 data URL 에서 바로 바이트로 푼다. 기기의 atob 에 기대지 않는다.
  const sample = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 250, 251, 252]);
  assert.deepEqual([...decodeDataUrl('data:image/png;base64,' + sample.toString('base64'))], [...sample],
    'data URL 을 그대로 되푼다');
  assert.deepEqual([...decodeDataUrl('data:image/png;base64,' + Buffer.from('a').toString('base64'))], [97], '패딩이 붙어도 길이가 맞다');
  assert.throws(() => decodeDataUrl('data:image/png,notbase64'), 'base64 가 아니면 조용히 넘기지 않는다');
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

console.log('PASS: zip structure parses, crc32 agrees with zlib, slot ordering, 부가 이미지와 공식 도구용 프레임 폴더·안내 쪽지, 제출 형식(WebP)이 묶음에 들어가고 못 만든 컷은 GIF 로 남는 것, reference/canon/working layers excluded, safe file naming, empty set refused. File system mocked.');
