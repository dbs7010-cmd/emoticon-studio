// App Store 구매 확인(iOS, 2026-10-28). 앱(expo-iap · StoreKit 2)이 보내는 것은 Apple 이 서명한 거래 정보(JWS)다.
// 서버가 직접 확인한다: ① 머리의 인증서 사슬(x5c)이 Apple Root CA - G3(certs/, SHA-256 63:34:3A…:91:79)까지 이어지는지
// ② 각 인증서 기간 ③ 맨 아래 인증서의 키로 ES256 서명 ④ 번들 ID · 상품 · 환불 여부.
// Apple 서버에 묻지 않아도 위조할 수 없다(Apple 개인키 없이는 서명 불가). 환불 알림(App Store Server Notifications)은 다음 단계.
// 심사(App Review)는 샌드박스로 산다 — 샌드박스 구매도 받아들이되 sandbox 로 표시한다(Apple 안내: 운영 서버가 샌드박스도 처리해야 함).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BUNDLE_ID = 'com.emoticonstudio.app';
const ROOT = new crypto.X509Certificate(fs.readFileSync(path.join(__dirname, 'certs', 'AppleRootCA-G3.pem')));
const ROOT_FINGERPRINT = '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79';
if (ROOT.fingerprint256 !== ROOT_FINGERPRINT) throw new Error('Apple root certificate mismatch');

const part = s => JSON.parse(Buffer.from(String(s || ''), 'base64url').toString('utf8'));
const der = b64 => new crypto.X509Certificate(Buffer.from(b64, 'base64'));

// 서명된 거래 하나 → 확인된 내용. 틀리면 이유를 던진다.
function verifyTransaction(jws, { now = Date.now(), root = ROOT, bundleId = BUNDLE_ID } = {}) {
  const [h, p, s] = String(jws || '').split('.');
  if (!h || !p || !s) throw new Error('apple jws shape');
  const header = part(h);
  if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length < 2) throw new Error('apple alg/x5c');
  const chain = header.x5c.map(der);
  // 사슬: leaf ← intermediate ← … ← Apple Root G3. 각 인증서는 다음 인증서가 서명했고, 마지막은 루트가 서명했다.
  const when = new Date(now);
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i], issuer = chain[i + 1] || root;
    if (!(new Date(c.validFrom) <= when && when <= new Date(c.validTo))) throw new Error('apple cert expired');
    if (!c.verify(issuer.publicKey)) throw new Error('apple cert chain');
  }
  if (chain[chain.length - 1].fingerprint256 !== root.fingerprint256 && !chain[chain.length - 1].verify(root.publicKey)) throw new Error('apple root');
  const ok = crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: chain[0].publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('apple signature');
  const t = part(p);
  if (t.bundleId !== bundleId) throw new Error('apple bundle');
  if (!t.productId || !t.originalTransactionId) throw new Error('apple fields');
  return { productId: String(t.productId), originalTransactionId: String(t.originalTransactionId), transactionId: String(t.transactionId || ''),
    revoked: !!t.revocationDate, sandbox: t.environment !== 'Production', type: String(t.type || '') };
}
module.exports = { verifyTransaction, BUNDLE_ID, ROOT_FINGERPRINT };
