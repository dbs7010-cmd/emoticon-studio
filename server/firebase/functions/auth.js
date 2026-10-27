// 로그인 중계(2026-10-07). 카카오·네이버·구글 모두 같은 방식 — 각 회사의 '인가 코드' 로그인을 서버가 대신 끝낸다.
//
//  앱(또는 웹 탈퇴 페이지)  ──① /auth/start?provider=…&return=app|web&challenge=sha256(verifier)──▶  authStart
//        ▲                                                                                              │ ② 회사 로그인 화면으로(상태값 state)
//        │ ⑤ redeemAuth({ticket, verifier}) → Firebase 로그인 토큰                                      ▼
//        └──── ④ emoti://auth?ticket=…  (웹은 /account/#ticket=…) ◀── authCallback{Kakao|Naver|Google} ◀── ③ 회사가 code·state 를 돌려줌
//
//  - 클라이언트 비밀값(Client Secret)은 서버 비밀(Secret Manager)에만 있다. 앱에는 어떤 회사 키도 넣지 않는다.
//  - 회사 토큰은 서버가 비밀값으로 직접 받아 쓰고 버린다 → 다른 앱에서 받은 토큰을 들고 와 로그인할 길이 없다
//    (네이버 nid/me 는 토큰이 어느 앱 것인지 알려 주지 않으므로, 앱이 보낸 토큰을 믿는 방식은 쓰지 않는다).
//  - state 는 한 번만·10분 안에만. ticket 은 한 번만·2분 안에만, 그리고 시작할 때 낸 challenge 의 원래 값(verifier)을
//    가진 쪽만 바꿀 수 있다 → emoti:// 주소를 다른 앱이 가로채도 로그인할 수 없다.
//  - 회원 식별자만 받는다(카카오 회원번호·네이버 고유 ID·구글 sub). 이메일·이름·전화번호를 요청하지 않는다.
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('node:crypto');

const SECRETS = {
  kakao: defineSecret('KAKAO_CLIENT_SECRET'),
  naver: defineSecret('NAVER_CLIENT_SECRET'),
  google: defineSecret('GOOGLE_CLIENT_SECRET'),
};
const conf = () => ({
  base: (process.env.AUTH_BASE_URL || '').replace(/\/$/, ''),           // 예: https://<프로젝트 ID>.web.app (Hosting 이 /auth/* 를 함수로 넘김)
  appReturn: process.env.AUTH_APP_RETURN || 'emoti://auth',
  ids: { kakao: process.env.KAKAO_REST_KEY || '', naver: process.env.NAVER_CLIENT_ID || '', google: process.env.GOOGLE_CLIENT_ID || '' },
  kakaoAuth: process.env.KAKAO_AUTH_BASE || 'https://kauth.kakao.com',
  kakaoApi: process.env.KAKAO_API_BASE || 'https://kapi.kakao.com',
  naverAuth: process.env.NAVER_AUTH_BASE || 'https://nid.naver.com',
  naverApi: process.env.NAVER_API_BASE || 'https://openapi.naver.com',
  googleAuth: process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
  googleToken: process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
});
const PROVIDERS = ['kakao', 'naver', 'google'];
const callbackUrl = p => `${conf().base}/auth/callback/${p}`;
const webReturn = () => `${conf().base}/account/`;
const rand = () => crypto.randomBytes(32).toString('base64url');
const sha256Hex = s => crypto.createHash('sha256').update(s).digest('hex');
const STATE_MS = 10 * 60 * 1000, TICKET_MS = 2 * 60 * 1000;

// 회사 화면 주소(공식 문서 2026-10-07 확인: 카카오 REST API 문서, 네이버 로그인 SDK 소스·위키, 구글 OAuth 2.0)
function authorizeUrl(p, state) {
  const c = conf(), q = new URLSearchParams({ response_type: 'code', client_id: c.ids[p], redirect_uri: callbackUrl(p), state });
  if (p === 'kakao') return `${c.kakaoAuth}/oauth/authorize?${q}`;
  if (p === 'naver') return `${c.naverAuth}/oauth2.0/authorize?${q}`;
  q.set('scope', 'openid'); q.set('prompt', 'select_account');   // 구글: 식별자(sub)만 — 이메일·프로필 범위를 요청하지 않는다
  return `${c.googleAuth}?${q}`;
}

