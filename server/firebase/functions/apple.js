// Apple 로그인(iOS, 2026-10-27) — App Store 심사 지침 4.8: 다른 회사 로그인을 쓰면 Apple 로그인을 함께 제공해야 한다.
//
//  앱(iOS)  ── signInAsync({ nonce: sha256(raw) }) ──▶ Apple  ── identityToken(JWT) · authorizationCode ──▶ 앱
//  앱  ── exchangeApple({ identityToken, nonce: raw, authorizationCode }) ──▶ 서버
//       서버: Apple 공개키(appleid.apple.com/auth/keys)로 서명 확인 · iss · aud(번들 ID) · exp · nonce(sha256(raw)) 확인
//       → uid 'apple:<sub>' Firebase 로그인 토큰. 앱이 들고 온 토큰을 믿지 않고 서버가 서명으로 확인한다(다른 회사와 같은 원칙).
//  - 이메일·이름을 요청하지 않는다(식별자 sub 만). 다른 회사 로그인과 같다.
//  - 탈퇴하면 Apple 토큰을 철회한다(지침 5.1.1(v)). 철회에는 refresh_token 과 Apple 로그인 키(.p8)로 만든 client secret 이 필요하다:
//    로그인 때 authorizationCode 를 서버가 바로 refresh_token 으로 바꿔 서버 전용 문서(appleTokens/<uid>)에 둔다.
//    .p8 은 Secret Manager(APPLE_SIGNIN_KEY)에만. Team ID·Key ID 는 공개값이라 환경 변수(APPLE_TEAM_ID·APPLE_KEY_ID).
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const crypto = require('node:crypto');

const APPLE_KEY = defineSecret('APPLE_SIGNIN_KEY');
const ISSUER = 'https://appleid.apple.com';
const conf = () => ({
  bundleId: process.env.APPLE_BUNDLE_ID || 'com.emoticonstudio.app',
  teamId: process.env.APPLE_TEAM_ID || '',
  keyId: process.env.APPLE_KEY_ID || '',
  keysUrl: process.env.APPLE_KEYS_URL || `${ISSUER}/auth/keys`,
  tokenUrl: process.env.APPLE_TOKEN_URL || `${ISSUER}/auth/token`,
  revokeUrl: process.env.APPLE_REVOKE_URL || `${ISSUER}/auth/revoke`,
});
const sha256Hex = s => crypto.createHash('sha256').update(s).digest('hex');
const part = s => JSON.parse(Buffer.from(String(s || ''), 'base64url').toString('utf8'));

// 공개키는 자주 바뀌지 않는다 — 한 시간 보관, 모르는 kid 가 오면 한 번 새로 받는다.
let keyCache = { at: 0, keys: [] };
async function appleKeys(force = false, get = fetch) {
  if (!force && keyCache.keys.length && Date.now() - keyCache.at < 3600e3) return keyCache.keys;
  const res = await get(conf().keysUrl);
  const body = await res.json();
  keyCache = { at: Date.now(), keys: Array.isArray(body && body.keys) ? body.keys : [] };
  return keyCache.keys;
}

// identityToken 확인. 맞으면 sub, 아니면 이유를 던진다.
async function verifyIdentity(token, rawNonce, { now = Date.now(), keys = appleKeys } = {}) {
  const [h, p, s] = String(token || '').split('.');
  if (!h || !p || !s) throw new Error('apple token shape');
  const header = part(h), claims = part(p);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('apple alg');
  let jwk = (await keys()).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await keys(true)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('apple kid');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('apple signature');
  if (claims.iss !== ISSUER) throw new Error('apple iss');
  if (claims.aud !== conf().bundleId) throw new Error('apple aud');
  if (!(Number(claims.exp) * 1000 > now) || !claims.sub) throw new Error('apple exp/sub');
  // 앱은 sha256(raw) 를 Apple 에 nonce 로 넘기고, 서버에는 raw 를 보낸다 → 다른 곳에서 받은 토큰을 다시 쓸 수 없다.
  if (!rawNonce || claims.nonce !== sha256Hex(rawNonce)) throw new Error('apple nonce');
  return String(claims.sub);
}

// Apple 로그인 키로 만든 client secret(ES256 JWT, 5분).
function clientSecret(p8, now = Date.now()) {
  const c = conf(), iat = Math.floor(now / 1000);
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${enc({ alg: 'ES256', kid: c.keyId })}.${enc({ iss: c.teamId, iat, exp: iat + 300, aud: ISSUER, sub: c.bundleId })}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${data}.${sig}`;
}
const keyReady = p8 => !!(p8 && conf().teamId && conf().keyId);

module.exports = ({ db, ensureUser }) => {
  const exchangeApple = onCall({ secrets: [APPLE_KEY] }, async req => {
    const token = String(req.data?.identityToken || ''), nonce = String(req.data?.nonce || ''), code = String(req.data?.authorizationCode || '');
    if (token.length < 20 || token.length > 8000 || nonce.length < 16 || nonce.length > 128) throw new HttpsError('invalid-argument', '로그인 정보가 올바르지 않아요.');
    let sub;
    try { sub = await verifyIdentity(token, nonce); }
    catch (e) { console.error('apple', e.message); throw new HttpsError('unauthenticated', 'Apple 로그인을 확인하지 못했어요. 다시 시도해 주세요.'); }
    const uid = `apple:${sub}`;
    await ensureUser(uid, 'apple');
    // 탈퇴 때 철회할 refresh_token. 키가 아직 없거나 실패해도 로그인은 막지 않는다(기록만).
    const p8 = APPLE_KEY.value();
    if (code && keyReady(p8)) {
      try {
        const res = await fetch(conf().tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: conf().bundleId, client_secret: clientSecret(p8), code, grant_type: 'authorization_code' }) });
        const t = await res.json().catch(() => null);
        if (t && t.refresh_token) await db.doc(`appleTokens/${uid}`).set({ refreshToken: t.refresh_token, at: Date.now() });
        else console.error('apple token exchange', t && t.error);
      } catch (e) { console.error('apple token exchange', e.message); }
    }
    const [custom, user] = await Promise.all([getAuth().createCustomToken(uid, { provider: 'apple' }), db.doc(`users/${uid}`).get()]);
    return { token: custom, artistName: (user.exists && user.data().artistName) || null };
  });

  // 탈퇴: Apple 토큰 철회 + 서버 전용 문서 삭제. Apple 계정이 아니면 아무것도 하지 않는다.
  async function revokeApple(uid) {
    if (!uid.startsWith('apple:')) return 'skip';
    const ref = db.doc(`appleTokens/${uid}`), doc = await ref.get();
    const p8 = APPLE_KEY.value();
    let result = 'no-token';
    if (doc.exists && keyReady(p8)) {
      const res = await fetch(conf().revokeUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: conf().bundleId, client_secret: clientSecret(p8), token: doc.data().refreshToken, token_type_hint: 'refresh_token' }) });
      result = res.ok ? 'revoked' : `revoke-failed-${res.status}`;
      if (!res.ok) console.error('apple revoke', res.status);
    }
    await ref.delete();
    return result;
  }
  return { exchangeApple, revokeApple, APPLE_KEY };
};
module.exports._test = { verifyIdentity, clientSecret, sha256Hex, resetKeys: () => { keyCache = { at: 0, keys: [] }; } };
