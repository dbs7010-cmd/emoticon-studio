// emoti 이모티 서버 함수(Firebase Functions v2, 2026-10-07). 로컬 에뮬레이터로 검사한다 — 운영 배포 전.
//
// 원칙
//  - 앱이 보낸 '누구다·PRO 다'를 믿지 않는다. 카카오·네이버 로그인은 이 함수가 각 회사 서버에 토큰을 직접 확인하고,
//    PRO 는 회원 문서에 **서버만** 쓴다(규칙이 앱 쓰기를 막음). 구매 검증은 아직 연결 전이라 실제 구매로 PRO 가 열리지 않는다.
//  - 비밀 값(카카오 앱 ID 대조값, 관리자 권한)은 환경변수·관리 SDK 에만 있다. 앱·저장소에 비밀 키를 두지 않는다.
//  - 공모전은 세트 전체 묶음(ZIP)을 그대로 받고, 서버가 열어 구성(칸 수·번호·형식)·해시·크기를 확인한 뒤에만 '접수됨'.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onObjectFinalized, onObjectDeleted } = require('firebase-functions/v2/storage');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const crypto = require('node:crypto');
const { checkPackage } = require('./package-check');
const artist = require('./artist-name');
const retention = require('./retention');

initializeApp();
const db = getFirestore();
const bucket = () => getStorage().bucket();

const env = () => ({
  // 체험 PRO 는 관리자만 준다(adminSetPro, 기간 필수). 로그인만으로 PRO 가 열리는 설정은 없다.
  trialMaxDays: Number(process.env.TRIAL_MAX_DAYS || 30),
  backupQuota: Number(process.env.BACKUP_QUOTA_BYTES || 1024 * 1024 * 1024),
  staleHours: Number(process.env.STALE_UPLOAD_HOURS || 24),
});

const toMillis = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : Date.parse(v));
const need = (cond, code, message) => { if (!cond) throw new HttpsError(code, message); };
const signedIn = req => { need(req.auth && req.auth.uid, 'unauthenticated', '로그인이 필요해요.'); return req.auth.uid; };
const adminOnly = req => { signedIn(req); need(req.auth.token.admin === true, 'permission-denied', '관리자만 할 수 있어요.'); };

