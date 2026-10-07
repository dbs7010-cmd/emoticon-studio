// emoti 서버 검사(로컬 Firebase 에뮬레이터, 2026-10-07). `npm test` 가 emulators:exec 안에서 돌린다.
// 실제 카카오·네이버 대신 이 파일의 가짜 서버(127.0.0.1:7777)가 토큰 확인 응답을 준다 — 함수의 '확인 규칙'을 검사하는 것이지
// 실제 회사 연동을 검사하는 것이 아니다(실연동은 운영자 앱 키가 생긴 뒤).
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithCustomToken, signInWithCredential, GoogleAuthProvider, signOut } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, getDocs } = require('firebase/firestore');
const { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes, deleteObject } = require('firebase/storage');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const { initializeApp: adminInit } = require('firebase-admin/app');
const { getFirestore: adminFirestore } = require('firebase-admin/firestore');
const { getStorage: adminStorage } = require('firebase-admin/storage');
const { getAuth: adminAuth } = require('firebase-admin/auth');

const PROJECT = 'demo-emoti', BUCKET = 'demo-emoti.appspot.com';
adminInit({ projectId: PROJECT, storageBucket: BUCKET });
const adb = adminFirestore();

// ── 가짜 카카오·네이버 ─────────────────────────────────────────────────────────────────────
const mock = http.createServer((req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.url === '/v1/user/access_token_info') {
    if (token === 'kakao-good-token') return send(200, { id: 111, expires_in: 3600, app_id: 424242 });
    if (token === 'kakao-other-app') return send(200, { id: 222, expires_in: 3600, app_id: 999999 });
    return send(401, { code: -401, msg: 'this access token does not exist' });
  }
  if (req.url === '/v1/nid/me') {
    if (token === 'naver-good-token') return send(200, { resultcode: '00', message: 'success', response: { id: 'NV-abc' } });
    return send(401, { resultcode: '024', message: 'Authentication failed' });
  }
  send(404, {});
});

