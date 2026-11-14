// The only door PRO can come through: a thin layer over `expo-iap` (OpenIAP, hyochan).
//
// Module choice: `expo-iap` 5.x. Expo lists it next to react-native-purchases (RevenueCat) for
// in-app purchases; it needs a native build (this app already ships one) and cannot run in Expo Go.
// It is loaded at call time so a build or a test without the native side still runs everything
// else, and its absence is reported as absence — never as a refusal and never as a purchase.
//
// TRUST BOUNDARY: nothing here grants PRO. This file only talks to the store and hands back what
// the store said. `pro.ts` sends the purchase token to our receipt server, and only a verified
// answer becomes an entitlement. A purchase is finished (acknowledged) only after that answer.
import { Platform } from 'react-native';
import { purchasesClosed } from './purchase-config';

// 45.28: PRO 는 **한 번 사면 끝나는 비소모성 일회성 상품** 하나다(구독 아님). 소비되지 않으므로
// 스토어 계정에 계속 남고, 다시 설치해도 복원으로 돌아온다.
export const PRODUCT_IDS = { lifetime: 'pro_lifetime' } as const;
export type PlanId = keyof typeof PRODUCT_IDS;
// 예전 구독 상품 id. **새로 팔지 않는다.** 스토어 계정이나 저장본에 남아 있을 수 있어 복원에서
// 알아보기만 한다 — 남의 구매를 못 본 척해서 이용권을 잃게 하지 않는다.
export const LEGACY_PRODUCT_IDS: Record<string, string> = { pro_monthly: 'monthly', pro_yearly: 'yearly' };
export const isOurProduct = (productId: string): boolean =>
  productId === PRODUCT_IDS.lifetime || productId in LEGACY_PRODUCT_IDS;

// What went wrong, in words the screen can turn into a next step. Raw store codes stay in here.
export type StoreProblem = 'purchases-closed' | 'store-missing' | 'network' | 'store-unavailable' | 'not-found' | 'already-owned' | 'unknown';

// 할인(2026-10-20): Play Console 의 일회성 상품 할인 offer 가 있으면 localizedPrice 는 할인가, regularPrice 는 정가, offerToken 은 결제에 넘긴다.
export type StoreProduct = { id: string; plan: PlanId; title: string; localizedPrice: string; regularPrice?: string; offerToken?: string; discountPercent?: number };
// Only the fields this app relies on. `purchaseToken` is the Android purchase token (Play) and the
// signed transaction (JWS) on iOS.
export type StorePurchase = { productId: string; purchaseToken?: string | null; purchaseState?: string; transactionDate?: number; isSuspendedAndroid?: boolean | null; platform?: string };
export type ProductsResult = { state: 'ok'; products: StoreProduct[] } | { state: 'unavailable'; problem: StoreProblem };
// 상품 id 를 그대로 들고 다닌다 — 서버가 무엇을 확인해야 하는지는 상품 id 가 말한다.
export type PurchaseResult =
  | { state: 'purchased'; productId: string; token: string; purchase: StorePurchase }
  | { state: 'cancelled' }
  | { state: 'pending' }
  | { state: 'unavailable'; problem: StoreProblem };
export type RestoreResult =
  | { state: 'found'; productId: string; token: string; purchase: StorePurchase }
  | { state: 'none' }
  | { state: 'unavailable'; problem: StoreProblem };

type Listener = { remove: () => void };
export type IapModule = {
  initConnection: () => Promise<unknown>;
  fetchProducts: (request: { skus: string[]; type?: 'in-app' | 'subs' | 'all' }) => Promise<any[] | null>;
  requestPurchase: (args: any) => Promise<unknown>;
  getAvailablePurchases: (options?: any) => Promise<any[]>;
  finishTransaction: (args: { purchase: any; isConsumable?: boolean }) => Promise<unknown>;
  purchaseUpdatedListener: (listener: (purchase: any) => void) => Listener;
  purchaseErrorListener: (listener: (error: any) => void) => Listener;
};

let injected: IapModule | null | undefined;
// Tests hand in a fake store here. The app never calls this.
export function useStoreModuleForTests(module: IapModule | null | undefined) { injected = module; connected = false; }
function loadModule(): IapModule | null {
  if (injected !== undefined) return injected;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('expo-iap') as Partial<IapModule>;
    return typeof module?.initConnection === 'function' && typeof module.requestPurchase === 'function' ? module as IapModule : null;
  } catch { return null; }
}
export const storeModuleAvailable = () => !purchasesClosed() && loadModule() !== null;

