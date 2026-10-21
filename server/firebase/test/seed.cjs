// 관리자 페이지 확인용 자료 넣기(로컬 에뮬레이터 전용). 실제 작품 그림(PNG 폴더)으로 32칸 세트 묶음을 앱의 ZIP 작성기로 만들어
// 일반 회원이 정상 경로(createSubmission → 업로드 → 서버 검사)로 접수한다. 사용: node test/seed.cjs <PNG 폴더> [관리자로 만들 이메일]
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithCustomToken } = require('firebase/auth');
const { getStorage, connectStorageEmulator, ref, uploadBytes } = require('firebase/storage');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const { initializeApp: adminInit } = require('firebase-admin/app');
const { getAuth: adminAuth } = require('firebase-admin/auth');
const PROJECT = 'demo-emoti', BUCKET = 'demo-emoti.appspot.com';
const [dir, adminEmail] = process.argv.slice(2);
adminInit({ projectId: PROJECT, storageBucket: BUCKET });
(async () => {
  if (adminEmail) {   // 이미 로그인해 본 관리자 계정에 권한 부여
    const u = await adminAuth().getUserByEmail(adminEmail);
    await adminAuth().setCustomUserClaims(u.uid, { admin: true });
    console.log('admin claim →', u.uid); process.exit(0);
  }
  const REPO = path.join(__dirname, '../../..'), here = process.cwd(); process.chdir(REPO);
  const { loader } = require(path.join(REPO, 'scripts/load-ts.cjs'));
  const fsMock = { Directory: class { constructor(...p) { this.uri = p.join('/'); } create() {} }, File: class { constructor(...p) { this.uri = p.join('/'); } }, Paths: { document: 'doc' } };
  const { buildZip } = loader({ 'expo-file-system': fsMock })('src/services/export.ts');
  process.chdir(here);
  const pngs = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().map(f => fs.readFileSync(path.join(dir, f)));
  const zip = Buffer.from(buildZip([...Array.from({ length: 32 }, (_, i) => ({ name: `${String(i + 1).padStart(2, '0')}.png`, data: new Uint8Array(pngs[i % pngs.length]) })), { name: 'icon.png', data: new Uint8Array(pngs[0]) }]));
  // 관리자 페이지용 공모전은 관리 SDK 로 직접(관리자 함수와 같은 모양)
  const { getFirestore } = require('firebase-admin/firestore');
  await getFirestore().doc('contests/demo').set({ title: '시험 공모전(에뮬레이터)', code: 'T', status: 'open', consentVersion: 'v1', startsAt: Date.now() - 1000, endsAt: Date.now() + 864e5, requirements: { kind: 'still', cuts: 32, minAnimated: 0 }, maxBytes: 120 * 1024 * 1024, notice: '시험 공지', rules: '시험 조건', target: '카카오 이모티콘 스튜디오 제안(작가 본인 제출)' });
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key', storageBucket: BUCKET, authDomain: 'localhost' });
  const auth = getAuth(app), st = getStorage(app), fn = getFunctions(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectStorageEmulator(st, '127.0.0.1', 9199); connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  await signInWithCustomToken(auth, await adminAuth().createCustomToken('kakao:seed-1', { provider: 'kakao' }));
  const key = 'seed' + crypto.randomBytes(5).toString('hex');
  const s = (await httpsCallable(fn, 'createSubmission')({ contestId: 'demo', submissionKey: key, declared: { sha256: crypto.createHash('sha256').update(zip).digest('hex'), bytes: zip.length, kind: 'still', cuts: 32, setName: '몽이의 하루' }, consentVersion: 'v1' })).data;
  await uploadBytes(ref(st, s.path), zip, { contentType: 'application/zip' });
  console.log('submitted', s.path, (zip.length / 1024).toFixed(0) + 'KB'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
