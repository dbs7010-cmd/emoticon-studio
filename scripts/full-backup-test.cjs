// 전체 백업·복원(2026-10-06): 모든 세트 + 앱 설정을 한 파일로. 구매 권한은 파일로 옮겨지지 않는다.
// 지금 저장소를 덮어쓰지 않고 더하기만 한다(세트는 새로·같으면 사본, 목록은 없는 것만 상한까지, 한 값 설정은 비었을 때만).
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
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
const { createProject, parseStore, storeImagePaths } = load('src/project.ts');
const { localFile, exportUri } = load('src/services/storage.ts');
const { readZip } = load('src/services/backup.ts');
const { buildZip } = load('src/services/export.ts');
const { buildFullBackup, writeFullBackup, readFullBackup, restoreFullBackup, isFullBackup } = load('src/services/full-backup.ts');

const png = tag => new Uint8Array([0x89, 0x50, 0x4E, 0x47, ...Buffer.from(tag)]);
const put = (path, tag) => { localFile(path).write(png(tag)); return { path, width: 360, height: 360 }; };

// ── 원래 기기 ───────────────────────────────────────────────────────────────────────────────
const a = createProject('몽이의 하루', '몽이');
a.slots[0].finalImage = put('image-a1.png', 'a1');
const b = createProject('두부 세트', '두부');
b.slots[0].finalImage = put('image-b1.png', 'b1');
const trashed = createProject('지운 세트', '콩');
trashed.slots[0].finalImage = put('image-t1.png', 't1');
trashed.deletedAt = '2026-10-01T00:00:00.000Z';
const motion = { version: 1, preset: 'bounce', speed: .5, strength: .5 };
const source = {
  version: 1, revision: 9, projects: [a, b, trashed],
  palette: ['#111111', '#222222'], userPalette: ['#FF0000'], paperTexture: true, introDone: true,
  savedMotions: [{ id: 'm1', name: '통통 약하게', motion }],
  cutouts: [{ id: 'c1', name: '손', image: put('image-cut-1.png', 'cut1') }],
  favoriteBrushes: ['pen', 'pencil', 'marker'],
  entitlement: { plan: 'lifetime', source: 'store', verified: true, checkedAt: '2026-10-01T00:00:00.000Z' },
  reviewUnlock: true,
};
parseStore(JSON.stringify(source));   // 시험 자료 자체가 올바른 저장소다

const made = writeFullBackup(source, new Date(2026, 9, 6, 9, 0, 0));
assert.ok(/^set-all-backup-20261006-090000\.zip$/.test(made.path), '전체 백업 파일 이름: ' + made.path);
assert.equal(made.sets, 2, '휴지통 세트는 담지 않는다');
assert.equal(made.missing, 0);
const archive = files.get(exportUri(made.path));
assert.ok(isFullBackup(archive), '전체 백업으로 알아본다');
const meta = JSON.parse(new TextDecoder().decode(readZip(archive).find(e => e.name === 'full-backup.json').data));
assert.equal(meta.settings.entitlement, undefined, '구매 권한은 파일에 쓰지 않는다');
assert.equal(meta.settings.reviewUnlock, undefined, '검수 해제도 쓰지 않는다');
assert.ok(!JSON.stringify(meta).includes('lifetime'), '이용권 흔적이 파일 어디에도 없다');
const names = readZip(archive).map(e => e.name);
for (const p of ['image-a1.png', 'image-b1.png', 'image-cut-1.png']) assert.ok(names.includes('images/' + p), p + ' 담김');
assert.ok(!names.includes('images/image-t1.png'), '휴지통 세트의 그림은 담지 않는다');

// ── 새 기기(빈 저장소, PRO 없음)에서 되살리기 ───────────────────────────────────────────────────
files.clear();
const fresh = { version: 1, revision: 1, projects: [] };
const r1 = restoreFullBackup(archive, fresh, new Date('2026-10-07T00:00:00Z'));
assert.equal(r1.sets, 2); assert.equal(r1.copies, 0);
assert.deepEqual(r1.store.projects.map(p => p.projectName), ['몽이의 하루', '두부 세트']);
assert.equal(r1.store.entitlement, undefined, '백업에서 PRO 가 열리지 않는다(구매 복원으로만)');
assert.equal(r1.store.reviewUnlock, undefined);
assert.equal(r1.store.paperTexture, true, '빈 기기에는 설정이 채워진다');
assert.deepEqual(r1.store.favoriteBrushes, ['pen', 'pencil', 'marker']);
assert.equal(r1.store.savedMotions.length, 1); assert.equal(r1.store.cutouts.length, 1); assert.deepEqual(r1.store.userPalette, ['#FF0000']);
assert.equal(r1.store.introDone, true);
for (const path of storeImagePaths(r1.store)) assert.ok(localFile(path).exists, '가리키는 그림이 모두 있다: ' + path);
assert.ok(!storeImagePaths(r1.store).has('image-a1.png'), '그림은 새 이름으로 쓴다(덮어쓰기 없음)');
parseStore(JSON.stringify(r1.store));

