// 세트 백업·복원(45.38): 만든 백업을 다른 기기(빈 저장소)에서 되살리면 칸·레이어·움직임·참고·그림이 그대로 돌아온다.
// 손상·다시 압축·경로 조작·그림 누락·다른 형식은 아무것도 쓰지 않고 거절한다.
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
  async bytes() { return this.bytesSync(); }
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
const { createProject, imagePaths } = load('src/project.ts');
const { localFile } = load('src/services/storage.ts');
const { buildZip, crc32 } = load('src/services/export.ts');
const { buildBackup, writeBackup, readBackup, restoreBackup, readZip, backupPaths } = load('src/services/backup.ts');

const png = tag => new Uint8Array([0x89, 0x50, 0x4E, 0x47, ...Buffer.from(tag)]);
const put = (path, tag) => { localFile(path).write(png(tag)); return { path, width: 360, height: 360 }; };

// ── 만들기 ─────────────────────────────────────────────────────────────────────────────────
const p = createProject('콩이 세트', '콩이');
p.canon.image = put('image-canon.png', 'canon');
p.slots[0].finalImage = put('image-final-1.png', 'final1');
p.slots[0].referenceImages = [put('image-ref-1.png', 'ref1')];
p.slots[0].work = { version: 1, activeLayerId: 'draw-1', caption: { text: '고마워', place: 'bottom', color: '#242424' },
  layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: put('image-layer-1.png', 'layer1') }],
  references: [{ id: 'ref-image-ref-1.png', name: '참고 1', visible: true, opacity: .3, x: 0, y: 0, scale: 1, rotation: 0, image: { path: 'image-ref-1.png', width: 360, height: 360 } }] };
p.slots[0].motion = { version: 1, preset: 'bounce', speed: .5, strength: .5 };
p.slots[0].motionImage = put('image-move-1.gif', 'gif1');
p.slots[0].done = true;
p.extras = { icon: put('image-icon.png', 'icon') };
const paths = backupPaths(p);
assert.deepEqual(paths, [...imagePaths(p), 'image-icon.png'].sort(), '백업은 세트가 가리키는 그림을 모두 담는다(부가 이미지 포함)');

const written = writeBackup(p, new Date('2026-09-27T10:00:00Z'));
assert.ok(/^set-backup-.+-20260927\.zip$/.test(written.path), '백업 파일 이름: ' + written.path);
assert.equal(written.images, paths.length, '담은 그림 수를 말한다');
assert.equal(written.missing, 0, '빠진 그림 없음');
const archive = localFile(written.path).bytesSync();
const names = readZip(archive).map(e => e.name);
assert.equal(names[0], 'backup.json', '백업 정보가 맨 앞');
assert.ok(paths.every(path => names.includes('images/' + path)), '그림이 images/ 아래에 모두 있다');

// ── 다른 기기(빈 저장소)에서 되살리기 ──────────────────────────────────────────────────────────
files.clear();
const back = restoreBackup(archive, [], new Date('2026-09-28T00:00:00Z'));
assert.equal(back.copy, false, '같은 세트가 없으면 원래 id 그대로');
assert.equal(back.project.id, p.id);
assert.equal(back.project.projectName, '콩이 세트');
assert.equal(back.images, paths.length, '그림 수가 같다');
const restoredPaths = [...backupPaths(back.project)];
assert.equal(restoredPaths.length, paths.length, '되살린 세트도 같은 수의 그림을 가리킨다');
assert.ok(restoredPaths.every(path => !paths.includes(path)), '그림은 새 이름으로 쓴다 — 있던 파일을 덮어쓰지 않는다');
for (const path of restoredPaths) assert.ok(files.has(localFile(path).uri), '가리키는 그림이 실제로 있다: ' + path);
const s0 = back.project.slots[0];
assert.equal(Buffer.from(files.get(localFile(s0.finalImage.path).uri)).subarray(4).toString(), 'final1', '완성 그림 내용이 같다');
assert.equal(Buffer.from(files.get(localFile(s0.work.layers[0].image.path).uri)).subarray(4).toString(), 'layer1', '작업 레이어 내용이 같다');
assert.equal(s0.work.references[0].image.path, s0.referenceImages[0].path, '참고 경로가 레이어와 목록에서 함께 바뀐다');
assert.deepEqual(s0.motion, p.slots[0].motion, '움직임 그대로');
assert.equal(s0.work.caption.text, '고마워', '문구 그대로');
assert.equal(s0.done, true, '완성 표시 그대로');
assert.ok(back.project.extras.icon.path !== 'image-icon.png' && files.has(localFile(back.project.extras.icon.path).uri), '부가 이미지도 되살린다');

