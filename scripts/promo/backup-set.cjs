// 홍보 캡처용 세트 '몽이의 하루'를 앱의 백업 파일(설정 › 백업에서 되살리기)로 만든다.
// 앱과 같은 코드(src/services/backup.ts 의 writeBackup·readBackup·restoreBackup)를 그대로 써서 만들고 검사한다 —
// 손으로 짠 ZIP 이 아니다. 몽이 12종 = 1~12칸(완성 표시), 13칸부터는 비어 있다(완성으로 표시하지 않는다).
//   1 안녕   : 몸·손 두 레이어 + PRO 부분 움직임(손 레이어 회전) + 엔진 GIF(part-wave-hello)
//   2 신나   : 통통(bounce) + 엔진 GIF(bounce-excited)
//   11 삐짐  : 흔들기(shake) + 엔진 GIF(shake-pouty)
// 사용: node scripts/promo/backup-set.cjs <나갈 폴더>
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { loader } = require('../load-ts.cjs');
const C = require('./character.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || 'verification/promo/backup');
fs.mkdirSync(out, { recursive: true });

// 앱 저장소(expo-file-system)를 메모리로 바꾼다 — backup-test.cjs 와 같은 방식.
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
const { createProject } = load('src/project.ts');
const { localFile } = load('src/services/storage.ts');
const { writeBackup, readBackup, restoreBackup, backupPaths } = load('src/services/backup.ts');

const pngSize = buf => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });
const put = (name, src) => {
  const buf = fs.readFileSync(src);
  localFile(name).write(new Uint8Array(buf));
  const size = src.endsWith('.png') ? pngSize(buf) : { width: 360, height: 360 };
  return { path: name, ...size };
};
const chars = path.join(root, 'assets/promo/characters');
const gifs = path.join(root, 'assets/promo/motion');
const engine = JSON.parse(fs.readFileSync(path.join(gifs, 'engine-motion.json'), 'utf8'));
const layer = (id, name, image) => ({ id, name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image });

const p = createProject('몽이의 하루', '몽이');
p.canon.personality = '말랑한 흰 고양이. 하루 내내 표정이 풍부하다.';
C.ORDER.forEach((key, i) => {
  const s = p.slots[i];
  const label = C.POSES[key].label;
  s.dialogue = label;
  s.emotion = label;
  s.finalImage = put(`image-mongi-${key}-final.png`, path.join(chars, `mongi-${key}.png`));
  if (key === 'hello') {
    s.work = { version: 1, activeLayerId: 'draw-2', references: [], layers: [
      layer('draw-1', '몸', put('image-mongi-hello-body.png', path.join(chars, 'mongi-hello-layer-body.png'))),
      layer('draw-2', '손', put('image-mongi-hello-arm.png', path.join(chars, 'mongi-hello-layer-arm.png'))),
    ] };
  } else {
    s.work = { version: 1, activeLayerId: 'draw-1', references: [], layers: [layer('draw-1', '그림 1', put(`image-mongi-${key}-layer.png`, path.join(chars, `mongi-${key}.png`)))] };
  }
  s.status = 'REVIEW';   // 자동 검사 결과는 지어 넣지 않는다 — 앱이 세트를 열 때 직접 검사한다.
  s.done = true;
});
// 움직임: engine-run.cjs 가 엔진에 넣었던 설정 그대로(GIF 와 설정이 같은 값).
const slotOf = key => p.slots[C.ORDER.indexOf(key)];
slotOf('hello').motion = { version: 1, speed: .5, strength: .5, captionMoves: false,
  parts: [{ id: 'p1', layerId: 'draw-2', effect: 'rotate', pivotX: C.SHOULDER_R[0] / 360, pivotY: C.SHOULDER_R[1] / 360, amount: 30, angle: 0, speed: .6, delay: 0 }] };
