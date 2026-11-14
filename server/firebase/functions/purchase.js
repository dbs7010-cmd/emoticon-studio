// PRO 구매 확인(영수증 서버, 2026-10-13). 앱이 받은 Google Play 구매 토큰을 **서버가** Play Developer API 에 직접 묻고,
// 확인된 구매만 회원 문서의 PRO 를 연다. 앱이 "샀다"고 하는 말은 믿지 않는다.
//
//  - 입력: POST /receipt  { platform:'android', productId, purchaseToken } + Authorization: Bearer <Firebase ID 토큰>
//    (app/src/services/receipt.ts 의 모양 그대로). 대답: { verified, plan:'lifetime', sandbox?, reason? }.
//  - 한 구매 토큰은 한 emoti 계정에만 묶인다(purchases/{토큰 해시}). 다른 계정이 같은 토큰을 내면 거절한다.
//  - Play API 접근: 함수의 서비스 계정 권한(메타데이터 서버 토큰, androidpublisher 범위). 키 파일·비밀 값 없음.
//    운영자가 Play Console › 사용자 및 권한에서 이 서비스 계정을 초대해야 한다(22번 문서).
//  - 구매 확정(acknowledge)은 앱이 서버 확인 뒤에 한다(pro.ts confirm → finishPurchase). 서버는 상태만 본다.
//  - 환불·취소: 하루 한 번 voidedpurchases 를 읽어 해당 구매의 PRO 를 닫는다(작품은 그대로).
//  - 테스트 구매(라이선스 테스터): PURCHASE_ACCEPT_TEST=true 일 때만 받아들이고 sandbox 로 표시한다.
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('node:crypto');
const apple = require('./apple-receipt');

const PACKAGE = 'com.emoticonstudio.app';
const PRODUCTS = { pro_lifetime: 'lifetime' };   // 지금 파는 것은 한 번 구매 PRO 하나
const conf = () => ({
  apiBase: (process.env.PLAY_API_BASE || 'https://androidpublisher.googleapis.com').replace(/\/$/, ''),
  acceptTest: process.env.PURCHASE_ACCEPT_TEST === 'true',
  // 에뮬레이터는 가짜 Play 서버를 보므로 토큰이 필요 없다. 운영은 반드시 메타데이터 서버 토큰을 쓴다.
  fakeToken: process.env.PLAY_API_FAKE_TOKEN || '',
});
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

