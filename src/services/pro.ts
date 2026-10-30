import { t } from '../i18n/index';
import type { Entitlement } from '../types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { buy, finishPurchase, listProducts, ownedPurchase, storeModuleAvailable, PRODUCT_IDS, type ProductsResult, type StoreProblem, type StorePurchase } from './purchase-adapter';
import { verifyReceipt } from './receipt';
import { purchasesClosed, PURCHASES_CLOSED_NOTE } from './purchase-config';
export { purchasesClosed, PURCHASES_CLOSED_NOTE, proTrial, PRO_TRIAL_NOTE } from './purchase-config';
export { storeModuleAvailable, PRODUCT_IDS };

// What PRO is allowed to be, in one place.
// Two rules run through everything here:
//   1. Nothing in the app may grant PRO by itself. Only a store purchase that our receipt server
//      confirmed with the store can, and it is written down only after that confirmation.
//   2. Losing PRO never takes work away. Effects already saved keep playing and keep exporting;
//      only making new PRO effects needs a live entitlement.
// 45.28: 파는 것은 하나다 — **한 번 사면 끝나는 비소모성 일회성 PRO**. 구독은 팔지 않는다.
// 45.29: 값은 **스토어가 말해 주는 것만** 화면에 적는다. 내부 기획의 후보 가격은 코드에 두지 않는다
// (문서 docs/IAP_AUDIT.md 에만 남긴다) — 제품 화면에 '미확정' 같은 내부 상태가 나가지 않게.
export const PLANS = [
  { id: 'lifetime' as const, label: t("release.p11") },
];

export const FREE_ENTITLEMENT: Entitlement = { plan: 'free', source: 'none' };

// True only in a development build. Anything that loosens a rule must be tied to this, so the
// looser path cannot exist in what ships.
export const devBuild = () => typeof __DEV__ !== 'undefined' && __DEV__ === true;

// 내부 검수 빌드인가. **__DEV__ 가 아니라 빌드 구성이 정한다** — 손으로 확인하는 내부 APK 는 Metro
// 없는 release 번들이라 __DEV__ 가 거짓이고, 그러면 정작 확인해야 할 그 APK 에서 동작하지 않는다.
// app.config.js 가 EMOTICON_INTERNAL_REVIEW=1 일 때만 이 값을 참으로 박아 넣는다. 출시 구성은 거짓이다.
export const internalReviewBuild = (): boolean =>
  (Constants.expoConfig?.extra as { internalReview?: boolean } | undefined)?.internalReview === true;

// 검수용 PRO 를 **볼 수 있고 켤 수 있는** 환경인가. 두 가지다:
//   ① 내부 검수 APK (EMOTICON_INTERNAL_REVIEW=1 로 빌드)
//   ② 개발 실행 (Expo Go / 개발 클라이언트 — __DEV__ 가 참)
// 출시 구성은 둘 다 거짓이므로 스위치가 그려지지도, 저장된 값이 권한으로 인정되지도 않는다.
export const reviewCapable = (): boolean => !purchasesClosed() && (internalReviewBuild() || devBuild());

// 검수용 임시 해제. **구매가 아니고 영수증도 아니다.** 그래서 Entitlement 안에 넣지 않고 따로 둔다 —
// 넣는 순간 언젠가 '이용권'으로 읽히고, 출시 앱으로 옮겨 갈 길이 생긴다. 저장소에 남더라도 출시
// 구성에서는 internalReviewBuild() 가 거짓이라 아무 효력이 없다. 작품은 그대로 남는다.
export const reviewUnlocked = (store: { reviewUnlock?: boolean } | undefined): boolean =>
  reviewCapable() && store?.reviewUnlock === true;

// 화면이 이 빌드가 무엇인지 스스로 말하게 한다. 검수용임을 숨기면 검수 결과를 출시 상태로 착각한다.
export const REVIEW_BUILD_NOTE = t("release.p12");
// 개발 실행에서 켰을 때의 안내. 검수 APK 와 구분해 적는다 — 어느 쪽에서 본 결과인지 헷갈리면 안 된다.
export const REVIEW_DEV_NOTE = t("release.p13");
// 지금 환경의 이름. 화면이 스스로 무엇인지 말하게 한다.
export const reviewEnvLabel = (): string =>
  internalReviewBuild() ? t("release.p14") : devBuild() ? t("release.p15") : '';

