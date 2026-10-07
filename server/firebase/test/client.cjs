// 앱의 클라우드 코드(src/services/cloud/*)를 그대로 Node 에서 돌려 로컬 에뮬레이터 서버와 맞춰 본다(2026-10-07).
// 기기 저장소는 메모리 흉내(expo-file-system), 서버는 실제 Firebase 에뮬레이터 + 이 폴더의 함수·규칙.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const REPO = path.join(__dirname, '../../..');
const { initializeApp } = require(path.join(REPO, 'node_modules/firebase/app'));
const { getAuth, connectAuthEmulator } = require(path.join(REPO, 'node_modules/firebase/auth'));
const { getFirestore, connectFirestoreEmulator } = require(path.join(REPO, 'node_modules/firebase/firestore'));
const { getStorage, connectStorageEmulator } = require(path.join(REPO, 'node_modules/firebase/storage'));
const { getFunctions, connectFunctionsEmulator } = require(path.join(REPO, 'node_modules/firebase/functions'));
const { initializeApp: adminInit } = require('firebase-admin/app');
const { getFirestore: adminFirestore } = require('firebase-admin/firestore');
const startMock = require('./mock-providers.cjs');
const PROJECT = 'demo-emoti', BUCKET = 'demo-emoti.appspot.com';
adminInit({ projectId: PROJECT, storageBucket: BUCKET });
const adb = adminFirestore();

// ── 기기 저장소 흉내 ─────────────────────────────────────────────────────────────────────────
const files = new Map();
class Directory { constructor(...p) { this.uri = p.map(x => x.uri ?? x).join('/'); } create() {} list() { return []; } }
class File {
  constructor(...p) { this.uri = p.map(x => x.uri ?? x).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  get size() { return files.get(this.uri)?.length ?? 0; }
  write(d) { files.set(this.uri, d); }
  textSync() { return files.get(this.uri); }
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const here = process.cwd(); process.chdir(REPO);
const { loader } = require(path.join(REPO, 'scripts/load-ts.cjs'));
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
const { cloudFrom } = load('src/services/cloud/firebase.ts');
const contest = load('src/services/cloud/contest.ts');
const cloudBackup = load('src/services/cloud/backup.ts');
const account = load('src/services/cloud/account.ts');
const { createProject } = load('src/project.ts');
const { localFile } = load('src/services/storage.ts');
process.chdir(here);

const png = fs.readFileSync(path.join(REPO, 'scripts/promo/fixtures/fit-body.png'));
const hand = fs.readFileSync(path.join(REPO, 'scripts/promo/fixtures/fit-hand.png'));
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(64, 3)]);
const img = (name, data) => { localFile(name).write(new Uint8Array(data)); return { path: name, width: 360, height: 360 }; };
function makeSet(name, cuts, moving) {
  const p = createProject(name, '몽');
  p.slots = p.slots.slice(0, cuts);
  p.slots.forEach((s, i) => {
    const tag = `${p.id.slice(-4)}-${i}`;
    s.finalImage = img(`image-final-${tag}.png`, png);
    s.work = { version: 1, activeLayerId: 'draw-1', caption: { text: '안녕', place: 'bottom', color: '#242424' }, references: [],
      layers: [{ id: 'draw-1', name: '몸', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: img(`image-l1-${tag}.png`, png) }, { id: 'draw-2', name: '손', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: img(`image-l2-${tag}.png`, hand) }] };
    if (moving) { s.motion = { version: 1, preset: 'bounce', speed: .5, strength: .5 }; s.submitImage = img(`image-sub-${tag}.webp`, webp); }
    s.done = true;
  });
  return p;
}
function client(name) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key', storageBucket: BUCKET, authDomain: 'localhost', appId: 'demo-app' }, name);
  const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app), functions = getFunctions(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199); connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return cloudFrom(app, { auth, db, storage, functions });
}
const ok = msg => console.log('  ✓ ' + msg);