let connected = false;
async function connect(iap: IapModule) { if (!connected) { await iap.initConnection(); connected = true; } }

// The token our server needs. On Android that is the Play purchase token and nothing else: an order
// id or a raw receipt cannot be looked up with the Play Developer API, so it is never substituted.
export function tokenOf(purchase: StorePurchase | null | undefined, platform: string = Platform.OS): string {
  if (!purchase) return '';
  const token = typeof purchase.purchaseToken === 'string' ? purchase.purchaseToken.trim() : '';
  if (platform === 'android') return token;
  // iOS: OpenIAP puts the signed transaction (JWS) in the same unified field.
  return token;
}

// Store error codes (OpenIAP ErrorCode values) → what the person can do about it.
export function problemOf(error: unknown): StoreProblem | 'cancelled' | 'pending' {
  const code = String((error as { code?: unknown })?.code ?? '').toLowerCase();
  if (code === 'user-cancelled' || /cancel/i.test(String((error as { message?: unknown })?.message ?? ''))) return 'cancelled';
  if (code === 'pending' || code === 'deferred-payment') return 'pending';
  if (code === 'already-owned') return 'already-owned';
  if (['network-error', 'service-timeout', 'service-disconnected', 'connection-closed', 'remote-error', 'interrupted'].includes(code)) return 'network';
  if (['billing-unavailable', 'iap-not-available', 'feature-not-supported', 'service-error', 'init-connection', 'not-prepared'].includes(code)) return 'store-unavailable';
  if (['item-unavailable', 'sku-not-found', 'empty-sku-list', 'sku-offer-mismatch', 'developer-error'].includes(code)) return 'not-found';
  return 'unknown';
}

export async function listProducts(): Promise<ProductsResult> {
  if (purchasesClosed()) return { state: 'unavailable', problem: 'purchases-closed' };
  const iap = loadModule();
  if (!iap) return { state: 'unavailable', problem: 'store-missing' };
  try {
    await connect(iap);
    // 일회성 상품은 'in-app' 이다. 구독 offer token 이 없고, 있어야 할 것도 아니다.
    const found = (await iap.fetchProducts({ skus: [PRODUCT_IDS.lifetime], type: 'in-app' })) ?? [];
    const products = found.flatMap((p: any): StoreProduct[] => {
      const id = String(p?.id ?? p?.productId ?? '');
      if (id !== PRODUCT_IDS.lifetime) return [];
      const regular = String(p.displayPrice ?? '');
      // 할인 offer: offer token 이 있고 정가보다 싼 것(퍼센트 또는 금액 할인)만. 없으면 정가 그대로.
      const offer = (Array.isArray(p.discountOffers) ? p.discountOffers : []).find((o: any) => o?.offerTokenAndroid && o?.displayPrice && (Number(o.percentageDiscountAndroid) > 0 || Number(o.discountAmountMicrosAndroid) > 0));
      if (!offer) return [{ id, plan: 'lifetime', title: String(p.title ?? ''), localizedPrice: regular }];
      return [{ id, plan: 'lifetime', title: String(p.title ?? ''), localizedPrice: String(offer.displayPrice), regularPrice: regular, offerToken: String(offer.offerTokenAndroid), ...(Number(offer.percentageDiscountAndroid) > 0 ? { discountPercent: Number(offer.percentageDiscountAndroid) } : {}) }];
    });
    if (!products.length) return { state: 'unavailable', problem: 'not-found' };
    return { state: 'ok', products };
  } catch (e) {
    const problem = problemOf(e);
    return { state: 'unavailable', problem: problem === 'cancelled' || problem === 'pending' ? 'unknown' : problem };
  }
}

