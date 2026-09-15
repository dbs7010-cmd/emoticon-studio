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

export const PRODUCT_IDS = { monthly: 'pro_monthly', yearly: 'pro_yearly' } as const;
export type PlanId = keyof typeof PRODUCT_IDS;
export const planOf = (productId: string): PlanId | null =>
  productId === PRODUCT_IDS.yearly ? 'yearly' : productId === PRODUCT_IDS.monthly ? 'monthly' : null;

// What went wrong, in words the screen can turn into a next step. Raw store codes stay in here.
export type StoreProblem = 'store-missing' | 'network' | 'store-unavailable' | 'not-found' | 'already-owned' | 'unknown';

export type StoreProduct = { id: string; plan: PlanId; title: string; localizedPrice: string; offerToken?: string };
// Only the fields this app relies on. `purchaseToken` is the Android purchase token (Play) and the
// signed transaction (JWS) on iOS.
export type StorePurchase = { productId: string; purchaseToken?: string | null; purchaseState?: string; transactionDate?: number; isSuspendedAndroid?: boolean | null; platform?: string };
export type ProductsResult = { state: 'ok'; products: StoreProduct[] } | { state: 'unavailable'; problem: StoreProblem };
export type PurchaseResult =
  | { state: 'purchased'; plan: PlanId; token: string; purchase: StorePurchase }
  | { state: 'cancelled' }
  | { state: 'pending' }
  | { state: 'unavailable'; problem: StoreProblem };
export type RestoreResult =
  | { state: 'found'; plan: PlanId; token: string; purchase: StorePurchase }
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
export const storeModuleAvailable = () => loadModule() !== null;

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
  const iap = loadModule();
  if (!iap) return { state: 'unavailable', problem: 'store-missing' };
  try {
    await connect(iap);
    const found = (await iap.fetchProducts({ skus: [PRODUCT_IDS.monthly, PRODUCT_IDS.yearly], type: 'subs' })) ?? [];
    const products = found.flatMap((p: any): StoreProduct[] => {
      const id = String(p?.id ?? p?.productId ?? ''), plan = planOf(id);
      if (!plan) return [];
      const offer = Array.isArray(p.subscriptionOffers) ? p.subscriptionOffers.find((o: any) => o?.offerTokenAndroid) : undefined;
      return [{ id, plan, title: String(p.title ?? ''), localizedPrice: String(p.displayPrice ?? ''), offerToken: offer?.offerTokenAndroid ?? undefined }];
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
export async function buy(plan: PlanId, options: { timeoutMs?: number } = {}): Promise<PurchaseResult> {
  const iap = loadModule();
  if (!iap) return { state: 'unavailable', problem: 'store-missing' };
  const sku = PRODUCT_IDS[plan];
  try {
    await connect(iap);
    // Play subscriptions must name an offer; the token comes from the product the store just listed.
    let offerToken: string | undefined;
    if (Platform.OS === 'android') {
      const listed = await listProducts();
      if (listed.state !== 'ok') return listed;
      offerToken = listed.products.find(p => p.id === sku)?.offerToken;
      if (!offerToken) return { state: 'unavailable', problem: 'not-found' };
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
        finish({ state: 'purchased', plan, token, purchase });
      }));
      subs.push(iap.purchaseErrorListener((error: unknown) => {
        const problem = problemOf(error);
        finish(problem === 'cancelled' ? { state: 'cancelled' } : problem === 'pending' ? { state: 'pending' } : { state: 'unavailable', problem });
      }));
      iap.requestPurchase({
        type: 'subs',
        request: {
          apple: { sku },
          google: { skus: [sku], subscriptionOffers: offerToken ? [{ sku, offerToken }] : undefined },
        },
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
  const iap = loadModule();
  if (!iap) return { state: 'unavailable', problem: 'store-missing' };
  try {
    await connect(iap);
    const owned = (await iap.getAvailablePurchases()) ?? [];
    const live = (owned as StorePurchase[])
      .filter(p => planOf(p?.productId) && p.purchaseState !== 'pending' && !p.isSuspendedAndroid && tokenOf(p))
      .sort((a, b) => (b.transactionDate ?? 0) - (a.transactionDate ?? 0));
    const match = live[0];
    if (!match) return { state: 'none' };
    return { state: 'found', plan: planOf(match.productId)!, token: tokenOf(match), purchase: match };
  } catch (e) {
    const problem = problemOf(e);
    return { state: 'unavailable', problem: problem === 'cancelled' || problem === 'pending' ? 'unknown' : problem };
  }
}

// Acknowledge a subscription after our server confirmed it. Play refunds purchases left
// unacknowledged for 3 days, so an unverified one is deliberately left open: it comes back through
// `ownedPurchase` and is confirmed on the next restore or app start.
export async function finishPurchase(purchase: StorePurchase): Promise<boolean> {
  const iap = loadModule();
  if (!iap) return false;
  try { await iap.finishTransaction({ purchase, isConsumable: false }); return true; }
  catch { return false; }
}
