// 영수증 확인 서버의 판정 규칙. 네트워크 없이 순수 함수만 본다 — 실제 스토어 호출은 서비스 계정
// 키가 있어야 하고, 그건 외부 차단이다. 여기서 통과했다고 "실제 구매 검증 완료"가 아니다.
const assert = require('node:assert/strict');
const { decide } = require('../server/verify-receipt.js');

const now = '2026-09-12T00:00:00Z';
const future = '2026-10-12T00:00:00Z';
const past = '2026-08-12T00:00:00Z';
const ask = { productId: 'pro_monthly', purchaseToken: 'token', platform: 'android' };
const live = (over = {}) => ({
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  lineItems: [{ productId: 'pro_monthly', expiryTime: future }],
  ...over,
});

// ── 통과 ────────────────────────────────────────────────────────────────────────────────────
const ok = decide(live(), ask, { now });
assert.equal(ok.verified, true, '살아 있는 구독은 통과한다');
assert.equal(ok.plan, 'monthly', '상품 번호에서 플랜을 읽는다');
assert.equal(ok.expiresAt, future, '만료 시각을 그대로 전한다');
assert.equal(decide(live({ subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' }), ask, { now }).verified, true, '유예 기간도 이용 중이다');
assert.equal(decide(live({ lineItems: [{ productId: 'pro_yearly', expiryTime: future }] }), { ...ask, productId: 'pro_yearly' }, { now }).plan, 'yearly', '연간도 읽는다');

// ── 거절 ────────────────────────────────────────────────────────────────────────────────────
for (const state of ['SUBSCRIPTION_STATE_CANCELED', 'SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_PAUSED', undefined])
  assert.equal(decide(live({ subscriptionState: state }), ask, { now }).verified, false, '이용 중이 아니면 거절: ' + state);
assert.equal(decide(live({ lineItems: [{ productId: 'pro_monthly', expiryTime: past }] }), ask, { now }).verified, false, '기간이 지났으면 거절');
assert.equal(decide(live({ lineItems: [{ productId: 'other_app_product', expiryTime: future }] }), ask, { now }).verified, false, '다른 상품이면 거절');
assert.equal(decide(live({ lineItems: [{ productId: 'pro_yearly', expiryTime: future }] }), ask, { now }).verified, false, '요청한 상품과 다르면 거절 — 월간을 물었는데 연간이 왔다');
assert.equal(decide(null, ask, { now }).verified, false, '스토어 응답이 없으면 거절');
assert.equal(decide({}, ask, { now }).verified, false, '빈 응답도 거절');

// ── 테스트 구매: 서버 설정이 정한다 ──────────────────────────────────────────────────────────
// 공식 레퍼런스(purchases.subscriptionsv2)의 testPurchase 필드. 라이선스 테스터 구매에 붙는다.
const test = live({ testPurchase: {} });
const production = decide(test, ask, { now });
assert.equal(production.verified, false, '운영 설정에서는 테스트 구매를 받지 않는다');
assert.equal(production.sandbox, true, '테스트 구매였다는 사실은 그대로 전한다');
const internal = decide(test, ask, { now, acceptTestPurchases: true });
assert.equal(internal.verified, true, '내부 테스트 설정에서는 받는다 — 아니면 우리가 결제 흐름을 확인할 수 없다');
assert.equal(internal.sandbox, true, '그때도 테스트 구매 표시는 남는다');

console.log('PASS: 서버 판정 — 살아 있는 구독만 통과, 상품·기간·상태가 어긋나면 거절, 테스트 구매는 서버 설정이 정하고 그 사실이 응답에 남는다. 실제 스토어 호출은 서비스 계정 키가 있어야 하므로 여기서 검증하지 않는다.');