(async () => {
  const mock = await startMock();
  try {
    // 로그인
    const cloud = client('phone-A');
    assert.equal(await account.signInWithProviderToken(cloud, 'kakao', 'kakao-good-token'), 'kakao:111');
    assert.equal((await account.register(cloud)).pro.active, false);
    ok('앱 코드: 카카오 토큰 → 서버 확인 → 로그인(kakao:111) · 새 회원 PRO 아님');

    // 무료: 백업 막힘
    const set = makeSet('몽이의 하루', 32, false);
    await assert.rejects(cloudBackup.backupSet(cloud, set, 'phone-A'), /unauthorized|permission/i);
    ok('앱 코드: 무료 회원의 클라우드 백업은 서버가 거절');

    // PRO(서버 기록) → 백업 · 바뀐 것만 · 복원
    await adb.doc('users/kakao:111').set({ pro: { active: true, source: 'trial', verified: false } }, { merge: true });
    const first = await cloudBackup.backupSet(cloud, set, 'phone-A');
    assert.equal(first.files, 32 * 3, '칸마다 완성 + 레이어 2장');
    assert.equal(first.sent, 2, '같은 내용 파일은 한 번만 올린다(이 시험 그림은 두 종류)');
    const second = await cloudBackup.backupSet(cloud, set, 'phone-A');
    assert.equal(second.sent, 0, '다시 백업하면 바뀐 파일이 없어 보내지 않는다');
    localFile(set.slots[5].work.layers[0].image.path).write(new Uint8Array(Buffer.concat([png, Buffer.from('changed')])));
    const third = await cloudBackup.backupSet(cloud, set, 'phone-A');
    assert.equal(third.sent, 1, '바뀐 레이어 하나만 보낸다');
    ok(`PRO: 편집 원본(완성·레이어 ${first.files}개) 백업 — 처음 ${first.sent}개, 다시 0개, 레이어 하나 바꾸면 1개만 전송`);
    // 재설치: 기기 저장소 비우고 같은 계정
    const before = new Map(files); files.clear();
    const phoneB = client('phone-B');
    await account.signInWithProviderToken(phoneB, 'kakao', 'kakao-good-token');
    const listed = await cloudBackup.listSets(phoneB);
    assert.equal(listed.length, 1); assert.equal(listed[0].name, '몽이의 하루');
    const fresh = await cloudBackup.restoreSet(phoneB, listed[0].id, []);
    assert.equal(fresh.copy, false); assert.equal(fresh.project.projectName, '몽이의 하루');
    assert.equal(fresh.project.slots.length, 32);
    assert.equal(fresh.project.slots[0].work.layers.length, 2, '레이어 그대로');
    assert.equal(fresh.project.slots[0].work.caption.text, '안녕', '문구 그대로');
    for (const s of fresh.project.slots) assert.ok(localFile(s.work.layers[0].image.path).exists && localFile(s.finalImage.path).exists, '가리키는 파일이 기기에 있다');
    assert.equal(crypto.createHash('sha256').update(localFile(fresh.project.slots[5].work.layers[0].image.path).bytesSync()).digest('hex'),
      crypto.createHash('sha256').update(Buffer.concat([png, Buffer.from('changed')])).digest('hex'), '바꾼 레이어도 바뀐 내용으로 돌아온다');
    // 기존 기기(같은 세트가 있음)에 복원 → 덮어쓰지 않고 사본
    for (const [k, v] of before) files.set(k, v);
    const dup = await cloudBackup.restoreSet(phoneB, listed[0].id, [set]);
    assert.equal(dup.copy, true); assert.equal(dup.project.projectName, '몽이의 하루 (복원)'); assert.notEqual(dup.project.id, set.id);
    assert.ok(localFile(set.slots[0].finalImage.path).exists, '기존 세트 파일은 그대로');
    ok('재설치 후 같은 계정: 세트 목록 → 복원(32칸·레이어·문구·바뀐 레이어 내용 일치) · 같은 세트가 있으면 덮어쓰지 않고 (복원) 사본');

    // 공모전(정지 32칸)
    await adb.doc('contests/still1').set({ title: '정지 공모전', code: 'S', status: 'open', consentVersion: 'v1', startsAt: Date.now() - 1000, endsAt: Date.now() + 864e5, requirements: { kind: 'still', cuts: 32, minAnimated: 0 }, maxBytes: 120 * 1024 * 1024, notice: '', rules: '' });
    const open = await contest.openContests(cloud);
    const c1 = open.find(c => c.id === 'still1');
    const pkg = contest.contestPackage(set);
    assert.equal(pkg.cuts, 32); assert.equal(pkg.kind, 'still'); assert.equal(contest.precheck(pkg, c1), null);
    assert.equal(pkg.sha256, crypto.createHash('sha256').update(pkg.bytes).digest('hex'), '앱 해시 = Node 해시');
    // 첫 시도는 업로드 도중 끊김(흉내) → 같은 키로 다시
    const key = contest.newSubmissionKey();
    const flaky = { ...cloud, upload: async () => { throw new Error('network lost'); } };
    await assert.rejects(contest.submit(flaky, c1, set, pkg, key), /network lost/);
    const done = await contest.submit(cloud, c1, set, pkg, key, undefined, 60000);
    assert.equal(done.status, 'received'); assert.equal(done.receiptNo, 'S-00001');
    const again = await contest.submit(cloud, c1, set, pkg, key);
    assert.equal(again.receiptNo, 'S-00001', '같은 키로 또 내도 같은 접수');
    await assert.rejects(contest.submit(cloud, c1, set, pkg, contest.newSubmissionKey()), /already-exists|이미 접수/);
    const sub = (await adb.doc('contests/still1/submissions/kakao:111').get()).data();
    assert.equal(sub.attempts, 2, '끊긴 시도 1 + 다시 1 — 접수는 한 건');
    assert.equal(sub.file.cuts, 32);
    ok('공모전(정지): 앱이 만든 세트 전체 묶음(32칸) → 끊김 뒤 같은 키로 재시도 → 접수번호 S-00001 한 건 · 다른 키 두 번째 접수 거절');

    // 공모전(움직임 24칸) — 다른 회원
    const other = client('phone-C');
    await account.signInWithProviderToken(other, 'kakao', 'kakao-second-user');
    await adb.doc('contests/move1').set({ title: '움직임 공모전', code: 'M', status: 'open', consentVersion: 'v1', startsAt: Date.now() - 1000, endsAt: Date.now() + 864e5, requirements: { kind: 'moving', cuts: 24, minAnimated: 3 }, maxBytes: 120 * 1024 * 1024, notice: '', rules: '' });
    const c2 = (await contest.openContests(other)).find(c => c.id === 'move1');
    const moving = makeSet('움직이는 몽이', 24, true);
    const mpkg = contest.contestPackage(moving);
    assert.equal(mpkg.kind, 'moving'); assert.equal(mpkg.animated, 24);
    assert.match(contest.precheck(mpkg, c1), /32칸/, '정지 공모전에는 미리 안 된다고 알려 준다');
    const mres = await contest.submit(other, c2, moving, mpkg, contest.newSubmissionKey());
    assert.equal(mres.status, 'received'); assert.equal(mres.receiptNo, 'M-00001');
    ok('공모전(움직임): 24칸 WebP 세트 접수 M-00001 · 규격이 다른 공모전은 앱이 미리 알려 줌');

    // 탈퇴
    const del = await account.deleteAccount(cloud);
    assert.equal(del.deleted.backupSets, 1);
    assert.equal((await adb.doc('users/kakao:111').get()).exists, false);
    ok('앱 코드: 탈퇴 → 서버의 백업·회원·접수 삭제 (기기 안 작품은 그대로)');
    assert.ok(localFile(set.slots[0].finalImage.path).exists, '탈퇴해도 기기 작품은 지우지 않는다');
    console.log('PASS: app cloud client (src/services/cloud) against emulators');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e); process.exit(1); } finally { mock.close(); }
})();