// 같은 세트가 이미 있으면 덮어쓰지 않고 사본으로 들인다.
const again = restoreBackup(archive, [back.project], new Date('2026-09-28T00:00:01Z'));
assert.equal(again.copy, true, '같은 세트가 있으면 사본');
assert.notEqual(again.project.id, p.id, '사본은 새 id');
assert.equal(again.project.projectName, '콩이 세트 (복원)', '사본은 이름에 (복원)');
assert.equal(restoreBackup(archive, [back.project, again.project]).project.projectName, '콩이 세트 (복원 2)', '이름이 겹치면 번호');

// 휴지통 표시는 백업에 들어가지 않는다 — 되살린 세트가 곧바로 휴지통에 있으면 안 된다.
files.clear();
p.canon.image = put('image-canon.png', 'canon'); put('image-final-1.png', 'final1'); put('image-ref-1.png', 'ref1'); put('image-layer-1.png', 'layer1'); put('image-move-1.gif', 'gif1'); put('image-icon.png', 'icon');
assert.equal(readBackup(buildBackup({ ...p, deletedAt: new Date().toISOString() }).bytes).project.deletedAt, undefined, '휴지통 표시는 백업하지 않는다');

// ── 거절: 아무것도 쓰지 않는다 ────────────────────────────────────────────────────────────────
const refuse = (bytes, re, why) => {
  const before = files.size;
  assert.throws(() => restoreBackup(bytes, []), re, why);
  assert.equal(files.size, before, why + ' — 파일을 하나도 쓰지 않았다');
};
const good = buildBackup(p).bytes;
const broken = good.slice(); broken[good.length - 200] ^= 0xFF;
refuse(broken, /손상|깨졌/, '내용이 한 바이트라도 바뀌면 거절');
refuse(good.slice(0, good.length - 30), /끝까지|ZIP/, '잘린 파일 거절');
const meta = JSON.parse(new TextDecoder().decode(readZip(good)[0].data));
const zipWith = (m, extra = []) => buildZip([{ name: 'backup.json', data: new TextEncoder().encode(JSON.stringify(m)) }, ...readZip(good).slice(1), ...extra]);
refuse(zipWith({ ...meta, format: 'other-app' }), /백업 파일이 아니/, '다른 형식 거절');
refuse(zipWith({ ...meta, version: 2 }), /새 버전/, '새 버전 백업은 업데이트를 안내');
refuse(zipWith({ ...meta, project: { ...meta.project, slots: [] } }), /손상/, '세트 모양이 깨지면 거절');
refuse(zipWith(meta, [{ name: 'images/../store-a.json', data: new Uint8Array([1]) }]), /받을 수 없는 파일/, '경로 조작 거절');
refuse(buildZip(readZip(good).filter(e => e.name !== 'images/image-final-1.png')), /빠져/, '그림이 빠지면 거절');
// 다른 프로그램으로 다시 압축한 ZIP(방식 8)
const deflated = good.slice(); { const v = new DataView(deflated.buffer); const end = deflated.length - 22; const cd = v.getUint32(end + 16, true); v.setUint16(cd + 10, 8, true); }
refuse(deflated, /다시 압축/, '다시 압축한 파일은 이유를 말하고 거절');
// 기기에서 이미 사라진 그림: 백업은 막지 않고 적어 둔다. 되살리면 그 자리만 원래처럼 비어 있고 나머지는 모두 돌아온다.
files.delete(localFile('image-final-1.png').uri);
const partial = buildBackup(p);
assert.deepEqual(partial.missing, ['image-final-1.png'], '사라진 그림을 적어 둔다');
assert.equal(partial.images, paths.length - 1, '있는 그림은 모두 담는다');
const fromPartial = restoreBackup(partial.bytes, []);
assert.equal(fromPartial.images, paths.length - 1, '적어 둔 누락은 되살리기를 막지 않는다');
assert.equal(fromPartial.project.slots[0].finalImage.path, 'image-final-1.png', '사라진 그림의 자리는 원래처럼 남는다');
assert.equal(crc32(new Uint8Array([1, 2, 3])) > 0, true);

console.log('PASS: backup — 세트 하나를 ZIP 하나로(정보 + 가리키는 그림 전부), 빈 저장소에서 되살리면 칸·레이어·문구·움직임·참고·완성·부가 이미지와 그림 내용이 그대로, 기기에서 이미 사라진 그림은 적어 두고 나머지를 담음, 그림은 새 이름(덮어쓰기 없음), 같은 세트가 있으면 (복원) 사본, 휴지통 표시 제외. 손상·잘림·다른 형식·새 버전·깨진 세트·경로 조작·적히지 않은 그림 누락·재압축은 아무것도 쓰지 않고 거절. File system mocked.');
