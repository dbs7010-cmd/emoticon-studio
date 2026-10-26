// Apple identityToken 확인(apple.js) — 서명 · iss · aud · exp · nonce. 실제 Apple 대신 이 파일이 만든 RSA 키로 서명한다.
// 실행: node server/firebase/test/apple.cjs
const assert = require('node:assert');
const crypto = require('node:crypto');
const { _test: t } = require('../functions/apple.js');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'K1', alg: 'RS256', use: 'sig' };
const keys = async () => [jwk];
const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (claims, header = { alg: 'RS256', kid: 'K1' }, key = privateKey) => {
  const data = `${enc(header)}.${enc(claims)}`;
  return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
};
const raw = 'n0nce-raw-value-0123456789';
const good = { iss: 'https://appleid.apple.com', aud: 'com.emoticonstudio.app', sub: '001234.abcd', exp: Math.floor(Date.now() / 1000) + 600, nonce: t.sha256Hex(raw) };

(async () => {
  assert.strictEqual(await t.verifyIdentity(sign(good), raw, { keys }), '001234.abcd');
  const bad = async (token, nonce, why) => assert.rejects(t.verifyIdentity(token, nonce, { keys }), new RegExp(why));
  await bad(sign({ ...good, aud: 'other.app' }), raw, 'aud');
  await bad(sign({ ...good, iss: 'https://evil.example' }), raw, 'iss');
  await bad(sign({ ...good, exp: 1 }), raw, 'exp');
  await bad(sign(good), 'another-raw-nonce-value', 'nonce');
  await bad(sign(good), '', 'nonce');
  await bad(sign(good, { alg: 'RS256', kid: 'K9' }), raw, 'kid');
  await bad(sign(good, { alg: 'HS256', kid: 'K1' }), raw, 'alg');
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await bad(sign(good, undefined, other), raw, 'signature');
  const parts = sign(good).split('.'); parts[1] = enc({ ...good, sub: 'someone-else' });
  await bad(parts.join('.'), raw, 'signature');
  // client secret: ES256 · 5분 · Apple 이 요구하는 iss/aud/sub
  process.env.APPLE_TEAM_ID = 'TEAM123456'; process.env.APPLE_KEY_ID = 'KEY1234567';
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const cs = t.clientSecret(ec.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const [h, p, s] = cs.split('.');
  assert.deepStrictEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'ES256', kid: 'KEY1234567' });
  const c = JSON.parse(Buffer.from(p, 'base64url'));
  assert.strictEqual(c.iss, 'TEAM123456'); assert.strictEqual(c.aud, 'https://appleid.apple.com'); assert.strictEqual(c.sub, 'com.emoticonstudio.app'); assert.strictEqual(c.exp - c.iat, 300);
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
  console.log('PASS: apple — 서명·iss·aud·exp·nonce·kid·alg 확인, 바꾼 내용·다른 키 거절, client secret ES256 형식');
})().catch(e => { console.error(e); process.exit(1); });