// An entitlement is live when a receipt says so and the term has not run out.
// "verified" is set only by a server that checked the receipt with Google/Apple. The store file is
// plain JSON anyone can edit, so a release build refuses "plan" and "source" on their own.
export function isPro(entitlement: Entitlement | undefined, now = new Date()): boolean {
  if (!entitlement || entitlement.plan === 'free') return false;
  if (entitlement.source !== 'store') return false;
  if (!entitlement.verified && !devBuild()) return false;
  if (!entitlement.expiresAt) return true;
  return new Date(entitlement.expiresAt).getTime() > now.getTime();
}
// Why PRO is off, when it is off for a reason the user cannot fix by paying again.
export function proBlockedReason(entitlement: Entitlement | undefined): string | null {
  if (!entitlement || entitlement.plan === 'free') return null;
  if (entitlement.source === 'store' && !entitlement.verified && !devBuild())
    return t("release.p16");
  return null;
}
export function expiredButRemembered(entitlement: Entitlement | undefined, now = new Date()): boolean {
  return !!entitlement && entitlement.plan !== 'free' && !isPro(entitlement, now);
}
export function entitlementLabel(entitlement: Entitlement | undefined, now = new Date()): string {
  if (isPro(entitlement, now)) {
    if (entitlement!.plan === 'lifetime') return t("release.p17");
    const until = entitlement!.expiresAt ? t("release.p47", { v0: (new Date(entitlement!.expiresAt).toLocaleDateString('ko-KR')) }) : '';
    return t("release.p48", { v0: (until) });
  }
  if (expiredButRemembered(entitlement, now)) return t("release.p18");
  return t("ui.free");
}

// ── 구매·복원·재확인 ─────────────────────────────────────────────────────────────────────────
export type PaymentProblem = StoreProblem | 'server-missing' | 'server-unreachable' | 'refused' | 'store-account' | 'signed-out';
export type PurchaseOutcome =
  | { state: 'purchased'; entitlement: Entitlement }
  | { state: 'cancelled' }
  | { state: 'pending' }
  | { state: 'none' }
  // reason: 서버가 거절하며 알려 준 문장(예: 다른 emoti 계정에 연결된 구매). 화면이 그대로 보여 준다(2026-10-15).
  | { state: 'failed'; problem: PaymentProblem; reason?: string };
// 테스트가 서버 주소·네트워크·시각을 넣을 수 있는 자리. 앱은 빌드 설정의 주소를 쓴다.
// authToken: 로그인 증명을 꺼내는 함수(2026-10-13) — 구매 확인 서버가 구매를 이 계정에 묶는다.
export type PaymentOptions = { endpoint?: string; fetchImpl?: typeof fetch; now?: Date; authToken?: () => Promise<string | null> };

// 사람이 읽는 말. 스토어 오류 코드는 여기서 끝나고 화면에 나가지 않는다. 늘 **다음에 할 일**을 함께 준다.
export function problemText(problem: PaymentProblem | 'save'): { title: string; next: string; action?: 'restore' | 'retry' } {
  switch (problem) {
    case 'purchases-closed': return { title: t("release.p20"), next: PURCHASES_CLOSED_NOTE };
    case 'store-missing': return { title: t("release.p21"), next: t("release.p22") };
    case 'network': return { title: t("release.p23"), next: t("release.p24"), action: 'retry' };
    case 'store-unavailable': return { title: t("release.p25"), next: t("release.p26"), action: 'retry' };
    case 'not-found': return { title: t("release.p27"), next: t("release.p28"), action: 'retry' };
    case 'already-owned': return { title: t("release.p29"), next: t("release.p30"), action: 'restore' };
    case 'server-missing': return { title: t("release.p31"), next: t("release.p32") };
    case 'store-account': return { title: t("release.p33"), next: t("release.p34") };
    case 'server-unreachable': return { title: t("release.p35"), next: t("release.p36"), action: 'restore' };
    case 'signed-out': return { title: t("release.p37"), next: t("release.p38"), action: 'restore' };
    case 'refused': return { title: t("release.p39"), next: t("release.p40") };
    case 'save': return { title: t("release.p41"), next: t("release.p42"), action: 'restore' };
    default: return { title: t("release.p43"), next: t("release.p44"), action: 'restore' };
  }
}

