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

// ── 비소모성 일회성 상품(45.28차) ────────────────────────────────────────────────────────────
// Play 의 purchases.products 응답: purchaseState 0 = 구매됨 · 1 = 취소됨 · 2 = 보류,
// purchaseType 0 = 라이선스 테스터. 기간이 없으므로 expiresAt 을 주지 않는다.
const askOnce = { productId: 'pro_lifetime', purchaseToken: 'token', platform: 'android' };
const boughtOnce = (over = {}) => ({ productId: 'pro_lifetime', purchaseState: 0, consumptionState: 0, acknowledgementState: 1, ...over });

const once = decide(boughtOnce(), askOnce, { now });
assert.equal(once.verified, true, '구매된 일회성 상품은 통과한다');
assert.equal(once.plan, 'lifetime', '일회성 상품의 플랜 이름');
assert.equal(once.expiresAt, undefined, '한 번 사면 끝나므로 기한을 주지 않는다');
// 먼 미래 시각으로 물어도 통과한다 — 기간이라는 개념이 없다.
assert.equal(decide(boughtOnce(), askOnce, { now: '2099-01-01T00:00:00Z' }).verified, true, '몇 년이 지나도 통과한다');
assert.equal(decide(boughtOnce({ purchaseState: 1 }), askOnce, { now }).verified, false, '취소된 구매는 거절');
assert.equal(decide(boughtOnce({ purchaseState: 2 }), askOnce, { now }).verified, false, '보류 중인 결제는 거절');
assert.equal(decide(boughtOnce({ productId: 'other_app_product' }), askOnce, { now }).verified, false, '다른 상품이면 거절');
assert.equal(decide(null, askOnce, { now }).verified, false, '응답이 없으면 거절');
// 구독 응답 모양이 잘못 올라와도 통과시키지 않는다(purchaseState 가 0 이 아니다).
assert.equal(decide(live(), askOnce, { now }).verified, false, '일회성 상품에 구독 응답이 오면 거절');
const onceTest = boughtOnce({ purchaseType: 0 });
assert.deepEqual([decide(onceTest, askOnce, { now }).verified, decide(onceTest, askOnce, { now }).sandbox], [false, true], '운영 설정에서는 테스트 구매를 받지 않고, 그 사실은 남긴다');
assert.equal(decide(onceTest, askOnce, { now, acceptTestPurchases: true }).verified, true, '내부 테스트 설정에서는 받는다');
// 45.40 테스터 보상(docs/closed-test/08): Play 프로모션 코드로 받은 구매(purchaseType 1)는 **운영 설정에서도** 정식 구매로 인정한다.
// 테스트 구매로 표시하지 않고(sandbox 없음), 기한도 없다. 대신 상태·상품이 어긋나면 일반 구매와 똑같이 거절한다.
const promo = boughtOnce({ purchaseType: 1 });
const promoOk = decide(promo, askOnce, { now });
assert.equal(promoOk.verified, true, '프로모션 코드 구매는 운영 설정에서 인정한다');
assert.equal(promoOk.sandbox, undefined, '프로모션 구매는 테스트 구매로 표시하지 않는다');
assert.equal(promoOk.plan, 'lifetime'); assert.equal(promoOk.expiresAt, undefined, '프로모션 구매도 기한이 없다(pro_lifetime)');
assert.equal(decide(boughtOnce({ purchaseType: 1, purchaseState: 1 }), askOnce, { now }).verified, false, '취소된 프로모션 구매는 거절');
assert.equal(decide(boughtOnce({ purchaseType: 1, purchaseState: 2 }), askOnce, { now }).verified, false, '보류 중인 프로모션 구매는 거절');
assert.equal(decide(boughtOnce({ purchaseType: 1, productId: 'other_app_product' }), askOnce, { now }).verified, false, '다른 상품의 프로모션 구매는 거절');
assert.equal(decide(promo, { ...askOnce, productId: 'not_ours' }, { now }).verified, false, '우리 상품이 아닌 요청은 프로모션이어도 거절');

console.log('PASS: 서버 판정 — 비소모성 일회성 상품은 구매 상태만 보고 기한 없이 통과(취소·보류·다른 상품·구독 응답은 거절), 예전 구독은 살아 있는 것만 통과하고 상품·기간·상태가 어긋나면 거절, 테스트 구매는 서버 설정이 정하고 그 사실이 응답에 남는다. 프로모션 코드 구매는 운영 설정에서도 인정(테스트 표시 없음·기한 없음)하고, 취소·보류·다른 상품·우리 상품 아님은 거절한다. 실제 스토어 호출은 서비스 계정 키가 있어야 하므로 여기서 검증하지 않는다.');