async function playToken() {
  const c = conf();
  if (c.fakeToken) return c.fakeToken;
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=https://www.googleapis.com/auth/androidpublisher',
    { headers: { 'Metadata-Flavor': 'Google' } });
  if (!r.ok) throw new Error('metadata token ' + r.status);
  return (await r.json()).access_token;
}
async function play(path) {
  const r = await fetch(conf().apiBase + '/androidpublisher/v3/applications/' + PACKAGE + path, { headers: { authorization: 'Bearer ' + await playToken() } });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

module.exports = ({ db }) => {
  const answer = (res, verified, extra = {}) => res.status(200).set('cache-control', 'no-store').json({ verified, plan: 'lifetime', ...extra });

  const verifyPurchase = onRequest({ cors: false }, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('POST only');
    // 1) 누가 샀나: 로그인 토큰을 서버가 확인한다.
    let uid;
    try { uid = (await getAuth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer /, ''))).uid; }
    catch { return answer(res, false, { reason: '로그인한 뒤 구매 복원을 눌러 주세요.' }); }
    // 2) 무엇을: 형식만 맞는지 본다.
    const { platform, productId, purchaseToken } = req.body || {};
    if (platform !== 'android' && platform !== 'ios') return answer(res, false, { reason: '이 기기의 구매는 아직 확인할 수 없어요.' });
    if (!PRODUCTS[productId]) return answer(res, false, { reason: '알 수 없는 상품이에요.' });
    if (typeof purchaseToken !== 'string' || purchaseToken.length < 10 || purchaseToken.length > 16384) return answer(res, false, { reason: '구매 정보가 올바르지 않아요.' });
    // iOS(2026-10-28): Apple 이 서명한 거래(JWS)를 서버가 인증서 사슬·서명으로 확인한다(apple-receipt.js). 한 구매 = 원거래 ID.
    if (platform === 'ios') {
      let t;
      try { t = apple.verifyTransaction(purchaseToken); } catch (e) { console.error('apple verify', e.message); return answer(res, false, { reason: 'App Store 구매를 확인하지 못했어요.' }); }
      if (t.productId !== productId) return answer(res, false, { reason: '이 구매는 요청한 상품이 아니에요.' });
      if (t.revoked) return answer(res, false, { reason: '취소되었거나 환불된 구매예요.' });
      return bind(res, uid, 'ios:' + t.originalTransactionId, productId, t.sandbox, t.transactionId);
    }
    // 3) Play 에 직접 묻는다. 물어보지 못하면 '아니다'가 아니라 연결 실패(5xx) — 앱은 기존 권한을 건드리지 않는다.
    let p;
    try { p = await play(`/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`); }
    catch (e) { console.error('play api', e.message); return res.status(503).send('play unreachable'); }
    if (p.status === 404 || p.status === 400 || p.status === 410) return answer(res, false, { reason: 'Play 스토어가 이 구매를 찾지 못했어요.' });
    if (p.status !== 200) { console.error('play api status', p.status, JSON.stringify(p.body).slice(0, 300)); return res.status(503).send('play error'); }
    const g = p.body;
    if (g.productId !== undefined && g.productId !== productId) return answer(res, false, { reason: '이 구매는 요청한 상품이 아니에요.' });
    if (g.purchaseState === 2) return answer(res, false, { reason: '결제가 아직 끝나지 않았어요. 완료되면 구매 복원을 눌러 주세요.' });
    if (g.purchaseState !== 0) return answer(res, false, { reason: '취소되었거나 환불된 구매예요.' });
    const sandbox = g.purchaseType === 0;   // 0 = 라이선스 테스터의 테스트 구매
    if (sandbox && !conf().acceptTest) return answer(res, false, { reason: '테스트 구매는 이 서버에서 받지 않아요.', sandbox: true });
    return bind(res, uid, purchaseToken, productId, sandbox, g.orderId || null);
  });

  // 4) 한 구매 = 한 계정. 트랜잭션으로 묶고 PRO 를 연다. Android 는 구매 토큰, iOS 는 'ios:'+원거래 ID 를 해시해 열쇠로 쓴다.
  async function bind(res, uid, identity, productId, sandbox, orderId) {
    const key = sha256(identity), ref = db.doc(`purchases/${key}`), userRef = db.doc(`users/${uid}`);
    let taken = false;
    await db.runTransaction(async tx => {
      const [s, u] = await Promise.all([tx.get(ref), tx.get(userRef)]);
      if (s.exists && s.data().uid !== uid) { taken = true; return; }
      if (s.exists && s.data().state === 'voided') { taken = 'voided'; return; }
      tx.set(ref, { uid, productId, orderId, sandbox, state: 'active', checkedAt: FieldValue.serverTimestamp(), ...(s.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
      const pro = { active: true, source: 'store', verified: true, productId, purchase: key, since: (u.exists && u.data().pro && u.data().pro.source === 'store' && u.data().pro.since) || Date.now(), until: null, ...(sandbox ? { sandbox: true } : {}) };
      tx.set(userRef, { pro }, { merge: true });
    });
    if (taken === 'voided') return answer(res, false, { reason: '환불된 구매예요.' });
    if (taken) return answer(res, false, { reason: '이 구매는 다른 emoti 계정에 연결되어 있어요. 처음 산 계정으로 로그인해 주세요.' });
    return answer(res, true, sandbox ? { sandbox: true } : {});
  }

  // 환불·취소된 구매(최근 30일, 하루 한 번). 그 구매로 열린 PRO 만 닫는다 — 체험·관리자 PRO 와 작품은 건드리지 않는다.
  async function syncVoided(now = Date.now()) {
    const since = now - 30 * 864e5;
    let pageToken = '', closed = 0, seen = 0;
    do {
      const r = await play(`/purchases/voidedpurchases?startTime=${since}&maxResults=1000${pageToken ? '&token=' + encodeURIComponent(pageToken) : ''}`);
      if (r.status !== 200) throw new Error('voided ' + r.status);
      for (const v of r.body.voidedPurchases || []) {
        seen++;
        const ref = db.doc(`purchases/${sha256(v.purchaseToken)}`);
        const s = await ref.get();
        if (!s.exists || s.data().state === 'voided') continue;
        await ref.set({ state: 'voided', voidedAt: Number(v.voidedTimeMillis) || now }, { merge: true });
        const u = await db.doc(`users/${s.data().uid}`).get();
        if (u.exists && u.data().pro && u.data().pro.purchase === s.id) { await u.ref.set({ pro: { ...u.data().pro, active: false, endedAt: now, endedBy: 'voided' } }, { merge: true }); closed++; }
      }
      pageToken = (r.body.tokenPagination && r.body.tokenPagination.nextPageToken) || '';
    } while (pageToken);
    return { seen, closed };
  }
  const syncVoidedPurchases = onSchedule({ schedule: 'every day 04:30', timeZone: 'Asia/Seoul' }, async () => {
    try { const r = await syncVoided(); console.log('voided', JSON.stringify(r)); } catch (e) { console.error('voided sync', e.message); }
  });

  return { verifyPurchase, syncVoidedPurchases, _syncVoided: syncVoided };
};
module.exports.PRODUCTS = PRODUCTS;
module.exports.PACKAGE = PACKAGE;