// 스토어가 "샀다"고 해도 그것만으로는 PRO 가 열리지 않는다. 우리 서버가 스토어에 직접 물어보고
// 확인해 준 것만 `verified` 를 받고, 그다음에야 구매를 확정(acknowledge)한다.
async function confirm(productId: string, token: string, purchase: StorePurchase, options: PaymentOptions): Promise<PurchaseOutcome> {
  const authToken = options.authToken ? await options.authToken().catch(() => null) : null;
  // 2026-10-15: 로그인 증명이 아직 없으면(앱을 막 열어 로그인을 되살리는 중 등) 서버에 묻지 않는다.
  // 물었다면 서버는 '로그인한 뒤'라며 거절하고, 앱을 열 때 다시 확인하는 흐름이 그 거절을 '구매 없음'으로 읽어 PRO 를 꺼 버렸다.
  if (options.authToken && !authToken) return { state: 'failed', problem: 'signed-out' };
  const verdict = await verifyReceipt(
    { platform: Platform.OS === 'ios' ? 'ios' : 'android', productId, purchaseToken: token },
    { endpoint: options.endpoint ?? RECEIPT_ENDPOINT, fetchImpl: options.fetchImpl, now: options.now, authToken },
  );
  if (verdict.state === 'verified') { await finishPurchase(purchase); return { state: 'purchased', entitlement: verdict.entitlement }; }
  if (verdict.state === 'not-configured') return { state: 'failed', problem: 'server-missing' };
  if (verdict.state === 'unreachable') return { state: 'failed', problem: 'server-unreachable' };
  return { state: 'failed', problem: 'refused', reason: verdict.reason };
}
export async function purchase(options: PaymentOptions = {}): Promise<PurchaseOutcome> {
  if (purchasesClosed()) return { state: 'failed', problem: 'purchases-closed' };
  const result = await buy();
  if (result.state === 'purchased') return confirm(result.productId, result.token, result.purchase, options);
  if (result.state === 'cancelled' || result.state === 'pending') return { state: result.state };
  return { state: 'failed', problem: result.problem };
}
export async function restore(options: PaymentOptions = {}): Promise<PurchaseOutcome> {
  if (purchasesClosed()) return { state: 'failed', problem: 'purchases-closed' };
  const owned = await ownedPurchase();
  if (owned.state === 'found') return confirm(owned.productId, owned.token, owned.purchase, options);
  if (owned.state === 'none') return { state: 'none' };
  return { state: 'failed', problem: owned.problem };
}
export const storePrices = (): Promise<ProductsResult> => purchasesClosed()
  ? Promise.resolve({ state: 'unavailable', problem: 'purchases-closed' }) : listProducts();

// 앱을 열 때 저장된 이용권을 스토어·서버에 다시 묻는다.
//   - 물어볼 수 없으면(모듈 없음·오프라인·서버 없음·서버 연결 실패) 저장된 것을 **그대로 둔다.**
//   - 스토어가 "이 계정에 구독이 없다"고 분명히 말하거나 서버가 거절하면, 살아 있던 이용권을 지금 끝낸다.
//     기록은 지우지 않는다 — 만든 PRO 작품이 그대로 재생·재저장되어야 하기 때문이다.
//   - 스토어에 살아 있는 구독이 있고 서버가 확인하면 새 기간으로 갱신한다(재설치 뒤 자동 복원 포함).
export type RefreshResult = { state: 'unchanged' } | { state: 'updated'; entitlement: Entitlement };
export async function refreshEntitlement(cached: Entitlement | undefined, options: PaymentOptions = {}): Promise<RefreshResult> {
  if (purchasesClosed()) return { state: 'unchanged' };
  if (!storeModuleAvailable()) return { state: 'unchanged' };
  const now = options.now ?? new Date();
  const end = (): RefreshResult => cached && cached.source === 'store' && isPro(cached, now)
    ? { state: 'updated', entitlement: { ...cached, expiresAt: now.toISOString(), checkedAt: now.toISOString() } }
    : { state: 'unchanged' };
  const owned = await ownedPurchase();
  if (owned.state === 'unavailable') return { state: 'unchanged' };
  if (owned.state === 'none') return end();
  const outcome = await confirm(owned.productId, owned.token, owned.purchase, options);
  if (outcome.state === 'purchased') return { state: 'updated', entitlement: outcome.entitlement };
  if (outcome.state === 'failed' && outcome.problem === 'refused') return end();
  return { state: 'unchanged' };
}

// 일회성 구매에는 해지가 없다. 대신 스토어의 구매 내역으로 보낸다 — 영수증·환불 문의는 그곳에서 한다.
export const purchaseHistoryUrl = () => 'https://play.google.com/store/account/orderhistory';
// 예전 구독 저장본을 가진 사람에게만 필요한 해지 화면. 새로 팔지는 않지만 길은 막지 않는다.
export const subscriptionManageUrl = (productId: string = PRODUCT_IDS.lifetime) =>
  `https://play.google.com/store/account/subscriptions?sku=${productId}&package=com.emoticonstudio.app`;

// 서버 주소는 빌드 설정에서 온다. 비밀 키는 서버에만 있고 앱에는 없다.
export const RECEIPT_ENDPOINT: string | undefined =
  (Constants.expoConfig?.extra as { receiptEndpoint?: string } | undefined)?.receiptEndpoint;
export const receiptServerReady = () => !!RECEIPT_ENDPOINT;
