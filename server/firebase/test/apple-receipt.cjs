// App Store 서명 거래(JWS) 확인 — server/firebase/functions/apple-receipt.js.
// 진짜 Apple 키는 없으므로 이 검사가 openssl 로 '가짜 루트 → 중간 → 말단' 사슬을 만들어, 같은 확인 코드에 가짜 루트를 넘긴다.
// 확인: 올바른 거래 통과 · 번들/서명/사슬/기간/형식 틀리면 거절 · 샌드박스 표시 · 환불 표시 · 실제 Apple 루트 지문.
// 실행: node server/firebase/test/apple-receipt.cjs   (openssl 필요)
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const apple = require('../functions/apple-receipt.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-jws-'));
const ssl = (...a) => execFileSync('openssl', a, { cwd: dir, stdio: 'pipe' });
const ec = name => ssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', name + '.key');
ec('root'); ec('mid'); ec('leaf');
fs.writeFileSync(path.join(dir, 'ca.ext'), 'basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n');
ssl('req', '-x509', '-new', '-key', 'root.key', '-subj', '/CN=Fake Root', '-days', '3650', '-out', 'root.pem', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign');
ssl('req', '-new', '-key', 'mid.key', '-subj', '/CN=Fake WWDR', '-out', 'mid.csr');
ssl('x509', '-req', '-in', 'mid.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-days', '3650', '-extfile', 'ca.ext', '-out', 'mid.pem');
ssl('req', '-new', '-key', 'leaf.key', '-subj', '/CN=Fake StoreKit', '-out', 'leaf.csr');
ssl('x509', '-req', '-in', 'leaf.csr', '-CA', 'mid.pem', '-CAkey', 'mid.key', '-CAcreateserial', '-days', '3650', '-out', 'leaf.pem');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const b64 = pem => new crypto.X509Certificate(pem).raw.toString('base64');
const root = new crypto.X509Certificate(read('root.pem'));
const leafKey = crypto.createPrivateKey(read('leaf.key'));
const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (payload, { x5c = [b64(read('leaf.pem')), b64(read('mid.pem'))], key = leafKey, alg = 'ES256' } = {}) => {
  const data = `${enc({ alg, x5c })}.${enc(payload)}`;
  return `${data}.${crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
};
const good = { bundleId: 'com.emoticonstudio.app', productId: 'pro_lifetime', originalTransactionId: '2000000123', transactionId: '2000000123', type: 'Non-Consumable', environment: 'Production' };
const v = (jws, o = {}) => apple.verifyTransaction(jws, { root, ...o });

const t = v(sign(good));
assert.deepStrictEqual([t.productId, t.originalTransactionId, t.sandbox, t.revoked], ['pro_lifetime', '2000000123', false, false]);
assert.strictEqual(v(sign({ ...good, environment: 'Sandbox' })).sandbox, true, '샌드박스 표시');
assert.strictEqual(v(sign({ ...good, revocationDate: 1793000000000 })).revoked, true, '환불 표시');
const bad = (fn, why) => assert.throws(fn, new RegExp(why));
bad(() => v(sign({ ...good, bundleId: 'com.other.app' })), 'bundle');
bad(() => v(sign(good, { alg: 'RS256' })), 'alg');
bad(() => v(sign(good, { x5c: [b64(read('leaf.pem'))] })), 'x5c');
bad(() => v(sign(good, { key: crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey })), 'signature');
const parts = sign(good).split('.'); parts[1] = enc({ ...good, productId: 'pro_free' });
bad(() => v(parts.join('.')), 'signature');
bad(() => v(sign(good, { x5c: [b64(read('leaf.pem')), b64(read('root.pem'))] })), 'chain');   // 중간을 건너뛴 사슬
assert.throws(() => apple.verifyTransaction(sign(good)), /chain|root/, '실제 Apple 루트로는 가짜 사슬이 통과하지 않음');
bad(() => v(sign(good), { now: Date.now() + 20 * 365 * 864e5 }), 'expired');
bad(() => v('abc'), 'shape');
assert.strictEqual(apple.ROOT_FINGERPRINT, '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79');
fs.rmSync(dir, { recursive: true, force: true });
console.log('PASS: apple receipt — 사슬·서명·기간·번들·형식 확인, 바꾼 내용/다른 키/끊긴 사슬/가짜 루트 거절, 샌드박스·환불 표시, Apple Root G3 지문');