// The store answers a purchase through listeners, not through the returned promise. This waits for
// the first answer about *our* product, then lets go of both listeners.
export async function buy(options: { timeoutMs?: number } = {}): Promise<PurchaseResult> {
  if (purchasesClosed()) return { state: 'unavailable', problem: 'purchases-closed' };
  const iap = loadModule();
  if (!iap) return { state: 'unavailable', problem: 'store-missing' };
  const sku = PRODUCT_IDS.lifetime;
  try {
    await connect(iap);
    // 일회성 상품은 스토어에 등록되어 있어야 살 수 있다. 목록에 없으면 그 사실대로 알린다.
    let offerToken: string | undefined;
    if (Platform.OS === 'android') {
      const listed = await listProducts();
      if (listed.state !== 'ok') return listed;
      const product = listed.products.find(p => p.id === sku);
      if (!product) return { state: 'unavailable', problem: 'not-found' };
      offerToken = product.offerToken;   // 화면에 보인 할인가로 결제한다(없으면 정가)
    }
    return await new Promise<PurchaseResult>(resolve => {
      let settled = false;
      const subs: Listener[] = [];
      const finish = (result: PurchaseResult) => { if (settled) return; settled = true; clearTimeout(timer); subs.forEach(s => { try { s.remove(); } catch { /* already gone */ } }); resolve(result); };
      const timer = setTimeout(() => finish({ state: 'pending' }), options.timeoutMs ?? 10 * 60 * 1000);
      subs.push(iap.purchaseUpdatedListener((purchase: StorePurchase) => {
        if (!purchase || purchase.productId !== sku) return;
        if (purchase.purchaseState === 'pending') return finish({ state: 'pending' });
        const token = tokenOf(purchase);
        if (!token) return finish({ state: 'pending' });
        finish({ state: 'purchased', productId: sku, token, purchase });
      }));
      subs.push(iap.purchaseErrorListener((error: unknown) => {
        const problem = problemOf(error);
        finish(problem === 'cancelled' ? { state: 'cancelled' } : problem === 'pending' ? { state: 'pending' } : { state: 'unavailable', problem });
      }));
      iap.requestPurchase({
        type: 'in-app',
        request: { apple: { sku }, google: { skus: [sku], ...(offerToken ? { offerToken } : {}) } },
      }).catch((error: unknown) => {
        const problem = problemOf(error);
        finish(problem === 'cancelled' ? { state: 'cancelled' } : problem === 'pending' ? { state: 'pending' } : { state: 'unavailable', problem });
      });
    });
  } catch (e) {
    const problem = problemOf(e);
    return problem === 'cancelled' ? { state: 'cancelled' } : problem === 'pending' ? { state: 'pending' } : { state: 'unavailable', problem };
  }
}

// What the store account currently holds for our products. Suspended (payment failed) and pending
// purchases are not counted; the newest live one wins.
export async function ownedPurchase(): Promise<RestoreResult> {
  if (purchasesClosed()) return { state: 'unavailable', problem: 'purchases-closed' };
  const iap = loadModule();
  if (!iap) return { state: 'unavailable', problem: 'store-missing' };
  try {
    await connect(iap);
    const owned = (await iap.getAvailablePurchases()) ?? [];
    const live = (owned as StorePurchase[])
      .filter(p => isOurProduct(String(p?.productId ?? '')) && p.purchaseState !== 'pending' && !p.isSuspendedAndroid && tokenOf(p))
      // 일회성 PRO 가 있으면 그것이 먼저다. 그다음은 최근 것.
      .sort((a, b) => (b.productId === PRODUCT_IDS.lifetime ? 1 : 0) - (a.productId === PRODUCT_IDS.lifetime ? 1 : 0) || (b.transactionDate ?? 0) - (a.transactionDate ?? 0));
    const match = live[0];
    if (!match) return { state: 'none' };
    return { state: 'found', productId: String(match.productId), token: tokenOf(match), purchase: match };
  } catch (e) {
    const problem = problemOf(e);
    return { state: 'unavailable', problem: problem === 'cancelled' || problem === 'pending' ? 'unknown' : problem };
  }
}

// 서버가 확인한 뒤에만 구매를 확정(acknowledge)한다. Play 는 3일 동안 확정되지 않은 구매를 자동
// 환불하므로, 확인되지 않은 것은 일부러 열어 둔다 — `ownedPurchase` 로 다시 올라와 다음 복원이나
// 앱 시작에서 확인된다. **isConsumable: false** — 비소모성이라 소비 처리하지 않는다(다시 팔지 않는다).
export async function finishPurchase(purchase: StorePurchase): Promise<boolean> {
  if (purchasesClosed()) return false;
  const iap = loadModule();
  if (!iap) return false;
  try { await iap.finishTransaction({ purchase, isConsumable: false }); return true; }
  catch { return false; }
}