// ── 앱 쪽 도구: 앱의 ZIP 작성기를 그대로 쓴다 ─────────────────────────────────────────────────
const REPO = path.join(__dirname, '../../..');
const { loader } = require('../../../scripts/load-ts.cjs');
const fsMock = { Directory: class { constructor(...p) { this.uri = p.join('/'); } create() {} }, File: class { constructor(...p) { this.uri = p.join('/'); } }, Paths: { document: 'doc' } };
const here = process.cwd(); process.chdir(REPO);
const { buildZip } = loader({ 'expo-file-system': fsMock })('src/services/export.ts');
process.chdir(here);
const png = fs.readFileSync(path.join(__dirname, '../../../scripts/promo/fixtures/fit-body.png'));
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(32)]);
const setZip = (n, kind = 'png', extra = []) => Buffer.from(buildZip([
  ...Array.from({ length: n }, (_, i) => ({ name: `${String(i + 1).padStart(2, '0')}.${kind}`, data: new Uint8Array(kind === 'png' ? png : webp) })),
  { name: 'icon.png', data: new Uint8Array(png) }, ...extra,
]));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// ── 클라이언트(앱과 같은 Firebase JS SDK) ────────────────────────────────────────────────────
let n = 0;
function client() {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key', storageBucket: BUCKET, authDomain: 'localhost' }, 'c' + (++n));
  const auth = getAuth(app), db = getFirestore(app), st = getStorage(app), fn = getFunctions(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(st, '127.0.0.1', 9199);
  connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  return { app, auth, db, st, call: (name, data) => httpsCallable(fn, name)(data).then(r => r.data) };
}
const denied = async (p, code = /permission|unauthorized|denied/i, what) => { await assert.rejects(p, e => code.test(String(e.code || '') + ' ' + String(e.message || '')), what); };
const until = async (fnc, what, ms = 40000) => { const end = Date.now() + ms; for (;;) { const v = await fnc(); if (v) return v; if (Date.now() > end) throw new Error('시간 초과: ' + what); await new Promise(r => setTimeout(r, 400)); } };
const results = [];
const ok = msg => { results.push(msg); console.log('  ✓ ' + msg); };

(async () => {
  await new Promise(r => mock.listen(7777, '127.0.0.1', r));
  try {
    // 1) 로그인 3종 ────────────────────────────────────────────────────────────────────────
    const kakao = client();
    const kt = await kakao.call('exchangeKakao', { accessToken: 'kakao-good-token' });
    const kUser = (await signInWithCustomToken(kakao.auth, kt.token)).user;
    assert.equal(kUser.uid, 'kakao:111');
    assert.equal((await getDoc(doc(kakao.db, 'users/kakao:111'))).data().pro.active, false, '새 회원은 PRO 아님(체험 전체 부여 꺼짐)');
    await denied(kakao.call('exchangeKakao', { accessToken: 'kakao-other-app' }), /permission-denied/, '다른 앱 카카오 토큰 거절');
    await denied(kakao.call('exchangeKakao', { accessToken: 'kakao-bad-token-xx' }), /unauthenticated/, '가짜 카카오 토큰 거절');
    ok('카카오: 서버가 토큰을 확인(app_id 대조)해 kakao:회원번호로 로그인 · 다른 앱/가짜 토큰 거절');
    const naver = client();
    const nt = await naver.call('exchangeNaver', { accessToken: 'naver-good-token' });
    assert.equal((await signInWithCustomToken(naver.auth, nt.token)).user.uid, 'naver:NV-abc');
    await denied(naver.call('exchangeNaver', { accessToken: 'naver-bad-token-xx' }), /unauthenticated/);
    ok('네이버: 서버가 토큰을 확인해 naver:회원ID 로 로그인 · 가짜 토큰 거절');
    const google = client();
    const gUser = (await signInWithCredential(google.auth, GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-1', email: 'g1@example.com', email_verified: true })))).user;
    const reg = await google.call('registerUser', {});
    assert.equal(reg.pro.active, false);
    assert.equal((await getDoc(doc(google.db, `users/${gUser.uid}`))).data().provider, 'google.com');
    ok('구글: Firebase 인증 로그인 뒤 회원 문서 생성(provider google.com)');

    // 2) 남의 데이터·PRO 직접 쓰기 막힘 ──────────────────────────────────────────────────────
    await denied(getDoc(doc(kakao.db, 'users/naver:NV-abc')), /permission/, '남의 회원 문서');
    await denied(setDoc(doc(kakao.db, 'users/kakao:111'), { pro: { active: true } }, { merge: true }), /permission/, '앱이 스스로 PRO 를 쓸 수 없다');
    ok('남의 회원 문서 읽기 거절 · 앱이 자기 PRO 값을 쓰는 것 거절');

    // 3) 무료 사용자 개인 백업 차단 ─────────────────────────────────────────────────────────
    const blob = Buffer.from('layer-pixels-' + 'x'.repeat(2000)), bsha = sha(blob);
    await denied(uploadBytes(ref(kakao.st, `backups/kakao:111/blobs/${bsha}`), blob), /unauthorized|permission/, '무료: 파일');
    await denied(setDoc(doc(kakao.db, 'backups/kakao:111/sets/set-1'), { name: '몽이', updatedAt: 1, device: 'd1', files: [], bytes: 0, store: '{}' }), /permission/, '무료: 목록');
    ok('무료 사용자: 개인 클라우드 백업(파일·목록) 거절');

    // 관리자(구글 계정 + 서버가 준 admin 권한)
    const boss = client();
    const bossUser = (await signInWithCredential(boss.auth, GoogleAuthProvider.credential(JSON.stringify({ sub: 'admin-1', email: 'ops@example.com', email_verified: true })))).user;
    await adminAuth().setCustomUserClaims(bossUser.uid, { admin: true });
    await bossUser.getIdToken(true);
    await denied(kakao.call('adminSetPro', { uid: 'kakao:111', active: true, source: 'admin' }), /permission-denied/, '일반 회원은 관리자 함수를 못 부른다');
    await boss.call('adminSetPro', { uid: 'kakao:111', active: true, source: 'trial' });
    await denied(boss.call('adminSetPro', { uid: 'kakao:111', active: true, source: 'store' }), /invalid-argument/, '구매(store) 출처는 관리자 부여로 만들 수 없다');
    ok('PRO 는 관리자(서버)만 부여 · 출처 trial/admin 만(구매 검증과 구분) · 일반 회원 거절');

    // 4) PRO 원본 백업 · 복원 · 사용량 ───────────────────────────────────────────────────────
    await uploadBytes(ref(kakao.st, `backups/kakao:111/blobs/${bsha}`), blob);
    await until(async () => (await adb.doc('users/kakao:111').get()).data().backupBytes === blob.length, '사용량');
    await uploadBytes(ref(kakao.st, `backups/kakao:111/blobs/${bsha}`), blob);   // 같은 파일 다시
    await new Promise(r => setTimeout(r, 2500));
    assert.equal((await adb.doc('users/kakao:111').get()).data().backupBytes, blob.length, '같은 파일을 다시 올려도 두 번 세지 않는다');
    const fake = Buffer.from('not-matching-content'), wrongName = sha(Buffer.from('something else'));
    await uploadBytes(ref(kakao.st, `backups/kakao:111/blobs/${wrongName}`), fake);
    await until(async () => { const [e] = await adminStorage().bucket(BUCKET).file(`backups/kakao:111/blobs/${wrongName}`).exists(); return !e; }, '이름과 내용이 다른 파일 삭제');
    const manifest = { name: '몽이의 하루', updatedAt: Date.now(), device: 'phone-A', files: [{ path: 'image-a.png', sha256: bsha, size: blob.length }], bytes: blob.length, store: JSON.stringify({ projectName: '몽이의 하루', slots: 32 }) };
    await setDoc(doc(kakao.db, 'backups/kakao:111/sets/set-1'), manifest);
    await denied(getBytes(ref(naver.st, `backups/kakao:111/blobs/${bsha}`)), /unauthorized|permission/, '남의 백업 파일');
    await denied(getDoc(doc(naver.db, 'backups/kakao:111/sets/set-1')), /permission/, '남의 백업 목록');
    // 재설치: 새 클라이언트로 같은 카카오 계정 → 같은 uid → 목록·원본 그대로
    await signOut(kakao.auth);
    const again = client();
    const kt2 = await again.call('exchangeKakao', { accessToken: 'kakao-good-token' });
    assert.equal((await signInWithCustomToken(again.auth, kt2.token)).user.uid, 'kakao:111');
    const sets = await getDocs(collection(again.db, 'backups/kakao:111/sets'));
    assert.equal(sets.size, 1);
    const got = sets.docs[0].data();
    assert.equal(got.store, manifest.store);
    const back = Buffer.from(await getBytes(ref(again.st, `backups/kakao:111/blobs/${got.files[0].sha256}`)));
    assert.equal(sha(back), bsha, '복원한 원본이 같은 내용');
    ok('PRO: 원본 파일(해시 이름)·세트 목록 백업 → 재설치·같은 계정 로그인으로 복원(내용 일치) · 같은 파일 재전송은 다시 세지 않음 · 이름과 다른 파일은 서버가 지움 · 남의 백업 거절');
    // 용량 상한(에뮬레이터 5MB)
    const big = Buffer.alloc(5_100_000, 7), bigSha = sha(big);
    await uploadBytes(ref(again.st, `backups/kakao:111/blobs/${bigSha}`), big);
    await until(async () => { const [e] = await adminStorage().bucket(BUCKET).file(`backups/kakao:111/blobs/${bigSha}`).exists(); return !e; }, '용량 초과 파일 삭제');
    assert.match((await adb.doc('users/kakao:111').get()).data().backupNotice, /용량/);
    ok('PRO 백업 용량 상한: 넘는 파일은 서버가 지우고 이유를 남김');
    // PRO 가 끝나도 읽기는 됨, 쓰기는 안 됨
    await boss.call('adminSetPro', { uid: 'kakao:111', active: false, source: 'trial' });
    assert.equal(sha(Buffer.from(await getBytes(ref(again.st, `backups/kakao:111/blobs/${bsha}`)))), bsha, 'PRO 가 끝나도 내 백업을 내려받을 수 있다');
    await denied(uploadBytes(ref(again.st, `backups/kakao:111/blobs/${sha(Buffer.from('new'))}`), Buffer.from('new')), /unauthorized|permission/);
    ok('PRO 가 끝난 뒤: 기존 백업은 지워지지 않고 내려받기 가능 · 새 백업은 거절');

    // 5) 공모전 ──────────────────────────────────────────────────────────────────────────────
    const now = Date.now();
    await denied(naver.call('adminSaveContest', { id: 'c1' }), /permission-denied/);
    await boss.call('adminSaveContest', { id: 'c1', title: '첫 emoti 공모전', code: 'E1', notice: '공지', rules: '조건', consentVersion: 'v1', status: 'open', startsAt: now - 1000, endsAt: now + 86400000, requirements: { kind: 'still', cuts: 32 } });
    assert.equal((await getDoc(doc(naver.db, 'contests/c1'))).data().title, '첫 emoti 공모전', '공개된 공모전은 회원이 읽는다');
    const good = setZip(32);
    const key1 = 'sub' + crypto.randomBytes(6).toString('hex');
    await denied(uploadBytes(ref(naver.st, `contests/c1/naver:NV-abc/${key1}.zip`), good, { contentType: 'application/zip' }), /unauthorized|permission/, '접수 시작 없이 올리기');
    await denied(naver.call('createSubmission', { contestId: 'c1', submissionKey: key1, declared: { sha256: sha(good), bytes: good.length, kind: 'still', cuts: 32, setName: '네이버 세트' }, consentVersion: 'v0' }), /failed-precondition/, '동의 버전이 다르면 거절');
    const start = await naver.call('createSubmission', { contestId: 'c1', submissionKey: key1, declared: { sha256: sha(good), bytes: good.length, kind: 'still', cuts: 32, setName: '네이버 세트' }, consentVersion: 'v1' });
    assert.equal(start.status, 'uploading');
    const retry = await naver.call('createSubmission', { contestId: 'c1', submissionKey: key1, declared: { sha256: sha(good), bytes: good.length, kind: 'still', cuts: 32, setName: '네이버 세트' }, consentVersion: 'v1' });
    assert.equal(retry.path, start.path, '같은 제출 키로 다시 부르면 같은 접수(재시도)');
    await denied(uploadBytes(ref(kakao.st, start.path), good, { contentType: 'application/zip' }), /unauthorized|permission/, '남의 접수 자리에 올리기');
    await uploadBytes(ref(naver.st, start.path), good, { contentType: 'application/zip' });
    const received = await until(async () => { const s = (await getDoc(doc(naver.db, 'contests/c1/submissions/naver:NV-abc'))).data(); return s.status === 'received' ? s : null; }, '접수됨');
    assert.equal(received.receiptNo, 'E1-00001');
    assert.equal(received.file.cuts, 32);
    assert.deepEqual(received.file.formats, { png: 32 });
    const again2 = await naver.call('createSubmission', { contestId: 'c1', submissionKey: key1, declared: { sha256: sha(good), bytes: good.length, kind: 'still', cuts: 32, setName: '네이버 세트' }, consentVersion: 'v1' });
    assert.equal(again2.receiptNo, 'E1-00001', '접수 뒤 같은 키로 다시 불러도 같은 접수번호(중복 없음)');
    await denied(naver.call('createSubmission', { contestId: 'c1', submissionKey: 'other' + key1, declared: { sha256: sha(good), bytes: good.length }, consentVersion: 'v1' }), /already-exists/, '다른 키로 두 번째 접수 거절');
    await denied(getBytes(ref(kakao.st, start.path)), /unauthorized|permission/, '남의 제출 묶음 읽기');
    ok('공모전: 세트 전체(32칸) 묶음 접수 → 서버 검사 후 접수번호 E1-00001 · 재시도는 같은 접수 · 두 번째 접수 거절 · 남의 묶음 읽기/쓰기 거절 · 시작 없이 올리기 거절');
    // 손상·끊긴 업로드 → 거절·파일 삭제 → 새로 제출하면 접수
    await kakao.auth.currentUser || await signInWithCustomToken(kakao.auth, (await kakao.call('exchangeKakao', { accessToken: 'kakao-good-token' })).token);
    const key2 = 'sub' + crypto.randomBytes(6).toString('hex');
    const s2 = await kakao.call('createSubmission', { contestId: 'c1', submissionKey: key2, declared: { sha256: sha(good), bytes: good.length, kind: 'still', cuts: 32, setName: '카카오 세트' }, consentVersion: 'v1' });
    await uploadBytes(ref(kakao.st, s2.path), good.subarray(0, good.length - 500), { contentType: 'application/zip' });
    const rej = await until(async () => { const s = (await getDoc(doc(kakao.db, 'contests/c1/submissions/kakao:111'))).data(); return s.status === 'rejected' ? s : null; }, '끊긴 업로드 거절');
    assert.match(rej.reason, /다시 제출/);
    assert.equal((await adminStorage().bucket(BUCKET).file(s2.path).exists())[0], false, '거절된 묶음은 지운다');
    const short = setZip(31), key3 = 'sub' + crypto.randomBytes(6).toString('hex');
    const s3 = await kakao.call('createSubmission', { contestId: 'c1', submissionKey: key3, declared: { sha256: sha(short), bytes: short.length, kind: 'still', cuts: 31, setName: '카카오 세트' }, consentVersion: 'v1' });
    await uploadBytes(ref(kakao.st, s3.path), short, { contentType: 'application/zip' });
    const rej2 = await until(async () => { const s = (await getDoc(doc(kakao.db, 'contests/c1/submissions/kakao:111'))).data(); return s.status === 'rejected' && s.submissionKey === key3 ? s : null; }, '칸 수 부족 거절');
    assert.match(rej2.reason, /32칸/);
    const key4 = 'sub' + crypto.randomBytes(6).toString('hex');
    const s4 = await kakao.call('createSubmission', { contestId: 'c1', submissionKey: key4, declared: { sha256: sha(good), bytes: good.length, kind: 'still', cuts: 32, setName: '카카오 세트' }, consentVersion: 'v1' });
    await uploadBytes(ref(kakao.st, s4.path), good, { contentType: 'application/zip' });
    const rec2 = await until(async () => { const s = (await getDoc(doc(kakao.db, 'contests/c1/submissions/kakao:111'))).data(); return s.status === 'received' ? s : null; }, '다시 제출 접수');
    assert.equal(rec2.receiptNo, 'E1-00002', '거절된 시도는 접수번호를 쓰지 않는다');
    ok('끊긴 업로드(해시 불일치)·칸 수 부족은 거절하고 파일 삭제 · 고쳐서 다시 내면 접수(E1-00002)');
    // 끊긴 채 남은 업로드 정리
    const gUid = gUser.uid, key5 = 'sub' + crypto.randomBytes(6).toString('hex');
    const s5 = await google.call('createSubmission', { contestId: 'c1', submissionKey: key5, declared: { sha256: sha(good), bytes: good.length, kind: 'still', cuts: 32, setName: '구글 세트' }, consentVersion: 'v1' });
    const cleaned = await boss.call('adminCleanupNow', { now: Date.now() + 25 * 3600 * 1000 });
    assert.equal(cleaned.expired, 1);
    assert.equal((await getDoc(doc(google.db, `contests/c1/submissions/${gUid}`))).data().status, 'expired');
    ok('24시간 넘게 \'올리는 중\'으로 남은 접수는 정리(만료)');
    // 철회
    await kakao.call('withdrawSubmission', { contestId: 'c1' });
    assert.equal((await adminStorage().bucket(BUCKET).file(s4.path).exists())[0], false);
    assert.equal((await getDoc(doc(kakao.db, 'contests/c1/submissions/kakao:111'))).data().status, 'withdrawn');
    ok('철회: 묶음 삭제·상태 withdrawn');
    // 관리자: 목록·미리보기용 내려받기·심사·결과
    const list = (await boss.call('adminListSubmissions', { contestId: 'c1' })).submissions;
    const mine = list.find(s => s.uid === 'naver:NV-abc');
    assert.equal(mine.status, 'received'); assert.equal(mine.cuts, 32);
    const pkg = Buffer.from(await getBytes(ref(boss.st, mine.path)));
    assert.equal(sha(pkg), sha(good), '관리자가 제출 당시 묶음 그대로 내려받는다');
    await denied(naver.call('adminListSubmissions', { contestId: 'c1' }), /permission-denied/);
    await boss.call('adminSetReview', { contestId: 'c1', uid: 'naver:NV-abc', state: 'selected', note: '좋아요' });
    const pub = await boss.call('adminPublishResults', { contestId: 'c1' });
    assert.deepEqual(pub.results, [{ receiptNo: 'E1-00001', setName: '네이버 세트' }]);
    assert.equal((await getDoc(doc(naver.db, 'contests/c1/submissions/naver:NV-abc'))).data().review.state, 'selected', '참가자는 자기 심사 결과를 본다');
    assert.equal((await getDoc(doc(naver.db, 'contests/c1'))).data().status, 'announced');
    ok('관리자: 접수 목록 · 제출 당시 묶음 내려받기(해시 일치) · 심사 상태 · 결과 발표(공개) · 일반 회원은 관리자 기능 거절');

    // 6) 탈퇴 ────────────────────────────────────────────────────────────────────────────────
    await denied(again.call('deleteMyAccount', {}), /failed-precondition/);
    const del = await again.call('deleteMyAccount', { confirm: 'DELETE' });
    assert.equal(del.deleted.backupSets, 1);
    assert.equal((await adb.doc('users/kakao:111').get()).exists, false);
    assert.equal((await adb.collection('backups/kakao:111/sets').get()).size, 0);
    const [left] = await adminStorage().bucket(BUCKET).getFiles({ prefix: 'backups/kakao:111/' });
    assert.equal(left.length, 0);
    assert.equal((await adb.doc('contests/c1/submissions/kakao:111').get()).exists, false);
    await assert.rejects(adminAuth().getUser('kakao:111'));
    ok('탈퇴: 백업 파일·목록·회원 문서·공모전 접수·로그인 계정 모두 삭제');

    for (const c of [kakao, naver, google, boss, again]) await deleteApp(c.app);
    console.log(`PASS: emoti server (emulator) — ${results.length} groups`);
    process.exit(0);
  } catch (e) {
    console.error('FAIL:', e);
    process.exit(1);
  } finally { mock.close(); }
})();