async function jsonOf(res) { try { return await res.json(); } catch { return null; } }
// 코드 → 회사 토큰 → 회원 식별자. 실패하면 이유를 던진다(사용자에게는 짧은 문구만).
async function identify(p, code, state, secret) {
  const c = conf();
  if (p === 'kakao') {
    const t = await jsonOf(await fetch(`${c.kakaoAuth}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: c.ids.kakao, redirect_uri: callbackUrl('kakao'), code, client_secret: secret }) }));
    if (!t || !t.access_token) throw new Error('kakao token: ' + (t && (t.error_code || t.error) || 'no body'));
    const me = await jsonOf(await fetch(`${c.kakaoApi}/v2/user/me`, { headers: { Authorization: `Bearer ${t.access_token}` } }));
    if (!me || !me.id) throw new Error('kakao me');
    return String(me.id);
  }
  if (p === 'naver') {
    const q = new URLSearchParams({ grant_type: 'authorization_code', client_id: c.ids.naver, client_secret: secret, code, state });
    const t = await jsonOf(await fetch(`${c.naverAuth}/oauth2.0/token?${q}`));
    if (!t || !t.access_token) throw new Error('naver token: ' + (t && t.error || 'no body'));
    const me = await jsonOf(await fetch(`${c.naverApi}/v1/nid/me`, { headers: { Authorization: `Bearer ${t.access_token}` } }));
    if (!me || me.resultcode !== '00' || !me.response || !me.response.id) throw new Error('naver me');
    return String(me.response.id);
  }
  const t = await jsonOf(await fetch(c.googleToken, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: c.ids.google, client_secret: secret, redirect_uri: callbackUrl('google'), code }) }));
  if (!t || !t.id_token) throw new Error('google token: ' + (t && t.error || 'no body'));
  // 토큰 엔드포인트와 서버가 직접(TLS) 주고받은 ID 토큰 — OpenID Connect Core 3.1.3.7 에 따라 서명 대신 TLS 로 발급자를 확인하고
  // 대상(aud)·발급자(iss)·만료(exp)는 직접 확인한다.
  const claims = JSON.parse(Buffer.from(String(t.id_token).split('.')[1] || '', 'base64url').toString('utf8'));
  if (claims.aud !== c.ids.google) throw new Error('google aud');
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)) throw new Error('google iss');
  if (!(Number(claims.exp) * 1000 > Date.now()) || !claims.sub) throw new Error('google exp/sub');
  return String(claims.sub);
}

const page = (res, code, msg) => res.status(code).set('content-type', 'text/html; charset=utf-8').set('cache-control', 'no-store')
  .send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>emoti 이모티</title><p style="font:16px sans-serif;padding:24px">${msg}</p>`);
const back = (ret, params) => ret === 'web' ? `${webReturn()}#${new URLSearchParams(params)}` : `${conf().appReturn}?${new URLSearchParams(params)}`;

module.exports = ({ db, ensureUser }) => {
  const authStart = onRequest({ cors: false }, async (req, res) => {
    const c = conf(), p = String(req.query.provider || ''), ret = req.query.return === 'web' ? 'web' : 'app', challenge = String(req.query.challenge || '');
    if (!PROVIDERS.includes(p) || !/^[0-9a-f]{64}$/.test(challenge)) return page(res, 400, '로그인 요청이 올바르지 않아요.');
    if (!c.base || !c.ids[p]) return page(res, 503, '이 로그인은 아직 서버에 설정되지 않았어요.');
    const state = rand();
    await db.doc(`authStates/${state}`).set({ provider: p, ret, challenge, expiresAt: Date.now() + STATE_MS });
    res.set('cache-control', 'no-store').redirect(302, authorizeUrl(p, state));
  });

  const callback = p => onRequest({ secrets: [SECRETS[p]], cors: false }, async (req, res) => {
    const state = String(req.query.state || ''), code = String(req.query.code || '');
    const ref = db.doc(`authStates/${state.replace(/[^A-Za-z0-9_-]/g, '') || 'none'}`);
    let st = null;
    await db.runTransaction(async tx => { const s = await tx.get(ref); if (s.exists) { st = s.data(); tx.delete(ref); } });   // 한 번만
    if (!st || st.provider !== p || st.expiresAt < Date.now()) return page(res, 400, '로그인 시간이 지났거나 이미 쓴 요청이에요. 앱으로 돌아가 다시 시도해 주세요.');
    if (req.query.error || !code) return res.redirect(302, back(st.ret, { error: req.query.error === 'access_denied' || req.query.error === 'user_cancel' ? 'cancelled' : 'provider' }));
    let id;
    try { id = await identify(p, code, state, SECRETS[p].value()); }
    catch (e) { console.error('auth', p, e.message); return res.redirect(302, back(st.ret, { error: 'verify' })); }
    const uid = `${p}:${id}`;
    await ensureUser(uid, p);
    const ticket = rand();
    await db.doc(`authTickets/${ticket}`).set({ uid, provider: p, challenge: st.challenge, expiresAt: Date.now() + TICKET_MS });
    res.set('cache-control', 'no-store').redirect(302, back(st.ret, { ticket }));
  });

  // 표(ticket) + 시작할 때 숨겨 둔 원래 값(verifier) → Firebase 로그인 토큰. 한 번만.
  const redeemAuth = onCall(async req => {
    const ticket = String(req.data?.ticket || ''), verifier = String(req.data?.verifier || '');
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(ticket) || verifier.length < 32 || verifier.length > 128) throw new HttpsError('invalid-argument', '로그인 정보가 올바르지 않아요.');
    const ref = db.doc(`authTickets/${ticket}`);
    let t = null;
    await db.runTransaction(async tx => { const s = await tx.get(ref); if (s.exists) { t = s.data(); tx.delete(ref); } });
    if (!t || t.expiresAt < Date.now() || t.challenge !== sha256Hex(verifier)) throw new HttpsError('unauthenticated', '로그인을 마치지 못했어요. 다시 시도해 주세요.');
    // 작가명도 함께 돌려준다(2026-10-12): 로그인 직후 registerUser 를 한 번 더 부르지 않아도 다음 화면(작가명/홈)을 고를 수 있다.
    const [token, user] = await Promise.all([getAuth().createCustomToken(t.uid, { provider: t.provider }), db.doc(`users/${t.uid}`).get()]);
    return { token, artistName: (user.exists && user.data().artistName) || null };
  });

  // 오래된 state·ticket 정리(앱이 중간에 닫힌 경우).
  async function cleanupAuth(now = Date.now()) {
    let n = 0;
    for (const col of ['authStates', 'authTickets']) {
      const old = await db.collection(col).where('expiresAt', '<', now).limit(500).get();
      for (const d of old.docs) { await d.ref.delete(); n++; }
    }
    return n;
  }
  return { authStart, authCallbackKakao: callback('kakao'), authCallbackNaver: callback('naver'), authCallbackGoogle: callback('google'), redeemAuth, _cleanupAuth: cleanupAuth };
};
module.exports.PROVIDERS = PROVIDERS;