slotOf('hello').motionImage = put('image-mongi-hello-move.gif', path.join(gifs, 'part-wave-hello.gif'));
slotOf('excited').motion = { version: 1, preset: 'bounce', speed: .5, strength: .7, captionMoves: false };
slotOf('excited').motionImage = put('image-mongi-excited-move.gif', path.join(gifs, 'bounce-excited.gif'));
slotOf('pouty').motion = { version: 1, preset: 'shake', speed: .5, strength: .7, captionMoves: false };
slotOf('pouty').motionImage = put('image-mongi-pouty-move.gif', path.join(gifs, 'shake-pouty.gif'));
assert.equal(engine['part-wave-hello'].moments.length > 0, true);

// 앱 코드로 쓰고 바로 다시 읽어 검사(writeBackup 안에서 readBackup 도 한다).
const written = writeBackup(p, new Date('2026-10-03T09:00:00Z'));
const bytes = localFile(written.path).bytesSync();
const read = readBackup(bytes);
assert.equal(read.project.projectName, '몽이의 하루');
assert.equal(read.project.slots.filter(s => s.done && s.finalImage).length, 12, '완성 표시는 12칸뿐');
assert.equal(read.project.slots.length - 12, read.project.slots.filter(s => !s.finalImage && !s.done).length, '나머지 칸은 비어 있다');
assert.equal(new Set(read.project.slots.filter(s => s.finalImage).map(s => s.finalImage.path)).size, 12, '12칸 그림이 모두 다르다');
assert.equal(written.missing, 0);

// 덮어쓰기 검사 1: 기기에 이미 다른 작품(그림 파일 포함)이 있을 때 되살리기.
const before = createProject('내 세트', '콩이');
before.slots[0].finalImage = { path: 'image-existing-1.png', width: 360, height: 360 };
const existingBytes = new Uint8Array([1, 2, 3, 4]);
localFile('image-existing-1.png').write(existingBytes);
const snapshot = new Map([...files].map(([k, v]) => [k, v]));
const r1 = restoreBackup(bytes, [before], new Date('2026-10-04T00:00:00Z'));
assert.equal(r1.copy, false);
assert.equal(r1.project.projectName, '몽이의 하루', '이름이 겹치지 않으면 그대로');
for (const [k, v] of snapshot) assert.equal(files.get(k), v, '되살리기 전에 있던 파일은 그대로다: ' + k);
const newPaths = backupPaths(r1.project);
assert.ok(newPaths.every(x => !snapshot.has(localFile(x).uri)), '되살린 그림은 모두 새 이름');
// 덮어쓰기 검사 2: 같은 백업을 두 번 가져오거나 이미 '몽이의 하루'가 있으면 사본 '(복원)'으로 들어온다.
const r2 = restoreBackup(bytes, [before, r1.project], new Date('2026-10-04T00:01:00Z'));
assert.equal(r2.copy, true);
assert.notEqual(r2.project.id, r1.project.id);
assert.equal(r2.project.projectName, '몽이의 하루 (복원)');
assert.ok(backupPaths(r2.project).every(x => !newPaths.includes(x)), '두 번째도 새 이름 — 첫 번째 것을 덮지 않는다');

const name = 'emoti-promo-backup-mongi-day.zip';
fs.writeFileSync(path.join(out, name), Buffer.from(bytes));
const report = { file: name, bytes: bytes.length, images: written.images, slots: read.project.slots.length,
  filled: read.project.slots.filter(s => s.finalImage).map(s => ({ n: s.number, dialogue: s.dialogue, motion: s.motion ? (s.motion.preset || 'parts:' + s.motion.parts.map(x => x.effect).join(',')) : null, layers: s.work.layers.map(l => l.name) })),
  checks: ['readBackup 통과(형식·CRC·parseStore·그림 누락 없음)', '기존 작품 파일 그대로(내용 비교)', '되살린 그림은 모두 새 이름', '두 번째 가져오기는 새 id 의 "(복원)" 사본'] };
fs.writeFileSync(path.join(out, 'backup-check.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