// ── 이미 쓰던 기기(같은 세트·다른 설정·PRO 있음)에 되살리기: 아무것도 덮어쓰지 않는다 ─────────────────
const mine = {
  version: 1, revision: 5, projects: [r1.store.projects[0]],
  paperTexture: false, favoriteBrushes: ['marker'], userPalette: ['#00FF00'],
  savedMotions: [{ id: 'm9', name: '내 것', motion }], cutouts: [],
  entitlement: { plan: 'lifetime', source: 'store', verified: true },
};
const r2 = restoreFullBackup(archive, mine, new Date('2026-10-08T00:00:00Z'));
assert.equal(r2.store.projects[0], mine.projects[0], '지금 세트는 그대로 앞에 있다');
assert.equal(r2.copies, 1, '같은 세트는 사본으로 들어온다');
assert.ok(r2.store.projects.some(p => p.projectName === '몽이의 하루 (복원)'));
assert.equal(r2.store.paperTexture, false, '정해 둔 설정은 백업이 바꾸지 않는다');
assert.deepEqual(r2.store.favoriteBrushes, ['marker']);
assert.deepEqual(r2.store.userPalette, ['#00FF00', '#FF0000'], '색은 지금 것 뒤에 없는 것만');
assert.deepEqual(r2.store.savedMotions.map(m => m.id), ['m9', 'm1']);
assert.deepEqual(r2.store.entitlement, mine.entitlement, '지금 기기의 구매 권한은 그대로');

// 상한: 보관한 움직임이 이미 12개면 더 넣지 않고 몇 개 못 넣었는지 말한다
const full = { ...mine, savedMotions: Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, name: 'x' + i, motion })) };
const r3 = restoreFullBackup(archive, full);
assert.equal(r3.store.savedMotions.length, 12); assert.equal(r3.skipped.savedMotions, 1);

// ── 고친 파일: 이용권을 끼워 넣어도 읽지 않는다 ─────────────────────────────────────────────────
const entries = readZip(archive);
const tampered = entries.map(e => e.name === 'full-backup.json'
  ? { name: e.name, data: new TextEncoder().encode(JSON.stringify({ ...meta, settings: { ...meta.settings, entitlement: { plan: 'lifetime', source: 'store', verified: true }, reviewUnlock: true } })) }
  : e);
const r4 = restoreFullBackup(buildZip(tampered), fresh);
assert.equal(r4.store.entitlement, undefined, '파일에 이용권을 넣어도 PRO 가 열리지 않는다');
assert.equal(r4.store.reviewUnlock, undefined);

// ── 손상된 파일: 검사에서 멈추고 아무것도 쓰지 않는다 ───────────────────────────────────────────
const before = files.size;
const broken = archive.slice(); broken[broken.length - 200] ^= 0xFF;
assert.throws(() => restoreFullBackup(broken, fresh));
const lost = buildZip(entries.filter(e => e.name !== 'images/image-b1.png'));
assert.throws(() => restoreFullBackup(lost, fresh), /빠져 있어요/, '그림이 빠지면 거절');
assert.equal(files.size, before, '거절하면 그림을 하나도 쓰지 않는다');
assert.throws(() => readFullBackup(files.get(exportUri(made.path)) ?? buildZip([{ name: 'backup.json', data: new Uint8Array([123, 125]) }])), /전체 백업 파일이 아니에요|백업/);
assert.equal(isFullBackup(buildZip([{ name: 'backup.json', data: new Uint8Array([123, 125]) }])), false, '세트 백업은 전체 백업이 아니다');

console.log('PASS: full backup — every live set + settings (palettes, saved motions, cutouts, favourite brushes, paper, guide) in one file; never carries PRO entitlement or review unlock (even if injected); restore adds without overwriting (sets as copies, lists merged under caps, single settings only when unset); damaged or incomplete files write nothing');
