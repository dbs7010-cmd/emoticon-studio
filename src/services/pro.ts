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
  { id: 'lifetime' as const, label: '한 번 구매 · 계속 이용' },
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
export const REVIEW_BUILD_NOTE = '내부 검수용 빌드예요. PRO 기능을 결제 없이 켜서 확인할 수 있고, 이 권한은 구매가 아니며 출시 앱으로 넘어가지 않아요.';
// 개발 실행에서 켰을 때의 안내. 검수 APK 와 구분해 적는다 — 어느 쪽에서 본 결과인지 헷갈리면 안 된다.
export const REVIEW_DEV_NOTE = '개발 실행이라 PRO 기능을 결제 없이 켜서 확인할 수 있어요. 구매가 아니고, 출시 앱에서는 이 스위치가 없어요.';
// 지금 환경의 이름. 화면이 스스로 무엇인지 말하게 한다.
export const reviewEnvLabel = (): string =>
  internalReviewBuild() ? '내부 검수용 빌드' : devBuild() ? '개발 실행' : '';

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
    return '영수증 확인 서버가 아직 없어서 이 빌드에서는 PRO를 켤 수 없어요. 결제는 진행되지 않습니다.';
  return null;
}
export function expiredButRemembered(entitlement: Entitlement | undefined, now = new Date()): boolean {
  return !!entitlement && entitlement.plan !== 'free' && !isPro(entitlement, now);
}
export function entitlementLabel(entitlement: Entitlement | undefined, now = new Date()): string {
  if (isPro(entitlement, now)) {
    if (entitlement!.plan === 'lifetime') return 'PRO 이용 중 · 한 번 구매';
    const until = entitlement!.expiresAt ? ` · ${new Date(entitlement!.expiresAt).toLocaleDateString('ko-KR')}까지` : '';
    return `PRO 이용 중${until}`;
  }
  if (expiredButRemembered(entitlement, now)) return 'PRO 기간이 끝났어요. 만든 움직임은 그대로 재생·저장할 수 있어요.';
  return '무료';
}

// ── 구매·복원·재확인 ─────────────────────────────────────────────────────────────────────────
export type PaymentProblem = StoreProblem | 'server-missing' | 'server-unreachable' | 'refused' | 'store-account';
export type PurchaseOutcome =
  | { state: 'purchased'; entitlement: Entitlement }
  | { state: 'cancelled' }
  | { state: 'pending' }
  | { state: 'none' }
  | { state: 'failed'; problem: PaymentProblem };
// 테스트가 서버 주소·네트워크·시각을 넣을 수 있는 자리. 앱은 빌드 설정의 주소를 쓴다.
export type PaymentOptions = { endpoint?: string; fetchImpl?: typeof fetch; now?: Date };

// 사람이 읽는 말. 스토어 오류 코드는 여기서 끝나고 화면에 나가지 않는다. 늘 **다음에 할 일**을 함께 준다.
export function problemText(problem: PaymentProblem | 'save'): { title: string; next: string; action?: 'restore' | 'retry' } {
  switch (problem) {
    case 'purchases-closed': return { title: 'PRO 구매 준비 중', next: PURCHASES_CLOSED_NOTE };
    case 'store-missing': return { title: '이 기기에서는 결제를 열 수 없어요', next: 'Play 스토어에서 받은 앱에서 결제할 수 있어요. 무료 기능은 그대로 쓸 수 있어요.' };
    case 'network': return { title: '스토어에 연결하지 못했어요', next: '인터넷 연결을 확인하고 다시 시도해 주세요. 결제는 진행되지 않았어요.', action: 'retry' };
    case 'store-unavailable': return { title: '지금은 스토어 결제를 쓸 수 없어요', next: 'Play 스토어에 로그인되어 있는지 확인하고 잠시 뒤 다시 시도해 주세요.', action: 'retry' };
    case 'not-found': return { title: 'PRO 상품을 불러오지 못했어요', next: '잠시 뒤 다시 시도해 주세요. 계속되면 앱을 최신 버전으로 업데이트해 주세요.', action: 'retry' };
    case 'already-owned': return { title: '이미 PRO를 가지고 있어요', next: '한 번 산 PRO 예요. 구매 복원을 누르면 이 기기에서도 켜져요 — 다시 결제되지 않아요.', action: 'restore' };
    case 'server-missing': return { title: '구매 확인을 아직 할 수 없어요', next: '결제가 됐다면 확인되지 않은 결제는 스토어가 3일 안에 자동으로 환불해요. 앱을 업데이트한 뒤 구매 복원을 눌러 주세요.' };
    case 'store-account': return { title: 'Play 스토어 계정이 필요해요', next: '기기의 Play 스토어에 로그인한 뒤 다시 시도해 주세요. 무료 기능은 그대로 쓸 수 있어요.' };
    case 'server-unreachable': return { title: '결제 확인을 마치지 못했어요', next: '인터넷 연결을 확인하고 구매 복원을 눌러 주세요. 확인되기 전에는 결제가 확정되지 않아요.', action: 'restore' };
    case 'refused': return { title: '이 구매를 확인하지 못했어요', next: 'Play 스토어의 구매 내역을 확인해 주세요. 결제가 됐는데 계속 안 되면 문의해 주세요.' };
    case 'save': return { title: '구매는 확인했지만 저장하지 못했어요', next: '구매 복원을 누르면 다시 켜져요. 추가 결제는 없어요.', action: 'restore' };
    default: return { title: '결제를 마치지 못했어요', next: '잠시 뒤 다시 시도해 주세요. 결제가 됐다면 구매 복원으로 켤 수 있어요.', action: 'restore' };
  }
}

// 스토어가 "샀다"고 해도 그것만으로는 PRO 가 열리지 않는다. 우리 서버가 스토어에 직접 물어보고
// 확인해 준 것만 `verified` 를 받고, 그다음에야 구매를 확정(acknowledge)한다.
async function confirm(productId: string, token: string, purchase: StorePurchase, options: PaymentOptions): Promise<PurchaseOutcome> {
  const verdict = await verifyReceipt(
    { platform: Platform.OS === 'ios' ? 'ios' : 'android', productId, purchaseToken: token },
    { endpoint: options.endpoint ?? RECEIPT_ENDPOINT, fetchImpl: options.fetchImpl, now: options.now },
  );
  if (verdict.state === 'verified') { await finishPurchase(purchase); return { state: 'purchased', entitlement: verdict.entitlement }; }
  if (verdict.state === 'not-configured') return { state: 'failed', problem: 'server-missing' };
  if (verdict.state === 'unreachable') return { state: 'failed', problem: 'server-unreachable' };
  return { state: 'failed', problem: 'refused' };
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