// ── 회원 ───────────────────────────────────────────────────────────────────────────────────
async function ensureUser(uid, provider) {
  const ref = db.doc(`users/${uid}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) { tx.update(ref, { lastSignInAt: FieldValue.serverTimestamp() }); return; }
    const pro = { active: false, source: 'none', verified: false };
    tx.set(ref, { provider, createdAt: FieldValue.serverTimestamp(), lastSignInAt: FieldValue.serverTimestamp(), pro, backupBytes: 0 });
  });
  return (await ref.get()).data();
}

// 카카오·네이버·구글 로그인: 서버가 인가 코드를 직접 끝내는 중계(auth.js). 앱이 들고 온 회사 토큰을 믿지 않는다.
const broker = require('./auth')({ db, ensureUser });
exports.authStart = broker.authStart;
exports.authCallbackKakao = broker.authCallbackKakao;
exports.authCallbackNaver = broker.authCallbackNaver;
exports.authCallbackGoogle = broker.authCallbackGoogle;
exports.redeemAuth = broker.redeemAuth;

// PRO 가 지금 유효한가(서버 기록만). until 이 있으면 그 시각까지(체험은 항상 기간이 있다).
const proActive = u => !!(u && u.pro && u.pro.active === true && (u.pro.until == null || toMillis(u.pro.until) > Date.now()));

// 구글은 Firebase 인증이 직접 확인한다. 로그인 뒤 회원 문서를 만든다.
exports.registerUser = onCall(async req => {
  const uid = signedIn(req);
  const provider = req.auth.token.provider || (req.auth.token.firebase && req.auth.token.firebase.sign_in_provider) || 'unknown';
  const user = await ensureUser(uid, provider);
  return { pro: { ...user.pro, active: proActive(user) }, backupBytes: user.backupBytes || 0, artistName: user.artistName || null };
});

// ── 작가명(한 번 정하면 바꿀 수 없음) ───────────────────────────────────────────────────────
// 미리 보기: 형식·금지어·중복만 알려 준다(예약하지 않음).
exports.checkArtistName = onCall(async req => {
  signedIn(req);
  const f = artist.checkFormat(req.data?.name);
  if (!f.ok) return { ok: false, reason: f.reason };
  const taken = (await db.doc(`artistNames/${f.key}`).get()).exists;
  return taken ? { ok: false, reason: '이미 쓰는 작가명이에요.' } : { ok: true };
});
// 정하기: 회원 문서에 작가명이 없을 때만, 예약 문서와 함께 한 번에.
exports.setArtistName = onCall(async req => {
  const uid = signedIn(req);
  const f = artist.checkFormat(req.data?.name);
  need(f.ok, 'invalid-argument', f.reason);
  const userRef = db.doc(`users/${uid}`), nameRef = db.doc(`artistNames/${f.key}`);
  await db.runTransaction(async tx => {
    const [u, n] = await Promise.all([tx.get(userRef), tx.get(nameRef)]);
    need(u.exists, 'failed-precondition', '로그인을 다시 해 주세요.');
    need(!u.data().artistName, 'failed-precondition', '작가명은 한 번 정하면 바꿀 수 없어요.');
    need(!n.exists, 'already-exists', '이미 쓰는 작가명이에요.');
    tx.set(nameRef, { uid, name: f.name, at: FieldValue.serverTimestamp() });
    tx.update(userRef, { artistName: f.name, artistNameAt: FieldValue.serverTimestamp() });
  });
  return { artistName: f.name };
});

// ── PRO 개인 백업 ──────────────────────────────────────────────────────────────────────────
// 파일은 내용 해시 이름(backups/{uid}/blobs/{sha256}). 올라오면 서버가 다시 해시를 재고, PRO·용량을 확인해 사용량에 더한다.
const BACKUP_BLOB = /^backups\/([^/]+)\/blobs\/([0-9a-f]{64})$/;
const CONTEST_FILE = /^contests\/([^/]+)\/([^/]+)\/([A-Za-z0-9_-]{8,64})\.zip$/;

exports.onUploaded = onObjectFinalized({ memory: '1GiB', timeoutSeconds: 120 }, async event => {
  const name = event.data.name, size = Number(event.data.size || 0);
  let m = BACKUP_BLOB.exec(name);
  if (m) return backupFinalized(m[1], m[2], name, size);
  m = CONTEST_FILE.exec(name);
  if (m) return contestFinalized(m[1], m[2], m[3], name);
  return null;
});

async function backupFinalized(uid, sha, name, size) {
  const file = bucket().file(name);
  const [bytes] = await file.download();
  const real = crypto.createHash('sha256').update(bytes).digest('hex');
  const ref = db.doc(`users/${uid}`), counted = db.doc(`users/${uid}/blobs/${sha}`);
  let keep = false;
  await db.runTransaction(async tx => {
    const u = (await tx.get(ref)).data() || {}, seen = await tx.get(counted);
    const pro = proActive(u);
    if (seen.exists && real === sha) { keep = true; return; }   // 같은 파일을 다시 올림 — 이미 센 것, 다시 더하지 않는다
    const used = Number(u.backupBytes || 0);
    keep = real === sha && pro && used + size <= env().backupQuota;
    if (keep) { tx.set(ref, { backupBytes: used + size }, { merge: true }); tx.set(counted, { size }); }
    else tx.set(ref, { backupNotice: real !== sha ? '파일 내용이 이름과 달라 지웠어요.' : !pro ? 'PRO 가 아니어서 백업하지 않았어요.' : '백업 용량을 넘어 이 파일을 올리지 못했어요.' }, { merge: true });
  });
  if (!keep) await file.delete({ ignoreNotFound: true });
  return null;
}

// 센 파일만 뺀다(서버가 거절해 지운 파일은 센 적이 없다).
exports.onBackupDeleted = onObjectDeleted(async event => {
  const m = BACKUP_BLOB.exec(event.data.name);
  if (!m) return null;
  const ref = db.doc(`users/${m[1]}`), counted = db.doc(`users/${m[1]}/blobs/${m[2]}`);
  await db.runTransaction(async tx => {
    const seen = await tx.get(counted);
    if (!seen.exists) return;
    tx.set(ref, { backupBytes: FieldValue.increment(-Number(seen.data().size || 0)) }, { merge: true });
    tx.delete(counted);
  });
  return null;
});

// ── 공모전 ─────────────────────────────────────────────────────────────────────────────────
const KEY = /^[A-Za-z0-9_-]{8,64}$/;

// 접수 시작(또는 재시도). 접수 문서 id = 사용자 uid → 한 공모전에 한 사람 한 건. 같은 제출 키로 다시 부르면 같은 접수다.
exports.createSubmission = onCall(async req => {
  const uid = signedIn(req);
  const { contestId, submissionKey, declared, consentVersion } = req.data || {};
  need(typeof contestId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(contestId), 'invalid-argument', '공모전을 찾을 수 없어요.');
  need(typeof submissionKey === 'string' && KEY.test(submissionKey), 'invalid-argument', '제출 번호가 올바르지 않아요.');
  need(declared && typeof declared.sha256 === 'string' && /^[0-9a-f]{64}$/.test(declared.sha256) && Number.isInteger(declared.bytes) && declared.bytes > 0, 'invalid-argument', '제출 파일 정보가 올바르지 않아요.');
  need(typeof consentVersion === 'string' && consentVersion.length > 0, 'failed-precondition', '참가 동의가 필요해요.');
  const contestRef = db.doc(`contests/${contestId}`), subRef = db.doc(`contests/${contestId}/submissions/${uid}`);
  let out;
  await db.runTransaction(async tx => {
    const contest = (await tx.get(contestRef)).data();
    need(contest && contest.status === 'open', 'failed-precondition', '지금은 접수를 받지 않아요.');
    const now = Date.now();
    need(now >= toMillis(contest.startsAt) && now <= toMillis(contest.endsAt), 'failed-precondition', '접수 기간이 아니에요.');
    need(declared.bytes <= (contest.maxBytes || 120 * 1024 * 1024), 'failed-precondition', '제출 파일이 너무 커요.');
    need(consentVersion === contest.consentVersion, 'failed-precondition', '참가 조건이 바뀌었어요. 다시 확인해 주세요.');
    const snap = await tx.get(subRef), cur = snap.exists ? snap.data() : null;
    if (cur && cur.status === 'received') {
      need(cur.submissionKey === submissionKey, 'already-exists', '이미 접수된 작품이 있어요. 바꾸려면 접수를 철회한 뒤 다시 내 주세요.');
      out = { status: 'received', receiptNo: cur.receiptNo, path: cur.path };
      return;
    }
    const path = `contests/${contestId}/${uid}/${submissionKey}.zip`;
    if (cur && cur.status === 'uploading' && cur.submissionKey === submissionKey) {
      tx.update(subRef, { attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      out = { status: 'uploading', path };
      return;
    }
    tx.set(subRef, {
      uid, contestId, submissionKey, path, status: 'uploading', attempts: 1,
      declared: { sha256: declared.sha256, bytes: declared.bytes, setName: String(declared.setName || '').slice(0, 80), kind: declared.kind === 'still' ? 'still' : 'moving', cuts: Number(declared.cuts) || 0 },
      consent: { version: consentVersion, at: FieldValue.serverTimestamp() },
      review: { state: 'pending', note: '' },
      createdAt: cur ? cur.createdAt : FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      previousPath: cur && cur.path && cur.path !== path ? cur.path : null,
    });
    out = { status: 'uploading', path };
  });
  // 이전 키로 올라가 있던 묶음(실패·바꾼 제출)은 지운다 — 사본이 쌓이지 않게.
  const sub = (await subRef.get()).data();
  if (sub.previousPath) { await bucket().file(sub.previousPath).delete({ ignoreNotFound: true }); await subRef.update({ previousPath: null }); }
  return out;
});

async function contestFinalized(contestId, uid, key, name) {
  const file = bucket().file(name), subRef = db.doc(`contests/${contestId}/submissions/${uid}`);
  const [sub, contest] = await Promise.all([subRef.get(), db.doc(`contests/${contestId}`).get()]);
  if (!sub.exists || sub.data().status !== 'uploading' || sub.data().submissionKey !== key || !contest.exists) {
    await file.delete({ ignoreNotFound: true });
    return null;
  }
  const [bytes] = await file.download();
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const d = sub.data().declared;
  let verdict;
  if (sha !== d.sha256 || bytes.length !== d.bytes) verdict = { ok: false, reason: '올라온 파일이 앱이 만든 묶음과 달라요(끊긴 업로드일 수 있어요). 다시 제출해 주세요.' };
  else verdict = checkPackage(bytes, contest.data().requirements || {});
  if (!verdict.ok) {
    await file.delete({ ignoreNotFound: true });
    await subRef.update({ status: 'rejected', reason: verdict.reason, updatedAt: FieldValue.serverTimestamp() });
    return null;
  }
  await db.runTransaction(async tx => {
    const c = await tx.get(db.doc(`contests/${contestId}`));
    const s = await tx.get(subRef);
    if (s.data().status !== 'uploading' || s.data().submissionKey !== key) return;
    const seq = Number(c.data().receiptSeq || 0) + 1;
    tx.update(db.doc(`contests/${contestId}`), { receiptSeq: seq });
    tx.update(subRef, {
      status: 'received', receiptNo: `${c.data().code || 'E'}-${String(seq).padStart(5, '0')}`,
      file: { path: name, bytes: bytes.length, sha256: sha, cuts: verdict.cuts, formats: verdict.formats, animated: verdict.animated },
      receivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return null;
}

exports.withdrawSubmission = onCall(async req => {
  const uid = signedIn(req);
  const contestId = String(req.data?.contestId || '');
  const subRef = db.doc(`contests/${contestId}/submissions/${uid}`), contest = (await db.doc(`contests/${contestId}`).get()).data();
  const sub = (await subRef.get()).data();
  need(sub, 'not-found', '접수한 작품이 없어요.');
  need(contest && contest.status === 'open', 'failed-precondition', '접수 기간이 끝나 철회할 수 없어요.');
  await bucket().file(sub.path).delete({ ignoreNotFound: true });
  await subRef.update({ status: 'withdrawn', updatedAt: FieldValue.serverTimestamp() });
  return { status: 'withdrawn' };
});

// 끊긴 업로드 정리: '올리는 중'으로 오래 남은 접수의 파일을 지우고 '만료'로 둔다(다시 제출하면 새로 시작).
async function cleanupStale(now = Date.now()) {
  const limit = now - env().staleHours * 3600 * 1000;
  const snap = await db.collectionGroup('submissions').where('status', '==', 'uploading').get();
  let expired = 0;
  for (const doc of snap.docs) {
    if (toMillis(doc.data().updatedAt) > limit) continue;
    await bucket().file(doc.data().path).delete({ ignoreNotFound: true });
    await doc.ref.update({ status: 'expired', updatedAt: FieldValue.serverTimestamp() });
    expired++;
  }
  return expired;
}
exports.cleanupStaleUploads = onSchedule('every 24 hours', async () => { await cleanupStale(); });

// ── 관리자 ─────────────────────────────────────────────────────────────────────────────────
exports.adminSaveContest = onCall(async req => {
  adminOnly(req);
  const c = req.data || {};
  need(typeof c.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(c.id), 'invalid-argument', '공모전 id 가 필요해요.');
  need(typeof c.title === 'string' && c.title.trim(), 'invalid-argument', '제목이 필요해요.');
  need(['draft', 'open', 'closed', 'judging', 'announced'].includes(c.status), 'invalid-argument', '상태가 올바르지 않아요.');
  const req0 = c.requirements || {};
  need(['still', 'moving'].includes(req0.kind) && Number.isInteger(req0.cuts) && req0.cuts > 0 && req0.cuts <= 64, 'invalid-argument', '접수 규격(종류·칸 수)이 필요해요.');
  const doc = {
    title: c.title.trim(), code: String(c.code || 'E').slice(0, 8), notice: String(c.notice || ''), rules: String(c.rules || ''),
    consentVersion: String(c.consentVersion || '1'), status: c.status,
    startsAt: Number(c.startsAt), endsAt: Number(c.endsAt),
    requirements: { kind: req0.kind, cuts: req0.cuts, minAnimated: Number(req0.minAnimated || 0) },
    maxBytes: Math.min(Number(c.maxBytes || 120 * 1024 * 1024), 120 * 1024 * 1024),
    target: String(c.target || ''), updatedAt: FieldValue.serverTimestamp(),
  };
  need(Number.isFinite(doc.startsAt) && Number.isFinite(doc.endsAt) && doc.endsAt > doc.startsAt, 'invalid-argument', '기간이 올바르지 않아요.');
  await db.doc(`contests/${c.id}`).set(doc, { merge: true });
  return { id: c.id };
});

exports.adminListSubmissions = onCall(async req => {
  adminOnly(req);
  const snap = await db.collection(`contests/${String(req.data?.contestId || '')}/submissions`).get();
  return { submissions: snap.docs.map(d => { const s = d.data(); return { uid: d.id, status: s.status, receiptNo: s.receiptNo || null, setName: s.declared?.setName || '', kind: s.declared?.kind, cuts: s.file?.cuts || 0, bytes: s.file?.bytes || s.declared?.bytes || 0, path: s.path, review: s.review, reason: s.reason || null, attempts: s.attempts || 0 }; }) };
});

const REVIEW = ['pending', 'shortlisted', 'selected', 'not_selected'];
exports.adminSetReview = onCall(async req => {
  adminOnly(req);
  const { contestId, uid, state, note } = req.data || {};
  need(REVIEW.includes(state), 'invalid-argument', '심사 상태가 올바르지 않아요.');
  const ref = db.doc(`contests/${contestId}/submissions/${uid}`);
  const s = (await ref.get()).data();
  need(s && s.status === 'received', 'failed-precondition', '접수된 작품만 심사할 수 있어요.');
  await ref.update({ review: { state, note: String(note || '').slice(0, 500), at: FieldValue.serverTimestamp() } });
  return { state };
});

exports.adminPublishResults = onCall(async req => {
  adminOnly(req);
  const contestId = String(req.data?.contestId || '');
  const subs = await db.collection(`contests/${contestId}/submissions`).where('status', '==', 'received').get();
  const results = subs.docs.filter(d => d.data().review?.state === 'selected').map(d => ({ receiptNo: d.data().receiptNo, setName: d.data().declared?.setName || '' }));
  await db.doc(`contests/${contestId}`).update({ status: 'announced', results, announcedAt: FieldValue.serverTimestamp() });
  return { results };
});

// 비공개 테스트·심사용 PRO 부여(관리자만). 실제 구매로 여는 길(verify-receipt)은 아직 연결 전이다 — source 로 구분한다.
// 체험(trial)은 기간(일)이 꼭 있어야 하고 TRIAL_MAX_DAYS 를 넘지 못한다. 이미 있는 회원(한 번 로그인한 사람)에게만 준다.
// 끝낼 때(active=false)는 endedAt 을 남긴다 — 보관 기간 계산의 기준.
exports.adminSetPro = onCall(async req => {
  adminOnly(req);
  const { uid, active, source, days } = req.data || {};
  need(typeof uid === 'string' && /^(kakao|naver|google):[A-Za-z0-9_.-]{1,128}$/.test(uid), 'invalid-argument', '회원 번호가 올바르지 않아요.');
  need(['trial', 'admin'].includes(source), 'invalid-argument', '부여 출처는 trial 또는 admin 이에요(구매 검증은 별도).');
  const ref = db.doc(`users/${uid}`);
  need((await ref.get()).exists, 'not-found', '한 번 이상 로그인한 회원에게만 줄 수 있어요.');
  if (active !== true) {
    await ref.set({ pro: { active: false, source, verified: false, at: FieldValue.serverTimestamp(), endedAt: Date.now(), until: null } }, { merge: true });
    return { ok: true };
  }
  const d = Number(days);
  if (source === 'trial') need(Number.isInteger(d) && d >= 1 && d <= env().trialMaxDays, 'invalid-argument', `체험 기간은 1~${env().trialMaxDays}일이에요.`);
  else need(days == null || (Number.isInteger(d) && d >= 1 && d <= 3650), 'invalid-argument', '기간이 올바르지 않아요.');
  const until = days == null ? null : Date.now() + d * 864e5;
  await ref.set({ pro: { active: true, source, verified: false, at: FieldValue.serverTimestamp(), until, endedAt: null } }, { merge: true });
  return { ok: true, until };
});

// 보관 기간: 매일 '지울 대상'을 세어 ops/retention 에 남긴다(지우지 않음). 실제 삭제는 RETENTION_AUTO_DELETE=true + 관리자 실행 때만.
exports.retentionReport = onSchedule('every 24 hours', async () => { await retention.run({ db, bucket, proActive, FieldValue }); });
exports.adminRetention = onCall(async req => {
  adminOnly(req);
  const apply = req.data?.apply === true;
  need(!apply || retention.settings().autoDelete, 'failed-precondition', '자동 삭제가 꺼져 있어요(보관 정책 확정 전). RETENTION_AUTO_DELETE 를 켜기 전에는 세기만 해요.');
  return retention.run({ db, bucket, now: Number(req.data?.now) || Date.now(), apply, proActive, FieldValue });
});
exports.adminCleanupNow = onCall(async req => { adminOnly(req); return { expired: await cleanupStale(Number(req.data?.now) || Date.now()) }; });

// ── 탈퇴 ───────────────────────────────────────────────────────────────────────────────────
// 본인 데이터 전부: 개인 백업 파일·목록, 회원 문서, 공모전 접수 문서와 파일, 로그인 계정.
exports.deleteMyAccount = onCall(async req => {
  const uid = signedIn(req);
  need(req.data?.confirm === 'DELETE', 'failed-precondition', '탈퇴 확인이 필요해요.');
  await bucket().deleteFiles({ prefix: `backups/${uid}/` });
  const sets = await db.collection(`backups/${uid}/sets`).get();
  for (const d of sets.docs) await d.ref.delete();
  const subs = await db.collectionGroup('submissions').where('uid', '==', uid).get();
  for (const d of subs.docs) { await bucket().file(d.data().path).delete({ ignoreNotFound: true }); await d.ref.delete(); }
  const blobs = await db.collection(`users/${uid}/blobs`).get();
  for (const d of blobs.docs) await d.ref.delete();
  const name = (await db.doc(`users/${uid}`).get()).data()?.artistName;
  if (name) await db.doc(`artistNames/${artist.key(name)}`).delete();   // 탈퇴하면 작가명도 풀린다(개인 정보 삭제)
  await db.doc(`users/${uid}`).delete();
  await getAuth().deleteUser(uid).catch(() => {});
  return { deleted: { backupSets: sets.size, submissions: subs.size } };
});

exports._test = { cleanupStale };
