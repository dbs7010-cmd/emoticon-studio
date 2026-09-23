// 영수증 확인 서버 — 최소 구현.
//
// 앱은 "샀다"고 말할 수 없다. 스토어가 준 구매 토큰을 이 서버가 **구글 플레이에 직접 물어보고**,
// 그 대답만으로 이용권을 만든다. 비밀 키는 여기에만 있고 앱에는 들어가지 않는다.
//
// 이 파일은 코드다. **배포된 서버가 아니다.** 돌리려면 아래가 필요하고, 그것은 외부 차단이다:
//   GOOGLE_SERVICE_ACCOUNT_JSON  구글 플레이 콘솔에서 만든 서비스 계정 키(JSON 문자열 또는 파일 경로)
//   ANDROID_PACKAGE_NAME         com.emoticonstudio.app
//   ACCEPT_TEST_PURCHASES        내부 테스트 트랙에서만 'true'. 운영 배포에서는 비워 둔다.
//
// 상품: `pro_lifetime` — **비소모성 일회성 상품**(Play 콘솔의 '앱 내 상품'). 구독이 아니므로 기간이
// 없고, 소비 처리하지 않으며(consume 금지), 스토어 계정에 남아 복원으로 돌아온다.
//
// 왜 테스트 구매를 서버가 판단하는가: 라이선스 테스터의 구매는 Play API 응답에 `testPurchase` 가
// 붙는다(공식 레퍼런스 purchases.subscriptionsv2). 앱이 테스트 구매를 무조건 거절하면 **우리 내부
// 테스트와 심사에서 결제 흐름이 막힌다.** 그래서 받아들일지 말지는 배포 환경마다 다른 설정이고,
// 앱이 아니라 서버가 정한다 — 앱 안의 값은 누구나 고칠 수 있기 때문이다.

const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');

// 지금 파는 것은 비소모성 일회성 상품 하나다(45.28차). 구독 두 상품은 팔지 않지만, 예전 토큰이
// 올라올 수 있어 판정 규칙만 남겨 둔다 — 이미 산 사람의 이용권을 못 본 척하지 않는다.
const PRODUCTS = { pro_lifetime: 'lifetime', pro_monthly: 'monthly', pro_yearly: 'yearly' };
const ONE_TIME = new Set(['pro_lifetime']);

// ── 순수 판정 ────────────────────────────────────────────────────────────────────────────────
// 네트워크 없이 검사할 수 있게 따로 뺐다. 서버의 진짜 규칙은 전부 여기 있다.
// 일회성 상품(purchases.products)과 구독(purchases.subscriptionsv2)은 응답 모양이 달라 길이 갈린다.
const fallbackPlan = request => PRODUCTS[request && request.productId] || 'lifetime';

// 일회성 상품 판정. Play 의 purchases.products 응답:
//   purchaseState 0 = 구매됨 · 1 = 취소됨 · 2 = 보류
//   consumptionState 0 = 아직 소비 안 됨(비소모성은 늘 0)
//   purchaseType 0 = 테스트(라이선스 테스터) · 1 = 프로모션 · 2 = 리워드
// 기간이 없으므로 expiresAt 을 주지 않는다 — 한 번 사면 끝난다.
function decideOneTime(purchase, request, options = {}) {
  const plan = PRODUCTS[request.productId];
  if (!plan) return { verified: false, plan: 'lifetime', reason: '우리 상품이 아니에요.' };
  if (purchase.productId !== undefined && purchase.productId !== request.productId)
    return { verified: false, plan, reason: '이 구매는 요청한 상품이 아니에요.' };
  if (purchase.purchaseState !== 0)
    return { verified: false, plan, reason: purchase.purchaseState === 2 ? '결제가 아직 보류 중이에요.' : '취소된 구매예요.' };
  const isTest = purchase.purchaseType === 0;
  if (isTest && !options.acceptTestPurchases)
    return { verified: false, plan, sandbox: true, reason: '테스트 구매는 이 서버 설정에서 받지 않아요.' };
  return { verified: true, plan, sandbox: isTest || undefined };
}

function decide(purchase, request, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  if (!purchase || typeof purchase !== 'object') return { verified: false, plan: fallbackPlan(request), reason: '스토어 응답을 읽지 못했어요.' };
  if (request && ONE_TIME.has(request.productId)) return decideOneTime(purchase, request, options);

  const lineItems = Array.isArray(purchase.lineItems) ? purchase.lineItems : [];
  const item = lineItems.find(l => l && l.productId === request.productId);
  if (!item) return { verified: false, plan: fallbackPlan(request), reason: '이 구매는 요청한 상품이 아니에요.' };

  const plan = PRODUCTS[item.productId];
  if (!plan) return { verified: false, plan: fallbackPlan(request), reason: '우리 상품이 아니에요.' };

  // 살아 있는 상태만 통과. 취소·만료·보류는 통과시키지 않는다.
  const live = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'];
  if (!live.includes(purchase.subscriptionState))
    return { verified: false, plan, reason: '지금 이용 중인 구독이 아니에요. (' + String(purchase.subscriptionState) + ')' };

  const expiry = item.expiryTime || purchase.expiryTime;
  if (expiry && new Date(expiry).getTime() <= now.getTime())
    return { verified: false, plan, reason: '기간이 이미 끝났어요.' };

  // 라이선스 테스터·내부 테스트 구매. 운영 배포에서는 받지 않지만, 내부 테스트 배포에서는 받아야
  // 우리 스스로 결제 흐름을 확인할 수 있다.
  const isTest = !!purchase.testPurchase;
  if (isTest && !options.acceptTestPurchases)
    return { verified: false, plan, sandbox: true, reason: '테스트 구매는 이 서버 설정에서 받지 않아요.' };

  return { verified: true, plan, expiresAt: expiry || undefined, sandbox: isTest || undefined };
}

// ── 구글 플레이에 묻기 ───────────────────────────────────────────────────────────────────────
function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 이 없습니다. 서비스 계정 키가 있어야 스토어에 물어볼 수 있습니다.');
  return JSON.parse(raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8'));
}
function post(host, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({ host, path, method: 'POST', headers: { 'content-length': Buffer.byteLength(data), ...headers } }, res => {
      let out = ''; res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}
function get(host, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, path, method: 'GET', headers }, res => {
      let out = ''; res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject); req.end();
  });
}
async function accessToken() {
  const key = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64(claim);
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await post('oauth2.googleapis.com', '/token',
    'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + unsigned + '.' + signature,
    { 'content-type': 'application/x-www-form-urlencoded' });
  if (res.status !== 200) throw new Error('토큰을 받지 못했습니다: ' + res.status + ' ' + res.body.slice(0, 200));
  return JSON.parse(res.body).access_token;
}
async function askPlay(purchaseToken, productId) {
  const pkg = process.env.ANDROID_PACKAGE_NAME;
  if (!pkg) throw new Error('ANDROID_PACKAGE_NAME 이 없습니다.');
  const token = await accessToken();
  // 일회성 상품은 purchases.products, 구독은 purchases.subscriptionsv2 로 묻는다.
  const path = ONE_TIME.has(productId)
    ? `/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
    : `/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await get('androidpublisher.googleapis.com', path, { authorization: 'Bearer ' + token });
  if (res.status !== 200) throw new Error('스토어가 ' + res.status + ' 를 돌려줬습니다: ' + res.body.slice(0, 200));
  return JSON.parse(res.body);
}

// ── 요청 처리 ────────────────────────────────────────────────────────────────────────────────
async function handle(request) {
  if (!request || request.platform !== 'android')
    return { status: 400, body: { verified: false, plan: 'lifetime', reason: '지금은 안드로이드 구매만 확인할 수 있어요.' } };
  if (!request.purchaseToken || !request.productId)
    return { status: 400, body: { verified: false, plan: 'lifetime', reason: '구매 정보가 비어 있어요.' } };
  try {
    const purchase = await askPlay(request.purchaseToken, request.productId);
    const verdict = decide(purchase, request, { acceptTestPurchases: process.env.ACCEPT_TEST_PURCHASES === 'true' });
    return { status: 200, body: verdict };
  } catch (e) {
    // 물어보지 못한 것은 "아니다"가 아니다. 앱이 구분할 수 있도록 5xx 로 돌려준다.
    return { status: 503, body: { verified: false, plan: fallbackPlan(request), reason: '스토어에 확인하지 못했어요.' }, error: String(e) };
  }
}

module.exports = { decide, decideOneTime, handle, PRODUCTS, ONE_TIME };

// 직접 실행하면 작은 HTTP 서버가 된다. 실제 배포는 외부 작업이다.
if (require.main === module) {
  const http = require('node:http');
  http.createServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 8192) req.destroy(); });
    req.on('end', async () => {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch { }
      const out = await handle(parsed);
      if (out.error) console.error(out.error);
      res.writeHead(out.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out.body));
    });
  }).listen(process.env.PORT || 8787, () => console.log('영수증 확인 서버 준비 (포트 ' + (process.env.PORT || 8787) + ')'));
}
